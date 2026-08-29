import type { HtmlChildNode } from '@soeditor/html';

import type {
    EditingBlock,
    EditingInline,
    EditingModel,
    EditingPoint,
    EditingSelection,
} from './model.js';
import { paragraphLength } from './model.js';
import { validateSelection } from './operations.js';

interface DomSpan {
    readonly block: number;
    readonly start: number;
    readonly end: number;
}

interface TextSpan extends DomSpan {
    readonly node: Text;
}

export class DomProjection {
    readonly #document: Document;
    readonly #host: HTMLElement;
    readonly #spans = new WeakMap<Node, DomSpan>();
    readonly #paragraphs = new Map<number, HTMLElement>();
    readonly #textSpans: TextSpan[] = [];
    #model: EditingModel;

    constructor(host: HTMLElement, model: EditingModel) {
        this.#host = host;
        this.#document = host.ownerDocument;
        this.#model = model;
    }

    render(model: EditingModel): void {
        this.#model = model;
        this.#paragraphs.clear();
        this.#textSpans.length = 0;
        this.#host.replaceChildren(
            ...model.blocks.map((block, index) =>
                this.#renderBlock(block, index),
            ),
        );
    }

    readSelection(): EditingSelection | undefined {
        const selection = this.#document.getSelection();
        if (
            selection === null ||
            selection.anchorNode === null ||
            selection.focusNode === null ||
            !this.#contains(selection.anchorNode) ||
            !this.#contains(selection.focusNode)
        ) {
            return undefined;
        }

        const anchor = this.#readPoint(
            selection.anchorNode,
            selection.anchorOffset,
        );
        const focus = this.#readPoint(
            selection.focusNode,
            selection.focusOffset,
        );
        if (anchor === undefined || focus === undefined) {
            return undefined;
        }

        return { anchor, focus };
    }

    restoreSelection(selection: EditingSelection): boolean {
        validateSelection(this.#model, selection);
        const anchor = this.#resolvePoint(selection.anchor);
        const focus = this.#resolvePoint(selection.focus);
        const nativeSelection = this.#document.getSelection();

        if (
            anchor === undefined ||
            focus === undefined ||
            nativeSelection === null
        ) {
            return false;
        }

        nativeSelection.setBaseAndExtent(
            anchor.node,
            anchor.offset,
            focus.node,
            focus.offset,
        );
        return true;
    }

    #renderBlock(block: EditingBlock, blockIndex: number): HTMLElement {
        if (block.kind === 'opaque-block') {
            const placeholder = this.#document.createElement('div');
            placeholder.dataset.soeditorOpaqueBlock = 'true';
            placeholder.contentEditable = 'false';
            placeholder.textContent = describeOpaque(block.node);
            this.#spans.set(placeholder, {
                block: blockIndex,
                end: 1,
                start: 0,
            });
            return placeholder;
        }

        const paragraph = this.#document.createElement('p');
        paragraph.dataset.soeditorParagraph = 'true';
        this.#paragraphs.set(blockIndex, paragraph);
        let position = 0;

        for (const inline of block.inlines) {
            const rendered = this.#renderInline(inline, blockIndex, position);
            paragraph.append(rendered.node);
            position = rendered.end;
        }

        if (paragraph.childNodes.length === 0) {
            const placeholder = this.#document.createElement('br');
            placeholder.dataset.soeditorPlaceholder = 'true';
            this.#spans.set(placeholder, {
                block: blockIndex,
                end: 0,
                start: 0,
            });
            paragraph.append(placeholder);
        }

        this.#spans.set(paragraph, {
            block: blockIndex,
            end: paragraphLength(block),
            start: 0,
        });
        return paragraph;
    }

    #renderInline(
        inline: EditingInline,
        block: number,
        start: number,
    ): { readonly node: Node; readonly end: number } {
        if (inline.kind === 'opaque-inline') {
            const placeholder = this.#document.createElement('span');
            placeholder.dataset.soeditorOpaqueInline = 'true';
            placeholder.contentEditable = 'false';
            placeholder.textContent = describeOpaque(inline.node);
            const span = { block, end: start + 1, start };
            this.#spans.set(placeholder, span);
            return { node: placeholder, end: span.end };
        }

        const text = this.#document.createTextNode(inline.text);
        const end = start + inline.text.length;
        const span = { block, end, node: text, start };
        this.#spans.set(text, span);
        this.#textSpans.push(span);
        let rendered: Node = text;

        for (const mark of [...inline.marks].reverse()) {
            const wrapper = this.#document.createElement(mark);
            wrapper.append(rendered);
            this.#spans.set(wrapper, { block, end, start });
            rendered = wrapper;
        }

        return { node: rendered, end };
    }

    #readPoint(node: Node, offset: number): EditingPoint | undefined {
        const direct = this.#spans.get(node);
        if (node.nodeType === 3 && direct !== undefined) {
            return {
                block: direct.block,
                offset: Math.min(direct.end, direct.start + offset),
            };
        }

        if (node.nodeType === 1 && direct !== undefined) {
            const child = node.childNodes[offset - 1];
            if (offset === 0 || child === undefined) {
                return { block: direct.block, offset: direct.start };
            }
            const childSpan = this.#findSpan(child);
            return childSpan === undefined
                ? undefined
                : { block: childSpan.block, offset: childSpan.end };
        }

        if (node === this.#host) {
            const child = this.#host.childNodes[offset - 1];
            const span =
                child === undefined ? undefined : this.#findSpan(child);
            if (span !== undefined) {
                const block = this.#model.blocks[span.block];
                return block?.kind === 'paragraph'
                    ? { block: span.block, offset: paragraphLength(block) }
                    : undefined;
            }
        }

        const span = this.#findSpan(node);
        return span === undefined
            ? undefined
            : {
                  block: span.block,
                  offset: offset === 0 ? span.start : span.end,
              };
    }

    #resolvePoint(
        point: EditingPoint,
    ): { readonly node: Node; readonly offset: number } | undefined {
        const matches = this.#textSpans.filter(
            (span) =>
                span.block === point.block &&
                point.offset >= span.start &&
                point.offset <= span.end,
        );
        const match = matches[0];
        if (match !== undefined) {
            return { node: match.node, offset: point.offset - match.start };
        }

        const paragraph = this.#paragraphs.get(point.block);
        if (paragraph === undefined) {
            return undefined;
        }

        let childOffset = 0;
        for (const child of Array.from(paragraph.childNodes)) {
            const span = this.#findSpan(child);
            if (span !== undefined && span.end <= point.offset) {
                childOffset += 1;
            }
        }
        return { node: paragraph, offset: childOffset };
    }

    #findSpan(node: Node): DomSpan | undefined {
        const own = this.#spans.get(node);
        if (own !== undefined) {
            return own;
        }

        for (const child of Array.from(node.childNodes)) {
            const childSpan = this.#findSpan(child);
            if (childSpan !== undefined) {
                return childSpan;
            }
        }
        return undefined;
    }

    #contains(node: Node): boolean {
        return node === this.#host || this.#host.contains(node);
    }
}

function describeOpaque(node: HtmlChildNode): string {
    if (node.type === 'element') {
        return `<${node.tagName}>`;
    }
    if (node.type === 'comment') {
        return '<!-- comment -->';
    }
    return `[${node.type}]`;
}
