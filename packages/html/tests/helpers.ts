import type {
    HtmlAttribute,
    HtmlDocument,
    HtmlDocumentFragment,
    HtmlNode,
} from '../src/index.js';

type SemanticValue =
    | null
    | boolean
    | number
    | string
    | readonly SemanticValue[]
    | { readonly [key: string]: SemanticValue };

export function withoutSource(
    node: HtmlDocument | HtmlDocumentFragment,
): SemanticValue {
    return stripNode(node);
}

function stripNode(node: HtmlNode): SemanticValue {
    switch (node.type) {
        case 'document':
        case 'document-fragment':
            return {
                children: node.children.map((child) => stripNode(child)),
                type: node.type,
            };
        case 'element':
            return {
                attributes: node.attributes.map((attribute) =>
                    stripAttribute(attribute),
                ),
                children: node.children.map((child) => stripNode(child)),
                namespace: node.namespace,
                tagName: node.tagName,
                type: node.type,
            };
        case 'text':
        case 'comment':
            return { type: node.type, value: node.value };
        case 'doctype':
            return {
                name: node.name,
                publicId: node.publicId,
                systemId: node.systemId,
                type: node.type,
            };
        default:
            return assertNever(node);
    }
}

function stripAttribute(attribute: HtmlAttribute): SemanticValue {
    return {
        name: attribute.name,
        ...(attribute.namespace === undefined
            ? {}
            : { namespace: attribute.namespace }),
        ...(attribute.prefix === undefined ? {} : { prefix: attribute.prefix }),
        value: attribute.value,
    };
}

function assertNever(value: never): never {
    throw new Error(`Unexpected node: ${String(value)}.`);
}
