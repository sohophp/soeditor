import type { Transaction } from '@soeditor/core';
import type { HtmlAttribute, HtmlChildNode } from '@soeditor/html';

import {
    freezeModel,
    freezeSelection,
    normalizeInlines,
    paragraphLength,
    type EditingBlock,
    type EditingElementMark,
    type EditingInline,
    type EditingLinkMark,
    type EditingMark,
    type EditingModel,
    type EditingParagraph,
    type EditingPoint,
    type EditingSelection,
    type EditingStructuredBlock,
    type EditingStructuredBlockContent,
    type EditingTextRun,
    type EditingTextMark,
    type EditingBlockTag,
} from './model.js';

export interface EditingResult {
    readonly model: EditingModel;
    readonly operations: readonly EditingOperation[];
    readonly selection: EditingSelection;
}

/** The bounded operation descriptions emitted by the current visual editor. */
export type EditingOperation =
    | {
          readonly kind: 'replace-text';
          readonly block: number;
          readonly from: number;
          readonly to: number;
          readonly insertedLength: number;
      }
    | {
          readonly kind: 'split-block';
          readonly point: EditingPoint;
      }
    | {
          readonly kind: 'join-blocks';
          readonly block: number;
          readonly leftLength: number;
      }
    | {
          readonly kind: 'replace-range';
          readonly from: EditingPoint;
          readonly to: EditingPoint;
          readonly insertedEnd: EditingPoint;
      }
    | {
          readonly kind: 'format-blocks' | 'format-inline';
          readonly from: EditingPoint;
          readonly to: EditingPoint;
      }
    | {
          readonly kind: 'set-structured-attributes';
          readonly block: number;
          readonly type: string;
      }
    | {
          readonly kind: 'replace-structured-content';
          readonly block: number;
          readonly type: string;
      }
    | {
          readonly kind: 'move-block';
          readonly fromBlock: number;
          readonly toBlock: number;
      };

export type EditingPointAffinity = 'backward' | 'forward';

const EDITING_OPERATIONS_METADATA = 'soeditor.engine.editingOperations';

/** Maps a model point through an ordered list of immutable editing operations. */
export function mapEditingPoint(
    point: EditingPoint,
    operations: readonly EditingOperation[],
    affinity: EditingPointAffinity = 'forward',
): EditingPoint {
    if (!isEditingPoint(point)) {
        throw new TypeError('An editing point requires non-negative indexes.');
    }
    if (!Array.isArray(operations) || !operations.every(isEditingOperation)) {
        throw new TypeError('Editing operations are malformed.');
    }
    if (affinity !== 'backward' && affinity !== 'forward') {
        throw new TypeError(
            'Editing point affinity must be "backward" or "forward".',
        );
    }
    return operations.reduce(
        (mapped, operation) =>
            mapPointThroughOperation(mapped, operation, affinity),
        Object.freeze({ ...point }),
    );
}

/** Reads validated structured operations from a visual document transaction. */
export function readEditingOperations(
    transaction: Transaction,
): readonly EditingOperation[] | undefined {
    const value = transaction.getMeta(EDITING_OPERATIONS_METADATA);
    return Array.isArray(value) && value.every(isEditingOperation)
        ? Object.freeze(value.map((operation) => freezeOperation(operation)))
        : undefined;
}

/** @internal Attaches engine-owned operations to a visual transaction. */
export function setEditingOperations(
    transaction: Transaction,
    operations: readonly EditingOperation[],
): void {
    transaction.setMeta(EDITING_OPERATIONS_METADATA, operations);
}

export class UnsupportedEditingSelectionError extends Error {
    constructor(message = 'The selection crosses unsupported HTML content.') {
        super(message);
        this.name = 'UnsupportedEditingSelectionError';
    }
}

export function insertText(
    model: EditingModel,
    selection: EditingSelection,
    text: string,
): EditingResult {
    const deleted = deleteSelection(model, selection);
    const point = deleted.selection.focus;
    const paragraph = getParagraph(deleted.model, point);
    const [before, after] = splitInlines(paragraph.inlines, point.offset);
    const marks = marksAtPoint(paragraph, point.offset);
    const nextParagraph: EditingParagraph = {
        ...paragraph,
        inlines: [...before, { kind: 'text', marks, text }, ...after],
    };
    const nextPoint = {
        block: point.block,
        offset: point.offset + text.length,
    };

    return replaceParagraph(
        deleted.model,
        point.block,
        nextParagraph,
        nextPoint,
        collapsed(nextPoint),
        [
            ...deleted.operations,
            {
                block: point.block,
                from: point.offset,
                insertedLength: text.length,
                kind: 'replace-text',
                to: point.offset,
            },
        ],
    );
}

export function insertParagraph(
    model: EditingModel,
    selection: EditingSelection,
): EditingResult {
    const deleted = deleteSelection(model, selection);
    const point = deleted.selection.focus;
    const paragraph = getParagraph(deleted.model, point);
    if (
        paragraph.list !== undefined &&
        paragraphLength(paragraph) === 0 &&
        point.offset === 0
    ) {
        const exited = exitListAtPoint(deleted.model, point, paragraph);
        return result(exited.model, exited.selection, [
            ...deleted.operations,
            ...exited.operations,
        ]);
    }
    const [before, after] = splitInlines(paragraph.inlines, point.offset);
    const { listAttributes: _listAttributes, ...continuation } = paragraph;
    void _listAttributes;
    const blocks = [...deleted.model.blocks];
    blocks.splice(
        point.block,
        1,
        { ...paragraph, inlines: before },
        {
            ...continuation,
            attributes: [],
            inlines: after,
            kind: 'paragraph',
            ...(paragraph.list === undefined ? {} : { listStart: false }),
        },
    );
    const nextPoint = { block: point.block + 1, offset: 0 };

    return result({ blocks }, collapsed(nextPoint), [
        ...deleted.operations,
        { kind: 'split-block', point },
    ]);
}

