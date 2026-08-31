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

export type EditingTextMark =
    'strong' | 'em' | 'u' | 's' | 'code' | 'sub' | 'sup';

export interface EditingLinkMark {
    readonly kind: 'link';
    readonly attributes: readonly HtmlAttribute[];
}

export interface EditingElementMark {
    readonly kind: 'element';
    readonly tagName: 'kbd' | 'mark' | 'small' | 'span';
    readonly attributes: readonly HtmlAttribute[];
}

export type EditingMark =
    EditingTextMark | EditingLinkMark | EditingElementMark;

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
    readonly listDepth?: number;
    readonly listAttributes?: readonly HtmlAttribute[];
    readonly alignment?: 'center' | 'justify' | 'left' | 'right';
    readonly indent?: number;
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
            const serialized = serializeListAt(model.blocks, index, 0);
            children.push(serialized.node);
            index = serialized.nextIndex - 1;
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
                    ...(block.listAttributes === undefined
                        ? {}
                        : {
                              listAttributes: Object.freeze([
                                  ...block.listAttributes,
                              ]),
                          }),
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

        const formatting = readBlockFormatting(node.attributes);
        return [
            {
                attributes: formatting.attributes,
                inlines,
                kind: 'paragraph',
                tagName: node.tagName,
                ...(formatting.alignment === undefined
                    ? {}
                    : { alignment: formatting.alignment }),
                ...(formatting.indent === undefined
                    ? {}
                    : { indent: formatting.indent }),
            },
        ];
    }

    if (
        node.type === 'element' &&
        node.namespace === 'html' &&
        (node.tagName === 'ol' || node.tagName === 'ul') &&
        isSupportedList(node, 0)
    ) {
        return convertList(
            node as HtmlElement & { readonly tagName: 'ol' | 'ul' },
            0,
        );
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

    if (isStyleMarkTag(node.tagName)) {
        return {
            attributes: node.attributes,
            kind: 'element',
            tagName: node.tagName,
        };
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
        attributes: serializeBlockFormatting(block),
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
            tagName:
                typeof mark === 'string'
                    ? mark
                    : mark.kind === 'link'
                      ? 'a'
                      : mark.tagName,
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
        return mark.kind === 'link' ? 0 : 1;
    }
    return ['strong', 'em', 'u', 's', 'code', 'sub', 'sup'].indexOf(mark) + 2;
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
        left.kind === right.kind &&
        (left.kind !== 'element' ||
            (right.kind === 'element' && left.tagName === right.tagName)) &&
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
                isSupportedList(node, 0)))
    );
}

function isTextMark(tagName: string): tagName is EditingTextMark {
    return (
        tagName === 'strong' ||
        tagName === 'em' ||
        tagName === 'u' ||
        tagName === 's' ||
        tagName === 'code' ||
        tagName === 'sub' ||
        tagName === 'sup'
    );
}

function isStyleMarkTag(
    tagName: string,
): tagName is EditingElementMark['tagName'] {
    return (
        tagName === 'span' ||
        tagName === 'mark' ||
        tagName === 'small' ||
        tagName === 'kbd'
    );
}

function isSupportedList(node: HtmlElement, depth: number): boolean {
    return (
        depth <= 8 &&
        (node.tagName === 'ol' || node.tagName === 'ul') &&
        node.children.length > 0 &&
        node.children.every(
            (child) =>
                child.type === 'element' &&
                child.namespace === 'html' &&
                child.tagName === 'li' &&
                child.children.every(
                    (itemChild) =>
                        itemChild.type !== 'element' ||
                        (itemChild.tagName !== 'ol' &&
                            itemChild.tagName !== 'ul') ||
                        isSupportedList(itemChild, depth + 1),
                ),
        )
    );
}

