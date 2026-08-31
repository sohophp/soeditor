import { createServiceToken } from '@soeditor/core';
import type { PreviewConfiguration } from './configuration.js';

/** Narrow per-editor capability of an attached preview environment. */
export interface PreviewService {
    canRender(): boolean;
    refresh(): void;
    /** Replaces the isolated preview template and refreshes visible output. */
    setConfiguration(configuration: PreviewConfiguration): void;
}

/** Typed identity for one attached preview engine. */
export const previewServiceToken =
    createServiceToken<PreviewService>('soeditor.preview');
