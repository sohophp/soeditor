import { describe, expect, it } from 'vitest';

import { createDocumentOutline } from '../src/index.js';

describe('developer HTML analysis', () => {
    it('creates an immutable nested heading outline with source ranges', () => {
        const outline = createDocumentOutline(
            '<main><h1>Hello <em>world</em></h1><product-card><h3>Custom child</h3></product-card><h2></h2></main>',
        );

        expect(outline.map(({ label, level }) => ({ label, level }))).toEqual([
            { label: 'Hello world', level: 1 },
            { label: 'Custom child', level: 3 },
            { label: '(empty h2)', level: 2 },
        ]);
        expect(outline.every(({ source }) => source !== undefined)).toBe(true);
        expect(Object.isFrozen(outline)).toBe(true);
        expect(outline.every(Object.isFrozen)).toBe(true);
    });

    it('supports complete documents and ignores non-heading content', () => {
        expect(
            createDocumentOutline(
                '<!doctype html><html><body><p>Text</p><h2>Section</h2></body></html>',
            ).map(({ label }) => label),
        ).toEqual(['Section']);
    });
});
