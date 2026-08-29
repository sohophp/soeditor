import { createServiceToken } from '@soeditor/core';

/** Narrow capability of an attached Markdown CodeMirror surface. */
export interface MarkdownEditingService {
    focus(): void;
}

/** Typed identity for one attached Markdown source engine. */
export const markdownEditingServiceToken =
    createServiceToken<MarkdownEditingService>('soeditor.markdown-editing');
