import type { ElementSourceRange, SourceRange } from './source-location.js';

/** Namespace of an HTML-tree element. */
export type HtmlNamespace = 'html' | 'svg' | 'mathml';

/** An attribute retained from an element start tag. */
export interface HtmlAttribute {
    /** Local attribute name. */
    readonly name: string;
    /** Decoded attribute value. */
    readonly value: string;
    /** Namespace URI for a namespaced attribute. */
    readonly namespace?: string;
    /** Namespace prefix such as `xlink`. */
    readonly prefix?: string;
    /** Attribute range in the original source, when available. */
    readonly source?: SourceRange;
}

/** A parsed complete HTML document. */
export interface HtmlDocument {
    readonly type: 'document';
    readonly children: readonly HtmlDocumentChildNode[];
}

/** A parsed HTML fragment without synthetic document containers. */
export interface HtmlDocumentFragment {
    readonly type: 'document-fragment';
    readonly children: readonly HtmlChildNode[];
}

/** An HTML, SVG, MathML, or custom element. */
export interface HtmlElement {
    readonly type: 'element';
    readonly tagName: string;
    readonly namespace: HtmlNamespace;
    readonly attributes: readonly HtmlAttribute[];
    /**
     * Child content. For an HTML `template` element this is its template
     * content rather than parser-specific child storage.
     */
    readonly children: readonly HtmlChildNode[];
    /** Absent for parser-synthesized elements and other source-less nodes. */
    readonly source?: ElementSourceRange;
}

/** Character data after HTML parsing and entity decoding. */
export interface HtmlText {
    readonly type: 'text';
    readonly value: string;
    readonly source?: SourceRange;
}

/** An HTML comment, including CMS markers. */
export interface HtmlComment {
    readonly type: 'comment';
    readonly value: string;
    readonly source?: SourceRange;
}

/** A document type declaration in a complete HTML document. */
export interface HtmlDoctype {
    readonly type: 'doctype';
    readonly name: string;
    readonly publicId: string;
    readonly systemId: string;
    readonly source?: SourceRange;
}

/** Nodes that can occur inside an element or fragment. */
export type HtmlChildNode = HtmlElement | HtmlText | HtmlComment;

/** Nodes that can occur at the top level of a complete document. */
export type HtmlDocumentChildNode = HtmlChildNode | HtmlDoctype;

/** Any public SoEditor HTML-tree node. */
export type HtmlNode =
    | HtmlDocument
    | HtmlDocumentFragment
    | HtmlElement
    | HtmlText
    | HtmlComment
    | HtmlDoctype;
