import type { HtmlDocument, HtmlDocumentFragment } from './nodes.js';
import type { HtmlParseResult, HtmlParser } from './parser.js';
import type { HtmlSerializer } from './serializer.js';
import { Parse5HtmlParser } from './internal/parse5-parser.js';
import { Parse5HtmlSerializer } from './internal/parse5-serializer.js';

const defaultParser: HtmlParser = new Parse5HtmlParser();
const defaultSerializer: HtmlSerializer = new Parse5HtmlSerializer();

/** Parses a complete HTML document and collects parser diagnostics. */
export function parseHtmlDocument(
    source: string,
): HtmlParseResult<HtmlDocument> {
    return defaultParser.parseDocument(source);
}

/** Parses an HTML fragment without exposing synthetic document containers. */
export function parseHtmlFragment(
    source: string,
): HtmlParseResult<HtmlDocumentFragment> {
    return defaultParser.parseFragment(source);
}

/** Serializes a complete SoEditor HTML document semantically. */
export function serializeHtmlDocument(document: HtmlDocument): string {
    return defaultSerializer.serializeDocument(document);
}

/** Serializes a SoEditor HTML fragment semantically. */
export function serializeHtmlFragment(fragment: HtmlDocumentFragment): string {
    return defaultSerializer.serializeFragment(fragment);
}
