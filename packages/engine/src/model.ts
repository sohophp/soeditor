import type {
    HtmlAttribute,
    HtmlChildNode,
    HtmlDocumentFragment,
    HtmlElement,
} from '@soeditor/html';

export type EditingMark = 'strong' | 'em';

export interface EditingTextRun {
    readonly kind: 'text';
    readonly text: string;
    readonly marks: readonly EditingMark[];
}

export interface EditingOpaqueInline {
    readonly kind: 'opaque-inline';
    readonly node: HtmlChildNode;
}

export type EditingInline = EditingTextRun | EditingOpaqueInline;

export interface EditingParagraph {
    readonly kind: 'paragraph';
    readonly attributes: readonly HtmlAttribute[];
    readonly inlines: readonly EditingInline[];
}

export interface EditingOpaqueBlock {
    readonly kind: 'opaque-block';
    readonly node: HtmlChildNode;
}

export type EditingBlock = EditingParagraph | EditingOpaqueBlock;

export interface EditingModel {
    readonly blocks: readonly EditingBlock[];
}

export interface EditingPoint {
    readonly block: number;
    readonly offset: number;
}

export interface EditingSelection {
    readonly anchor: EditingPoint;
    readonly focus: EditingPoint;
}

export function createEditingModel(
    fragment: HtmlDocumentFragment,
): EditingModel {
    return freezeModel({
        blocks: fragment.children.map((node) => convertBlock(node)),
    });
}

export function serializeEditingModel(
    model: EditingModel,
): HtmlDocumentFragment {
    return Object.freeze({
        type: 'document-fragment',
        children: Object.freeze(
            model.blocks.map((block) => serializeBlock(block)),
        ),
    });
}

export function paragraphLength(paragraph: EditingParagraph): number {
    return paragraph.inlines.reduce(
        (length, inline) =>
            length + (inline.kind === 'text' ? inline.text.length : 1),
        0,
    );
}

export function freezeSelection(selection: EditingSelection): EditingSelection {
    return Object.freeze({
        anchor: Object.freeze({ ...selection.anchor }),
        focus: Object.freeze({ ...selection.focus }),
    });
}

export function freezeModel(model: EditingModel): EditingModel {
    return Object.freeze({
        blocks: Object.freeze(
            model.blocks.map((block) => {
                if (block.kind === 'opaque-block') {
                    return Object.freeze({ ...block });
                }

                return Object.freeze({
                    ...block,
                    attributes: Object.freeze([...block.attributes]),
                    inlines: Object.freeze(
                        normalizeInlines(block.inlines).map((inline) =>
                            inline.kind === 'text'
                                ? Object.freeze({
                                      ...inline,
                                      marks: Object.freeze([...inline.marks]),
                                  })
                                : Object.freeze({ ...inline }),
                        ),
                    ),
                });
            }),
        ),
    });
}

export function normalizeInlines(
    inlines: readonly EditingInline[],
): readonly EditingInline[] {
    const normalized: EditingInline[] = [];

    for (const inline of inlines) {
        if (inline.kind === 'text' && inline.text.length === 0) {
            continue;
        }

        const previous = normalized.at(-1);
        if (
            inline.kind === 'text' &&
            previous?.kind === 'text' &&
            sameMarks(previous.marks, inline.marks)
        ) {
            normalized[normalized.length - 1] = {
                kind: 'text',
                marks: previous.marks,
                text: previous.text + inline.text,
            };
        } else {
            normalized.push(inline);
        }
    }

    return normalized;
}

function convertBlock(node: HtmlChildNode): EditingBlock {
    if (
        node.type === 'element' &&
        node.namespace === 'html' &&
        node.tagName === 'p'
    ) {
        const inlines: EditingInline[] = [];

        for (const child of node.children) {
            appendInline(inlines, child, []);
        }

        return {
            attributes: node.attributes,
            inlines,
            kind: 'paragraph',
        };
    }

    return { kind: 'opaque-block', node };
}

function appendInline(
    target: EditingInline[],
    node: HtmlChildNode,
    marks: readonly EditingMark[],
): void {
    if (node.type === 'text') {
        target.push({ kind: 'text', marks, text: node.value });
        return;
    }

    if (node.type === 'element') {
        const mark = supportedMark(node);
        if (mark !== undefined && isPureMarkedContent(node)) {
            for (const child of node.children) {
                appendInline(target, child, addMark(marks, mark));
            }
            return;
        }
    }

    target.push({ kind: 'opaque-inline', node });
}

function supportedMark(node: HtmlChildNode): EditingMark | undefined {
    if (
        node.type !== 'element' ||
        node.namespace !== 'html' ||
        node.attributes.length !== 0
    ) {
        return undefined;
    }

    return node.tagName === 'strong' || node.tagName === 'em'
        ? node.tagName
        : undefined;
}

function isPureMarkedContent(node: HtmlElement): boolean {
    if (node.children.length === 0) {
        return false;
    }

    return node.children.every((child) => {
        if (child.type === 'text') {
            return true;
        }

        return (
            child.type === 'element' &&
            supportedMark(child) !== undefined &&
            isPureMarkedContent(child)
        );
    });
}

function serializeBlock(block: EditingBlock): HtmlChildNode {
    if (block.kind === 'opaque-block') {
        return block.node;
    }

    return Object.freeze({
        type: 'element',
        tagName: 'p',
        namespace: 'html',
        attributes: block.attributes,
        children: Object.freeze(
            block.inlines.map((inline) => serializeInline(inline)),
        ),
    });
}

function serializeInline(inline: EditingInline): HtmlChildNode {
    if (inline.kind === 'opaque-inline') {
        return inline.node;
    }

    let node: HtmlChildNode = Object.freeze({
        type: 'text',
        value: inline.text,
    });

    for (const mark of [...inline.marks].reverse()) {
        node = Object.freeze({
            type: 'element',
            tagName: mark,
            namespace: 'html',
            attributes: Object.freeze([]),
            children: Object.freeze([node]),
        });
    }

    return node;
}

function addMark(
    marks: readonly EditingMark[],
    mark: EditingMark,
): readonly EditingMark[] {
    if (marks.includes(mark)) {
        return marks;
    }

    const result = [...marks, mark];
    result.sort((left, right) => markOrder(left) - markOrder(right));
    return result;
}

function markOrder(mark: EditingMark): number {
    return mark === 'strong' ? 0 : 1;
}

function sameMarks(
    left: readonly EditingMark[],
    right: readonly EditingMark[],
): boolean {
    return (
        left.length === right.length &&
        left.every((mark, index) => mark === right[index])
    );
}
