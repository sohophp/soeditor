import { previewMediaServiceToken } from '@soeditor/preview/media';
import { transferVideo } from './video-transfer.js';
import { Plugin, type PluginConstructor } from '@soeditor/core';
import { visualEditingServiceToken } from '@soeditor/engine';
import {
    atomicViewServiceToken,
    type AtomicViewContext,
    type AtomicView,
} from '@soeditor/wysiwyg';
import { uiRegistryServiceToken } from '@soeditor/ui/cms';
import { UiPlugin, type EditorUi } from '@soeditor/ui';
import {
    attribute,
    mediaElement,
    mediaUrl,
    youtubeId,
    videoWidth,
    videoAlignment,
} from './video-policy.js';
import type { VideoRuntime } from './video-runtime.js';
import type * as VideoRuntimeModule from './video-runtime.js';

/** Explicit optional CMS video policy. Same-origin assets are always allowed. */
export interface CmsVideoOptions {
    readonly allowedMediaOrigins?: readonly string[];
    readonly youtube?: boolean;
    readonly youtubeMetadata?: boolean;
}

/** Creates an isolated Classic video plugin. Add `cmsVideo` to the toolbar. */
export function createCmsVideoPlugin(
    options: CmsVideoOptions = {},
): PluginConstructor {
    const policy: CmsVideoOptions = Object.freeze({
        ...options,
        ...(options.allowedMediaOrigins === undefined
            ? {}
            : {
                  allowedMediaOrigins: Object.freeze([
                      ...options.allowedMediaOrigins,
                  ]),
              }),
    });
    for (const origin of policy.allowedMediaOrigins ?? []) {
        const url = new URL(origin);
        if (url.origin !== origin || url.protocol !== 'https:')
            throw new TypeError(
                'Video asset origins must be HTTPS origins without paths.',
            );
    }
    return class CmsVideoPlugin extends Plugin {
        static readonly id = 'cms-video';
        static readonly requires = [UiPlugin];
        #ui: EditorUi | undefined;
        #runtime: Promise<VideoRuntime> | undefined;
        #loaded: VideoRuntime | undefined;
        #attempt = 0;
        #dispose: (() => void) | undefined;
        #destroyed = false;
        #target: AtomicViewContext | undefined;
        readonly #cards = new WeakMap<Element, AtomicView>();

        override init(): void {
            if (import.meta.env.SOEDITOR_OPTIONAL_CLASSIC !== 'false')
                this.editor.services.register(previewMediaServiceToken, {
                    resolve: (source) => {
                        const id = youtubeId(source.getAttribute('src') ?? '');
                        if (
                            source.localName !== 'video' &&
                            (source.localName !== 'iframe' ||
                                policy.youtube === false ||
                                source.hasAttribute('srcdoc') ||
                                id === undefined)
                        )
                            return undefined;
                        const html = source.outerHTML;
                        const base =
                            source.ownerDocument.baseURI === 'about:blank'
                                ? (this.#ui?.element.ownerDocument.baseURI ??
                                  source.ownerDocument.baseURI)
                                : source.ownerDocument.baseURI;
                        let poster: string | undefined;
                        try {
                            const value =
                                source.getAttribute('poster') ||
                                source.getAttribute('data-soeditor-poster');
                            if (value)
                                poster = new URL(
                                    mediaUrl(value, base, policy),
                                    base,
                                ).href;
                        } catch {
                            /* Invalid covers never trigger requests. */
                        }
                        return {
                            key: html,
                            ...(poster === undefined ? {} : { poster }),
                            title:
                                source.getAttribute('title') ||
                                (this.#ui?.locale.startsWith('zh')
                                    ? '视频'
                                    : 'Video'),
                            create: async (document) => {
                                const { resolveVideoPreview } =
                                    await import('./video-preview.js');
                                const template =
                                    document.createElement('template');
                                template.innerHTML = html;
                                const element =
                                    template.content.firstElementChild;
                                const description =
                                    element === null
                                        ? undefined
                                        : resolveVideoPreview(
                                              element,
                                              policy,
                                              base,
                                              (en, zh) =>
                                                  this.#ui?.translate(
                                                      this.#ui.locale.startsWith(
                                                          'zh',
                                                      )
                                                          ? zh
                                                          : en,
                                                  ) ?? en,
                                          );
                                if (description === undefined)
                                    throw new Error('Unsupported video.');
                                return description.create(document);
                            },
                        };
                    },
                });
            const registry = this.editor.services.get(uiRegistryServiceToken);
            this.#dispose = registry.registerToolbarItem(
                'cmsVideo',
                ({ document, ui }) => {
                    this.#ui = ui;
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'soeditor-ui__button';
                    button.setAttribute('data-toolbar-item', 'cmsVideo');
                    button.title = ui.translate(
                        ui.locale.startsWith('zh') ? '视频' : 'Video',
                    );
                    button.setAttribute('aria-label', button.title);
                    // Keep the focused video icon beside its toolbar factory.
                    const svg = document.createElementNS(
                        'http://www.w3.org/2000/svg',
                        'svg',
                    );
                    svg.setAttribute('viewBox', '0 0 24 24');
                    svg.setAttribute('width', '18');
                    svg.setAttribute('height', '18');
                    svg.setAttribute('aria-hidden', 'true');
                    const path = document.createElementNS(
                        svg.namespaceURI,
                        'path',
                    );
                    path.setAttribute('d', 'M3 4h18v16H3zM10 8v8l6-4z');
                    path.setAttribute('fill', 'currentColor');
                    path.setAttribute('fill-rule', 'evenodd');
                    svg.append(path);
                    button.append(svg);
                    const click = (): void => {
                        ui.restoreEditingSelection();
                        void this.editor.execute('cms.video.open');
                    };
                    button.addEventListener('click', click);
                    return {
                        element: button,
                        update: () => {
                            button.disabled =
                                !this.editor.commands.canExecute(
                                    'cms.video.open',
                                );
                        },
                        destroy: () => {
                            button.removeEventListener('click', click);
                            this.#ui = undefined;
                        },
                    };
                },
            );
            this.editor.commands.register({
                id: 'cms.video.open',
                label: 'Video',
                canExecute: () =>
                    !this.#destroyed &&
                    this.#ui !== undefined &&
                    (this.editor.services
                        .tryGet(visualEditingServiceToken)
                        ?.canEdit() ??
                        false),
                execute: async () => {
                    const ui = this.#ui;
                    const target =
                        this.#target?.isSelected() === true
                            ? this.#target
                            : undefined;
                    if (ui === undefined) return;
                    try {
                        const runtime = await this.#load(ui);
                        if (!this.#destroyed && !ui.destroyed)
                            runtime.open(target);
                    } catch (error) {
                        if (!this.#destroyed && !ui.destroyed)
                            ui.notifications.show({
                                message:
                                    error instanceof Error
                                        ? error.message
                                        : 'Video could not be loaded.',
                                severity: 'error',
                            });
                    }
                },
            });
            this.editor.commands.register({
                id: 'cms.video.delete',
                label: 'Remove video',
                canExecute: () =>
                    !this.#destroyed &&
                    this.#target?.isSelected() === true &&
                    (this.editor.services
                        .tryGet(visualEditingServiceToken)
                        ?.canEdit() ??
                        false),
                execute: () => {
                    if (this.#target?.select())
                        this.editor.services
                            .get(visualEditingServiceToken)
                            .removeSelectedStructuredBlock?.('soeditor.video');
                },
            });
            this.editor.services.register(atomicViewServiceToken, {
                create: (context) => this.#view(context),
                transfer: transferVideo,
                selected: (origin, range) => {
                    if (range !== undefined) {
                        const child =
                            range.startContainer.childNodes[range.startOffset];
                        return range.startContainer === range.endContainer &&
                            range.endOffset === range.startOffset + 1 &&
                            child instanceof Element
                            ? this.#cards.get(child)
                            : undefined;
                    }
                    const card = origin.closest('[data-soeditor-video-card]');
                    return card === null ? undefined : this.#cards.get(card);
                },
            });
        }

        #load(ui: EditorUi): Promise<VideoRuntime> {
            this.#runtime ??= loadVideoRuntime(this.#attempt++)
                .then(({ createVideoRuntime }) => {
                    if (this.#destroyed || ui.destroyed)
                        throw new Error('The video editor was destroyed.');
                    this.#loaded = createVideoRuntime(this.editor, ui, policy);
                    return this.#loaded;
                })
                .catch((error: unknown) => {
                    this.#runtime = undefined;
                    throw error;
                });
            return this.#runtime;
        }

        #view(
            context: AtomicViewContext,
        ): { element: HTMLElement; type: string } | undefined {
            const media = mediaElement(context.node);
            if (
                media === undefined ||
                context.node.namespace !== 'html' ||
                (media.tagName === 'iframe' &&
                    youtubeId(attribute(media, 'src')) === undefined)
            )
                return undefined;
            const { document } = context;
            const card = document.createElement('figure');
            card.setAttribute('data-soeditor-video-card', '');
            card.tabIndex = 0;
            card.setAttribute('role', 'group');
            card.style.cssText =
                'display:block;box-sizing:border-box;max-width:100%;padding:16px;border:1px solid #b9c2d5;border-radius:8px;background:#f5f7fb;color:#17233b;cursor:pointer;overflow-wrap:anywhere';
            const width = videoWidth(media);
            card.style.width = /^[1-9]\d{0,3}$/u.test(width)
                ? `${width}px`
                : width;
            const align = videoAlignment(media);
            card.style.marginLeft = align === 'left' ? '0' : 'auto';
            card.style.marginRight = align === 'right' ? '0' : 'auto';
            const title = document.createElement('strong');
            title.textContent = `▶ ${attribute(media, 'title') || 'Video'}`;
            card.setAttribute('aria-label', title.textContent);
            const poster = attribute(
                media,
                media.tagName === 'iframe' ? 'data-soeditor-poster' : 'poster',
            );
            if (poster) {
                try {
                    const image = document.createElement('img');
                    image.src = mediaUrl(poster, document.baseURI, policy);
                    image.alt = '';
                    image.loading = 'lazy';
                    image.draggable = false;
                    image.style.cssText =
                        'display:block;max-width:100%;max-height:180px;margin-bottom:8px;pointer-events:none';
                    card.append(image);
                } catch {
                    /* Stored unsafe URLs are preserved without being fetched. */
                }
            }
            const source = document.createElement('div');
            source.textContent = attribute(media, 'src');
            source.style.cssText = 'font-size:12px;opacity:.75;margin-top:6px';
            card.append(title, source);
            const select = (): void => {
                if (context.select()) this.#target = context;
            };
            card.addEventListener('pointerdown', (event) => {
                event.stopPropagation();
            });
            card.addEventListener('pointerup', (event) => {
                event.stopPropagation();
                select();
            });
            card.addEventListener('click', (event) => {
                event.stopPropagation();
                select();
            });
            const open = (): void => {
                select();
                if (this.editor.commands.canExecute('cms.video.open'))
                    void this.editor.execute('cms.video.open');
            };
            card.addEventListener('dblclick', (event) => {
                event.preventDefault();
                event.stopPropagation();
                open();
            });
            card.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    event.stopPropagation();
                    open();
                }
                if (event.key === 'Delete' || event.key === 'Backspace') {
                    event.preventDefault();
                    event.stopPropagation();
                    select();
                    if (this.editor.commands.canExecute('cms.video.delete'))
                        this.editor.execute('cms.video.delete');
                }
            });
            card.addEventListener('pointerover', (event) => {
                event.stopPropagation();
                card.dispatchEvent(
                    new CustomEvent('soeditor:block-hover', {
                        bubbles: true,
                        composed: true,
                        detail: {
                            block: card,
                            insertParagraph: context.insertParagraph,
                        },
                    }),
                );
            });
            const atomic = { element: card, type: 'soeditor.video' };
            this.#cards.set(card, atomic);
            return atomic;
        }

        override destroy(): void {
            this.#destroyed = true;
            this.#dispose?.();
            this.#target = undefined;
            this.#loaded?.destroy();
            this.editor.commands.unregister('cms.video.open');
            this.editor.commands.unregister('cms.video.delete');
            this.#ui = undefined;
        }
    };
}

async function loadVideoRuntime(
    attempt: number,
): Promise<typeof VideoRuntimeModule> {
    if (attempt === 0 && import.meta.env.SOEDITOR_STANDALONE_VIDEO !== 'true')
        return import('./video-runtime.js');
    // Browsers remember a failed module fetch. The separately emitted entry
    // permits a fresh URL without evaluating any downloaded text ourselves.
    const url = new URL(
        '../node_modules/.cache/video-recovery/video-runtime.js?no-inline',
        import.meta.url,
    );
    url.searchParams.set('soeditor-video-retry', String(attempt));
    const module: unknown = await import(/* @vite-ignore */ url.href);
    if (!isVideoRuntimeModule(module))
        throw new TypeError('Invalid video runtime.');
    return module;
}

function isVideoRuntimeModule(
    value: unknown,
): value is typeof VideoRuntimeModule {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof Reflect.get(value, 'createVideoRuntime') === 'function'
    );
}
