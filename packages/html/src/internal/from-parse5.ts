import { defaultTreeAdapter, html } from 'parse5';
import type { DefaultTreeAdapterTypes } from 'parse5';

import type {
    HtmlAttribute,
    HtmlChildNode,
    HtmlComment,
    HtmlDoctype,
    HtmlDocument,
    HtmlDocumentChildNode,
    HtmlDocumentFragment,
    HtmlElement,
    HtmlNamespace,
    HtmlText,
} from '../nodes.js';
import {
    convertElementSourceRange,
    convertSourceRange,
    findAttributeSourceRange,
} from './source-location.js';

/** @internal Converts parse5's implementation AST into immutable public data. */
export function convertDocument(
    document: DefaultTreeAdapterTypes.Document,
): HtmlDocument {
    return Object.freeze({
        children: Object.freeze(
            document.childNodes.map((node) => convertDocumentChild(node)),
        ),
        type: 'document',
    });
}

/** @internal Converts a context-free parse5 fragment. */
export function convertDocumentFragment(
    fragment: DefaultTreeAdapterTypes.DocumentFragment,
): HtmlDocumentFragment {
    return Object.freeze({
        children: Object.freeze(
            fragment.childNodes.map((node) => convertChild(node)),
        ),
        type: 'document-fragment',
    });
}

function convertDocumentChild(
    node: DefaultTreeAdapterTypes.ChildNode,
): HtmlDocumentChildNode {
    if (defaultTreeAdapter.isDocumentTypeNode(node)) {
        return convertDoctype(node);
    }

    return convertChild(node);
}

function convertChild(node: DefaultTreeAdapterTypes.ChildNode): HtmlChildNode {
    if (defaultTreeAdapter.isElementNode(node)) {
        return convertElement(node);
    }

    if (defaultTreeAdapter.isTextNode(node)) {
        return convertText(node);
    }

    if (defaultTreeAdapter.isCommentNode(node)) {
        return convertComment(node);
    }

    throw new Error(
        `Unexpected document type node outside a complete document: "${node.name}".`,
    );
}

function convertElement(node: DefaultTreeAdapterTypes.Element): HtmlElement {
    const location = node.sourceCodeLocation;
    const children = isHtmlTemplate(node)
        ? node.content.childNodes
        : node.childNodes;

    return Object.freeze({
        attributes: Object.freeze(
            node.attrs.map((attribute) =>
                convertAttribute(attribute, location),
            ),
        ),
        children: Object.freeze(children.map((child) => convertChild(child))),
        namespace: convertNamespace(node.namespaceURI),
        ...(location === undefined || location === null
            ? {}
            : { source: convertElementSourceRange(location) }),
        tagName: node.tagName,
        type: 'element',
    });
}

function convertAttribute(
    attribute: DefaultTreeAdapterTypes.Element['attrs'][number],
    elementLocation:
        DefaultTreeAdapterTypes.Element['sourceCodeLocation'] | undefined,
): HtmlAttribute {
    const source = findAttributeSourceRange(
        elementLocation,
        attribute.name,
        attribute.prefix,
    );

    return Object.freeze({
        name: attribute.name,
        ...(attribute.namespace === undefined
            ? {}
            : { namespace: attribute.namespace }),
        ...(attribute.prefix === undefined ? {} : { prefix: attribute.prefix }),
        ...(source === undefined ? {} : { source }),
        value: attribute.value,
    });
}

function convertText(node: DefaultTreeAdapterTypes.TextNode): HtmlText {
    const source = node.sourceCodeLocation;
    return Object.freeze({
        ...(source === undefined || source === null
            ? {}
            : { source: convertSourceRange(source) }),
        type: 'text',
        value: node.value,
    });
}

function convertComment(
    node: DefaultTreeAdapterTypes.CommentNode,
): HtmlComment {
    const source = node.sourceCodeLocation;
    return Object.freeze({
        ...(source === undefined || source === null
            ? {}
            : { source: convertSourceRange(source) }),
        type: 'comment',
        value: node.data,
    });
}

function convertDoctype(
    node: DefaultTreeAdapterTypes.DocumentType,
): HtmlDoctype {
    const source = node.sourceCodeLocation;
    return Object.freeze({
        name: node.name,
        publicId: node.publicId,
        ...(source === undefined || source === null
            ? {}
            : { source: convertSourceRange(source) }),
        systemId: node.systemId,
        type: 'doctype',
    });
}

function isHtmlTemplate(
    node: DefaultTreeAdapterTypes.Element,
): node is DefaultTreeAdapterTypes.Template {
    return (
        node.namespaceURI === html.NS.HTML &&
        node.tagName === 'template' &&
        'content' in node
    );
}

function convertNamespace(namespace: html.NS): HtmlNamespace {
    switch (namespace) {
        case html.NS.HTML:
            return 'html';
        case html.NS.SVG:
            return 'svg';
        case html.NS.MATHML:
            return 'mathml';
        default:
            throw new Error(`Unsupported element namespace "${namespace}".`);
    }
}
