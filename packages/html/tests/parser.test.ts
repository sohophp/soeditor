import { parseHtmlDocument, parseHtmlFragment } from '../src/index.js';

describe('HTML parsing', () => {
    it('parses document structure, doctype, comments, text, and nested elements', () => {
        const result = parseHtmlDocument(
            '<!doctype html><!--CMS:page--><html><head><title>Example</title></head><body><p>Hello <strong>world</strong></p></body></html>',
        );

        expect(result.diagnostics).toEqual([]);
        expect(result.document.children[0]).toMatchObject({
            name: 'html',
            type: 'doctype',
        });
        expect(result.document.children[1]).toMatchObject({
            type: 'comment',
            value: 'CMS:page',
        });

        const html = result.document.children[2];
        expect(html).toMatchObject({ namespace: 'html', tagName: 'html' });
        if (html?.type !== 'element') {
            throw new Error('Expected the document element.');
        }

        const body = html.children[1];
        expect(body).toMatchObject({ tagName: 'body', type: 'element' });
        if (body?.type !== 'element') {
            throw new Error('Expected a body element.');
        }

        expect(body.children[0]).toMatchObject({
            children: [
                { type: 'text', value: 'Hello ' },
                {
                    children: [{ type: 'text', value: 'world' }],
                    tagName: 'strong',
                    type: 'element',
                },
            ],
            tagName: 'p',
            type: 'element',
        });
    });

    it('parses fragments without synthetic html, head, or body nodes', () => {
        const result = parseHtmlFragment('lead<p>One</p><p>Two</p>');

        expect(result.document.children).toMatchObject([
            { type: 'text', value: 'lead' },
            { tagName: 'p', type: 'element' },
            { tagName: 'p', type: 'element' },
        ]);
    });

    it('preserves custom elements and ordinary custom attributes', () => {
        const result = parseHtmlFragment(
            '<product-card data-id="123" aria-label="Product" custom-property="abc"><option-row selected-value="x"></option-row></product-card>',
        );
        const card = result.document.children[0];

        expect(card).toMatchObject({
            attributes: [
                { name: 'data-id', value: '123' },
                { name: 'aria-label', value: 'Product' },
                { name: 'custom-property', value: 'abc' },
            ],
            namespace: 'html',
            tagName: 'product-card',
            type: 'element',
        });
        if (card?.type !== 'element') {
            throw new Error('Expected a custom element.');
        }
        expect(card.children[0]).toMatchObject({
            attributes: [{ name: 'selected-value', value: 'x' }],
            tagName: 'option-row',
        });
    });

    it('returns deeply frozen parser-owned values', () => {
        const result = parseHtmlFragment('<p class="lead">Text</p>');
        const paragraph = result.document.children[0];

        expect(Object.isFrozen(result)).toBe(true);
        expect(Object.isFrozen(result.diagnostics)).toBe(true);
        expect(Object.isFrozen(result.document)).toBe(true);
        expect(Object.isFrozen(result.document.children)).toBe(true);
        expect(Object.isFrozen(paragraph)).toBe(true);
        if (paragraph?.type !== 'element') {
            throw new Error('Expected a paragraph.');
        }
        expect(Object.isFrozen(paragraph.attributes)).toBe(true);
        expect(Object.isFrozen(paragraph.attributes[0])).toBe(true);
        expect(Object.isFrozen(paragraph.children[0])).toBe(true);
    });
});
