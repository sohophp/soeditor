import { parseHtmlDocument, parseHtmlFragment } from '@soeditor/html';

/**
 * Performs the parser-error gate required before a whole-source rewrite.
 * Browser callers run this from the formatting worker so validation cannot
 * block the editor UI. The Node fallback uses the same preservation rule.
 */
export function hasHtmlParserErrors(source: string): boolean {
    const diagnostics = isCompleteDocument(source)
        ? parseHtmlDocument(source).diagnostics
        : parseHtmlFragment(source).diagnostics;
    return diagnostics.some((diagnostic) => diagnostic.severity === 'error');
}

function isCompleteDocument(source: string): boolean {
    return /<!doctype\s|<\/?(?:html|head|body)(?:\s|>)/iu.test(source);
}
