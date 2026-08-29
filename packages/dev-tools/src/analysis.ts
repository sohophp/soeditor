import {
    parseHtmlDocument,
    parseHtmlFragment,
    type HtmlDocumentChildNode,
    type HtmlElement,
    type HtmlNode,
    type SourceRange,
} from '@soeditor/html';

/** One source-backed heading in document order. */
export interface OutlineItem {
    readonly label: string;
    readonly level: number;
    readonly source?: SourceRange;
}

/** One attribute shown by the read-only HTML inspector. */
export interface InspectorAttribute {
    readonly name: string;
    readonly value: string;
}

/** Selection-derived, non-authoritative visual element information. */
export interface InspectorElement {
    readonly attributes: readonly InspectorAttribute[];
    readonly path: readonly string[];
    readonly tagName: string;
}

/** Builds a basic immutable heading outline from canonical HTML. */
export function createDocumentOutline(source: string): readonly OutlineItem[] {
    const children = parseSource(source);
    const items: OutlineItem[] = [];
    visitElements(children, (element) => {
        const match = /^h([1-6])$/u.exec(element.tagName);
        if (element.namespace !== 'html' || match === null) {
            return;
        }
        const level = Number(match[1]);
        const label = textContent(element).replace(/\s+/gu, ' ').trim();
        items.push(
            Object.freeze({
                label: label.length === 0 ? `(empty h${String(level)})` : label,
                level,
                ...(element.source === undefined
                    ? {}
                    : { source: element.source }),
            }),
        );
    });
    return Object.freeze(items);
}

/** Reads a visual DOM selection without treating it as canonical state. */
export function inspectVisualSelection(
    visualElement: HTMLElement,
): InspectorElement | undefined {
    const selection = visualElement.ownerDocument.getSelection();
    const node = selection?.anchorNode;
    if (node === null || node === undefined || !visualElement.contains(node)) {
        return undefined;
    }
    const selected =
        node.nodeType === 1 ? (node as Element) : node.parentElement;
    if (
        selected === null ||
        selected === visualElement ||
        !visualElement.contains(selected)
    ) {
        return undefined;
    }
    const path = elementPath(selected, visualElement);
    const attributes = Array.from(selected.attributes)
        .filter(
            ({ name }) =>
                !name.startsWith('data-soeditor-') &&
                name !== 'contenteditable',
        )
        .map(({ name, value }) => Object.freeze({ name, value }));
    return Object.freeze({
        attributes: Object.freeze(attributes),
        path,
        tagName: selected.tagName.toLowerCase(),
    });
}

function parseSource(source: string): readonly HtmlDocumentChildNode[] {
    const result = isCompleteDocument(source)
        ? parseHtmlDocument(source)
        : parseHtmlFragment(source);
    return result.document.children;
}

function visitElements(
    nodes: readonly HtmlDocumentChildNode[],
    visit: (element: HtmlElement) => void,
): void {
    for (const node of nodes) {
        if (node.type !== 'element') {
            continue;
        }
        visit(node);
        visitElements(node.children, visit);
    }
}

function textContent(node: HtmlNode): string {
    if (node.type === 'text') {
        return node.value;
    }
    if (node.type !== 'element') {
        return '';
    }
    return node.children.map(textContent).join('');
}

function elementPath(
    selected: Element,
    visualElement: HTMLElement,
): readonly string[] {
    const path: string[] = [];
    let current: Element | null = selected;
    while (current !== null && current !== visualElement) {
        path.unshift(current.tagName.toLowerCase());
        current = current.parentElement;
    }
    return Object.freeze(path);
}

function isCompleteDocument(source: string): boolean {
    return /<!doctype\s|<\/?(?:html|head|body)(?:\s|>)/iu.test(source);
}
