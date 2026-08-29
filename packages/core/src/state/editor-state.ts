import type { EditorDocument } from './document.js';

/** The active projection requested from the editor. */
export type EditorMode = 'visual' | 'source' | 'markdown' | 'preview';

/** An immutable snapshot of editor state. */
export interface EditorState {
    /** Canonical immutable document snapshot. */
    readonly document: EditorDocument;
    /** Requested editor projection. */
    readonly mode: EditorMode;
    /** Editing-policy state for future user-facing editing operations. */
    readonly readonly: boolean;
    /** Whether canonical source has changed since it was marked clean. */
    readonly dirty: boolean;
}

/** @internal Creates an immutable editor state snapshot. */
export function createEditorState(values: EditorState): EditorState {
    return Object.freeze({ ...values });
}
