import type { DocumentFormat } from '@soeditor/core';

import { markdownToHtml, type MarkdownRenderOptions } from './conversion.js';

/** Preview-compatible renderer without a dependency on the Preview package. */
export interface MarkdownPreviewRenderer {
    supports(format: DocumentFormat): boolean;
    render(source: string, format: DocumentFormat): string;
}

/** Creates an HTML-pass-through and Markdown-aware preview renderer. */
export function createMarkdownPreviewRenderer(
    options: MarkdownRenderOptions = {},
): MarkdownPreviewRenderer {
    return Object.freeze({
        supports: (format: DocumentFormat) =>
            format === 'html' || format === 'markdown',
        render: (source: string, format: DocumentFormat) =>
            format === 'markdown' ? markdownToHtml(source, options) : source,
    });
}
