import { createServiceToken } from '@soeditor/core';
import type { HtmlParseDiagnostic, SourceRange } from '@soeditor/html';

/** Narrow source-surface capabilities available to integrations. */
export interface SourceEditingService {
    /** Focuses the attached CodeMirror surface. */
    focus(): void;
    /** Returns immutable diagnostics for the exact current source. */
    getDiagnostics(): readonly HtmlParseDiagnostic[];
    /** Opens CodeMirror Find/Replace, optionally primed with plain text. */
    openSearchPanel(query?: string): void;
    /** Reveals and selects a SoEditor-owned source range. */
    reveal(range: SourceRange): void;
}

/** Per-editor token for an attached source editing surface. */
export const sourceEditingServiceToken =
    createServiceToken<SourceEditingService>('soeditor.source-editing');