export function deleteBackward(
    model: EditingModel,
    selection: EditingSelection,
): EditingResult {
    if (!isCollapsed(selection)) {
        return deleteSelection(model, selection);
    }

    const point = selection.focus;
    const paragraph = getParagraph(model, point);

    if (point.offset > 0) {
        const previous = previousCodePointOffset(paragraph, point.offset);
        return deleteSelection(model, {
            anchor: { block: point.block, offset: previous },
            focus: point,
        });
    }

    if (paragraph.list !== undefined) {
        const previous = model.blocks[point.block - 1];
        const continuesPreviousItem =
            paragraph.listStart !== true &&
            previous?.kind === 'paragraph' &&
            previous.list === paragraph.list &&
            (previous.listDepth ?? 0) === (paragraph.listDepth ?? 0);
        if (!continuesPreviousItem) {
            return exitListAtPoint(model, point, paragraph);
        }
    }

    if (point.block === 0) {
        return unchanged(model, selection);
    }

    const previous = model.blocks[point.block - 1];
    if (previous?.kind !== 'paragraph') {
        return unchanged(model, selection);
    }
    if (paragraph.attributes.length > 0) {
        return unchanged(model, selection);
    }
    if (
        previous.list !== paragraph.list ||
        (previous.listDepth ?? 0) !== (paragraph.listDepth ?? 0) ||
        paragraph.listStart === true
    ) {
        return unchanged(model, selection);
    }

    const previousLength = paragraphLength(previous);
    const blocks = [...model.blocks];
    blocks.splice(point.block - 1, 2, {
        ...previous,
        inlines: [...previous.inlines, ...paragraph.inlines],
    });
    return result(
        { blocks },
        collapsed({ block: point.block - 1, offset: previousLength }),
        [
            {
                block: point.block - 1,
                kind: 'join-blocks',
                leftLength: previousLength,
            },
        ],
    );
}

function exitListAtPoint(
    model: EditingModel,
    point: EditingPoint,
    paragraph: EditingParagraph,
): EditingResult {
    if ((paragraph.listDepth ?? 0) > 0) {
        return adjustBlockIndent(model, collapsed(point), -1);
    }
    const blocks = [...model.blocks];
    blocks[point.block] = withoutList(paragraph);
    return result({ blocks }, collapsed(point), [
        {
            from: point,
            kind: 'format-blocks',
            to: point,
        },
    ]);
}

export function deleteForward(
    model: EditingModel,
    selection: EditingSelection,
): EditingResult {
    if (!isCollapsed(selection)) {
        return deleteSelection(model, selection);
    }

    const point = selection.focus;
    const paragraph = getParagraph(model, point);
    const length = paragraphLength(paragraph);

    if (point.offset < length) {
        const next = nextCodePointOffset(paragraph, point.offset);
        return deleteSelection(model, {
            anchor: point,
            focus: { block: point.block, offset: next },
        });
    }

    const following = model.blocks[point.block + 1];
    if (following?.kind !== 'paragraph') {
        return unchanged(model, selection);
    }
    if (following.attributes.length > 0) {
        return unchanged(model, selection);
    }
    if (
        following.list !== paragraph.list ||
        (following.listDepth ?? 0) !== (paragraph.listDepth ?? 0) ||
        following.listStart === true
    ) {
        return unchanged(model, selection);
    }

    const blocks = [...model.blocks];
    blocks.splice(point.block, 2, {
        ...paragraph,
        inlines: [...paragraph.inlines, ...following.inlines],
    });
    return result({ blocks }, collapsed(point), [
        {
            block: point.block,
            kind: 'join-blocks',
            leftLength: length,
        },
    ]);
}

export function toggleMark(
    model: EditingModel,
    selection: EditingSelection,
    mark: EditingTextMark,
): EditingResult {
    const ordered = orderSelection(selection);

    if (comparePoints(ordered.start, ordered.end) === 0) {
        return unchanged(model, selection);
    }
    const selectedRuns = selectedTextRuns(model, ordered);
    const remove =
        selectedRuns.length > 0 &&
        selectedRuns.every((run) => run.marks.includes(mark));
    return formatSelectedRuns(model, selection, (run) => ({
        ...run,
        marks: remove
            ? run.marks.filter((value) => value !== mark)
            : orderedMarks([
                  ...run.marks.filter(
                      (value) =>
                          !(
                              typeof value === 'string' &&
                              ((mark === 'sub' && value === 'sup') ||
                                  (mark === 'sup' && value === 'sub'))
                          ),
                  ),
                  mark,
              ]),
    }));
}

export function applyInlineStyle(
    model: EditingModel,
    selection: EditingSelection,
    style: EditingElementMark,
): EditingResult {
    const ordered = orderSelection(selection);
    if (comparePoints(ordered.start, ordered.end) === 0) {
        return unchanged(model, selection);
    }
    const selectedRuns = selectedTextRuns(model, ordered);
    const remove =
        selectedRuns.length > 0 &&
        selectedRuns.every((run) =>
            run.marks.some((mark) => sameElementMark(mark, style)),
        );
    return formatSelectedRuns(model, selection, (run) => ({
        ...run,
        marks: remove
            ? run.marks.filter((mark) => !sameElementMark(mark, style))
            : orderedMarks([
                  ...run.marks.filter((mark) => !sameElementMark(mark, style)),
                  style,
              ]),
    }));
}

export function removeFormat(
    model: EditingModel,
    selection: EditingSelection,
): EditingResult {
    const ordered = orderSelection(selection);
    if (comparePoints(ordered.start, ordered.end) === 0) {
        return unchanged(model, selection);
    }
    return formatSelectedRuns(model, selection, (run) => ({
        ...run,
        marks: run.marks.filter(
            (mark) => typeof mark !== 'string' && mark.kind === 'link',
        ),
    }));
}

export function deleteSelection(
    model: EditingModel,
    selection: EditingSelection,
): EditingResult {
    const ordered = orderSelection(selection);

    if (comparePoints(ordered.start, ordered.end) === 0) {
        validatePoint(model, ordered.start);
        return unchanged(model, selection);
    }

    const structured = wholeStructuredBlock(model, ordered);
    if (structured !== undefined) {
        if (structured.behavior !== 'atomic') {
            throw new UnsupportedEditingSelectionError(
                'Readonly structured content cannot be deleted.',
            );
        }
        return deleteStructuredBlock(model, ordered);
    }

    const startParagraph = getParagraph(model, ordered.start);
    const endParagraph = getParagraph(model, ordered.end);
    assertEditableRange(
        startParagraph,
        ordered.start.offset,
        ordered.start.block === ordered.end.block
            ? ordered.end.offset
            : paragraphLength(startParagraph),
    );

    if (ordered.start.block === ordered.end.block) {
        const [before, remainder] = splitInlines(
            startParagraph.inlines,
            ordered.start.offset,
        );
        const [, after] = splitInlines(
            remainder,
            ordered.end.offset - ordered.start.offset,
        );
        return replaceParagraph(
            model,
            ordered.start.block,
            { ...startParagraph, inlines: [...before, ...after] },
            ordered.start,
            collapsed(ordered.start),
            [
                {
                    block: ordered.start.block,
                    from: ordered.start.offset,
                    insertedLength: 0,
                    kind: 'replace-text',
                    to: ordered.end.offset,
                },
            ],
        );
    }

    assertEditableRange(endParagraph, 0, ordered.end.offset);
    if (
        endParagraph.attributes.length > 0 &&
        ordered.end.offset < paragraphLength(endParagraph)
    ) {
        throw new UnsupportedEditingSelectionError(
            'The selection would discard attributes from a partially retained paragraph.',
        );
    }
    for (
        let index = ordered.start.block + 1;
        index < ordered.end.block;
        index += 1
    ) {
        const block = model.blocks[index];
        if (
            block?.kind !== 'paragraph' ||
            block.inlines.some((inline) => inline.kind === 'opaque-inline')
        ) {
            throw new UnsupportedEditingSelectionError();
        }
    }

    const [before] = splitInlines(startParagraph.inlines, ordered.start.offset);
    const [, after] = splitInlines(endParagraph.inlines, ordered.end.offset);
    const blocks = [...model.blocks];
    blocks.splice(
        ordered.start.block,
        ordered.end.block - ordered.start.block + 1,
        { ...startParagraph, inlines: [...before, ...after] },
    );
    return result({ blocks }, collapsed(ordered.start), [
        {
            from: ordered.start,
            insertedEnd: ordered.start,
            kind: 'replace-range',
            to: ordered.end,
        },
    ]);
}

