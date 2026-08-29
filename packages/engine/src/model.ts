import type {
    HtmlAttribute,
    HtmlChildNode,
    HtmlDocumentFragment,
    HtmlElement,
} from '@soeditor/html';

import {
    findStructuredBlockConversion,
    getStructuredBlockConversion,
    StructuredEditingContributionConflictError,
    type StructuredBlockBehavior,
    type StructuredEditingSchema,
} from './structured-editing.js';

export type EditingBlockTag =
    'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'blockquote' | 'pre';

export type EditingTextMark = 'strong' | 'em' | 'u' | 's' | 'code';

export interface EditingLinkMark {
    readonly kind: 'link';
    readonly attributes: readonly HtmlAttribute[];
}

export type EditingMark = EditingTextMark | EditingLinkMark;

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
    readonly tagName: EditingBlockTag;
    readonly attributes: readonly HtmlAttribute[];
    readonly inlines: readonly EditingInline[];
    readonly list?: 'ol' | 'ul';
    readonly listStart?: boolean;
}

export interface EditingOpaqueBlock {
    readonly kind: 'opaque-block';
    readonly node: HtmlChildNode;
}

/** Source-shaped content owned by one plugin-recognized structured block. */
export interface EditingStructuredBlockContent {
    readonly attributes: readonly HtmlAttribute[];
    readonly children: readonly HtmlChildNode[];
}

/** A plugin-recognized block rendered through an optional node view. */
export interface EditingStructuredBlock extends EditingStructuredBlockContent {
    readonly kind: 'structured-block';
    readonly type: string;
    readonly behavior: StructuredBlockBehavior;
}

export type EditingBlock =
    EditingParagraph | EditingStructuredBlock | EditingOpaqueBlock;

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
    schema?: StructuredEditingSchema,
): EditingModel {
    return freezeModel({
        blocks: fragment.children.flatMap((node) =>
            convertBlocks(node, schema),
        ),
    });
}

