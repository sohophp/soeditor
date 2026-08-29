import { describe, expect, it } from 'vitest';

import { htmlToMarkdown, markdownToHtml } from '../src/index.js';

describe('Markdown conversion', () => {
    it('compiles CommonMark structures and raw HTML passthrough', () => {
        const html = markdownToHtml(
            '# Heading\n\n- one\n- two\n\n`code` and [safe](https://example.com)\n\n<product-card data-id="7"></product-card>',
        );

        expect(html).toContain('<h1>Heading</h1>');
        expect(html).toContain('<ul>');
        expect(html).toContain('<code>code</code>');
        expect(html).toContain('href="https://example.com"');
        expect(html).toContain('<product-card data-id="7"></product-card>');
    });

    it('does not compile dangerous link protocols and can escape raw HTML', () => {
        expect(markdownToHtml('[unsafe](javascript:alert(1))')).not.toContain(
            'javascript:',
        );
        expect(
            markdownToHtml('<script>alert(1)</script>', {
                rawHtml: 'escape',
            }),
        ).toContain('&lt;script&gt;');
    });

    it('converts HTML deliberately and reports known loss categories', () => {
        const result = htmlToMarkdown(
            '<!doctype html><html><body><!--CMS--><h1 class="title">Hello</h1><product-card data-id="7"></product-card></body></html>',
        );

        expect(result.source).toContain('# Hello');
        expect(result.source).toContain(
            '<product-card data-id="7"></product-card>',
        );
        expect(result.losses.map(({ code }) => code)).toEqual([
            'html.document',
            'html.comments',
            'html.attributes',
            'html.raw',
        ]);
        expect(Object.isFrozen(result)).toBe(true);
        expect(Object.isFrozen(result.losses)).toBe(true);
    });

    it('returns an empty loss report for simple representable fragments', () => {
        expect(htmlToMarkdown('<p>Hello <strong>world</strong></p>')).toEqual({
            losses: [],
            source: 'Hello **world**',
        });
    });

    it('reports parser recovery for invalid conversion input', () => {
        const result = htmlToMarkdown('<div first=1 first=2 id==x>text</div>');

        expect(result.losses.map(({ code }) => code)).toContain('html.invalid');
        expect(result.source).toContain('text');
    });
});