export function validateSelection(
    model: EditingModel,
    selection: EditingSelection,
): void {
    validatePoint(model, selection.anchor);
    validatePoint(model, selection.focus);
}

export function extractSelection(
    model: EditingModel,
    selection: EditingSelection,
): EditingModel {
    const ordered = orderSelection(selection);
    if (comparePoints(ordered.start, ordered.end) === 0) {
        return freezeModel({ blocks: [] });
    }

    const structured = wholeStructuredBlock(model, ordered);
    if (structured !== undefined) {
        return freezeModel({ blocks: [structured] });
    }

    const blocks = [] as EditingParagraph[];
    const firstSelected = model.blocks[ordered.start.block];
    const baseListDepth =
        firstSelected?.kind === 'paragraph' && firstSelected.list !== undefined
            ? (firstSelected.listDepth ?? 0)
            : 0;

    for (
        let index = ordered.start.block;
        index <= ordered.end.block;
        index += 1
    ) {
        const block = model.blocks[index];
        if (block?.kind !== 'paragraph') {
            throw new UnsupportedEditingSelectionError();
        }

        const from = index === ordered.start.block ? ordered.start.offset : 0;
        const to =
            index === ordered.end.block
                ? ordered.end.offset
                : paragraphLength(block);
        assertEditableRange(block, from, to);
        const [, remainder] = splitInlines(block.inlines, from);
        const [selected] = splitInlines(remainder, to - from);
        blocks.push({
            ...block,
            attributes:
                from === 0 && to === paragraphLength(block)
                    ? block.attributes
                    : [],
            inlines: selected,
            kind: 'paragraph',
            ...(block.list === undefined
                ? {}
                : {
                      listDepth: Math.max(
                          0,
                          (block.listDepth ?? 0) - baseListDepth,
                      ),
                      listStart: index === ordered.start.block,
                  }),
        });
    }

    return freezeModel({ blocks });
}

export function insertModel(
    model: EditingModel,
    selection: EditingSelection,
    inserted: EditingModel,
): EditingResult {
    const deleted = deleteSelection(model, selection);
    if (inserted.blocks.length === 0) {
        return deleted;
    }

    const point = deleted.selection.focus;
    const paragraph = getParagraph(deleted.model, point);
    const [before, after] = splitInlines(paragraph.inlines, point.offset);
    const insertedBlocks = [...inserted.blocks];

    if (
        insertedBlocks.length === 1 &&
        insertedBlocks[0]?.kind === 'paragraph' &&
        insertedBlocks[0].attributes.length === 0 &&
        isPlainParagraph(insertedBlocks[0])
    ) {
        const pastedLength = paragraphLength(insertedBlocks[0]);
        return replaceParagraph(
            deleted.model,
            point.block,
            {
                ...paragraph,
                inlines: [...before, ...insertedBlocks[0].inlines, ...after],
            },
            { block: point.block, offset: point.offset + pastedLength },
            collapsed({
                block: point.block,
                offset: point.offset + pastedLength,
            }),
            [
                ...deleted.operations,
                {
                    block: point.block,
                    from: point.offset,
                    insertedLength: pastedLength,
                    kind: 'replace-text',
                    to: point.offset,
                },
            ],
        );
    }

    const replacement: EditingBlock[] = [];
    const first = insertedBlocks[0];
    if (
        first?.kind === 'paragraph' &&
        first.attributes.length === 0 &&
        isPlainParagraph(first)
    ) {
        replacement.push({
            ...paragraph,
            inlines: [...before, ...first.inlines],
        });
        insertedBlocks.shift();
    } else {
        replacement.push({ ...paragraph, inlines: before });
    }

    replacement.push(...insertedBlocks);
    const last = replacement.at(-1);
    let caretBlock = point.block + replacement.length;
    let caretOffset = 0;
    if (
        last?.kind === 'paragraph' &&
        last.attributes.length === 0 &&
        isPlainParagraph(last)
    ) {
        caretBlock -= 1;
        caretOffset = paragraphLength(last);
        replacement[replacement.length - 1] = {
            ...last,
            inlines: [...last.inlines, ...after],
        };
    } else {
        replacement.push({
            attributes: [],
            inlines: after,
            kind: 'paragraph',
            tagName: 'p',
        });
    }

    const blocks = [...deleted.model.blocks];
    blocks.splice(point.block, 1, ...replacement);
    return result(
        { blocks },
        collapsed({ block: caretBlock, offset: caretOffset }),
        [
            ...deleted.operations,
            {
                from: point,
                insertedEnd: {
                    block: caretBlock,
                    offset: caretOffset,
                },
                kind: 'replace-range',
                to: point,
            },
        ],
    );
}

export function setBlockTag(
    model: EditingModel,
    selection: EditingSelection,
    tagName: EditingBlockTag,
): EditingResult {
    const range = orderSelection(selection);
    const blocks = [...model.blocks];

    for (let index = range.start.block; index <= range.end.block; index += 1) {
        const block = blocks[index];
        if (block?.kind !== 'paragraph') {
            throw new UnsupportedEditingSelectionError();
        }
        blocks[index] = {
            ...(block.list === undefined ? block : withoutList(block)),
            tagName,
        };
    }

    return result({ blocks }, selection, [
        {
            from: range.start,
            kind: 'format-blocks',
            to: range.end,
        },
    ]);
}