export function serializeEditingModel(
    model: EditingModel,
    schema?: StructuredEditingSchema,
): HtmlDocumentFragment {
    const children: HtmlChildNode[] = [];

    for (let index = 0; index < model.blocks.length; index += 1) {
        const block = model.blocks[index];
        if (block?.kind === 'paragraph' && block.list !== undefined) {
            const items: EditingParagraph[] = [];
            const list = block.list;
            while (index < model.blocks.length) {
                const item = model.blocks[index];
                if (
                    item?.kind !== 'paragraph' ||
                    item.list !== list ||
                    (items.length > 0 && item.listStart === true)
                ) {
                    break;
                }
                items.push(item);
                index += 1;
            }
            index -= 1;
            children.push(serializeList(list, items));
        } else if (block !== undefined) {
            children.push(serializeBlock(block, schema));
        }
    }

    return Object.freeze({
        type: 'document-fragment',
        children: Object.freeze(children),
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

                if (block.kind === 'structured-block') {
                    return Object.freeze({
                        ...block,
                        attributes: freezeAttributes(block.attributes),
                        children: Object.freeze(
                            block.children.map((child) =>
                                freezeHtmlChild(child),
                            ),
                        ),
                    });
                }

                return Object.freeze({
                    ...block,
                    attributes: Object.freeze([...block.attributes]),
                    inlines: Object.freeze(
                        normalizeInlines(block.inlines).map((inline) =>
                            inline.kind === 'text'
                                ? Object.freeze({
                                      ...inline,
                                      marks: Object.freeze(
                                          inline.marks.map((mark) =>
                                              typeof mark === 'string'
                                                  ? mark
                                                  : Object.freeze({
                                                        ...mark,
                                                        attributes:
                                                            Object.freeze([
                                                                ...mark.attributes,
                                                            ]),
                                                    }),
                                          ),
                                      ),
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

function convertBlocks(
    node: HtmlChildNode,
    schema?: StructuredEditingSchema,
): readonly EditingBlock[] {
    const conversion =
        schema === undefined
            ? undefined
            : findStructuredBlockConversion(schema, node);
    if (conversion !== undefined) {
        if (node.type !== 'element') {
            throw new Error(
                'A structured block conversion matched a non-element node.',
            );
        }
        if (isBuiltInBlock(node)) {
            throw new StructuredEditingContributionConflictError([
                `soeditor.builtin.${node.type === 'element' ? node.tagName : 'block'}`,
                conversion.id,
            ]);
        }
        const converted = conversion.fromHtml(node);
        if (
            typeof converted !== 'object' ||
            converted === null ||
            !Array.isArray(converted.attributes) ||
            !Array.isArray(converted.children)
        ) {
            throw new TypeError(
                `Structured editing contribution "${conversion.id}" returned invalid block data.`,
            );
        }
        return [
            {
                attributes: converted.attributes,
                behavior: conversion.behavior,
                children: converted.children,
                kind: 'structured-block',
                type: conversion.type,
            },
        ];
    }

    if (
        node.type === 'element' &&
        node.namespace === 'html' &&
        isBlockTag(node.tagName)
    ) {
        const inlines: EditingInline[] = [];

        for (const child of node.children) {
            appendInline(inlines, child, []);
        }

        return [
            {
                attributes: node.attributes,
                inlines,
                kind: 'paragraph',
                tagName: node.tagName,
            },
        ];
    }

    if (
        node.type === 'element' &&
        node.namespace === 'html' &&
        (node.tagName === 'ol' || node.tagName === 'ul') &&
        node.attributes.length === 0 &&
        node.children.every(isSimpleListItem)
    ) {
        const list: 'ol' | 'ul' = node.tagName;
        return node.children.map((item, itemIndex) => {
            if (item.type !== 'element') {
                throw new Error('Expected a validated list item.');
            }
            const inlines: EditingInline[] = [];
            for (const child of item.children) {
                appendInline(inlines, child, []);
            }
            return {
                attributes: item.attributes,
                inlines,
                kind: 'paragraph',
                list,
                listStart: itemIndex === 0,
                tagName: 'p',
            };
        });
    }

    return [{ kind: 'opaque-block', node }];
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
    if (node.type !== 'element' || node.namespace !== 'html') {
        return undefined;
    }

    if (node.tagName === 'a') {
        return { attributes: node.attributes, kind: 'link' };
    }

    return node.attributes.length === 0 && isTextMark(node.tagName)
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

function serializeBlock(
    block: EditingBlock,
    schema?: StructuredEditingSchema,
): HtmlChildNode {
    if (block.kind === 'opaque-block') {
        return block.node;
    }

    if (block.kind === 'structured-block') {
        const conversion =
            schema === undefined
                ? undefined
                : getStructuredBlockConversion(schema, block.type);
        if (conversion === undefined) {
            throw new Error(
                `Structured block type "${block.type}" has no registered source serializer.`,
            );
        }
        const serialized = conversion.toHtml(block);
        if (serialized.type !== 'element' || !conversion.matches(serialized)) {
            throw new TypeError(
                `Structured editing contribution "${conversion.id}" serialized a node it does not match.`,
            );
        }
        return freezeHtmlChild(serialized);
    }

    return Object.freeze({
        type: 'element',
        tagName: block.tagName,
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
            tagName: typeof mark === 'string' ? mark : 'a',
            namespace: 'html',
            attributes:
                typeof mark === 'string' ? Object.freeze([]) : mark.attributes,
            children: Object.freeze([node]),
        });
    }

    return node;
}

function addMark(
    marks: readonly EditingMark[],
    mark: EditingMark,
): readonly EditingMark[] {
    if (marks.some((candidate) => marksEqual(candidate, mark))) {
        return marks;
    }

    const result = [...marks, mark];
    result.sort((left, right) => markOrder(left) - markOrder(right));
    return result;
}

function markOrder(mark: EditingMark): number {
    if (typeof mark !== 'string') {
        return 0;
    }
    return ['strong', 'em', 'u', 's', 'code'].indexOf(mark) + 1;
}

function sameMarks(
    left: readonly EditingMark[],
    right: readonly EditingMark[],
): boolean {
    return (
        left.length === right.length &&
        left.every((mark, index) => {
            const candidate = right[index];
            return candidate !== undefined && marksEqual(mark, candidate);
        })
    );
}

function marksEqual(left: EditingMark, right: EditingMark): boolean {
    if (typeof left === 'string' || typeof right === 'string') {
        return left === right;
    }
    return (
        left.attributes.length === right.attributes.length &&
        left.attributes.every((attribute, index) => {
            const candidate = right.attributes[index];
            return (
                candidate !== undefined &&
                attribute.name === candidate.name &&
                attribute.value === candidate.value &&
                attribute.namespace === candidate.namespace &&
                attribute.prefix === candidate.prefix
            );
        })
    );
}

function isBlockTag(tagName: string): tagName is EditingBlockTag {
    return (
        tagName === 'p' ||
        tagName === 'blockquote' ||
        tagName === 'pre' ||
        /^h[1-6]$/u.test(tagName)
    );
}

function isBuiltInBlock(node: HtmlChildNode): boolean {
    return (
        node.type === 'element' &&
        node.namespace === 'html' &&
        (isBlockTag(node.tagName) ||
            ((node.tagName === 'ol' || node.tagName === 'ul') &&
                node.attributes.length === 0 &&
                node.children.every(isSimpleListItem)))
    );
}

function isTextMark(tagName: string): tagName is EditingTextMark {
    return (
        tagName === 'strong' ||
        tagName === 'em' ||
        tagName === 'u' ||
        tagName === 's' ||
        tagName === 'code'
    );
}

function isSimpleListItem(node: HtmlChildNode): boolean {
    return (
        node.type === 'element' &&
        node.namespace === 'html' &&
        node.tagName === 'li' &&
        node.attributes.length === 0
    );
}

function freezeAttributes(
    attributes: readonly HtmlAttribute[],
): readonly HtmlAttribute[] {
    return Object.freeze(
        attributes.map((attribute) => Object.freeze({ ...attribute })),
    );
}

function freezeHtmlChild(node: HtmlChildNode): HtmlChildNode {
    if (node.type !== 'element') {
        return Object.freeze({ ...node });
    }
    return Object.freeze({
        ...node,
        attributes: freezeAttributes(node.attributes),
        children: Object.freeze(
            node.children.map((child) => freezeHtmlChild(child)),
        ),
    });
}

function serializeList(
    tagName: 'ol' | 'ul',
    items: readonly EditingParagraph[],
): HtmlChildNode {
    return Object.freeze({
        type: 'element',
        tagName,
        namespace: 'html',
        attributes: Object.freeze([]),
        children: Object.freeze(
            items.map((item) =>
                Object.freeze({
                    type: 'element',
                    tagName: 'li',
                    namespace: 'html',
                    attributes: item.attributes,
                    children: Object.freeze(
                        item.inlines.map((inline) => serializeInline(inline)),
                    ),
                }),
            ),
        ),
    });
}
