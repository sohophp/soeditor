import type { PreviewMediaPlayer } from '@soeditor/preview/media';

type Translate = (en: string, zh: string) => string;

/** Shared recovery UI for both explicitly requested preview surfaces. */
export function createVideoPlayer(
    document: Document,
    create: () => HTMLIFrameElement | HTMLVideoElement,
    watchUrl: string,
    t: Translate,
    watchLabel = t('Open original video', '打开原视频'),
): PreviewMediaPlayer {
    const element = document.createElement('div');
    element.style.cssText =
        'display:grid;grid-template-rows:minmax(0,1fr) auto;height:100%;min-height:0;background:#101827;color:#fff';
    const slot = document.createElement('div');
    slot.style.cssText = 'min-height:0;overflow:hidden';
    const actions = document.createElement('div');
    actions.style.cssText =
        'padding:4px 8px;font:12px/1.4 system-ui,sans-serif;background:#f6f8fa;color:#172033';
    const status = document.createElement('div');
    status.setAttribute('role', 'status');
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = t('Reload video', '重新加载视频');
    const link = document.createElement('a');
    link.href = watchUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = watchLabel;
    link.style.marginLeft = '12px';
    actions.append(status, retry, link);
    element.append(slot, actions);
    let player: HTMLIFrameElement | HTMLVideoElement | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let closed = false;
    const release = (): void => {
        clearTimeout(timeout);
        if (player !== undefined && 'pause' in player) {
            const video = player;
            video.pause();
            video.removeAttribute('src');
            video
                .querySelectorAll('source,track')
                .forEach((child) => child.removeAttribute('src'));
            video.load();
        }
        player?.remove();
    };
    const reload = (): void => {
        if (closed) return;
        release();
        const current = create();
        player = current;
        Object.assign(current.style, {
            display: 'block',
            width: '100%',
            height: '100%',
            border: '0',
            objectFit: 'contain',
        });
        const report = (en: string, zh: string): void => {
            if (closed || player !== current) return;
            clearTimeout(timeout);
            status.textContent = t(en, zh);
        };
        status.textContent = t('Loading video…', '正在加载视频…');
        current.addEventListener('load', () =>
            report(
                'If playback fails, reload or open the original video.',
                '若无法播放，请重新加载或打开原视频。',
            ),
        );
        current.addEventListener('loadeddata', () =>
            report('Ready to play.', '可以播放。'),
        );
        current.addEventListener('error', () =>
            report(
                'Video could not load. Reload or open the original video.',
                '视频加载失败，请重试或打开原视频。',
            ),
        );
        timeout = setTimeout(
            () =>
                report(
                    'Still loading. You can reload or open the original video.',
                    '暂未加载完成，可重试或打开原视频。',
                ),
            8000,
        );
        slot.append(current);
    };
    retry.addEventListener('click', reload);
    reload();
    return {
        element,
        destroy: () => {
            closed = true;
            release();
            retry.removeEventListener('click', reload);
            element.remove();
        },
    };
}

export function createYoutubePlayer(
    document: Document,
    id: string,
    title: string,
    t: Translate,
): PreviewMediaPlayer {
    return createVideoPlayer(
        document,
        () => {
            const player = document.createElement('iframe');
            player.src = `https://www.youtube-nocookie.com/embed/${id}`;
            player.title = title || t('YouTube video', 'YouTube 视频');
            player.setAttribute(
                'sandbox',
                'allow-scripts allow-same-origin allow-presentation',
            );
            player.referrerPolicy = 'strict-origin-when-cross-origin';
            player.allow = 'fullscreen; encrypted-media; picture-in-picture';
            player.allowFullscreen = true;
            return player;
        },
        `https://www.youtube.com/watch?v=${id}`,
        t,
        t('Watch on YouTube', '在 YouTube 打开'),
    );
}
