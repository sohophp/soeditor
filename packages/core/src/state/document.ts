/** A source format understood by the stable document API. */
export type DocumentFormat = 'html' | 'markdown';

/** The canonical source document held by an editor state. */
export interface EditorDocument {
    /** Canonical source format. */
    readonly format: DocumentFormat;
    /** Canonical source text preserved by core without parsing. */
    readonly source: string;
    /** Monotonic revision incremented by actual source changes. */
    readonly revision: number;
    /** Immutable document-level metadata. */
    readonly metadata: Readonly<Record<string, unknown>>;
}

/** @internal Creates an immutable canonical document snapshot. */
export function createEditorDocument(
    source: string,
    format: DocumentFormat,
    revision = 0,
    metadata: Readonly<Record<string, unknown>> = {},
): EditorDocument {
    return Object.freeze({
        format,
        source,
        revision,
        metadata: Object.freeze({ ...metadata }),
    });
}
