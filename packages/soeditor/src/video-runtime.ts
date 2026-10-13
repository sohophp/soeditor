import videoDialogStyles from './video-dialog.css?inline';
import { createVideoPlayer, createYoutubePlayer } from './video-player.js';
import type { Editor } from '@soeditor/core';
import { visualEditingServiceToken } from '@soeditor/engine';
import {
    fileManagerServiceToken,
    type FileManagerKind,
} from '@soeditor/file-manager';
import { serializeHtmlFragment, type HtmlElement } from '@soeditor/html';
import type { DialogHandle, EditorUi } from '@soeditor/ui';
import type { AtomicViewContext } from '@soeditor/wysiwyg';
import type { CmsVideoOptions } from './video.js';
import { buildVideo, readVideo, type VideoValues } from './video-model.js';
import { attachYoutubeMetadata } from './youtube-metadata.js';
import {
    attribute,
    mediaElement,
    mediaUrl,
    youtubeId,
} from './video-policy.js';

export interface VideoRuntime {
    open(target?: AtomicViewContext): void;
    destroy(): void;
}

export function createVideoRuntime(
    editor: Editor,
    ui: EditorUi,
    options: CmsVideoOptions,
): VideoRuntime {
    const document = ui.element.ownerDocument;
    const handles = new Set<DialogHandle>();
    let destroyed = false;
    let editing: DialogHandle | undefined;
    let pending: { node: HtmlElement; target?: AtomicViewContext } | undefined;
    let currentTarget: AtomicViewContext | undefined;
    const t = (en: string): string => ui.translate(en);
    const editable = (): boolean =>
        !destroyed &&
        !ui.destroyed &&
        (editor.services.tryGet(visualEditingServiceToken)?.canEdit() ?? false);
    const service = () => editor.services.get(visualEditingServiceToken);
    editor.commands.register({
        id: 'cms.video.apply',
        label: 'Apply video',
        canExecute: editable,
        execute: () => {
            if (pending === undefined) return;
            if (pending.target !== undefined) {
                if (!pending.target.select())
                    throw new Error(
                        t('The video changed. Reopen its properties.'),
                    );
                pending.target.replace(pending.node);
            } else {
                ui.restoreEditingSelection();
                service().insertHtml(
                    serializeHtmlFragment({
                        type: 'document-fragment',
                        children: [pending.node],
                    }),
                );
            }
        },
    });
    editor.commands.register({
        id: 'cms.video.remove',
        label: 'Remove video',
        canExecute: () => editable() && currentTarget !== undefined,
        execute: () => {
            if (currentTarget?.select())
                service().removeSelectedStructuredBlock?.('soeditor.video');
        },
    });

    const trackHandle = (handle: DialogHandle): void => {
        handles.add(handle);
        handle.element.addEventListener(
            'close',
            () => {
                handles.delete(handle);
                if (editing === handle) editing = undefined;
            },
            { once: true },
        );
    };
    const preview = (node: HtmlElement): void => {
        const media = mediaElement(node);
        if (media === undefined) return;
        const container = document.createElement('div');
        const previewValues = readVideo(node);
        const layout = (element: HTMLElement): void => {
            const { width, align, ratio } = previewValues;
            element.style.width = width.endsWith('%') ? width : `${width}px`;
            element.style.maxWidth = '100%';
            element.style.aspectRatio = ratio.replace(':', '/');
            element.style.height = 'auto';
            element.style.display = 'block';
            element.style.marginLeft = align === 'left' ? '0' : 'auto';
            element.style.marginRight = align === 'right' ? '0' : 'auto';
        };
        let cleanup: () => void;
        if (media.tagName === 'iframe') {
            // Only validated, generated attributes are copied into the preview.
            const id = youtubeId(attribute(media, 'src'));
            if (id === undefined)
                throw new Error('Enter a supported YouTube video URL.');
            const player = createYoutubePlayer(
                document,
                id,
                attribute(media, 'title'),
                t,
            );
            const [w, h] = previewValues.ratio.split(':').map(Number);
            const ratio = w && h ? w / h : 16 / 9;
            layout(player.element);
            player.element.style.display = 'grid';
            player.element.style.height = `min(60vh, ${String(726 / ratio + 64)}px)`;
            player.element.style.minHeight = '264px';
            player.element.style.maxWidth = `min(100%, ${String(60 * ratio)}vh)`;
            container.append(player.element);
            cleanup = player.destroy;
        } else {
            const video = document.createElement('video');
            const crossOrigin = attribute(media, 'crossorigin');
            if (
                crossOrigin === 'anonymous' ||
                crossOrigin === 'use-credentials'
            )
                video.crossOrigin = crossOrigin;
            const src = attribute(media, 'src');
            if (src) video.src = src;
            else
                for (const child of media.children) {
                    if (child.type !== 'element' || child.tagName !== 'source')
                        continue;
                    try {
                        const source = document.createElement('source');
                        source.src = mediaUrl(
                            attribute(child, 'src'),
                            document.baseURI,
                            options,
                        );
                        source.type = attribute(child, 'type');
                        video.append(source);
                    } catch {
                        /* Preserve unsupported source alternatives without fetching them. */
                    }
                }
            video.controls = true;
            video.preload = 'metadata';
            video.playsInline = true;
            video.muted = media.attributes.some(
                (item) => item.name === 'muted',
            );
            video.loop = media.attributes.some((item) => item.name === 'loop');
            const poster = attribute(media, 'poster');
            if (poster) video.poster = poster;
            video.style.cssText = 'object-fit:contain;max-height:60vh';
            layout(video);
            for (const child of media.children) {
                if (child.type !== 'element' || child.tagName !== 'track')
                    continue;
                const track = document.createElement('track');
                // Only the validated subtitle selected by this dialog is previewed.
                const values = readVideo(node);
                if (attribute(child, 'src') !== values.subtitle) continue;
                track.src = values.subtitle;
                track.kind = 'subtitles';
                track.srclang = values.language;
                track.label = values.subtitleLabel;
                video.append(track);
            }
            const player = createVideoPlayer(
                document,
                () => {
                    const clone = document.importNode(video, true);
                    clone.muted = video.muted;
                    return clone;
                },
                video.src || video.querySelector('source')?.src || '',
                t,
            );
            layout(player.element);
            player.element.style.display = 'grid';
            player.element.style.height = 'min(60vh, 420px)';
            player.element.style.minHeight = '264px';
            container.append(player.element);
            cleanup = player.destroy;
        }
        const handle = ui.dialogs.open({
            title: t('Video preview'),
            content: container,
            actions: [
                {
                    label: t('Close'),
                    run: (dialog) => {
                        dialog.close();
                    },
                },
            ],
        });
        if (media.tagName === 'iframe') {
            handle.element.style.width = 'min(760px, calc(100vw - 32px))';
            handle.element.style.maxWidth = 'calc(100vw - 32px)';
        }
        handle.element.addEventListener('close', cleanup, { once: true });
        trackHandle(handle);
    };

    return {
        open: (target) => {
            if (!editable()) return;
            if (editing?.element.isConnected) {
                editing.element.focus();
                return;
            }
            if (target !== undefined && !target.select()) return;
            currentTarget = target;
            const original = currentTarget?.node;
            const selectedTarget = currentTarget;
            const initial = readVideo(original);
            const initialContent = editor.getData();
            const form = document.createElement('form');
            form.className = 'soeditor-video-form';
            form.addEventListener('submit', (event) => {
                event.preventDefault();
            });
            const error = document.createElement('p');
            error.setAttribute('role', 'alert');
            error.className = 'soeditor-video-error';
            const inputs = new Map<
                string,
                HTMLInputElement | HTMLSelectElement
            >();
            const field = (
                key: keyof VideoValues,
                en: string,
                choices?: readonly string[],
            ): HTMLInputElement | HTMLSelectElement => {
                const label = document.createElement('label');
                label.className = 'soeditor-video-field';
                label.dataset.field = key;
                const caption = document.createElement('span');
                caption.textContent = t(en);
                label.append(caption);
                const input =
                    choices === undefined
                        ? document.createElement('input')
                        : document.createElement('select');
                input.setAttribute('aria-label', t(en));
                input.name = key;
                if (choices !== undefined)
                    for (const value of choices ?? []) {
                        const option = document.createElement('option');
                        option.value = value;
                        option.textContent =
                            value === 'auto'
                                ? t('Automatic')
                                : value === 'left'
                                  ? t('Left')
                                  : value === 'center'
                                    ? t('Center')
                                    : value === 'right'
                                      ? t('Right')
                                      : value;
                        input.append(option);
                    }
                input.value = String(initial[key]);
                label.append(input);
                form.append(label);
                inputs.set(key, input);
                return input;
            };
            const source = field('src', 'Video URL');
            const title = field('title', 'Title');
            const poster = field('poster', 'Poster URL');
            field('width', 'Width (pixels or %)');
            const ratio = field('ratio', 'Aspect ratio', [
                ...new Set([
                    'auto',
                    '16:9',
                    '4:3',
                    '1:1',
                    '9:16',
                    initial.ratio,
                ]),
            ]);
            const ratioHint = document.createElement('small');
            ratioHint.textContent = t(
                'Suggested from the link, not the original video dimensions. Adjust if needed.',
            );
            ratio.parentElement?.append(ratioHint);
            field('align', 'Alignment', ['left', 'center', 'right']);
            const native = document.createElement('fieldset');
            native.className = 'soeditor-video-options';
            const legend = document.createElement('legend');
            legend.textContent = t('Video file options');
            native.append(legend);
            const flags = new Map<string, HTMLInputElement>();
            for (const [key, en] of [
                ['controls', 'Show controls', '显示播放控件'],
                ['muted', 'Muted', '静音'],
                ['loop', 'Loop', '循环播放'],
            ] as const) {
                const label = document.createElement('label');
                const input = document.createElement('input');
                input.type = 'checkbox';
                input.checked = initial[key];
                label.className = 'soeditor-video-toggle';
                flags.set(key, input);
                label.append(input, document.createTextNode(t(en)));
                native.append(label);
            }
            const subtitle = field('subtitle', 'Subtitle URL (WebVTT)');
            const language = field('language', 'Subtitle language');
            const subtitleLabel = field('subtitleLabel', 'Subtitle label');
            for (const input of [subtitle, language, subtitleLabel])
                if (input.parentElement !== null)
                    native.append(input.parentElement);
            const more = document.createElement('details');
            more.className = 'soeditor-video-more';
            const summary = document.createElement('summary');
            summary.textContent = t('More settings');
            summary.style.cursor = 'pointer';
            more.append(summary, native);
            form.append(more);
            const picker = editor.services.tryGet(fileManagerServiceToken);
            let active = true;
            const choose = (
                input: HTMLInputElement | HTMLSelectElement,
                kind: FileManagerKind,
                en: string,
                accept: readonly string[],
            ): void => {
                if (picker === undefined) return;
                const button = document.createElement('button');
                button.type = 'button';
                button.className =
                    'soeditor-ui__dialog-action soeditor-video-picker';
                input.parentElement?.classList.add(
                    'soeditor-video-field--picker',
                );
                button.textContent = t(en);
                input.parentElement?.append(button);
                button.addEventListener('click', () => {
                    button.disabled = true;
                    void Promise.resolve()
                        .then(() =>
                            picker.open({ kind, multiple: false, accept }),
                        )
                        .then((result) => {
                            if (
                                !active ||
                                destroyed ||
                                ui.destroyed ||
                                result === null
                            )
                                return;
                            if (
                                result.mime !== undefined &&
                                !accept.some((mime) =>
                                    mime.endsWith('/*')
                                        ? result.mime?.startsWith(
                                              mime.slice(0, -1),
                                          )
                                        : result.mime === mime,
                                )
                            )
                                throw new Error(
                                    t(
                                        'Select an asset with the requested format.',
                                    ),
                                );
                            input.value = result.url;
                            input.dispatchEvent(new Event('input'));
                        })
                        .catch((reason: unknown) => {
                            if (active && !destroyed)
                                error.textContent =
                                    reason instanceof Error
                                        ? reason.message
                                        : t('Asset selection failed.');
                        })
                        .finally(() => {
                            if (active) button.disabled = false;
                        });
                });
            };
            choose(source, 'media', 'Choose video', [
                'video/mp4',
                'video/webm',
                'video/ogg',
            ]);
            choose(poster, 'image', 'Choose poster', ['image/*']);
            choose(subtitle, 'file', 'Choose subtitles', ['text/vtt']);
            const refresh = (): void => {
                const youtube = youtubeId(source.value) !== undefined;
                native.disabled = youtube;
                more.hidden = youtube;
                ratioHint.hidden = !youtube;
            };
            source.addEventListener('input', refresh);
            refresh();
            const metadataStatus = document.createElement('p');
            metadataStatus.setAttribute('role', 'status');
            metadataStatus.className = 'soeditor-video-status';
            source.parentElement?.after(metadataStatus);
            const disposeMetadata = attachYoutubeMetadata(
                source,
                { title, poster, ratio },
                metadataStatus,
                options,
                original !== undefined,
                () => active && editable(),
                t,
            );
            const read = (key: keyof VideoValues): string =>
                inputs.get(key)?.value.trim() ?? '';
            const values = (): VideoValues => {
                const align = read('align');
                return {
                    src: read('src'),
                    title: read('title'),
                    poster: read('poster'),
                    width: read('width'),
                    ratio: read('ratio'),
                    align:
                        align === 'left' || align === 'right'
                            ? align
                            : 'center',
                    controls: flags.get('controls')?.checked ?? true,
                    muted: flags.get('muted')?.checked ?? false,
                    loop: flags.get('loop')?.checked ?? false,
                    subtitle: native.disabled ? '' : read('subtitle'),
                    language: read('language'),
                    subtitleLabel: read('subtitleLabel'),
                };
            };
            const validated = (): HtmlElement =>
                buildVideo(values(), document.baseURI, options, original);
            const attempt = (action: () => void): void => {
                try {
                    error.textContent = '';
                    action();
                } catch (reason) {
                    error.textContent =
                        reason instanceof Error
                            ? ui.translate(reason.message)
                            : t('Invalid video.');
                }
            };
            const previewButton = document.createElement('button');
            previewButton.type = 'button';
            previewButton.className =
                'soeditor-ui__dialog-action soeditor-video-preview';
            previewButton.textContent = t('Preview video');
            previewButton.addEventListener('click', () => {
                attempt(() => {
                    preview(validated());
                });
            });
            form.append(previewButton, error);
            const handle = ui.dialogs.open({
                title:
                    original === undefined
                        ? t('Insert video')
                        : t('Edit video'),
                content: form,
                actions: [
                    ...(selectedTarget === undefined
                        ? []
                        : [
                              {
                                  label: t('Remove video'),
                                  kind: 'danger' as const,
                                  run: (dialog: DialogHandle) => {
                                      attempt(() => {
                                          if (
                                              !editable() ||
                                              !selectedTarget.select()
                                          )
                                              throw new Error(
                                                  t(
                                                      'The video is no longer editable.',
                                                  ),
                                              );
                                          editor.execute('cms.video.remove');
                                          dialog.close();
                                      });
                                  },
                              },
                          ]),
                    {
                        label: t('Apply'),
                        kind: 'primary',
                        run: (dialog) => {
                            attempt(() => {
                                if (!editable())
                                    throw new Error(
                                        t('The editor is read-only.'),
                                    );
                                if (editor.getData() !== initialContent)
                                    throw new Error(
                                        t(
                                            'The document changed. Reopen the video dialog.',
                                        ),
                                    );
                                pending = {
                                    node: validated(),
                                    ...(selectedTarget === undefined
                                        ? {}
                                        : { target: selectedTarget }),
                                };
                                try {
                                    editor.execute('cms.video.apply');
                                } finally {
                                    pending = undefined;
                                }
                                dialog.close();
                            });
                        },
                    },
                ],
            });
            handle.element.classList.add('soeditor-video-dialog');
            const style = document.createElement('style');
            const visual = ui.element
                .closest('.soeditor-classic')
                ?.querySelector('.soeditor-classic__visual');
            const nonce =
                visual?.shadowRoot?.querySelector<HTMLStyleElement>(
                    'style[nonce]',
                )?.nonce;
            if (nonce !== undefined) style.nonce = nonce;
            style.textContent = videoDialogStyles;
            handle.element.append(style);
            editing = handle;
            trackHandle(handle);
            handle.element.addEventListener(
                'close',
                () => {
                    active = false;
                    disposeMetadata();
                    currentTarget = undefined;
                },
                { once: true },
            );
        },
        destroy: () => {
            destroyed = true;
            for (const handle of handles) handle.close();
            handles.clear();
            for (const id of ['cms.video.apply', 'cms.video.remove'])
                editor.commands.unregister(id);
        },
    };
}
