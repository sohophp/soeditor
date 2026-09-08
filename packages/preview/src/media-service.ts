import { createServiceToken } from '@soeditor/core';

/** One trusted player, owned by a single preview window. */
export interface PreviewMediaPlayer {
    readonly element: HTMLElement;
    destroy(): void;
}

/** Stable identity includes every attribute that affects playback. */
export interface PreviewMediaSource {
    readonly key: string;
    readonly title: string;
    readonly poster?: string;
    create(
        document: Document,
    ): PreviewMediaPlayer | Promise<PreviewMediaPlayer>;
}

/** Resolve approved media without fetching it or copying executable article HTML. */
export interface PreviewMediaService {
    resolve(source: Element): PreviewMediaSource | undefined;
}

export const previewMediaServiceToken = createServiceToken<PreviewMediaService>(
    'soeditor.preview.media',
);