export function applyBlockAttributes(
    model: EditingModel,
    selection: EditingSelection,
    attributes: readonly HtmlAttribute[],
): EditingResult {
    const range = orderSelection(selection);
    const blocks = [...model.blocks];

    for (let index = range.start.block; index <= range.end.block; index += 1) {
        const block = blocks[index];
        if (block?.kind !== 'paragraph') {
            throw new UnsupportedEditingSelectionError();
        }
        const names = new Set(
            attributes.map(
                (attribute) => `${attribute.namespace ?? ''}:${attribute.name}`,
            ),
        );
        blocks[index] = {
            ...block,
            attributes: [
                ...block.attributes.filter(
                    (attribute) =>
                        !names.has(
                            `${attribute.namespace ?? ''}:${attribute.name}`,
                        ),
                ),
                ...attributes,
            ],
        };
    }

    return result({ blocks }, selection, [
        { from: range.start, kind: 'format-blocks', to: range.end },
    ]);
}

export function setBlockAlignment(
    model: EditingModel,
    selection: EditingSelection,
    alignment: EditingParagraph['alignment'],
): EditingResult {
    const range = orderSelection(selection);
    const blocks = [...model.blocks];
    for (let index = range.start.block; index <= range.end.block; index += 1) {
        const block = blocks[index];
        if (block?.kind !== 'paragraph') {
            throw new UnsupportedEditingSelectionError();
        }
        if (alignment === undefined) {
            const { alignment: _alignment, ...withoutAlignment } = block;
            void _alignment;
            blocks[index] = withoutAlignment;
        } else {
            blocks[index] = { ...block, alignment };
        }
    }
    return result({ blocks }, selection, [
        { from: range.start, kind: 'format-blocks', to: range.end },
    ]);
}

export function adjustBlockIndent(
    model: EditingModel,
    selection: EditingSelection,
    delta: -1 | 1,
): EditingResult {
    const range = orderSelection(selection);
    const blocks = [...model.blocks];
    let changed = false;
    for (let index = range.start.block; index <= range.end.block; index += 1) {
        const block = blocks[index];
        if (block?.kind !== 'paragraph') {
            throw new UnsupportedEditingSelectionError();
        }
        if (block.list !== undefined) {
            const currentDepth = block.listDepth ?? 0;
            if (delta === 1) {
                const previous = blocks[index - 1];
                const maximum =
                    previous?.kind === 'paragraph' &&
                    previous.list !== undefined
                        ? Math.min(8, (previous.listDepth ?? 0) + 1)
                        : currentDepth;
                const next = Math.min(currentDepth + 1, maximum);
                if (next !== currentDepth) changed = true;
                blocks[index] = {
                    ...block,
                    listDepth: next,
                    listStart: true,
                };
            } else if (currentDepth > 0) {
                changed = true;
                const previous = blocks[index - 1];
                blocks[index] = {
                    ...block,
                    listDepth: currentDepth - 1,
                    listStart: !(
                        previous?.kind === 'paragraph' &&
                        previous.list === block.list &&
                        (previous.listDepth ?? 0) === currentDepth - 1
                    ),
                };
            } else {
                changed = true;
                blocks[index] = withoutList(block);
            }
            continue;
        }
        const next = Math.max(0, Math.min(8, (block.indent ?? 0) + delta));
        if (next !== (block.indent ?? 0)) changed = true;
        if (next === 0) {
            const { indent: _indent, ...withoutIndent } = block;
            void _indent;
            blocks[index] = withoutIndent;
        } else {
            blocks[index] = { ...block, indent: next };
        }
    }
    return changed
        ? result({ blocks }, selection, [
              { from: range.start, kind: 'format-blocks', to: range.end },
          ])
        : unchanged(model, selection);
}

export function toggleList(
    model: EditingModel,
    selection: EditingSelection,
    list: 'ol' | 'ul',
): EditingResult {
    const range = orderSelection(selection);
    const blocks = [...model.blocks];
    const remove = blocks
        .slice(range.start.block, range.end.block + 1)
        .every((block) => block?.kind === 'paragraph' && block.list === list);

    for (let index = range.start.block; index <= range.end.block; index += 1) {
        const block = blocks[index];
        if (block?.kind !== 'paragraph') {
            throw new UnsupportedEditingSelectionError();
        }
        blocks[index] = remove
            ? withoutList(block)
            : {
                  ...block,
                  list,
                  listDepth: 0,
                  listStart: index === range.start.block,
                  ...(index === range.start.block
                      ? { listAttributes: Object.freeze([]) }
                      : {}),
                  tagName: 'p',
              };
    }

    return result({ blocks }, selection, [
        {
            from: range.start,
            kind: 'format-blocks',
            to: range.end,
        },
    ]);
}

export function setListAttributes(
    model: EditingModel,
    selection: EditingSelection,
    attributes: readonly HtmlAttribute[],
): EditingResult {
    const range = orderSelection(selection);
    const selected = model.blocks[range.start.block];
    if (selected?.kind !== 'paragraph' || selected.list === undefined) {
        throw new UnsupportedEditingSelectionError(
            'A list item selection is required.',
        );
    }
    const depth = selected.listDepth ?? 0;
    let start = range.start.block;
    while (start > 0) {
        const previous = model.blocks[start - 1];
        if (
            previous?.kind !== 'paragraph' ||
            previous.list !== selected.list ||
            (previous.listDepth ?? 0) !== depth ||
            model.blocks[start]?.kind !== 'paragraph' ||
            (model.blocks[start] as EditingParagraph).listStart === true
        ) {
            break;
        }
        start -= 1;
    }
    const block = model.blocks[start];
    if (block?.kind !== 'paragraph') {
        throw new UnsupportedEditingSelectionError();
    }
    const blocks = [...model.blocks];
    blocks[start] = {
        ...block,
        listAttributes: attributes,
        listStart: true,
    };
    return result({ blocks }, selection, [
        { from: range.start, kind: 'format-blocks', to: range.end },
    ]);
}

export function setLink(
    model: EditingModel,
    selection: EditingSelection,
    attributes: readonly HtmlAttribute[] | undefined,
): EditingResult {
    const range = orderSelection(selection);
    if (
        comparePoints(range.start, range.end) === 0 ||
        range.start.block !== range.end.block
    ) {
        return unchanged(model, selection);
    }

    const paragraph = getParagraph(model, range.start);
    assertPoint(paragraph, range.end);
    assertEditableRange(paragraph, range.start.offset, range.end.offset);
    const [before, remainder] = splitInlines(
        paragraph.inlines,
        range.start.offset,
    );
    const [middle, after] = splitInlines(
        remainder,
        range.end.offset - range.start.offset,
    );
    const linked = middle.map((inline): EditingInline => {
        if (inline.kind !== 'text') {
            return inline;
        }
        const marks = inline.marks.filter(
            (mark) => typeof mark === 'string' || mark.kind !== 'link',
        );
        return attributes === undefined
            ? { ...inline, marks }
            : {
                  ...inline,
                  marks: [{ attributes, kind: 'link' }, ...marks],
              };
    });

    return replaceParagraph(
        model,
        range.start.block,
        { ...paragraph, inlines: [...before, ...linked, ...after] },
        selection.focus,
        selection,
        [
            {
                from: range.start,
                kind: 'format-inline',
                to: range.end,
            },
        ],
    );
}

