import { describe, expect, it } from 'vitest';

import {
    applyPreviewTemplate,
    isCompleteHtmlDocument,
    normalizePreviewConfiguration,
} from '../src/index.js';

describe('preview configuration', () => {
    it('normalizes and freezes application-owned values', () => {
        const context = { section: 'News' };
        const styles = ['article { color: red; }'];
        const configuration = normalizePreviewConfiguration({
            baseUrl: 'https://example.com/articles/',
            context,
            styles,
            stylesheets: ['/site.css'],
            template: '<main data-section="{{ section }}">{{ content }}</main>',
            title: 'Article preview',
        });

        context.section = 'Changed';
        styles.push('body {}');
        expect(configuration.context.section).toBe('News');
        expect(configuration.styles).toEqual(['article { color: red; }']);
        expect(configuration.baseUrl).toBe('https://example.com/articles/');
        expect(Object.isFrozen(configuration)).toBe(true);
        expect(Object.isFrozen(configuration.context)).toBe(true);
    });

    it('escapes context while inserting canonical content as markup', () => {
        expect(
            applyPreviewTemplate(
                '<main data-section="{{ section }}">{{ content }}</main>',
                '<product-card data-id="1"></product-card>',
                { section: '"><script>unsafe</script>' },
            ),
        ).toBe(
            '<main data-section="&quot;&gt;&lt;script&gt;unsafe&lt;/script&gt;"><product-card data-id="1"></product-card></main>',
        );
    });

    it('requires exactly one content marker and safe configuration records', () => {
        expect(() =>
            normalizePreviewConfiguration({ template: '<main></main>' }),
        ).toThrow('exactly one');
        expect(() =>
            normalizePreviewConfiguration({
                template: '{{ content }}{{content}}',
            }),
        ).toThrow('exactly one');
        expect(() =>
            normalizePreviewConfiguration({ baseUrl: 'javascript:alert(1)' }),
        ).toThrow('HTTP or HTTPS');
        expect(() =>
            normalizePreviewConfiguration({
                stylesheets: ['javascript:alert(1)'],
            }),
        ).toThrow('unsafe protocol');
        expect(() =>
            normalizePreviewConfiguration({ stylesheets: [''] }),
        ).toThrow('must not be empty');
        expect(() =>
            normalizePreviewConfiguration({
                context: { invalid: 1 } as unknown as Record<string, string>,
            }),
        ).toThrow('valid strings');
    });

    it('copies allowed prototype-shaped keys and rejects invalid keys', () => {
        const context = JSON.parse('{"constructor":"value"}') as Record<
            string,
            string
        >;
        const normalized = normalizePreviewConfiguration({ context });

        expect(Object.hasOwn(normalized.context, 'constructor')).toBe(true);
        expect(normalized.context.constructor).toBe('value');
        expect(() =>
            normalizePreviewConfiguration({
                context: JSON.parse('{"__proto__":"unsafe"}') as Record<
                    string,
                    string
                >,
            }),
        ).toThrow('valid strings');
    });

    it('distinguishes complete documents from fragments', () => {
        expect(isCompleteHtmlDocument('<p>Fragment</p>')).toBe(false);
        expect(
            isCompleteHtmlDocument(
                '<!doctype html><html><body>Complete</body></html>',
            ),
        ).toBe(true);
        expect(isCompleteHtmlDocument('<html lang="en"></html>')).toBe(true);
        expect(
            isCompleteHtmlDocument(
                '<!--before--><!doctype html><html><body></body></html>',
            ),
        ).toBe(true);
    });
});
