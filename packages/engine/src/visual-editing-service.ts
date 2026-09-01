import { createServiceToken } from '@soeditor/core';
import type { HtmlAttribute } from '@soeditor/html';
import type {
    EditingSelection,
    EditingStructuredBlock,
    EditingStructuredBlockContent,
} from './model.js';

/** Inline semantic marks supported by the controlled visual service. */
export type VisualTextMark =
    'strong' | 'em' | 'u' | 's' | 'code' | 'sub' | 'sup';

/** Validated inline element style applied through the controlled model. */
export interface VisualInlineStyle {
    readonly tagName: 'kbd' | 'mark' | 'small' | 'span';
    readonly attributes: readonly HtmlAttribute[];
}

/** Inline CSS properties that feature plugins may remove independently. */
export type VisualInlineStyleProperty =
    'background-color' | 'color' | 'font-family' | 'font-size';

/** Bounded ordered/unordered list source properties. */
export interface VisualListProperties {
    readonly start?: number;
    readonly type?: '1' | 'A' | 'I' | 'a' | 'circle' | 'disc' | 'i' | 'square';
}
/** Text-block elements supported by the controlled visual service. */
export type VisualBlockTag =
    'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'blockquote' | 'pre';

/** Source attributes accepted when applying a link mark. */
export interface VisualLinkAttributes {
    readonly href: string;
    readonly target?: string;
    readonly rel?: string;
    readonly title?: string;
    /** Validated non-managed attributes preserved on the anchor element. */
    readonly customAttributes?: readonly HtmlAttribute[];
}

/** Controls whether inserted HTML replaces a selection or is placed before it. */
export interface VisualHtmlInsertionOptions {
    readonly placement?: 'replace-selection' | 'selection-start';
}

/** Narrow, transaction-backed editing capabilities exposed to feature plugins. */
export interface VisualEditingService {
    canEdit(): boolean;
    getSelection(): EditingSelection | undefined;
    setSelection(selection: EditingSelection, focus?: boolean): boolean;
    toggleMark(mark: VisualTextMark): void;
    isMarkActive(mark: VisualTextMark): boolean;
    applyInlineStyle?(style: VisualInlineStyle): void;
    removeInlineStyleProperty?(property: VisualInlineStyleProperty): void;
    isInlineStyleActive?(style: VisualInlineStyle): boolean;
    removeFormat?(): void;
    setBlock(tagName: VisualBlockTag): void;
    isBlockActive(tagName: VisualBlockTag): boolean;
    applyBlockAttributes?(attributes: readonly HtmlAttribute[]): void;
    areBlockAttributesActive?(attributes: readonly HtmlAttribute[]): boolean;
    setAlignment?(
        alignment: 'center' | 'justify' | 'left' | 'right' | undefined,
    ): void;
    isAlignmentActive?(
        alignment: 'center' | 'justify' | 'left' | 'right' | undefined,
    ): boolean;
    adjustIndent?(delta: -1 | 1): void;
    toggleList(list: 'ol' | 'ul'): void;
    isListActive(list: 'ol' | 'ul'): boolean;
    setListProperties?(properties: VisualListProperties): void;
    setLink(attributes: VisualLinkAttributes | undefined): void;
    isLinkActive(): boolean;
    getLinkAttributes?(): VisualLinkAttributes | undefined;
    insertHtml(html: string, options?: VisualHtmlInsertionOptions): void;
    getSelectedStructuredBlock(
        type?: string,
    ): EditingStructuredBlock | undefined;
    /** Projection-owned selection metadata for one structured feature. */
    getStructuredSelection?(type: string): unknown;
    isStructuredBlockSelected(type?: string): boolean;
    replaceStructuredBlockContent(
        type: string,
        content: EditingStructuredBlockContent,
    ): void;
    removeSelectedStructuredBlock?(type: string): void;
    setStructuredBlockAttributes(
        type: string,
        attributes: readonly HtmlAttribute[],
    ): void;
}

/** Per-editor token used by command plugins to discover visual capabilities. */
export const visualEditingServiceToken =
    createServiceToken<VisualEditingService>('soeditor.visual-editing');