export function setStructuredBlockAttributes(
    model: EditingModel,
    selection: EditingSelection,
    type: string,
    attributes: readonly HtmlAttribute[],
): EditingResult {
    const range = orderSelection(selection);
    const block = editableStructuredBlock(model, range, type);
    const blocks = [...model.blocks];
    blocks[range.start.block] = { ...block, attributes };
    return result({ blocks }, selection, [
        {
            block: range.start.block,
            kind: 'set-structured-attributes',
            type,
        },
    ]);
}

export function replaceStructuredBlockContent(
    model: EditingModel,
    selection: EditingSelection,
    type: string,
    content: EditingStructuredBlockContent,
): EditingResult {
    const range = orderSelection(selection);
    const block = editableStructuredBlock(model, range, type);
    if (
        typeof content !== 'object' ||
        content === null ||
        !Array.isArray(content.attributes) ||
        !content.attributes.every(isHtmlAttribute) ||
        !Array.isArray(content.children) ||
        !content.children.every(isHtmlChildNode)
    ) {
        throw new TypeError(
            'Structured block content requires valid HTML attributes and child nodes.',
        );
    }
    const blocks = [...model.blocks];
    blocks[range.start.block] = {
        ...block,
        attributes: content.attributes,
        children: content.children,
    };
    return result({ blocks }, selection, [
        {
            block: range.start.block,
            kind: 'replace-structured-content',
            type,
        },
    ]);
}

export function getSelectedStructuredBlock(
    model: EditingModel,
    selection: EditingSelection,
    type?: string,
): EditingStructuredBlock | undefined {
    const block = wholeStructuredBlock(model, orderSelection(selection));
    return block !== undefined && (type === undefined || block.type === type)
        ? block
        : undefined;
}

export function isStructuredBlockSelected(
    model: EditingModel,
    selection: EditingSelection,
    type?: string,
): boolean {
    return getSelectedStructuredBlock(model, selection, type) !== undefined;
}

export function moveStructuredBlock(
    model: EditingModel,
    selection: EditingSelection,
    targetBlock: number,
    placement: 'before' | 'after',
): EditingResult {
    const range = orderSelection(selection);
    const block = wholeStructuredBlock(model, range);
    if (block === undefined || block.behavior !== 'atomic') {
        throw new UnsupportedEditingSelectionError(
            'An atomic structured block must be selected for movement.',
        );
    }
    if (
        !Number.isInteger(targetBlock) ||
        targetBlock < 0 ||
        targetBlock >= model.blocks.length
    ) {
        throw new RangeError(`Drop target block ${targetBlock} is invalid.`);
    }
    if (placement !== 'before' && placement !== 'after') {
        throw new TypeError('Drop placement must be "before" or "after".');
    }

    const sourceBlock = range.start.block;
    let insertion = targetBlock + (placement === 'after' ? 1 : 0);
    if (sourceBlock < insertion) {
        insertion -= 1;
    }
    if (insertion === sourceBlock) {
        return unchanged(model, selection);
    }
    const blocks = [...model.blocks];
    blocks.splice(sourceBlock, 1);
    blocks.splice(insertion, 0, block);
    return result(
        { blocks },
        {
            anchor: { block: insertion, offset: 0 },
            focus: { block: insertion, offset: 1 },
        },
        [
            {
                fromBlock: sourceBlock,
                kind: 'move-block',
                toBlock: insertion,
            },
        ],
    );
}

export function isTextMarkActive(
    model: EditingModel,
    selection: EditingSelection,
    mark: EditingTextMark,
): boolean {
    const range = orderSelection(selection);
    if (comparePoints(range.start, range.end) === 0) {
        const paragraph = model.blocks[range.start.block];
        if (paragraph?.kind !== 'paragraph') {
            return false;
        }
        return marksAtPoint(paragraph, range.start.offset).includes(mark);
    }
    try {
        const runs = selectedTextRuns(model, range);
        return runs.length > 0 && runs.every((run) => run.marks.includes(mark));
    } catch {
        return false;
    }
}

export function isInlineStyleActive(
    model: EditingModel,
    selection: EditingSelection,
    style: EditingElementMark,
): boolean {
    const range = orderSelection(selection);
    if (comparePoints(range.start, range.end) === 0) {
        const paragraph = model.blocks[range.start.block];
        return (
            paragraph?.kind === 'paragraph' &&
            marksAtPoint(paragraph, range.start.offset).some((mark) =>
                sameElementMark(mark, style),
            )
        );
    }
    try {
        const runs = selectedTextRuns(model, range);
        return (
            runs.length > 0 &&
            runs.every((run) =>
                run.marks.some((mark) => sameElementMark(mark, style)),
            )
        );
    } catch {
        return false;
    }
}

export function areBlockAttributesActive(
    model: EditingModel,
    selection: EditingSelection,
    attributes: readonly HtmlAttribute[],
): boolean {
    const range = orderSelection(selection);
    return model.blocks
        .slice(range.start.block, range.end.block + 1)
        .every(
            (block) =>
                block?.kind === 'paragraph' &&
                attributes.every((attribute) =>
                    block.attributes.some(
                        (candidate) =>
                            candidate.name === attribute.name &&
                            candidate.namespace === attribute.namespace &&
                            candidate.value === attribute.value,
                    ),
                ),
        );
}

export function isBlockAlignmentActive(
    model: EditingModel,
    selection: EditingSelection,
    alignment: EditingParagraph['alignment'],
): boolean {
    const range = orderSelection(selection);
    return model.blocks
        .slice(range.start.block, range.end.block + 1)
        .every(
            (block) =>
                block?.kind === 'paragraph' && block.alignment === alignment,
        );
}

export function isBlockTagActive(
    model: EditingModel,
    selection: EditingSelection,
    tagName: EditingBlockTag,
): boolean {
    const range = orderSelection(selection);
    return model.blocks
        .slice(range.start.block, range.end.block + 1)
        .every(
            (block) =>
                block?.kind === 'paragraph' &&
                block.list === undefined &&
                block.tagName === tagName,
        );
}

