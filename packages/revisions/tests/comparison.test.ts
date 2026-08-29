import { compareRevisionSources } from '../src/index.js';
import { describe, expect, it } from 'vitest';

describe('revision comparison', () => {
    it('treats HTML attribute order and entity spelling as semantic details', () => {
        const comparison = compareRevisionSources(
            'html',
            '<product-card b="2" a="1">A &amp; B</product-card>',
            '<product-card a="1" b="2">A &#38; B</product-card>',
        );

        expect(comparison.equivalent).toBe(true);
        expect(comparison.changes).toEqual([]);
    });

    it('reports bounded structural changes without discarding custom HTML', () => {
        const comparison = compareRevisionSources(
            'html',
            '<!--cms--><product-card id="1">Old</product-card>',
            '<!--cms--><product-card id="2">New</product-card><aside>X</aside>',
        );

        expect(comparison.equivalent).toBe(false);
        expect(comparison.changes).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ kind: 'changed' }),
                expect.objectContaining({ kind: 'inserted' }),
            ]),
        );
        expect(Object.isFrozen(comparison)).toBe(true);
        expect(Object.isFrozen(comparison.changes)).toBe(true);
    });

    it('compares canonical Markdown by exact lines', () => {
        const comparison = compareRevisionSources(
            'markdown',
            '# Title\nOld',
            '# Title\nNew\nMore',
        );

        expect(comparison.changes).toEqual([
            {
                after: 'New',
                before: 'Old',
                kind: 'changed',
                path: 'line[1]',
            },
            { after: 'More', kind: 'inserted', path: 'line[2]' },
        ]);
    });

    it('bounds large-document comparison output deterministically', () => {
        const before = Array.from(
            { length: 2_100 },
            (_, index) => `<p>${String(index)}</p>`,
        ).join('');
        const after = Array.from(
            { length: 2_100 },
            (_, index) => `<p>changed-${String(index)}</p>`,
        ).join('');

        const comparison = compareRevisionSources('html', before, after);

        expect(comparison.changes).toHaveLength(2_000);
        expect(comparison.truncated).toBe(true);
    });
});
