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
    insertText,
    toggleMark,
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