export function isListActive(
    model: EditingModel,
    selection: EditingSelection,
    list: 'ol' | 'ul',
): boolean {
    const range = orderSelection(selection);
    return model.blocks
        .slice(range.start.block, range.end.block + 1)
        .every((block) => block?.kind === 'paragraph' && block.list === list);
}

export function isLinkActive(
    model: EditingModel,
    selection: EditingSelection,
): boolean {
    const range = orderSelection(selection);
    const paragraph = model.blocks[range.start.block];
    if (paragraph?.kind !== 'paragraph') {
        return false;
    }
    if (comparePoints(range.start, range.end) === 0) {
        return marksAtPoint(paragraph, range.start.offset).some(
            (mark) => typeof mark !== 'string' && mark.kind === 'link',
        );
    }
    if (range.start.block !== range.end.block) {
        return false;
    }
    const [, remainder] = splitInlines(paragraph.inlines, range.start.offset);
    const [middle] = splitInlines(
        remainder,
        range.end.offset - range.start.offset,
    );
    const runs = middle.filter(
        (inline): inline is EditingTextRun => inline.kind === 'text',
    );
    return (
        runs.length > 0 &&
        runs.every((run) =>
            run.marks.some(
                (mark) => typeof mark !== 'string' && mark.kind === 'link',
            ),
        )
    );
}

export function getLinkAttributes(
    model: EditingModel,
    selection: EditingSelection,
): readonly HtmlAttribute[] | undefined {
    const range = orderSelection(selection);
    const paragraph = model.blocks[range.start.block];
    if (
        paragraph?.kind !== 'paragraph' ||
        range.start.block !== range.end.block
    ) {
        return undefined;
    }
    const collapsedSelection = comparePoints(range.start, range.end) === 0;
    const marks = collapsedSelection
        ? marksAtPoint(paragraph, range.start.offset)
        : [];
    const links = collapsedSelection
        ? marks.filter(isEditingLinkMark)
        : selectedTextRuns(model, range).map((run) =>
              run.marks.find(isEditingLinkMark),
          );
    if (links.some((link) => link === undefined)) return undefined;
    if (links.length === 0) return undefined;
    const signature = JSON.stringify(links[0]?.attributes ?? []);
    return links.every((link) => JSON.stringify(link?.attributes) === signature)
        ? links[0]?.attributes
        : undefined;
}

function isEditingLinkMark(mark: EditingMark): mark is EditingLinkMark {
    return typeof mark !== 'string' && mark.kind === 'link';
}

function replaceParagraph(
    model: EditingModel,
    index: number,
    paragraph: EditingParagraph,
    point: EditingPoint,
    selection: EditingSelection = collapsed(point),
    operations: readonly EditingOperation[] = [],
): EditingResult {
    const blocks = [...model.blocks];
    blocks[index] = paragraph;
    return result({ blocks }, selection, operations);
}

function isPlainParagraph(paragraph: EditingParagraph): boolean {
    return paragraph.tagName === 'p' && paragraph.list === undefined;
}

function splitInlines(
    inlines: readonly EditingInline[],
    offset: number,
): readonly [readonly EditingInline[], readonly EditingInline[]] {
    const before: EditingInline[] = [];
    const after: EditingInline[] = [];
    let position = 0;

    for (const inline of inlines) {
        const length = inline.kind === 'text' ? inline.text.length : 1;
        const end = position + length;

        if (offset <= position) {
            after.push(inline);
        } else if (offset >= end) {
            before.push(inline);
        } else if (inline.kind === 'opaque-inline') {
            throw new UnsupportedEditingSelectionError();
        } else {
            const localOffset = offset - position;
            before.push({ ...inline, text: inline.text.slice(0, localOffset) });
            after.push({ ...inline, text: inline.text.slice(localOffset) });
        }

        position = end;
    }

    if (offset < 0 || offset > position) {
        throw new RangeError(
            `Editing offset ${offset} is outside the paragraph.`,
        );
    }

    return [normalizeInlines(before), normalizeInlines(after)];
}

function assertEditableRange(
    paragraph: EditingParagraph,
    start: number,
    end: number,
): void {
    let position = 0;
    for (const inline of paragraph.inlines) {
        const length = inline.kind === 'text' ? inline.text.length : 1;
        if (
            inline.kind === 'opaque-inline' &&
            start < position + length &&
            end > position
        ) {
            throw new UnsupportedEditingSelectionError();
        }
        position += length;
    }
}

function getParagraph(
    model: EditingModel,
    point: EditingPoint,
): EditingParagraph {
    const block = model.blocks[point.block];
    if (block?.kind !== 'paragraph') {
        throw new UnsupportedEditingSelectionError(
            `Block ${point.block} is not an editable paragraph.`,
        );
    }
    assertPoint(block, point);
    return block;
}

function validatePoint(model: EditingModel, point: EditingPoint): void {
    const block = model.blocks[point.block];
    if (block?.kind === 'structured-block') {
        if (
            !Number.isInteger(point.offset) ||
            point.offset < 0 ||
            point.offset > 1
        ) {
            throw new RangeError(
                `Editing offset ${point.offset} is outside a structured block.`,
            );
        }
        return;
    }
    getParagraph(model, point);
}

function isHtmlChildNode(value: unknown): value is HtmlChildNode {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return false;
    }
    const node = value as Record<string, unknown>;
    if (node.type === 'text' || node.type === 'comment') {
        return typeof node.value === 'string';
    }
    return (
        node.type === 'element' &&
        typeof node.tagName === 'string' &&
        ['html', 'svg', 'mathml'].includes(String(node.namespace)) &&
        Array.isArray(node.attributes) &&
        node.attributes.every(isHtmlAttribute) &&
        Array.isArray(node.children) &&
        node.children.every(isHtmlChildNode)
    );
}

function isHtmlAttribute(value: unknown): value is HtmlAttribute {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return false;
    }
    const attribute = value as Record<string, unknown>;
    return (
        typeof attribute.name === 'string' &&
        typeof attribute.value === 'string' &&
        (attribute.namespace === undefined ||
            typeof attribute.namespace === 'string') &&
        (attribute.prefix === undefined || typeof attribute.prefix === 'string')
    );
}

function wholeStructuredBlock(
    model: EditingModel,
    range: { readonly start: EditingPoint; readonly end: EditingPoint },
): Extract<EditingBlock, { readonly kind: 'structured-block' }> | undefined {
    if (
        range.start.block !== range.end.block ||
        range.start.offset !== 0 ||
        range.end.offset !== 1
    ) {
        return undefined;
    }
    const block = model.blocks[range.start.block];
    return block?.kind === 'structured-block' ? block : undefined;
}

