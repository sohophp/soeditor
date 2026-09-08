import {
    attribute,
    mediaElement,
    mediaUrl,
    youtubeId,
    styleDeclarations,
    styleName,
    videoWidth,
    videoRatio,
    videoAlignment,
} from './video-policy.js';
import type { HtmlAttribute, HtmlElement } from '@soeditor/html';
import type { CmsVideoOptions } from './video.js';

export interface VideoValues {
    readonly src: string;
    readonly title: string;
    readonly poster: string;
    readonly width: string;
    readonly ratio: string;
    readonly align: 'left' | 'center' | 'right';
    readonly controls: boolean;
    readonly muted: boolean;
    readonly loop: boolean;
    readonly subtitle: string;
    readonly language: string;
    readonly subtitleLabel: string;
}

export function readVideo(node?: HtmlElement): VideoValues {
    const media = node === undefined ? undefined : mediaElement(node);
    const read = (name: string): string =>
        media === undefined ? '' : attribute(media, name);
    const track = media?.children.find(
        (child): child is HtmlElement =>
            child.type === 'element' &&
            child.tagName === 'track' &&
            attribute(child, 'kind') === 'subtitles',
    );
    const has = (name: string): boolean =>
        media?.attributes.some((item) => item.name === name) ?? false;
    return {
        src:
            read('src') ||
            (media?.children
                .find(
                    (child): child is HtmlElement =>
                        child.type === 'element' && child.tagName === 'source',
                )
                ?.attributes.find((item) => item.name === 'src')?.value ??
                ''),
        title: read('title'),
        poster: read(
            media?.tagName === 'iframe' ? 'data-soeditor-poster' : 'poster',
        ),
        width: media === undefined ? '100%' : videoWidth(media),
        ratio: media === undefined ? '16:9' : videoRatio(media),
        align: media === undefined ? 'center' : videoAlignment(media),
        controls:
            media === undefined ||
            media.tagName === 'iframe' ||
            has('controls'),
        muted: has('muted'),
        loop: has('loop'),
        subtitle: track === undefined ? '' : attribute(track, 'src'),
        language: track === undefined ? 'zh' : attribute(track, 'srclang'),
        subtitleLabel: track === undefined ? '' : attribute(track, 'label'),
    };
}