function convertList(
    node: HtmlElement & { readonly tagName: 'ol' | 'ul' },
    depth: number,
): readonly EditingParagraph[] {
    const blocks: EditingParagraph[] = [];
    node.children.forEach((item, itemIndex) => {
        if (item.type !== 'element') {
            throw new Error('Expected a validated list item.');
        }
        const inlines: EditingInline[] = [];
        const nested: HtmlElement[] = [];
        for (const child of item.children) {
            if (
                child.type === 'element' &&
                (child.tagName === 'ol' || child.tagName === 'ul')
            ) {
                nested.push(child);
            } else {
                appendInline(inlines, child, []);
            }
        }
        const formatting = readBlockFormatting(item.attributes);
        blocks.push({
            attributes: formatting.attributes,
            inlines,
            kind: 'paragraph',
            list: node.tagName,
            listDepth: depth,
            listStart: itemIndex === 0,
            ...(itemIndex === 0 ? { listAttributes: node.attributes } : {}),
            tagName: 'p',
            ...(formatting.alignment === undefined
                ? {}
                : { alignment: formatting.alignment }),
            ...(formatting.indent === undefined
                ? {}
                : { indent: formatting.indent }),
        });
        for (const child of nested) {
            blocks.push(
                ...convertList(
                    child as HtmlElement & { readonly tagName: 'ol' | 'ul' },
                    depth + 1,
                ),
            );
        }
    });
    return blocks;
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

function serializeListAt(
    blocks: readonly EditingBlock[],
    startIndex: number,
    depth: number,
): { readonly nextIndex: number; readonly node: HtmlChildNode } {
    const first = blocks[startIndex];
    if (
        first?.kind !== 'paragraph' ||
        first.list === undefined ||
        (first.listDepth ?? 0) !== depth
    ) {
        throw new Error('The editing model contains an invalid nested list.');
    }
    const tagName = first.list;
    const children: HtmlChildNode[] = [];
    let index = startIndex;
    while (index < blocks.length) {
        const item = blocks[index];
        if (
            item?.kind !== 'paragraph' ||
            item.list !== tagName ||
            (item.listDepth ?? 0) !== depth ||
            (index > startIndex && item.listStart === true)
        ) {
            break;
        }
        const itemChildren = item.inlines.map((inline) =>
            serializeInline(inline),
        );
        index += 1;
        while (index < blocks.length) {
            const nested = blocks[index];
            if (
                nested?.kind !== 'paragraph' ||
                nested.list === undefined ||
                (nested.listDepth ?? 0) <= depth
            ) {
                break;
            }
            if ((nested.listDepth ?? 0) !== depth + 1) {
                throw new Error(
                    'Nested list depth cannot skip a parent level.',
                );
            }
            const serialized = serializeListAt(blocks, index, depth + 1);
            itemChildren.push(serialized.node);
            index = serialized.nextIndex;
        }
        children.push(
            Object.freeze({
                type: 'element',
                tagName: 'li',
                namespace: 'html',
                attributes: serializeBlockFormatting(item),
                children: Object.freeze(itemChildren),
            }),
        );
    }
    return {
        nextIndex: index,
        node: Object.freeze({
            type: 'element',
            tagName,
            namespace: 'html',
            attributes: first.listAttributes ?? Object.freeze([]),
            children: Object.freeze(children),
        }),
    };
}

function readBlockFormatting(attributes: readonly HtmlAttribute[]): {
    readonly alignment?: EditingParagraph['alignment'];
    readonly attributes: readonly HtmlAttribute[];
    readonly indent?: number;
} {
    const style = attributes.find(
        (attribute) =>
            attribute.namespace === undefined && attribute.name === 'style',
    );
    if (style === undefined) return { attributes };
    let alignment: EditingParagraph['alignment'];
    let indent: number | undefined;
    const retained: string[] = [];
    for (const declaration of style.value.split(';')) {
        const [rawName, ...rawValue] = declaration.split(':');
        const name = rawName?.trim().toLowerCase();
        const value = rawValue.join(':').trim().toLowerCase();
        if (
            name === 'text-align' &&
            (value === 'left' ||
                value === 'center' ||
                value === 'right' ||
                value === 'justify')
        ) {
            alignment = value;
        } else {
            const match =
                name === 'margin-inline-start'
                    ? /^(\d+)em$/u.exec(value)
                    : null;
            if (match?.[1] !== undefined) {
                const parsed = Number(match[1]) / 2;
                if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 8) {
                    indent = parsed;
                    continue;
                }
            }
            if (declaration.trim().length > 0)
                retained.push(declaration.trim());
        }
    }
    const nextAttributes = attributes.filter(
        (attribute) => attribute !== style,
    );
    if (retained.length > 0) {
        nextAttributes.push({
            name: 'style',
            value: `${retained.join('; ')};`,
        });
    }
    return {
        attributes: nextAttributes,
        ...(alignment === undefined ? {} : { alignment }),
        ...(indent === undefined ? {} : { indent }),
    };
}

function serializeBlockFormatting(
    block: EditingParagraph,
): readonly HtmlAttribute[] {
    const declarations = [
        ...(block.alignment === undefined
            ? []
            : [`text-align: ${block.alignment}`]),
        ...(block.indent === undefined
            ? []
            : [`margin-inline-start: ${String(block.indent * 2)}em`]),
    ];
    if (declarations.length === 0) return block.attributes;
    const attributes = [...block.attributes];
    const styleIndex = attributes.findIndex(
        (attribute) =>
            attribute.namespace === undefined && attribute.name === 'style',
    );
    const retained =
        styleIndex < 0 ? '' : (attributes[styleIndex]?.value ?? '');
    const value = `${retained}${retained.trim().endsWith(';') || retained.length === 0 ? '' : ';'}${declarations.join('; ')};`;
    const style = Object.freeze({ name: 'style', value });
    if (styleIndex < 0) attributes.push(style);
    else attributes[styleIndex] = style;
    return Object.freeze(attributes);
}
