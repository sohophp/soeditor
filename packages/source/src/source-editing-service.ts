import { createServiceToken } from '@soeditor/core';
import type { HtmlParseDiagnostic } from '@soeditor/html';

/** Narrow source-surface capabilities available to integrations. */
export interface SourceEditingService {
    /** Focuses the attached CodeMirror surface. */
    focus(): void;
    /** Returns immutable diagnostics for the exact current source. */
    getDiagnostics(): readonly HtmlParseDiagnostic[];
}

/** Per-editor token for an attached source editing surface. */
export const sourceEditingServiceToken =
    createServiceToken<SourceEditingService>('soeditor.source-editing');