function editableStructuredBlock(
    model: EditingModel,
    range: { readonly start: EditingPoint; readonly end: EditingPoint },
    type: string,
): EditingStructuredBlock {
    const block = wholeStructuredBlock(model, range);
    if (
        block === undefined ||
        block.type !== type ||
        block.behavior !== 'atomic'
    ) {
        throw new UnsupportedEditingSelectionError(
            `An editable atomic structured block of type "${type}" must be selected.`,
        );
    }
    return block;
}

function deleteStructuredBlock(
    model: EditingModel,
    range: { readonly start: EditingPoint; readonly end: EditingPoint },
): EditingResult {
    const blocks = [...model.blocks];
    blocks.splice(range.start.block, 1);
    let point: EditingPoint;
    const following = blocks[range.start.block];
    const previous = blocks[range.start.block - 1];
    if (following?.kind === 'paragraph') {
        point = { block: range.start.block, offset: 0 };
    } else if (previous?.kind === 'paragraph') {
        point = {
            block: range.start.block - 1,
            offset: paragraphLength(previous),
        };
    } else {
        blocks.splice(range.start.block, 0, {
            attributes: [],
            inlines: [],
            kind: 'paragraph',
            tagName: 'p',
        });
        point = { block: range.start.block, offset: 0 };
    }
    return result({ blocks }, collapsed(point), [
        {
            from: range.start,
            insertedEnd: point,
            kind: 'replace-range',
            to: range.end,
        },
    ]);
}

function assertPoint(paragraph: EditingParagraph, point: EditingPoint): void {
    const length = paragraphLength(paragraph);
    if (
        !Number.isInteger(point.offset) ||
        point.offset < 0 ||
        point.offset > length
    ) {
        throw new RangeError(
            `Editing offset ${point.offset} is outside a paragraph of length ${length}.`,
        );
    }
}

function marksAtPoint(
    paragraph: EditingParagraph,
    offset: number,
): readonly EditingMark[] {
    let position = 0;
    let previous: EditingTextRun | undefined;

    for (const inline of paragraph.inlines) {
        const length = inline.kind === 'text' ? inline.text.length : 1;
        if (inline.kind === 'text') {
            if (offset > position && offset <= position + length) {
                return inline.marks;
            }
            if (offset === position) {
                return previous?.marks ?? inline.marks;
            }
            previous = inline;
        }
        position += length;
    }

    return previous?.marks ?? [];
}

function previousCodePointOffset(
    paragraph: EditingParagraph,
    offset: number,
): number {
    const text = paragraphText(paragraph);
    const candidate = offset - 1;
    if (
        candidate > 0 &&
        isLowSurrogate(text.charCodeAt(candidate)) &&
        isHighSurrogate(text.charCodeAt(candidate - 1))
    ) {
        return candidate - 1;
    }
    return candidate;
}

function nextCodePointOffset(
    paragraph: EditingParagraph,
    offset: number,
): number {
    const text = paragraphText(paragraph);
    if (
        isHighSurrogate(text.charCodeAt(offset)) &&
        isLowSurrogate(text.charCodeAt(offset + 1))
    ) {
        return offset + 2;
    }
    return offset + 1;
}

function paragraphText(paragraph: EditingParagraph): string {
    return paragraph.inlines
        .map((inline) => (inline.kind === 'text' ? inline.text : '\uFFFC'))
        .join('');
}

function selectedTextRuns(
    model: EditingModel,
    range: { readonly start: EditingPoint; readonly end: EditingPoint },
): readonly EditingTextRun[] {
    const runs: EditingTextRun[] = [];
    for (let index = range.start.block; index <= range.end.block; index += 1) {
        const paragraph = getParagraph(model, { block: index, offset: 0 });
        const from = index === range.start.block ? range.start.offset : 0;
        const to =
            index === range.end.block
                ? range.end.offset
                : paragraphLength(paragraph);
        assertEditableRange(paragraph, from, to);
        const [, remainder] = splitInlines(paragraph.inlines, from);
        const [middle] = splitInlines(remainder, to - from);
        runs.push(
            ...middle.filter(
                (inline): inline is EditingTextRun => inline.kind === 'text',
            ),
        );
    }
    return runs;
}

function formatSelectedRuns(
    model: EditingModel,
    selection: EditingSelection,
    format: (run: EditingTextRun) => EditingTextRun,
): EditingResult {
    const range = orderSelection(selection);
    const blocks = [...model.blocks];
    for (let index = range.start.block; index <= range.end.block; index += 1) {
        const paragraph = getParagraph(model, { block: index, offset: 0 });
        const from = index === range.start.block ? range.start.offset : 0;
        const to =
            index === range.end.block
                ? range.end.offset
                : paragraphLength(paragraph);
        assertEditableRange(paragraph, from, to);
        const [before, remainder] = splitInlines(paragraph.inlines, from);
        const [middle, after] = splitInlines(remainder, to - from);
        blocks[index] = {
            ...paragraph,
            inlines: [
                ...before,
                ...middle.map((inline) =>
                    inline.kind === 'text' ? format(inline) : inline,
                ),
                ...after,
            ],
        };
    }
    return result({ blocks }, selection, [
        { from: range.start, kind: 'format-inline', to: range.end },
    ]);
}

function sameElementMark(
    mark: EditingMark,
    style: EditingElementMark,
): boolean {
    return (
        typeof mark !== 'string' &&
        mark.kind === 'element' &&
        mark.tagName === style.tagName &&
        mark.attributes.length === style.attributes.length &&
        mark.attributes.every((attribute, index) => {
            const candidate = style.attributes[index];
            return (
                candidate !== undefined &&
                candidate.name === attribute.name &&
                candidate.value === attribute.value &&
                candidate.namespace === attribute.namespace &&
                candidate.prefix === attribute.prefix
            );
        })
    );
}

function withoutList(block: EditingParagraph): EditingParagraph {
    const {
        list: _list,
        listAttributes: _listAttributes,
        listDepth: _listDepth,
        listStart: _listStart,
        ...paragraph
    } = block;
    void _list;
    void _listAttributes;
    void _listDepth;
    void _listStart;
    return { ...paragraph, tagName: 'p' };
}

function isHighSurrogate(value: number): boolean {
    return value >= 0xd800 && value <= 0xdbff;
}

function isLowSurrogate(value: number): boolean {
    return value >= 0xdc00 && value <= 0xdfff;
}

