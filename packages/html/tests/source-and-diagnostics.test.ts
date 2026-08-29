import { parseHtmlFragment } from '../src/index.js';

describe('source locations and diagnostics', () => {
    it('maps element, tag, attribute, text, and comment ranges', () => {
        const source = '<section data-id="42">Text<!--marker--></section>';
        const result = parseHtmlFragment(source);
        const section = result.document.children[0];

        if (section?.type !== 'element') {
            throw new Error('Expected a section element.');
        }

        expect(section.source).toEqual({
            end: { column: 50, line: 1, offset: 49 },
            endTag: {
                end: { column: 50, line: 1, offset: 49 },
                start: { column: 40, line: 1, offset: 39 },
            },
            start: { column: 1, line: 1, offset: 0 },
            startTag: {
                end: { column: 23, line: 1, offset: 22 },
                start: { column: 1, line: 1, offset: 0 },
            },
        });
        expect(section.attributes[0]?.source).toEqual({
            end: { column: 22, line: 1, offset: 21 },
            start: { column: 10, line: 1, offset: 9 },
        });
        expect(section.children[0]?.source).toEqual({
            end: { column: 27, line: 1, offset: 26 },
            start: { column: 23, line: 1, offset: 22 },
        });
        expect(section.children[1]?.source).toEqual({
            end: { column: 40, line: 1, offset: 39 },
            start: { column: 27, line: 1, offset: 26 },
        });
    });

    it('uses one-based lines and columns with zero-based offsets across lines', () => {
        const result = parseHtmlFragment('\n<div>\ntext\n</div>');
        const element = result.document.children[1];

        expect(element?.source?.start).toEqual({
            column: 1,
            line: 2,
            offset: 1,
        });
    });

    it('does not invent source ranges for implicit recovery nodes', () => {
        const result = parseHtmlFragment(
            '<table><tr><td>cell</td></tr></table>',
        );
        const table = result.document.children[0];
        if (table?.type !== 'element') {
            throw new Error('Expected a table.');
        }

        const tbody = table.children[0];
        expect(tbody).toMatchObject({ tagName: 'tbody', type: 'element' });
        expect(tbody?.source).toBeUndefined();
    });

    it('maps parse errors to stable SoEditor-owned diagnostics', () => {
        const result = parseHtmlFragment('<div first=1 first=2 id==x>');

        expect(result.diagnostics.map(({ code }) => code)).toEqual([
            'duplicate-attribute',
            'unexpected-character-in-unquoted-attribute-value',
        ]);
        expect(result.diagnostics[0]).toMatchObject({
            message: 'HTML parse error: duplicate attribute.',
            severity: 'error',
            source: {
                start: { column: expect.any(Number), line: 1 },
            },
        });
    });

    it('reports abrupt malformed comments while retaining recovered content', () => {
        const result = parseHtmlFragment('<!-- CMS:block');

        expect(result.diagnostics).toHaveLength(1);
        expect(result.diagnostics[0]?.code).toBe('eof-in-comment');
        expect(result.document.children[0]).toMatchObject({
            type: 'comment',
            value: ' CMS:block',
        });
    });
});
