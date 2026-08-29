import {
    parseHtmlDocument,
    parseHtmlFragment,
    serializeHtmlDocument,
    serializeHtmlFragment,
} from '../src/index.js';
import { withoutSource } from './helpers.js';

describe('HTML serialization', () => {
    it('semantically round-trips a complete document with doctype and comments', () => {
        const source =
            '<!doctype html><!--page--><html lang="en"><head><title>Title</title></head><body><main data-layout="wide">Body</main></body></html>';
        const first = parseHtmlDocument(source);
        const serialized = serializeHtmlDocument(first.document);
        const second = parseHtmlDocument(serialized);

        expect(serialized).toContain('<!DOCTYPE html>');
        expect(serialized).toContain('<!--page-->');
        expect(withoutSource(second.document)).toEqual(
            withoutSource(first.document),
        );
    });

    it('semantically round-trips custom markup, comments, and attributes', () => {
        const source =
            '<!--CMS:block:123--><product-card data-id="123" aria-label="Card" custom-property="abc"><strong>Hello</strong></product-card>';
        const first = parseHtmlFragment(source);
        const serialized = serializeHtmlFragment(first.document);
        const second = parseHtmlFragment(serialized);

        expect(serialized).toContain('<!--CMS:block:123-->');
        expect(serialized).toContain(
            '<product-card data-id="123" aria-label="Card" custom-property="abc">',
        );
        expect(withoutSource(second.document)).toEqual(
            withoutSource(first.document),
        );
    });

    it('semantically round-trips SVG, MathML, and namespaced attributes', () => {
        const source =
            '<svg viewBox="0 0 10 10"><use xlink:href="#shape"></use></svg><math><mrow><mi>x</mi><mo>+</mo><mn>1</mn></mrow></math>';
        const first = parseHtmlFragment(source);
        const serialized = serializeHtmlFragment(first.document);
        const second = parseHtmlFragment(serialized);

        expect(serialized).toContain('xlink:href="#shape"');
        expect(withoutSource(second.document)).toEqual(
            withoutSource(first.document),
        );
    });

    it('serializes void elements without XML-style closing syntax', () => {
        const parsed = parseHtmlFragment('<img src="image.png"><br>');

        expect(serializeHtmlFragment(parsed.document)).toBe(
            '<img src="image.png"><br>',
        );
    });

    it('serializes recovered malformed nesting as the corrected HTML tree', () => {
        const parsed = parseHtmlFragment('<p>before<div>inside</div>after');
        const serialized = serializeHtmlFragment(parsed.document);

        expect(serialized).toBe('<p>before</p><div>inside</div>after');
        expect(withoutSource(parseHtmlFragment(serialized).document)).toEqual(
            withoutSource(parsed.document),
        );
    });
});
