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
import type { VisualDecoration } from './visual-decorations.js';
import {
    getStructuredNodeViewFactory,
    type StructuredEditingSchema,
    type StructuredNodeViewInstance,
    type StructuredNodeViewSelectionOptions,
    type StructuredNodeViewState,
} from './structured-editing.js';

interface DomSpan {
    readonly block: number;
    readonly start: number;
    readonly end: number;
}

interface TextSpan extends DomSpan {
    readonly node: Text;
}

interface DomProjectionOptions {
    readonly hasCommand: (commandId: string) => boolean;
    readonly decorations: () => readonly VisualDecoration[];
    readonly executeCommand: (
        commandId: string,
        args: readonly unknown[],
    ) => unknown;
    readonly insertParagraphAfter: (block: number) => void;
    readonly projectionId: 'visual' | 'wysiwyg';
    readonly schema: StructuredEditingSchema;
    readonly readonly: boolean;
}

interface MountedNodeView {
    readonly block: number;
    readonly boundary: HTMLElement;
    readonly instance: StructuredNodeViewInstance;
}

interface StructuredDropTarget {
    readonly block: number;
    readonly placement: 'before' | 'after';
}

export class DomProjection {
    readonly #document: Document;
    readonly #host: HTMLElement;
    readonly #spans = new WeakMap<Node, DomSpan>();
    readonly #paragraphs = new Map<number, HTMLElement>();
    readonly #structuredBlocks = new Map<number, HTMLElement>();
    readonly #textSpans: TextSpan[] = [];
    readonly #nodeViews: MountedNodeView[] = [];
    readonly #nodeViewOwnedNodes = new WeakSet<Node>();
    readonly #options: DomProjectionOptions;
    #model: EditingModel;
    #readonly = false;
    #selectedStructuredBlock: number | undefined;

    constructor(
        host: HTMLElement,
        model: EditingModel,
        options: DomProjectionOptions,
    ) {
        this.#host = host;
        this.#document = host.ownerDocument;
        this.#model = model;
        this.#selectedStructuredBlock = undefined;
        this.#options = options;
        this.#readonly = options.readonly;
    }

