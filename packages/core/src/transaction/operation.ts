import type { EditorMode } from '../state/editor-state.js';

/** Replaces the canonical document source. */
export interface ReplaceDocumentOperation {
    /** Discriminator for canonical source replacement. */
    readonly type: 'replace-document';
    /** Replacement canonical source. */
    readonly source: string;
}

/** Changes the current editor mode without changing the document. */
export interface SetModeOperation {
    /** Discriminator for a requested-mode change. */
    readonly type: 'set-mode';
    /** Requested editor mode. */
    readonly mode: EditorMode;
}

/** A document or state operation supported by Phase 1. */
export type Operation = ReplaceDocumentOperation | SetModeOperation;
