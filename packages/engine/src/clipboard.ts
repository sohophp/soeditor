import {
    parseHtmlFragment,
    serializeHtmlFragment,
    type HtmlChildNode,
    type HtmlDocumentFragment,
} from '@soeditor/html';

import {
    createEditingModel,
    freezeModel,
    serializeEditingModel,
    type EditingBlock,
    type EditingModel,
    type EditingSelection,
} from './model.js';
import {
    extractSelection,
    UnsupportedEditingSelectionError,
} from './operations.js';

export interface ClipboardPayload {
    readonly html: string;
    readonly text: string;
}

const BLOCK_ELEMENTS = new Set([
    'address',
    'article',
    'aside',
    'blockquote',
    'div',
    'dl',
    'fieldset',
    'figure',
    'footer',
    'form',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'header',
    'hr',
    'main',
    'nav',
    'ol',
    'p',
    'pre',
    'section',
    'table',
    'ul',
]);

export function createClipboardPayload(
    model: EditingModel,
    selection: EditingSelection,
): ClipboardPayload {
    const selected = extractSelection(model, selection);
    return Object.freeze({
        html: serializeHtmlFragment(serializeEditingModel(selected)),
        text: modelToPlainText(selected),
    });
}

export function createPastedModel(
    html: string,
    plainText: string,
): EditingModel {
    if (html.length > 0) {
        if (/<!doctype\s|<\/?(?:html|head|body)(?:\s|>)/iu.test(html)) {
            throw new UnsupportedEditingSelectionError(
                'A complete HTML document cannot be pasted into an HTML fragment without losing its document structure.',
            );
        }
        const parsed = parseHtmlFragment(html).document;
        const normalized = normalizePastedFragment(parsed);
        if (normalized.children.length > 0) {
            return createEditingModel(normalized);
        }
    }

    return createPlainTextModel(plainText);
}

export function modelToPlainText(model: EditingModel): string {
    return model.blocks.map((block) => blockText(block)).join('\n');
}

function createPlainTextModel(source: string): EditingModel {
    const lines = source
        .replaceAll('\r\n', '\n')
        .replaceAll('\r', '\n')
        .split('\n');
    return freezeModel({
        blocks: lines.map((line): EditingBlock => ({
            attributes: [],
            inlines:
                line.length === 0
                    ? []
                    : [{ kind: 'text', marks: [], text: line }],
            kind: 'paragraph',
            tagName: 'p',
        })),
    });
}

function normalizePastedFragment(
    fragment: HtmlDocumentFragment,
): HtmlDocumentFragment {
    const children: HtmlChildNode[] = [];
    let inline: HtmlChildNode[] = [];

    const flushInline = (): void => {
        if (inline.length === 0) {
            return;
        }
        if (
            inline.every(
                (node) =>
                    node.type === 'text' && node.value.trim().length === 0,
            )
        ) {
            inline = [];
            return;
        }
        children.push(
            Object.freeze({
                type: 'element',
                tagName: 'p',
                namespace: 'html',
                attributes: Object.freeze([]),
                children: Object.freeze(inline),
            }),
        );
        inline = [];
    };

    for (const child of fragment.children) {
        if (isBlock(child)) {
            flushInline();
            children.push(child);
        } else {
            inline.push(child);
        }
    }
    flushInline();
    return Object.freeze({
        type: 'document-fragment',
        children: Object.freeze(children),
    });
}

function isBlock(node: HtmlChildNode): boolean {
    return (
        node.type === 'element' &&
        node.namespace === 'html' &&
        BLOCK_ELEMENTS.has(node.tagName)
    );
}

function blockText(block: EditingBlock): string {
    if (block.kind === 'opaque-block') {
        return '';
    }

    return block.inlines
        .map((inline) => (inline.kind === 'text' ? inline.text : ''))
        .join('');
}
