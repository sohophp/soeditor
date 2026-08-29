import { createServiceToken } from '@soeditor/core';

/** Narrow per-editor capability of an attached preview environment. */
export interface PreviewService {
    canRender(): boolean;
    refresh(): void;
}

/** Typed identity for one attached preview engine. */
export const previewServiceToken =
    createServiceToken<PreviewService>('soeditor.preview');
