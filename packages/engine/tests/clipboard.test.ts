import { parseHtmlFragment, serializeHtmlFragment } from '@soeditor/html';

import { createClipboardPayload, createPastedModel } from '../src/clipboard.js';
import {
    createEditingModel,
    serializeEditingModel,
    type EditingModel,
    type EditingSelection,
} from '../src/model.js';
import {
    insertModel,
    UnsupportedEditingSelectionError,
} from '../src/operations.js';

describe('clipboard model boundary', () => {
    it('extracts semantic HTML and plain text for a marked selection', () => {
        const model = fromHtml('<p>A<strong>BC</strong>D</p>');

        expect(createClipboardPayload(model, range(0, 1, 0, 3))).toEqual({
            html: '<p><strong>BC</strong></p>',
            text: 'BC',
        });
    });

    it('extracts supported cross-paragraph selections', () => {
        const model = fromHtml('<p>First</p><p><em>Second</em></p>');

        expect(createClipboardPayload(model, range(0, 2, 1, 3))).toEqual({
            html: '<p>rst</p><p><em>Sec</em></p>',
            text: 'rst\nSec',
        });
    });

    it('retains paragraph attributes only when the whole paragraph is copied', () => {
        const model = fromHtml('<p data-id="1">Text</p>');

        expect(createClipboardPayload(model, range(0, 0, 0, 4)).html).toBe(
            '<p data-id="1">Text</p>',
        );
        expect(createClipboardPayload(model, range(0, 1, 0, 3)).html).toBe(
            '<p>ex</p>',
        );
    });

    it('rejects clipboard extraction across opaque content', () => {
        const model = fromHtml(
            '<p>A<product-card data-id="1"></product-card>B</p>',
        );

        expect(() => createClipboardPayload(model, range(0, 0, 0, 3))).toThrow(
            UnsupportedEditingSelectionError,
        );
    });

    it('normalizes multiline plain text into paragraph insertion', () => {
        const model = fromHtml('<p>Hello</p>');
        const pasted = createPastedModel('', 'One\r\nTwo');
        const result = insertModel(model, range(0, 2, 0, 2), pasted);

        expect(toHtml(result.model)).toBe('<p>HeOne</p><p>Twollo</p>');
        expect(result.selection).toEqual(range(1, 3, 1, 3));
    });

    it('normalizes inline HTML and retains strong/emphasis marks', () => {
        const model = fromHtml('<p>AD</p>');
        const pasted = createPastedModel('<strong>B<em>C</em></strong>', 'BC');
        const result = insertModel(model, range(0, 1, 0, 1), pasted);

        expect(toHtml(result.model)).toBe(
            '<p>A<strong>B</strong><strong><em>C</em></strong>D</p>',
        );
    });

    it('preserves block HTML and paragraph attributes during insertion', () => {
        const model = fromHtml('<p>AB</p>');
        const pasted = createPastedModel(
            '<p data-kind="pasted">P</p><div data-id="1">Block</div>',
            'P\nBlock',
        );
        const result = insertModel(model, range(0, 1, 0, 1), pasted);

        expect(toHtml(result.model)).toBe(
            '<p>A</p><p data-kind="pasted">P</p><div data-id="1">Block</div><p>B</p>',
        );
    });

    it('preserves unsafe and custom pasted markup without interpreting it', () => {
        const model = fromHtml('<p>AB</p>');
        const pasted = createPastedModel(
            '<script>alert(1)</script><img src="x" onerror="alert(2)"><custom-inline value="x"></custom-inline>',
            '',
        );
        const result = insertModel(model, range(0, 1, 0, 1), pasted);
        const html = toHtml(result.model);

        expect(html).toContain('<script>alert(1)</script>');
        expect(html).toContain('onerror="alert(2)"');
        expect(html).toContain('<custom-inline value="x"></custom-inline>');
    });

    it('rejects complete-document HTML instead of flattening its structure', () => {
        expect(() =>
            createPastedModel(
                '<!doctype html><html><head><title>X</title></head><body><p>Body</p></body></html>',
                'Body',
            ),
        ).toThrow(UnsupportedEditingSelectionError);
    });
});

function fromHtml(source: string): EditingModel {
    return createEditingModel(parseHtmlFragment(source).document);
}

function toHtml(model: EditingModel): string {
    return serializeHtmlFragment(serializeEditingModel(model));
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
