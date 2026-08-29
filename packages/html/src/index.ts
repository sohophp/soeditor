export {
    parseHtmlDocument,
    parseHtmlFragment,
    serializeHtmlDocument,
    serializeHtmlFragment,
} from './api.js';
export type {
    HtmlAttribute,
    HtmlChildNode,
    HtmlComment,
    HtmlDoctype,
    HtmlDocument,
    HtmlDocumentChildNode,
    HtmlDocumentFragment,
    HtmlElement,
    HtmlNamespace,
    HtmlNode,
    HtmlText,
} from './nodes.js';
export type {
    HtmlParseDiagnostic,
    HtmlParseDiagnosticSeverity,
    HtmlParseResult,
    HtmlParser,
} from './parser.js';
export type { HtmlSerializer } from './serializer.js';
export type {
    ElementSourceRange,
    SourcePosition,
    SourceRange,
} from './source-location.js';
