import { parseHtmlDocument, parseHtmlFragment } from '@soeditor/html';

export interface HtmlFormattingIssue {
    readonly code: string;
    readonly reason: string;
    readonly line?: number;
    readonly column?: number;
}

const reasons: Readonly<Record<string, string>> = {
    'eof-in-element-that-can-contain-only-text':
        'A raw-text element such as <style> or <script> is missing its closing tag.',
    'eof-in-comment': 'An HTML comment is missing its closing -->.',
    'eof-in-tag': 'An HTML tag is incomplete or missing its closing >.',
    'duplicate-attribute':
        'The same attribute appears more than once on a tag.',
    'missing-attribute-value': 'An HTML attribute is missing its value.',
    'unexpected-character-in-attribute-name':
        'An attribute name contains an unexpected character.',
};

export function getHtmlFormattingIssue(
    source: string,
): HtmlFormattingIssue | undefined {
    const diagnostics = isHtmlDocumentSource(source)
        ? parseHtmlDocument(source).diagnostics
        : parseHtmlFragment(source).diagnostics;
    const error = diagnostics.find(
        (diagnostic) => diagnostic.severity === 'error',
    );
    if (error === undefined) return undefined;
    return {
        code: error.code,
        reason: reasons[error.code] ?? error.message,
        ...(error.source === undefined
            ? {}
            : {
                  line: error.source.start.line,
                  column: error.source.start.column,
              }),
    };
}

/**
 * Performs the parser-error gate required before a whole-source rewrite.
 * Browser callers run this from the formatting worker so validation cannot
 * block the editor UI. The Node fallback uses the same preservation rule.
 */
export function hasHtmlParserErrors(source: string): boolean {
    return getHtmlFormattingIssue(source) !== undefined;
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
