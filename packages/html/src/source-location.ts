/** A position in the original HTML source. */
export interface SourcePosition {
    /** One-based source line. */
    readonly line: number;
    /** One-based source column. */
    readonly column: number;
    /** Zero-based UTF-16 source offset. */
    readonly offset: number;
}

/** A half-open range in the original HTML source. */
export interface SourceRange {
    /** Position of the first character in the range. */
    readonly start: SourcePosition;
    /** Position immediately after the final character in the range. */
    readonly end: SourcePosition;
}

/** Source ranges available for an explicitly written element. */
export interface ElementSourceRange extends SourceRange {
    /** Range occupied by the opening tag, when present in source. */
    readonly startTag?: SourceRange;
    /** Range occupied by the closing tag, when present in source. */
    readonly endTag?: SourceRange;
}
