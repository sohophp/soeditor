import { defaultTreeAdapter, html } from 'parse5';
import type { DefaultTreeAdapterTypes } from 'parse5';

import type {
    HtmlChildNode,
    HtmlDocument,
    HtmlDocumentFragment,
    HtmlElement,
    HtmlNamespace,
} from '../nodes.js';

/** @internal Builds a parse5 serialization tree from a public document. */
export function convertToParse5Document(
    document: HtmlDocument,
): DefaultTreeAdapterTypes.Document {
    const result = defaultTreeAdapter.createDocument();

    for (const child of document.children) {
        if (child.type === 'doctype') {
            defaultTreeAdapter.setDocumentType(
                result,
                child.name,
                child.publicId,
                child.systemId,
            );
        } else {
            appendChild(result, child);
        }
    }

    return result;
}

/** @internal Builds a parse5 serialization tree from a public fragment. */
export function convertToParse5Fragment(
    fragment: HtmlDocumentFragment,
): DefaultTreeAdapterTypes.DocumentFragment {
    const result = defaultTreeAdapter.createDocumentFragment();

    for (const child of fragment.children) {
        appendChild(result, child);
    }

    return result;
}

function appendChild(
    parent: DefaultTreeAdapterTypes.ParentNode,
    child: HtmlChildNode,
): void {
    switch (child.type) {
        case 'element': {
            appendElement(parent, child);
            return;
        }
        case 'text': {
            defaultTreeAdapter.appendChild(
                parent,
                defaultTreeAdapter.createTextNode(child.value),
            );
            return;
        }
        case 'comment': {
            defaultTreeAdapter.appendChild(
                parent,
                defaultTreeAdapter.createCommentNode(child.value),
            );
            return;
        }
        default:
            assertNever(child);
    }
}

function appendElement(
    parent: DefaultTreeAdapterTypes.ParentNode,
    child: HtmlElement,
): void {
    const element = defaultTreeAdapter.createElement(
        child.tagName,
        convertNamespace(child.namespace),
        child.attributes.map((attribute) => ({
            name: attribute.name,
            ...(attribute.namespace === undefined
                ? {}
                : { namespace: attribute.namespace }),
            ...(attribute.prefix === undefined
                ? {}
                : { prefix: attribute.prefix }),
            value: attribute.value,
        })),
    );

    defaultTreeAdapter.appendChild(parent, element);

    if (child.namespace === 'html' && child.tagName === 'template') {
        const template = element as DefaultTreeAdapterTypes.Template;
        const content = defaultTreeAdapter.createDocumentFragment();
        defaultTreeAdapter.setTemplateContent(template, content);

        for (const grandchild of child.children) {
            appendChild(content, grandchild);
        }

        return;
    }

    for (const grandchild of child.children) {
        appendChild(element, grandchild);
    }
}

function convertNamespace(namespace: HtmlNamespace): html.NS {
    switch (namespace) {
        case 'html':
            return html.NS.HTML;
        case 'svg':
            return html.NS.SVG;
        case 'mathml':
            return html.NS.MATHML;
        default:
            return assertNever(namespace);
    }
}

function assertNever(value: never): never {
    throw new Error(`Unsupported HTML tree value: ${String(value)}.`);
}
