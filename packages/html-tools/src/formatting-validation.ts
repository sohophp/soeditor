import { parseHtmlDocument, parseHtmlFragment } from '@soeditor/html';

/**
 * Performs the parser-error gate required before a whole-source rewrite.
 * Browser callers run this from the formatting worker so validation cannot
 * block the editor UI. The Node fallback uses the same preservation rule.
 */
export function hasHtmlParserErrors(source: string): boolean {
    const diagnostics = isHtmlDocumentSource(source)
        ? parseHtmlDocument(source).diagnostics
        : parseHtmlFragment(source).diagnostics;
    return diagnostics.some((diagnostic) => diagnostic.severity === 'error');
}

export function isHtmlDocumentSource(source: string): boolean {
    let remaining = source.trimStart();
    while (remaining.startsWith('<!--')) {
        const end = remaining.indexOf('-->', 4);
        if (end < 0) return false;
        remaining = remaining.slice(end + 3).trimStart();
    }
    return /^(?:<!doctype\s|<(?:html|head|body)(?:\s|>))/iu.test(remaining);
}