function orderSelection(selection: EditingSelection): {
    readonly start: EditingPoint;
    readonly end: EditingPoint;
} {
    return comparePoints(selection.anchor, selection.focus) <= 0
        ? { start: selection.anchor, end: selection.focus }
        : { start: selection.focus, end: selection.anchor };
}

function comparePoints(left: EditingPoint, right: EditingPoint): number {
    return left.block === right.block
        ? left.offset - right.offset
        : left.block - right.block;
}

function collapsed(point: EditingPoint): EditingSelection {
    return { anchor: point, focus: point };
}

function isCollapsed(selection: EditingSelection): boolean {
    return comparePoints(selection.anchor, selection.focus) === 0;
}

function orderedMarks(marks: readonly EditingMark[]): readonly EditingMark[] {
    return [...new Set(marks)].sort((left, right) =>
        left === right ? 0 : left === 'strong' ? -1 : 1,
    );
}

function result(
    model: EditingModel,
    selection: EditingSelection,
    operations: readonly EditingOperation[] = [],
): EditingResult {
    return Object.freeze({
        model: freezeModel(model),
        operations: Object.freeze(
            operations.map((operation) => freezeOperation(operation)),
        ),
        selection: freezeSelection(selection),
    });
}

function unchanged(
    model: EditingModel,
    selection: EditingSelection,
): EditingResult {
    validateSelection(model, selection);
    return Object.freeze({
        model,
        operations: Object.freeze([]),
        selection: freezeSelection(selection),
    });
}

function freezeOperation(operation: EditingOperation): EditingOperation {
    if (operation.kind === 'split-block') {
        return Object.freeze({
            ...operation,
            point: Object.freeze({ ...operation.point }),
        });
    }
    if (
        operation.kind === 'replace-range' ||
        operation.kind === 'format-blocks' ||
        operation.kind === 'format-inline'
    ) {
        if (operation.kind === 'replace-range') {
            return Object.freeze({
                ...operation,
                from: Object.freeze({ ...operation.from }),
                insertedEnd: Object.freeze({ ...operation.insertedEnd }),
                to: Object.freeze({ ...operation.to }),
            });
        }
        return Object.freeze({
            ...operation,
            from: Object.freeze({ ...operation.from }),
            to: Object.freeze({ ...operation.to }),
        });
    }
    return Object.freeze({ ...operation });
}

function isEditingOperation(value: unknown): value is EditingOperation {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const operation = value as Record<string, unknown>;
    switch (operation.kind) {
        case 'replace-text':
            return (
                isIndex(operation.block) &&
                isIndex(operation.from) &&
                isIndex(operation.to) &&
                isIndex(operation.insertedLength) &&
                operation.from <= operation.to
            );
        case 'split-block':
            return isEditingPoint(operation.point);
        case 'join-blocks':
            return isIndex(operation.block) && isIndex(operation.leftLength);
        case 'set-structured-attributes':
        case 'replace-structured-content':
            return (
                isIndex(operation.block) &&
                typeof operation.type === 'string' &&
                operation.type.length > 0
            );
        case 'move-block':
            return isIndex(operation.fromBlock) && isIndex(operation.toBlock);
        case 'replace-range':
            return (
                isEditingPoint(operation.from) &&
                isEditingPoint(operation.to) &&
                comparePoints(operation.from, operation.to) <= 0 &&
                isEditingPoint(operation.insertedEnd)
            );
        case 'format-blocks':
        case 'format-inline':
            return (
                isEditingPoint(operation.from) &&
                isEditingPoint(operation.to) &&
                comparePoints(operation.from, operation.to) <= 0
            );
        default:
            return false;
    }
}

function isEditingPoint(value: unknown): value is EditingPoint {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const point = value as Record<string, unknown>;
    return isIndex(point.block) && isIndex(point.offset);
}

function isIndex(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function mapPointThroughOperation(
    point: EditingPoint,
    operation: EditingOperation,
    affinity: EditingPointAffinity,
): EditingPoint {
    switch (operation.kind) {
        case 'replace-text': {
            if (point.block !== operation.block) {
                return point;
            }
            if (point.offset < operation.from) {
                return point;
            }
            if (point.offset > operation.to) {
                return Object.freeze({
                    block: point.block,
                    offset:
                        point.offset +
                        operation.insertedLength -
                        (operation.to - operation.from),
                });
            }
            return Object.freeze({
                block: point.block,
                offset:
                    operation.from +
                    (affinity === 'forward' ? operation.insertedLength : 0),
            });
        }
        case 'split-block':
            if (point.block < operation.point.block) {
                return point;
            }
            if (point.block > operation.point.block) {
                return Object.freeze({
                    block: point.block + 1,
                    offset: point.offset,
                });
            }
            if (
                point.offset < operation.point.offset ||
                (point.offset === operation.point.offset &&
                    affinity === 'backward')
            ) {
                return point;
            }
            return Object.freeze({
                block: point.block + 1,
                offset: point.offset - operation.point.offset,
            });
        case 'join-blocks':
            if (point.block <= operation.block) {
                return point;
            }
            if (point.block === operation.block + 1) {
                return Object.freeze({
                    block: operation.block,
                    offset: operation.leftLength + point.offset,
                });
            }
            return Object.freeze({
                block: point.block - 1,
                offset: point.offset,
            });
        case 'replace-range': {
            if (comparePoints(point, operation.from) < 0) {
                return point;
            }
            if (
                point.block === operation.to.block &&
                point.offset > operation.to.offset
            ) {
                return Object.freeze({
                    block: operation.insertedEnd.block,
                    offset:
                        operation.insertedEnd.offset +
                        point.offset -
                        operation.to.offset,
                });
            }
            if (point.block > operation.to.block) {
                return Object.freeze({
                    block:
                        point.block +
                        operation.insertedEnd.block -
                        operation.to.block,
                    offset: point.offset,
                });
            }
            return affinity === 'forward'
                ? operation.insertedEnd
                : operation.from;
        }
        case 'format-blocks':
        case 'format-inline':
        case 'set-structured-attributes':
        case 'replace-structured-content':
            return point;
        case 'move-block':
            if (point.block === operation.fromBlock) {
                return Object.freeze({
                    block: operation.toBlock,
                    offset: point.offset,
                });
            }
            if (
                operation.fromBlock < operation.toBlock &&
                point.block > operation.fromBlock &&
                point.block <= operation.toBlock
            ) {
                return Object.freeze({
                    block: point.block - 1,
                    offset: point.offset,
                });
            }
            if (
                operation.toBlock < operation.fromBlock &&
                point.block >= operation.toBlock &&
                point.block < operation.fromBlock
            ) {
                return Object.freeze({
                    block: point.block + 1,
                    offset: point.offset,
                });
            }
            return point;
    }
}