    render(model: EditingModel): void {
        const decorations = this.#options.decorations();
        for (const decoration of decorations) {
            validateSelection(model, {
                anchor: decoration.from,
                focus: decoration.to,
            });
        }
        const cleanupErrors = this.#releaseNodeViews();
        this.#model = model;
        this.#selectedStructuredBlock = undefined;
        this.#paragraphs.clear();
        this.#structuredBlocks.clear();
        this.#textSpans.length = 0;
        const rendered: Node[] = [];

        try {
            for (let index = 0; index < model.blocks.length; index += 1) {
                const block = model.blocks[index];
                if (block?.kind === 'paragraph' && block.list !== undefined) {
                    const list = this.#renderListAt(index, 0, decorations);
                    index = list.nextIndex - 1;
                    rendered.push(list.element);
                } else if (block !== undefined) {
                    rendered.push(this.#renderBlock(block, index, decorations));
                }
            }
        } catch (error: unknown) {
            const errors = [error, ...this.#releaseNodeViews()];
            throw new AggregateError(
                errors,
                'Structured node-view rendering failed.',
            );
        }

        this.#host.replaceChildren(...rendered);
        if (cleanupErrors.length > 0) {
            throw new AggregateError(
                cleanupErrors,
                'Structured node-view cleanup failed during rendering.',
            );
        }
    }

    setReadonly(readonly: boolean): void {
        if (this.#readonly === readonly) {
            return;
        }
        this.#readonly = readonly;
        this.#updateNodeViews();
    }

    selectStructuredBlock(block: number, focus = true): boolean {
        const node = this.#model.blocks[block];
        const boundary = this.#structuredBlocks.get(block);
        if (node?.kind !== 'structured-block' || boundary === undefined) {
            return false;
        }
        this.#selectedStructuredBlock = block;
        this.#updateNodeViews();
        if (focus) {
            boundary.focus();
        }
        return true;
    }

    selectStructuredBlockFromNode(
        node: EventTarget | null,
        focus = false,
    ): boolean {
        if (!(node instanceof this.#document.defaultView!.Node)) {
            return false;
        }
        for (const [block, boundary] of this.#structuredBlocks) {
            if (boundary === node || boundary.contains(node)) {
                return this.selectStructuredBlock(block, focus);
            }
        }
        return false;
    }

    isStructuredBoundary(node: EventTarget | null): boolean {
        return [...this.#structuredBlocks.values()].some(
            (boundary) => boundary === node,
        );
    }

    isInsideStructuredView(node: EventTarget | null): boolean {
        const view = this.#document.defaultView;
        if (view === null || !(node instanceof view.Node)) {
            return false;
        }
        return [...this.#structuredBlocks.values()].some(
            (boundary) => boundary !== node && boundary.contains(node),
        );
    }

    moveFromStructuredBlock(direction: -1 | 1): boolean {
        const selected = this.#selectedStructuredBlock;
        if (selected === undefined) {
            return false;
        }
        for (
            let index = selected + direction;
            index >= 0 && index < this.#model.blocks.length;
            index += direction
        ) {
            const block = this.#model.blocks[index];
            if (block?.kind === 'paragraph') {
                const offset = direction < 0 ? paragraphLength(block) : 0;
                this.#host.focus();
                return this.restoreSelection({
                    anchor: { block: index, offset },
                    focus: { block: index, offset },
                });
            }
            if (block?.kind === 'structured-block') {
                return this.selectStructuredBlock(index);
            }
        }
        return false;
    }

    moveIntoStructuredBlock(
        selection: EditingSelection,
        direction: -1 | 1,
    ): boolean {
        if (
            selection.anchor.block !== selection.focus.block ||
            selection.anchor.offset !== selection.focus.offset
        ) {
            return false;
        }
        const block = this.#model.blocks[selection.anchor.block];
        if (
            block?.kind !== 'paragraph' ||
            (direction < 0
                ? selection.anchor.offset !== 0
                : selection.anchor.offset !== paragraphLength(block))
        ) {
            return false;
        }
        const target = selection.anchor.block + direction;
        return this.#model.blocks[target]?.kind === 'structured-block'
            ? this.selectStructuredBlock(target)
            : false;
    }

    ownsNodeViewMutation(record: MutationRecord): boolean {
        const node = record.target;
        if (this.#nodeViewOwnedNodes.has(node)) {
            for (const added of Array.from(record.addedNodes)) {
                this.#markNodeViewTree(added);
            }
            return true;
        }
        for (const boundary of this.#structuredBlocks.values()) {
            if (boundary !== node && boundary.contains(node)) {
                this.#markNodeViewTree(node);
                for (const added of Array.from(record.addedNodes)) {
                    this.#markNodeViewTree(added);
                }
                return true;
            }
        }
        return false;
    }

    readDropTarget(
        target: EventTarget | null,
        clientY: number,
    ): StructuredDropTarget | undefined {
        const view = this.#document.defaultView;
        if (view === null || !(target instanceof view.Node)) {
            return undefined;
        }
        let current: Node | null = target;
        while (current !== null && current !== this.#host) {
            const span = this.#spans.get(current);
            if (span !== undefined) {
                const element =
                    this.#structuredBlocks.get(span.block) ??
                    this.#paragraphs.get(span.block);
                if (element === undefined) {
                    return undefined;
                }
                const bounds = element.getBoundingClientRect();
                return Object.freeze({
                    block: span.block,
                    placement:
                        clientY >= bounds.top + bounds.height / 2
                            ? 'after'
                            : 'before',
                });
            }
            current = current.parentNode;
        }
        return undefined;
    }

    destroy(): void {
        const errors = this.#releaseNodeViews();
        if (errors.length > 0) {
            throw new AggregateError(
                errors,
                'Structured node-view cleanup failed.',
            );
        }
    }

    readSelection(): EditingSelection | undefined {
        const active = this.#document.activeElement;
        for (const [block, boundary] of this.#structuredBlocks) {
            if (
                active !== null &&
                (boundary === active || boundary.contains(active))
            ) {
                return structuredSelection(block);
            }
        }
        if (this.#selectedStructuredBlock !== undefined) {
            this.#selectedStructuredBlock = undefined;
            this.#updateNodeViews();
        }
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

    readRetainedSelection(): EditingSelection | undefined {
        return this.#selectedStructuredBlock === undefined
            ? this.readSelection()
            : structuredSelection(this.#selectedStructuredBlock);
    }

    restoreSelection(selection: EditingSelection): boolean {
        validateSelection(this.#model, selection);
        const structured = selectedStructuredBlock(this.#model, selection);
        if (structured !== undefined) {
            return this.selectStructuredBlock(structured);
        }
        this.#selectedStructuredBlock = undefined;
        this.#updateNodeViews();
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

    #renderBlock(
        block: EditingBlock,
        blockIndex: number,
        decorations: readonly VisualDecoration[],
    ): HTMLElement {
        if (block.kind === 'opaque-block') {
            const placeholder = this.#document.createElement('div');
            placeholder.dataset.soeditorOpaqueBlock = 'true';
            placeholder.contentEditable = 'false';
            if (this.#options.projectionId === 'wysiwyg') {
                placeholder.className = 'soeditor-wysiwyg-preserved-block';
                const visible = appendWysiwygPresentation(
                    placeholder,
                    block.node,
                    this.#document,
                );
                placeholder.hidden = !visible;
                this.#spans.set(placeholder, {
                    block: blockIndex,
                    end: 1,
                    start: 0,
                });
                this.#decorateElement(placeholder, blockIndex, decorations);
                return placeholder;
            }
            placeholder.className = 'soeditor-opaque soeditor-opaque--block';
            appendOpaquePresentation(placeholder, block.node, this.#document);
            this.#appendOpaqueSourceAction(placeholder, block.node);
            const continuation = this.#document.createElement('button');
            continuation.type = 'button';
            continuation.className = 'soeditor-opaque__continue';
            continuation.dataset.soeditorInsertParagraphAfter =
                String(blockIndex);
            continuation.textContent = '＋ Continue editing after this content';
            continuation.title =
                'Insert an editable paragraph after this content';
            continuation.disabled = this.#readonly;
            continuation.addEventListener('pointerdown', (event) => {
                event.preventDefault();
            });
            continuation.addEventListener('click', () => {
                if (!this.#readonly) {
                    this.#options.insertParagraphAfter(blockIndex);
                }
            });
            placeholder.append(continuation);
            this.#spans.set(placeholder, {
                block: blockIndex,
                end: 1,
                start: 0,
            });
            this.#decorateElement(placeholder, blockIndex, decorations);
            return placeholder;
        }

        if (block.kind === 'structured-block') {
            const element = this.#renderStructuredBlock(block, blockIndex);
            this.#decorateElement(element, blockIndex, decorations);
            return element;
        }

        return this.#renderParagraph(
            block,
            blockIndex,
            block.tagName,
            decorations,
        );
    }

    #renderListAt(
        startIndex: number,
        depth: number,
        decorations: readonly VisualDecoration[],
    ): { readonly element: HTMLElement; readonly nextIndex: number } {
        const first = this.#model.blocks[startIndex];
        if (
            first?.kind !== 'paragraph' ||
            first.list === undefined ||
            (first.listDepth ?? 0) !== depth
        ) {
            throw new Error(
                'The visual model contains an invalid nested list.',
            );
        }
        const tagName = first.list;
        const list = this.#document.createElement(tagName);
        list.dataset.soeditorList = tagName;
        applySafeListProjection(list, first.listAttributes ?? []);
        let index = startIndex;
        while (index < this.#model.blocks.length) {
            const item = this.#model.blocks[index];
            if (
                item?.kind !== 'paragraph' ||
                item.list !== tagName ||
                (item.listDepth ?? 0) !== depth ||
                (index > startIndex && item.listStart === true)
            ) {
                break;
            }
            const listItem = this.#renderParagraph(
                item,
                index,
                'li',
                decorations,
            );
            index += 1;
            while (index < this.#model.blocks.length) {
                const nested = this.#model.blocks[index];
                if (
                    nested?.kind !== 'paragraph' ||
                    nested.list === undefined ||
                    (nested.listDepth ?? 0) <= depth
                ) {
                    break;
                }
                if ((nested.listDepth ?? 0) !== depth + 1) {
                    throw new Error('Nested list depth skips its parent.');
                }
                const child = this.#renderListAt(index, depth + 1, decorations);
                listItem.append(child.element);
                index = child.nextIndex;
            }
            list.append(listItem);
        }
        return { element: list, nextIndex: index };
    }

    #renderStructuredBlock(
        block: Extract<EditingBlock, { readonly kind: 'structured-block' }>,
        blockIndex: number,
    ): HTMLElement {
        const boundary = this.#document.createElement('div');
        boundary.dataset.soeditorStructuredBlock = block.type;
        boundary.dataset.soeditorStructuredBehavior = block.behavior;
        boundary.contentEditable = 'false';
        boundary.tabIndex = 0;
        boundary.setAttribute('role', 'group');
        boundary.setAttribute(
            'aria-label',
            `Structured content: ${block.type}`,
        );
        boundary.setAttribute('aria-current', 'false');
        boundary.setAttribute('aria-disabled', String(this.#readonly));
        boundary.draggable = block.behavior === 'atomic' && !this.#readonly;
        this.#structuredBlocks.set(blockIndex, boundary);
        this.#spans.set(boundary, { block: blockIndex, end: 1, start: 0 });

        const factory = getStructuredNodeViewFactory(
            this.#options.schema,
            block.type,
        );
        if (factory === undefined) {
            boundary.textContent = `<${block.type}>`;
            return boundary;
        }
        const state = this.#nodeViewState(block, false);
        const instance = factory(
            Object.freeze({
                ...state,
                actions: Object.freeze({
                    execute: (commandId: string, ...args: readonly unknown[]) =>
                        this.#options.executeCommand(commandId, args),
                    select: (options?: StructuredNodeViewSelectionOptions) => {
                        this.selectStructuredBlock(
                            blockIndex,
                            options?.focus ?? true,
                        );
                    },
                }),
                document: this.#document,
            }),
        );
        if (
            typeof instance !== 'object' ||
            instance === null ||
            !(
                instance.element instanceof
                this.#document.defaultView!.HTMLElement
            ) ||
            instance.element.ownerDocument !== this.#document ||
            instance.element.isConnected ||
            instance.element === this.#host ||
            instance.element.contains(this.#host)
        ) {
            const invalid = new TypeError(
                `Structured node view "${block.type}" returned an invalid host element.`,
            );
            try {
                instance?.destroy?.();
            } catch (error: unknown) {
                throw new AggregateError(
                    [invalid, error],
                    `Structured node view "${block.type}" failed validation and cleanup.`,
                );
            }
            throw invalid;
        }
        try {
            boundary.append(instance.element);
            this.#markNodeViewTree(instance.element);
        } catch (error: unknown) {
            try {
                instance.destroy?.();
            } catch (cleanupError: unknown) {
                throw new AggregateError(
                    [error, cleanupError],
                    `Structured node view "${block.type}" failed mounting and cleanup.`,
                );
            }
            throw error;
        }
        this.#nodeViews.push({ block: blockIndex, boundary, instance });
        return boundary;
    }

    #markNodeViewTree(node: Node): void {
        this.#nodeViewOwnedNodes.add(node);
        for (const child of Array.from(node.childNodes)) {
            this.#markNodeViewTree(child);
        }
    }

    #nodeViewState(
        node: Extract<EditingBlock, { readonly kind: 'structured-block' }>,
        selected: boolean,
    ): StructuredNodeViewState {
        return Object.freeze({
            node,
            projectionId: this.#options.projectionId,
            readonly: this.#readonly || node.behavior === 'readonly',
            selected,
        });
    }

    #updateNodeViews(): void {
        const errors: unknown[] = [];
        for (const [block, boundary] of this.#structuredBlocks) {
            const selected = block === this.#selectedStructuredBlock;
            boundary.setAttribute('aria-current', String(selected));
            boundary.classList.toggle('soeditor-structured-selected', selected);
            boundary.setAttribute('aria-disabled', String(this.#readonly));
            const node = this.#model.blocks[block];
            boundary.draggable =
                node?.kind === 'structured-block' &&
                node.behavior === 'atomic' &&
                !this.#readonly;
        }
        for (const control of Array.from(
            this.#host.querySelectorAll<HTMLButtonElement>(
                '[data-soeditor-insert-paragraph-after]',
            ),
        )) {
            control.disabled = this.#readonly;
        }
        for (const mounted of this.#nodeViews) {
            const node = this.#model.blocks[mounted.block];
            if (node?.kind !== 'structured-block') {
                continue;
            }
            try {
                mounted.instance.update?.(
                    this.#nodeViewState(
                        node,
                        mounted.block === this.#selectedStructuredBlock,
                    ),
                );
            } catch (error: unknown) {
                errors.push(error);
            }
        }
        if (errors.length > 0) {
            throw new AggregateError(
                errors,
                'Structured node-view update failed.',
            );
        }
    }

