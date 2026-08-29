import { Editor } from '@soeditor/core';
import { parseHtmlFragment, serializeHtmlFragment } from '@soeditor/html';

import {
    createEditingModel,
    serializeEditingModel,
    type EditingModel,
    type EditingSelection,
} from '../src/model.js';
import {
    deleteBackward,
    deleteForward,
    deleteSelection,
    insertParagraph,
    insertModel,
    insertText,
    isBlockTagActive,
    isLinkActive,
    isListActive,
    isTextMarkActive,
    mapEditingPoint,
    readEditingOperations,
    setBlockTag,
    setEditingOperations,
    setLink,
    toggleMark,
    toggleList,
    UnsupportedEditingSelectionError,
} from '../src/operations.js';

describe('editing operations', () => {
    it('inserts text and replaces a text selection through marked runs', () => {
        const model = fromHtml('<p>A<strong>BC</strong>D</p>');
        const inserted = insertText(model, collapsed(0, 2), 'x');
        const replaced = insertText(inserted.model, range(0, 1, 0, 4), 'Y');

        expect(toHtml(inserted.model)).toBe('<p>A<strong>BxC</strong>D</p>');
        expect(inserted.selection).toEqual(collapsed(0, 3));
        expect(toHtml(replaced.model)).toBe('<p>AYD</p>');
        expect(replaced.selection).toEqual(collapsed(0, 2));
    });

    it('splits a paragraph and merges it with Backspace and Delete', () => {
        const model = fromHtml('<p>One<strong>Two</strong></p>');
        const split = insertParagraph(model, collapsed(0, 3));
        const mergedBackward = deleteBackward(split.model, collapsed(1, 0));
        const splitAgain = insertParagraph(
            mergedBackward.model,
            collapsed(0, 3),
        );
        const mergedForward = deleteForward(splitAgain.model, collapsed(0, 3));

        expect(toHtml(split.model)).toBe(
            '<p>One</p><p><strong>Two</strong></p>',
        );
        expect(toHtml(mergedBackward.model)).toBe(
            '<p>One<strong>Two</strong></p>',
        );
        expect(toHtml(mergedForward.model)).toBe(
            '<p>One<strong>Two</strong></p>',
        );
    });

    it('deletes backward and forward by Unicode code point', () => {
        const model = fromHtml('<p>A😀B</p>');

        expect(toHtml(deleteBackward(model, collapsed(0, 3)).model)).toBe(
            '<p>AB</p>',
        );
        expect(toHtml(deleteForward(model, collapsed(0, 1)).model)).toBe(
            '<p>AB</p>',
        );
    });

    it('deletes a selection across supported paragraphs', () => {
        const model = fromHtml('<p>First</p><p>Middle</p><p>Last</p>');
        const deleted = deleteSelection(model, range(0, 2, 2, 2));

        expect(toHtml(deleted.model)).toBe('<p>Fist</p>');
        expect(deleted.selection).toEqual(collapsed(0, 2));
    });

    it('toggles strong and emphasis on a basic selection', () => {
        const model = fromHtml('<p>Example</p>');
        const strong = toggleMark(model, range(0, 1, 0, 6), 'strong');
        const emphasized = toggleMark(strong.model, range(0, 2, 0, 5), 'em');
        const unstrong = toggleMark(
            emphasized.model,
            range(0, 1, 0, 6),
            'strong',
        );

        expect(toHtml(strong.model)).toBe('<p>E<strong>xampl</strong>e</p>');
        expect(toHtml(emphasized.model)).toBe(
            '<p>E<strong>x</strong><strong><em>amp</em></strong><strong>l</strong>e</p>',
        );
        expect(toHtml(unstrong.model)).toBe('<p>Ex<em>amp</em>le</p>');
    });

    it('sets blocks and toggles lists across forward or backward selections', () => {
        const model = fromHtml('<p>One</p><p>Two</p>');
        const selection = range(1, 3, 0, 0);
        const heading = setBlockTag(model, selection, 'h2');
        const listed = toggleList(heading.model, selection, 'ol');

        expect(toHtml(heading.model)).toBe('<h2>One</h2><h2>Two</h2>');
        expect(isBlockTagActive(heading.model, selection, 'h2')).toBe(true);
        expect(toHtml(listed.model)).toBe('<ol><li>One</li><li>Two</li></ol>');
        expect(isListActive(listed.model, selection, 'ol')).toBe(true);
        expect(toHtml(toggleList(listed.model, selection, 'ol').model)).toBe(
            '<p>One</p><p>Two</p>',
        );
    });

    it('keeps inserted list blocks structural instead of flattening them', () => {
        const model = fromHtml('<p>BeforeAfter</p>');
        const inserted = fromHtml('<ul><li>Item</li></ul>');
        const result = insertModel(model, collapsed(0, 6), inserted);

        expect(toHtml(result.model)).toBe(
            '<p>Before</p><ul><li>Item</li></ul><p>After</p>',
        );
    });

    it('sets, detects, and removes links without interpreting their URL', () => {
        const model = fromHtml('<p>Example</p>');
        const selection = range(0, 1, 0, 6);
        const linked = setLink(model, selection, [
            { name: 'href', value: 'javascript:alert(1)' },
            { name: 'data-cms', value: 'kept' },
        ]);

        expect(toHtml(linked.model)).toBe(
            '<p>E<a href="javascript:alert(1)" data-cms="kept">xampl</a>e</p>',
        );
        expect(isLinkActive(linked.model, selection)).toBe(true);
        expect(toHtml(setLink(linked.model, selection, undefined).model)).toBe(
            '<p>Example</p>',
        );
    });

    it('queries all supported text marks', () => {
        const model = fromHtml(
            '<p><strong><em><u><s><code>X</code></s></u></em></strong></p>',
        );
        const selection = range(0, 0, 0, 1);

        expect(
            ['strong', 'em', 'u', 's', 'code'].every((mark) =>
                isTextMarkActive(
                    model,
                    selection,
                    mark as 'strong' | 'em' | 'u' | 's' | 'code',
                ),
            ),
        ).toBe(true);
    });

    it('refuses edits that would delete opaque custom HTML', () => {
        const model = fromHtml(
            '<p>A<product-card data-id="1"></product-card>B</p>',
        );

        expect(() => deleteSelection(model, range(0, 0, 0, 3))).toThrow(
            UnsupportedEditingSelectionError,
        );
        expect(() => deleteBackward(model, collapsed(0, 2))).toThrow(
            UnsupportedEditingSelectionError,
        );
        expect(toHtml(insertText(model, collapsed(0, 1), 'x').model)).toBe(
            '<p>Ax<product-card data-id="1"></product-card>B</p>',
        );
    });

    it('refuses cross-block deletion when an opaque block is between paragraphs', () => {
        const model = fromHtml(
            '<p>Before</p><product-card></product-card><p>After</p>',
        );

        expect(() => deleteSelection(model, range(0, 2, 2, 2))).toThrow(
            UnsupportedEditingSelectionError,
        );
    });

    it('does not merge away meaningful attributes on the removed paragraph', () => {
        const backward = fromHtml('<p>A</p><p data-id="second">B</p>');
        const forward = fromHtml('<p>A</p><p data-id="second">B</p>');

        expect(toHtml(deleteBackward(backward, collapsed(1, 0)).model)).toBe(
            '<p>A</p><p data-id="second">B</p>',
        );
        expect(toHtml(deleteForward(forward, collapsed(0, 1)).model)).toBe(
            '<p>A</p><p data-id="second">B</p>',
        );
    });

    it('emits immutable granular operations and maps positions deterministically', () => {
        const typed = insertText(fromHtml('<p>AB</p>'), collapsed(0, 1), 'xy');
        expect(typed.operations).toEqual([
            {
                block: 0,
                from: 1,
                insertedLength: 2,
                kind: 'replace-text',
                to: 1,
            },
        ]);
        expect(
            mapEditingPoint({ block: 0, offset: 2 }, typed.operations),
        ).toEqual({ block: 0, offset: 4 });
        expect(Object.isFrozen(typed.operations)).toBe(true);
        expect(Object.isFrozen(typed.operations[0])).toBe(true);

        const split = insertParagraph(typed.model, collapsed(0, 2));
        expect(
            mapEditingPoint({ block: 0, offset: 4 }, split.operations),
        ).toEqual({ block: 1, offset: 2 });
        expect(
            mapEditingPoint(
                { block: 0, offset: 2 },
                split.operations,
                'backward',
            ),
        ).toEqual({ block: 0, offset: 2 });

        const joined = deleteBackward(
            fromHtml('<p>One</p><p>Two</p>'),
            collapsed(1, 0),
        );
        expect(
            mapEditingPoint({ block: 1, offset: 2 }, joined.operations),
        ).toEqual({ block: 0, offset: 5 });

        const across = deleteSelection(
            fromHtml('<p>One</p><p>Two</p><p>Three</p><p>Four</p>'),
            range(0, 1, 2, 2),
        );
        expect(
            mapEditingPoint({ block: 3, offset: 2 }, across.operations),
        ).toEqual({ block: 1, offset: 2 });
        expect(
            mapEditingPoint({ block: 0, offset: 0 }, across.operations),
        ).toEqual({ block: 0, offset: 0 });
        expect(
            mapEditingPoint({ block: 2, offset: 4 }, across.operations),
        ).toEqual({ block: 0, offset: 3 });
    });

    it('publishes validated operation metadata without exposing mutable values', async () => {
        const editor = await Editor.create();
        const transaction = editor.createTransaction({ origin: 'user' });
        const operations = insertText(
            fromHtml('<p>A</p>'),
            collapsed(0, 1),
            'B',
        ).operations;
        setEditingOperations(transaction, operations);

        const read = readEditingOperations(transaction);
        expect(read).toEqual(operations);
        expect(Object.isFrozen(read)).toBe(true);
        expect(Object.isFrozen(read?.[0])).toBe(true);

        transaction.setMeta('soeditor.engine.editingOperations', [
            { kind: 'replace-text', block: -1 },
        ]);
        expect(readEditingOperations(transaction)).toBeUndefined();
        await editor.destroy();
    });

    it('rejects partial cross-paragraph deletion that would lose attributes', () => {
        const model = fromHtml('<p>First</p><p data-id="second">Last</p>');

        expect(() => deleteSelection(model, range(0, 2, 1, 2))).toThrow(
            UnsupportedEditingSelectionError,
        );
    });
});

function fromHtml(source: string): EditingModel {
    return createEditingModel(parseHtmlFragment(source).document);
}

function toHtml(model: EditingModel): string {
    return serializeHtmlFragment(serializeEditingModel(model));
}

function collapsed(block: number, offset: number): EditingSelection {
    return range(block, offset, block, offset);
}

function range(
    anchorBlock: number,
    anchorOffset: number,
    focusBlock: number,
    focusOffset: number,
): EditingSelection {
    return {
        anchor: { block: anchorBlock, offset: anchorOffset },
        focus: { block: focusBlock, offset: focusOffset },
    };
}
