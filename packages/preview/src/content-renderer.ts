import type { DocumentFormat } from '@soeditor/core';

/** Converts canonical source into preview-only HTML. */
export interface PreviewContentRenderer {
    supports(format: DocumentFormat): boolean;
    render(source: string, format: DocumentFormat): string;
}

/** Reports a preview request without a renderer for the document format. */
export class UnsupportedPreviewDocumentFormatError extends Error {
    constructor(format: string) {
        super(`No preview content renderer supports "${format}" documents.`);
        this.name = 'UnsupportedPreviewDocumentFormatError';
    }
}

export const htmlPreviewContentRenderer: PreviewContentRenderer = Object.freeze(
    {
        supports: (format: DocumentFormat) => format === 'html',
        render: (source: string, format: DocumentFormat) => {
            if (format !== 'html') {
                throw new UnsupportedPreviewDocumentFormatError(format);
            }
            return source;
        },
    },
);