export function buildVideo(
    values: VideoValues,
    base: string,
    options: CmsVideoOptions,
    original?: HtmlElement,
): HtmlElement {
    const old = original === undefined ? undefined : mediaElement(original);
    const initial = readVideo(original);
    const sourceChanged =
        old === undefined || values.src.trim() !== initial.src.trim();
    const widthChanged = old === undefined || values.width !== initial.width;
    const ratioChanged = old === undefined || values.ratio !== initial.ratio;
    const alignChanged = old === undefined || values.align !== initial.align;
    const id = youtubeId(values.src);
    if (id !== undefined && options.youtube === false)
        throw new Error('YouTube is disabled.');
    const src =
        id === undefined
            ? mediaUrl(values.src, base, options)
            : `https://www.youtube-nocookie.com/embed/${id}`;
    if (
        id === undefined &&
        /(?:^|\.)youtube(?:-nocookie)?\.com$|^youtu\.be$/u.test(
            new URL(src, base).hostname,
        )
    )
        throw new Error('Enter a supported YouTube video URL.');
    if (
        widthChanged &&
        (!/^(?:(?:100|[1-9]\d?)%|[1-9]\d{0,3})$/u.test(values.width) ||
            Number(values.width) > 4096)
    )
        throw new Error('Width must be 1–4096 pixels or 1–100%.');
    if (
        ratioChanged &&
        !['auto', '16:9', '4:3', '1:1', '9:16'].includes(values.ratio)
    )
        throw new Error('Choose a supported aspect ratio.');
    if (!['left', 'center', 'right'].includes(values.align))
        throw new Error('Choose a supported alignment.');
    if (values.title.length > 500 || values.subtitleLabel.length > 200)
        throw new Error('The title or subtitle label is too long.');
    const poster = values.poster.trim()
        ? mediaUrl(values.poster, base, options)
        : '';
    const subtitle = values.subtitle.trim()
        ? mediaUrl(values.subtitle, base, options)
        : '';
    if (
        subtitle &&
        !/^[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*$/u.test(values.language)
    )
        throw new Error('Enter a valid subtitle language, such as zh or en.');
    const tagName = id === undefined ? 'video' : 'iframe';
    const styles: Record<string, string> = {};
    if (widthChanged) {
        styles['width'] = values.width.endsWith('%')
            ? values.width
            : `${values.width}px`;
        styles['max-width'] = '100%';
    }
    if (widthChanged || ratioChanged) styles['height'] = 'auto';
    if (ratioChanged) styles['aspect-ratio'] = values.ratio.replace(':', '/');
    if (alignChanged) {
        styles['display'] = 'block';
        styles['margin-left'] = values.align === 'left' ? '0' : 'auto';
        styles['margin-right'] = values.align === 'right' ? '0' : 'auto';
    }
    const managed = new Set([
        ...(sourceChanged ? ['src'] : []),
        'title',
        'poster',
        'data-soeditor-poster',
        'controls',
        'muted',
        'loop',
        ...(widthChanged ? ['width', 'data-video-width'] : []),
        ...(widthChanged || ratioChanged ? ['height'] : []),
        ...(ratioChanged ? ['data-video-ratio'] : []),
        ...(alignChanged ? ['data-align'] : []),
        ...(Object.keys(styles).length > 0 ? ['style'] : []),
        ...(id === undefined
            ? []
            : [
                  'srcdoc',
                  'allow',
                  'allowfullscreen',
                  'sandbox',
                  'loading',
                  'referrerpolicy',
              ]),
    ]);
    const attributes: HtmlAttribute[] = (old?.attributes ?? []).filter(
        (item) => !managed.has(item.name),
    );
    const set = (name: string, value: string): void => {
        attributes.push({ name, value });
    };
    if (sourceChanged) set('src', src);
    set(
        'title',
        values.title.trim() || (id === undefined ? 'Video' : 'YouTube video'),
    );
    if (alignChanged) set('data-align', values.align);
    if (widthChanged) set('data-video-width', values.width);
    if (ratioChanged) set('data-video-ratio', values.ratio);
    if (Object.keys(styles).length > 0) {
        const style = styleDeclarations(
            old === undefined ? '' : attribute(old, 'style'),
        )
            .filter(
                (declaration) => !Object.hasOwn(styles, styleName(declaration)),
            )
            .join(';');
        set(
            'style',
            [
                style,
                ...Object.entries(styles).map(
                    ([name, value]) => `${name}:${value}`,
                ),
            ]
                .filter(Boolean)
                .join(';'),
        );
    }
    if (id === undefined) {
        if (old === undefined || old.tagName !== 'video') {
            set('preload', 'none');
            set('playsinline', '');
        }
        if (subtitle && !attributes.some((item) => item.name === 'crossorigin'))
            set('crossorigin', 'anonymous');
        if (poster) set('poster', poster);
        for (const flag of ['controls', 'muted', 'loop'] as const)
            if (values[flag]) set(flag, '');
    } else {
        if (poster) set('data-soeditor-poster', poster);
        set('loading', 'lazy');
        set('referrerpolicy', 'strict-origin-when-cross-origin');
        set('allow', 'fullscreen; encrypted-media; picture-in-picture');
        set('allowfullscreen', '');
        set('sandbox', 'allow-scripts allow-same-origin allow-presentation');
    }
    const oldTrack = old?.children.find(
        (child): child is HtmlElement =>
            child.type === 'element' &&
            child.tagName === 'track' &&
            attribute(child, 'kind') === 'subtitles',
    );
    const children = old?.tagName === tagName ? [...old.children] : [];
    if (subtitle && id === undefined) {
        const track: HtmlElement = {
            type: 'element',
            namespace: 'html',
            tagName: 'track',
            attributes: [
                ...(oldTrack?.attributes ?? []).filter(
                    (item) =>
                        !['kind', 'src', 'srclang', 'label'].includes(
                            item.name,
                        ),
                ),
                { name: 'kind', value: 'subtitles' },
                { name: 'src', value: subtitle },
                { name: 'srclang', value: values.language },
                {
                    name: 'label',
                    value: values.subtitleLabel || values.language,
                },
            ],
            children: oldTrack?.children ?? [],
        };
        const index = oldTrack === undefined ? -1 : children.indexOf(oldTrack);
        if (index < 0) children.push(track);
        else children[index] = track;
    } else if (oldTrack !== undefined) {
        const index = children.indexOf(oldTrack);
        if (index >= 0) children.splice(index, 1);
    }
    const media: HtmlElement = {
        type: 'element',
        namespace: 'html',
        tagName,
        attributes,
        children,
    };
    return original?.tagName === 'figure'
        ? {
              ...original,
              children: original.children.map((child) =>
                  child === old ? media : child,
              ),
          }
        : media;
}
