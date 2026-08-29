import { createServiceToken } from '@soeditor/core';
import type { HtmlAttribute } from '@soeditor/html';
import type {
    EditingStructuredBlock,
    EditingStructuredBlockContent,
} from './model.js';

/** Inline semantic marks supported by the controlled visual service. */
export type VisualTextMark = 'strong' | 'em' | 'u' | 's' | 'code';
/** Text-block elements supported by the controlled visual service. */
export type VisualBlockTag =
    'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'blockquote' | 'pre';

/** Source attributes accepted when applying a link mark. */
export interface VisualLinkAttributes {
    readonly href: string;
    readonly target?: string;
    readonly rel?: string;
    readonly title?: string;
}

/** Narrow, transaction-backed editing capabilities exposed to feature plugins. */
export interface VisualEditingService {
    canEdit(): boolean;
    toggleMark(mark: VisualTextMark): void;
    isMarkActive(mark: VisualTextMark): boolean;
    setBlock(tagName: VisualBlockTag): void;
    isBlockActive(tagName: VisualBlockTag): boolean;
    toggleList(list: 'ol' | 'ul'): void;
    isListActive(list: 'ol' | 'ul'): boolean;
    setLink(attributes: VisualLinkAttributes | undefined): void;
    isLinkActive(): boolean;
    insertHtml(html: string): void;
    getSelectedStructuredBlock(
        type?: string,
    ): EditingStructuredBlock | undefined;
    isStructuredBlockSelected(type?: string): boolean;
    replaceStructuredBlockContent(
        type: string,
        content: EditingStructuredBlockContent,
    ): void;
    setStructuredBlockAttributes(
        type: string,
        attributes: readonly HtmlAttribute[],
    ): void;
}

/** Per-editor token used by command plugins to discover visual capabilities. */
export const visualEditingServiceToken =
    createServiceToken<VisualEditingService>('soeditor.visual-editing');
