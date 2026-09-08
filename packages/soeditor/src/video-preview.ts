import type { PreviewMediaSource } from '@soeditor/preview/media';
import type { CmsVideoOptions } from './video.js';
import { mediaUrl, youtubeId } from './video-policy.js';
import { createVideoPlayer, createYoutubePlayer } from './video-player.js';

/** Validate every network-bearing field; never attach a stored element to the popup. */
export function resolveVideoPreview(
    source: Element,
    options: CmsVideoOptions,
    base: string,
    t: (en: string, zh: string) => string,
): PreviewMediaSource | undefined {
    const id = youtubeId(source.getAttribute('src') ?? '');
    const title = source.getAttribute('title') || t('Video', '视频');
    const key = source.outerHTML;
    const safe = (value: string | null): string | undefined => {
        try {
            return value
                ? new URL(mediaUrl(value, base, options), base).href
                : undefined;
        } catch {
            return undefined;
        }
    };
    if (source.localName === 'iframe') {
        if (
            options.youtube === false ||
            source.hasAttribute('srcdoc') ||
            id === undefined
        )
            return undefined;
        const poster = safe(source.getAttribute('data-soeditor-poster'));
        return {
            key,
            title,
            ...(poster === undefined ? {} : { poster }),
            create: (document) => createYoutubePlayer(document, id, title, t),
        };
    }
    if (source.localName !== 'video') return undefined;
    const src = safe(source.getAttribute('src'));
    const alternatives = Array.from(source.querySelectorAll('source')).flatMap(
        (child) => {
            const url = safe(child.getAttribute('src'));
            return url === undefined
                ? []
                : [{ src: url, type: child.getAttribute('type') ?? '' }];
        },
    );
    const watch = src ?? alternatives[0]?.src;
    if (watch === undefined) return undefined;
    const tracks = Array.from(source.querySelectorAll('track')).flatMap(
        (child) => {
            const url = safe(child.getAttribute('src'));
            return url === undefined
                ? []
                : [
                      {
                          src: url,
                          language: child.getAttribute('srclang') ?? '',
                          label: child.getAttribute('label') ?? '',
                          kind: child.getAttribute('kind') ?? 'subtitles',
                          default: child.hasAttribute('default'),
                      },
                  ];
        },
    );
    const poster = safe(source.getAttribute('poster'));
    const crossOrigin = source.getAttribute('crossorigin');
    const muted = source.hasAttribute('muted');
    const loop = source.hasAttribute('loop');
    return {
        key,
        title,
        ...(poster === undefined ? {} : { poster }),
        create: (document) =>
            createVideoPlayer(
                document,
                () => {
                    const video = document.createElement('video');
                    if (
                        crossOrigin === 'anonymous' ||
                        crossOrigin === 'use-credentials'
                    )
                        video.crossOrigin = crossOrigin;
                    video.controls = true;
                    video.muted = muted;
                    video.loop = loop;
                    video.playsInline = true;
                    video.preload = 'metadata';
                    video.title = title;
                    if (poster !== undefined) video.poster = poster;
                    if (src !== undefined) video.src = src;
                    else
                        for (const item of alternatives) {
                            const child = document.createElement('source');
                            child.src = item.src;
                            child.type = item.type;
                            video.append(child);
                        }
                    for (const item of tracks) {
                        const child = document.createElement('track');
                        child.src = item.src;
                        child.srclang = item.language;
                        child.label = item.label;
                        child.kind = [
                            'subtitles',
                            'captions',
                            'descriptions',
                            'chapters',
                            'metadata',
                        ].includes(item.kind)
                            ? item.kind
                            : 'subtitles';
                        child.default = item.default;
                        video.append(child);
                    }
                    return video;
                },
                watch,
                t,
            ),
    };
}
