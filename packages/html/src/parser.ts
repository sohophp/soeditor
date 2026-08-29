import type { HtmlDocument, HtmlDocumentFragment } from './nodes.js';
import type { SourceRange } from './source-location.js';

/** Severity assigned to a standards-parser diagnostic. */
export type HtmlParseDiagnosticSeverity = 'error' | 'warning';

/** A parser diagnostic independent of the underlying parser implementation. */
export interface HtmlParseDiagnostic {
    /** Stable WHATWG-style parse error code. */
    readonly code: string;
    readonly severity: HtmlParseDiagnosticSeverity;
    readonly message: string;
    readonly source?: SourceRange;
}

/** A parsed tree and diagnostics collected during the same parser pass. */
export interface HtmlParseResult<TDocument> {
    readonly document: TDocument;
    readonly diagnostics: readonly HtmlParseDiagnostic[];
}

/** Standards-oriented complete-document and fragment parser. */
export interface HtmlParser {
    parseDocument(source: string): HtmlParseResult<HtmlDocument>;
    parseFragment(source: string): HtmlParseResult<HtmlDocumentFragment>;
}