    #releaseNodeViews(): unknown[] {
        const errors: unknown[] = [];
        for (const mounted of this.#nodeViews.splice(0)) {
            try {
                mounted.instance.destroy?.();
            } catch (error: unknown) {
                errors.push(error);
            }
        }
        return errors;
    }

    #renderParagraph(
        block: Extract<EditingBlock, { readonly kind: 'paragraph' }>,
        blockIndex: number,
        tagName: string,
        decorations: readonly VisualDecoration[] = this.#options.decorations(),
    ): HTMLElement {
        const paragraph = this.#document.createElement(tagName);
        paragraph.dataset.soeditorParagraph = 'true';
        if (block.alignment !== undefined) {
            paragraph.style.textAlign = block.alignment;
        }
        if (block.indent !== undefined) {
            paragraph.style.marginInlineStart = `${String(block.indent * 2)}em`;
        }
        this.#paragraphs.set(blockIndex, paragraph);
        let position = 0;

        for (const inline of block.inlines) {
            const rendered = this.#renderInline(
                inline,
                blockIndex,
                position,
                decorations,
            );
            paragraph.append(...rendered.nodes);
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
        decorations: readonly VisualDecoration[],
    ): { readonly nodes: readonly Node[]; readonly end: number } {
        if (inline.kind === 'opaque-inline') {
            const placeholder = this.#document.createElement('span');
            placeholder.dataset.soeditorOpaqueInline = 'true';
            placeholder.contentEditable = 'false';
            if (this.#options.projectionId === 'wysiwyg') {
                placeholder.className = 'soeditor-wysiwyg-preserved-inline';
                const visible = appendWysiwygPresentation(
                    placeholder,
                    inline.node,
                    this.#document,
                );
                placeholder.hidden = !visible;
                const span = { block, end: start + 1, start };
                this.#spans.set(placeholder, span);
                return {
                    end: span.end,
                    nodes: [
                        this.#decorateNode(
                            placeholder,
                            span,
                            decorations.filter((decoration) =>
                                intersects(decoration, span),
                            ),
                        ),
                    ],
                };
            }
            placeholder.className = 'soeditor-opaque soeditor-opaque--inline';
            appendOpaquePresentation(placeholder, inline.node, this.#document);
            this.#appendOpaqueSourceAction(placeholder, inline.node);
            const span = { block, end: start + 1, start };
            this.#spans.set(placeholder, span);
            return {
                end: span.end,
                nodes: [
                    this.#decorateNode(
                        placeholder,
                        span,
                        decorations.filter((decoration) =>
                            intersects(decoration, span),
                        ),
                    ),
                ],
            };
        }

        const end = start + inline.text.length;
        const boundaries = new Set([start, end]);
        for (const decoration of decorations) {
            if (decoration.from.block === block) {
                boundaries.add(clamp(decoration.from.offset, start, end));
            }
            if (decoration.to.block === block) {
                boundaries.add(clamp(decoration.to.offset, start, end));
            }
        }
        const points = [...boundaries].sort((left, right) => left - right);
        const nodes: Node[] = [];
        for (let index = 0; index < points.length - 1; index += 1) {
            const segmentStart = points[index];
            const segmentEnd = points[index + 1];
            if (segmentStart === undefined || segmentEnd === undefined) {
                continue;
            }
            const text = inline.text.slice(
                segmentStart - start,
                segmentEnd - start,
            );
            if (text.length === 0) continue;
            nodes.push(
                this.#renderTextSegment(
                    text,
                    inline,
                    { block, end: segmentEnd, start: segmentStart },
                    decorations.filter((decoration) =>
                        intersects(decoration, {
                            block,
                            end: segmentEnd,
                            start: segmentStart,
                        }),
                    ),
                ),
            );
        }
        return { end, nodes };
    }

    #appendOpaqueSourceAction(
        container: HTMLElement,
        node: HtmlChildNode,
    ): void {
        if (this.#options.projectionId === 'wysiwyg') return;
        if (!this.#options.hasCommand('editor.source.find')) return;
        const action = this.#document.createElement('button');
        action.type = 'button';
        action.className = 'soeditor-opaque__edit';
        action.textContent =
            node.type === 'element' && node.tagName === 'img'
                ? 'Edit image HTML'
                : 'Edit HTML';
        action.title = 'Open this preserved content in HTML source';
        action.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            event.stopPropagation();
        });
        action.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.#options.executeCommand('editor.source.find', [
                opaqueSearchTerm(node),
            ]);
        });
        container.append(action);
    }

    #renderTextSegment(
        value: string,
        inline: Extract<EditingInline, { readonly kind: 'text' }>,
        span: DomSpan,
        decorations: readonly VisualDecoration[],
    ): Node {
        const text = this.#document.createTextNode(value);
        const textSpan = { ...span, node: text };
        this.#spans.set(text, textSpan);
        this.#textSpans.push(textSpan);
        let rendered: Node = text;

        for (const mark of [...inline.marks].reverse()) {
            const wrapper = this.#document.createElement(
                typeof mark === 'string'
                    ? mark
                    : mark.kind === 'link'
                      ? 'a'
                      : mark.tagName,
            );
            if (typeof mark !== 'string' && mark.kind === 'link') {
                wrapper.dataset.soeditorLink = 'true';
                wrapper.setAttribute('aria-label', 'Link');
            } else if (typeof mark !== 'string') {
                applySafeStyleProjection(wrapper, mark.attributes);
            }
            wrapper.append(rendered);
            this.#spans.set(wrapper, span);
            rendered = wrapper;
        }
        return this.#decorateNode(rendered, span, decorations);
    }

    #decorateNode(
        node: Node,
        span: DomSpan,
        decorations: readonly VisualDecoration[],
    ): Node {
        let rendered = node;
        for (const decoration of [...decorations].sort((left, right) =>
            left.id.localeCompare(right.id),
        )) {
            const marker = this.#document.createElement('mark');
            marker.dataset.soeditorDecoration = decoration.id;
            marker.dataset.soeditorDecorationStatus = decoration.status;
            marker.title = decoration.label;
            marker.append(rendered);
            this.#spans.set(marker, span);
            rendered = marker;
        }
        return rendered;
    }

    #decorateElement(
        element: HTMLElement,
        block: number,
        decorations: readonly VisualDecoration[],
    ): void {
        const matching = decorations.filter((decoration) =>
            intersects(decoration, { block, end: 1, start: 0 }),
        );
        if (matching.length === 0) return;
        element.dataset.soeditorDecorationCount = String(matching.length);
        element.classList.add('soeditor-visual-decoration');
        if (matching.some(({ status }) => status === 'resolved')) {
            element.classList.add('soeditor-visual-decoration--resolved');
        }
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
            const previous = this.#host.childNodes[offset - 1];
            const following = this.#host.childNodes[offset];
            const previousSpan =
                previous === undefined ? undefined : this.#findSpan(previous);
            if (previousSpan !== undefined) {
                const block = this.#model.blocks[previousSpan.block];
                if (block?.kind === 'paragraph') {
                    return {
                        block: previousSpan.block,
                        offset: paragraphLength(block),
                    };
                }
                if (block?.kind === 'structured-block') {
                    return { block: previousSpan.block, offset: 1 };
                }
            }
            const followingSpan =
                following === undefined ? undefined : this.#findSpan(following);
            if (followingSpan !== undefined) {
                const block = this.#model.blocks[followingSpan.block];
                if (
                    block?.kind === 'paragraph' ||
                    block?.kind === 'structured-block'
                ) {
                    return { block: followingSpan.block, offset: 0 };
                }
            }
        }

        if (
            node.nodeType === 1 &&
            (node as HTMLElement).dataset.soeditorList !== undefined
        ) {
            const child = node.childNodes[offset === 0 ? 0 : offset - 1];
            const span =
                child === undefined ? undefined : this.#findSpan(child);
            return span === undefined
                ? undefined
                : {
                      block: span.block,
                      offset: offset === 0 ? span.start : span.end,
                  };
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
        const block = this.#model.blocks[point.block];
        if (block?.kind === 'structured-block') {
            const boundary = this.#structuredBlocks.get(point.block);
            if (boundary === undefined) {
                return undefined;
            }
            const index = Array.from(this.#host.childNodes).indexOf(boundary);
            return index < 0
                ? undefined
                : {
                      node: this.#host,
                      offset: index + (point.offset === 1 ? 1 : 0),
                  };
        }
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

function applySafeStyleProjection(
    element: HTMLElement,
    attributes: readonly { readonly name: string; readonly value: string }[],
): void {
    for (const attribute of attributes) {
        if (
            attribute.name === 'class' ||
            attribute.name === 'dir' ||
            attribute.name === 'lang' ||
            attribute.name === 'title'
        ) {
            element.setAttribute(attribute.name, attribute.value);
        } else if (
            attribute.name === 'style' &&
            /^(?:(?:color|background-color|font-family|font-size)\s*:\s*[-#(),.%\w\s"']+;?\s*)+$/iu.test(
                attribute.value,
            )
        ) {
            element.setAttribute('style', attribute.value);
        }
    }
}

function applySafeListProjection(
    element: HTMLOListElement | HTMLUListElement,
    attributes: readonly { readonly name: string; readonly value: string }[],
): void {
    for (const attribute of attributes) {
        if (
            element.tagName === 'OL' &&
            attribute.name === 'start' &&
            /^-?\d{1,6}$/u.test(attribute.value)
        ) {
            element.setAttribute('start', attribute.value);
        } else if (
            attribute.name === 'type' &&
            /^(?:1|a|A|i|I|disc|circle|square)$/u.test(attribute.value)
        ) {
            element.setAttribute('type', attribute.value);
        }
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

function opaqueSearchTerm(node: HtmlChildNode): string {
    if (node.type === 'comment') {
        const value = node.value.trim();
        return value.length > 0 ? value.slice(0, 120) : '<!--';
    }
    if (node.type !== 'element') return `[${node.type}]`;
    if (node.tagName === 'img') {
        const source = opaqueAttribute(node, 'src');
        if (source !== undefined && source.length > 0) {
            return `src="${source.slice(0, 160)}"`;
        }
    }
    return `<${node.tagName}`;
}

function appendOpaquePresentation(
    container: HTMLElement,
    node: HtmlChildNode,
    document: Document,
): void {
    if (node.type === 'element' && node.tagName === 'img') {
        const source = opaqueAttribute(node, 'src');
        if (source !== undefined && isSafeProjectedImageSource(source)) {
            const image = document.createElement('img');
            image.src = source;
            image.alt = opaqueAttribute(node, 'alt') ?? '';
            image.draggable = false;
            image.loading = 'lazy';
            const width = opaqueAttribute(node, 'width');
            const height = opaqueAttribute(node, 'height');
            if (/^\d{1,5}$/u.test(width ?? '')) image.width = Number(width);
            if (/^\d{1,5}$/u.test(height ?? '')) image.height = Number(height);
            container.append(image);
        }
    }
    const label = document.createElement('code');
    label.className = 'soeditor-opaque__label';
    label.textContent = describeOpaque(node);
    const details = document.createElement('span');
    details.className = 'soeditor-opaque__details';
    details.textContent = opaqueDetails(node);
    container.append(label);
    if (details.textContent.length > 0) container.append(details);
}

const safeWysiwygTags = new Set([
    'a',
    'b',
    'blockquote',
    'br',
    'code',
    'del',
    'div',
    'em',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'i',
    'ins',
    'li',
    'mark',
    'ol',
    'p',
    'pre',
    'q',
    's',
    'small',
    'span',
    'strong',
    'sub',
    'sup',
    'u',
    'ul',
]);

const nonRenderedWysiwygTags = new Set([
    'embed',
    'iframe',
    'noscript',
    'object',
    'script',
    'style',
    'template',
]);

/**
 * Renders preserved HTML as content, never as developer chrome. Unknown and
 * executable nodes stay in the model but are intentionally absent visually.
 */
function appendWysiwygPresentation(
    container: HTMLElement,
    node: HtmlChildNode,
    document: Document,
): boolean {
    const rendered = createSafeWysiwygNode(node, document);
    if (rendered === undefined) return false;
    container.append(rendered);
    return hasVisibleWysiwygContent(rendered);
}

function createSafeWysiwygNode(
    node: HtmlChildNode,
    document: Document,
): Node | undefined {
    if (node.type === 'comment') return undefined;
    if (node.type === 'text') return document.createTextNode(node.value);
    if (node.namespace !== 'html') return undefined;

    if (node.tagName === 'img') {
        const source = opaqueAttribute(node, 'src');
        if (source === undefined || !isSafeProjectedImageSource(source)) {
            return undefined;
        }
        const image = document.createElement('img');
        image.src = source;
        image.alt = opaqueAttribute(node, 'alt') ?? '';
        image.draggable = false;
        image.loading = 'lazy';
        const title = opaqueAttribute(node, 'title');
        if (title !== undefined) image.title = title;
        const width = opaqueAttribute(node, 'width');
        const height = opaqueAttribute(node, 'height');
        if (/^\d{1,5}$/u.test(width ?? '')) image.width = Number(width);
        if (/^\d{1,5}$/u.test(height ?? '')) image.height = Number(height);
        return image;
    }

    if (nonRenderedWysiwygTags.has(node.tagName)) return undefined;

    const fragment = document.createDocumentFragment();
    for (const child of node.children) {
        const rendered = createSafeWysiwygNode(child, document);
        if (rendered !== undefined) fragment.append(rendered);
    }
    if (!fragment.hasChildNodes()) return undefined;

    if (!safeWysiwygTags.has(node.tagName)) return fragment;
    const element = document.createElement(node.tagName);
    element.append(fragment);
    return element;
}

function hasVisibleWysiwygContent(node: Node): boolean {
    if (node.nodeType === 1 && (node as Element).tagName === 'IMG') {
        return true;
    }
    return (node.textContent ?? '').length > 0 || node.childNodes.length > 0;
}

function opaqueAttribute(
    node: Extract<HtmlChildNode, { readonly type: 'element' }>,
    name: string,
): string | undefined {
    return node.attributes.find((attribute) => attribute.name === name)?.value;
}

function opaqueDetails(node: HtmlChildNode): string {
    if (node.type === 'comment') return node.value.trim();
    if (node.type !== 'element') return '';
    const attributes = node.attributes
        .slice(0, 4)
        .map(({ name, value }) => `${name}="${value}"`)
        .join(' ');
    return attributes.length === 0 ? '' : attributes;
}

function isSafeProjectedImageSource(source: string): boolean {
    const value = source.trim();
    return (
        /^(?:https?:|blob:|data:image\/(?:png|jpe?g|gif|webp|avif);base64,)/iu.test(
            value,
        ) || /^(?!\/\/)(?![a-z][a-z\d+.-]*:)[^\s]+$/iu.test(value)
    );
}

function structuredSelection(block: number): EditingSelection {
    return {
        anchor: { block, offset: 0 },
        focus: { block, offset: 1 },
    };
}

function selectedStructuredBlock(
    model: EditingModel,
    selection: EditingSelection,
): number | undefined {
    const forward =
        selection.anchor.block < selection.focus.block ||
        (selection.anchor.block === selection.focus.block &&
            selection.anchor.offset <= selection.focus.offset);
    const start = forward ? selection.anchor : selection.focus;
    const end = forward ? selection.focus : selection.anchor;
    return start.block === end.block &&
        start.offset === 0 &&
        end.offset === 1 &&
        model.blocks[start.block]?.kind === 'structured-block'
        ? start.block
        : undefined;
}

function intersects(decoration: VisualDecoration, span: DomSpan): boolean {
    return (
        comparePoints(decoration.from, {
            block: span.block,
            offset: span.end,
        }) < 0 &&
        comparePoints(decoration.to, {
            block: span.block,
            offset: span.start,
        }) > 0
    );
}

function comparePoints(left: EditingPoint, right: EditingPoint): number {
    return left.block === right.block
        ? left.offset - right.offset
        : left.block - right.block;
}

function clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value));
}
