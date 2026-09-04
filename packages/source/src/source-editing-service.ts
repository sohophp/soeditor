import { createServiceToken } from '@soeditor/core';
import type { HtmlParseDiagnostic, SourceRange } from '@soeditor/html';

/** Narrow source-surface capabilities available to integrations. */
export interface SourceEditingService {
    /** Focuses the attached CodeMirror surface. */
    focus(): void;
    /** Returns immutable diagnostics for the exact current source. */
    getDiagnostics(): readonly HtmlParseDiagnostic[];
    /** Returns the current CodeMirror selection in source coordinates. */
    getSelection(): SourceRange;
    /** Subscribes to source cursor and selection changes. */
    subscribeSelection(listener: () => void): () => void;
    /** Opens CodeMirror Find/Replace, optionally primed with plain text. */
    openSearchPanel(query?: string): void;
    /** Reveals a source range and selects it unless passive focus is disabled. */
    reveal(range: SourceRange, options?: SourceRevealOptions): void;
}

/** Focus policy for a programmatic Source reveal. */
export interface SourceRevealOptions {
    /** Defaults to true. Set false for passive cross-pane synchronization. */
    readonly focus?: boolean;
}

/** Per-editor token for an attached source editing surface. */
export const sourceEditingServiceToken =
    createServiceToken<SourceEditingService>('soeditor.source-editing');
