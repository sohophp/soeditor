import { parseHtmlFragment, serializeHtmlFragment } from '@soeditor/html';

import { createEditingModel, serializeEditingModel } from '../src/model.js';

describe('controlled editing model', () => {
    it('converts paragraphs, text, strong, and emphasis into marked runs', () => {
        const fragment = parseHtmlFragment(
            '<p class="lead">A<strong>B<em>C</em></strong>D</p>',
        ).document;
        const model = createEditingModel(fragment);

        expect(model.blocks).toEqual([
            {
                attributes: [
                    {
                        name: 'class',
                        value: 'lead',
                        source: expect.any(Object),
                    },
                ],
                inlines: [
                    { kind: 'text', marks: [], text: 'A' },
                    { kind: 'text', marks: ['strong'], text: 'B' },
                    { kind: 'text', marks: ['strong', 'em'], text: 'C' },
                    { kind: 'text', marks: [], text: 'D' },
                ],
                kind: 'paragraph',
                tagName: 'p',
            },
        ]);
    });

    it('semantically serializes supported marked content', () => {
        const first = createEditingModel(
            parseHtmlFragment('<p>A<strong>B<em>C</em></strong>D</p>').document,
        );
        const source = serializeHtmlFragment(serializeEditingModel(first));
        const second = createEditingModel(parseHtmlFragment(source).document);

        expect(second).toEqual(first);
        expect(source).toBe(
            '<p>A<strong>B</strong><strong><em>C</em></strong>D</p>',
        );
    });

    it('supports semantic text blocks, rich marks, links, and simple lists', () => {
        const source =
            '<h2>Title</h2><blockquote><u>Quote</u></blockquote><pre><code>const x = 1;</code></pre><p><a href="javascript:alert(1)" data-cms="x"><s>linked</s></a></p><ul><li>One</li><li><em>Two</em></li></ul>';
        const model = createEditingModel(parseHtmlFragment(source).document);

        expect(
            model.blocks.map((block) =>
                block.kind === 'paragraph'
                    ? [block.tagName, block.list]
                    : block.kind,
            ),
        ).toEqual([
            ['h2', undefined],
            ['blockquote', undefined],
            ['pre', undefined],
            ['p', undefined],
            ['p', 'ul'],
            ['p', 'ul'],
        ]);
        expect(serializeHtmlFragment(serializeEditingModel(model))).toBe(
            source,
        );
    });

    it('edits attributed lists while preserving unsupported item content', () => {
        const source =
            '<ol start="3"><li>Three</li></ol><ul><li data-id="x">Item</li></ul><ul><li><p>Nested block</p></li></ul>';
        const model = createEditingModel(parseHtmlFragment(source).document);

        expect(model.blocks.map((block) => block.kind)).toEqual([
            'paragraph',
            'paragraph',
            'paragraph',
        ]);
        expect(serializeHtmlFragment(serializeEditingModel(model))).toBe(
            source,
        );
    });

    it('round-trips nested list depth, starts, and marker types', () => {
        const source =
            '<ol start="3" type="A"><li>Parent<ul type="square"><li>Child</li><li>Child 2<ol><li>Deep</li></ol></li></ul></li><li>Next</li></ol>';
        const model = createEditingModel(parseHtmlFragment(source).document);

        expect(
            model.blocks.map((block) =>
                block.kind === 'paragraph'
                    ? [block.list, block.listDepth, block.listStart]
                    : block.kind,
            ),
        ).toEqual([
            ['ol', 0, true],
            ['ul', 1, true],
            ['ul', 1, false],
            ['ol', 2, true],
            ['ol', 0, false],
        ]);
        expect(serializeHtmlFragment(serializeEditingModel(model))).toBe(
            source,
        );
    });

    it('preserves boundaries between adjacent lists of the same kind', () => {
        const source = '<ul><li>First</li></ul><ul><li>Second</li></ul>';
        const model = createEditingModel(parseHtmlFragment(source).document);

        expect(serializeHtmlFragment(serializeEditingModel(model))).toBe(
            source,
        );
    });

    it('retains unknown blocks, inline custom elements, and comments opaquely', () => {
        const source =
            '<!--CMS:block--><product-card data-id="1"></product-card><p>A<custom-inline value="x"></custom-inline>B<!--inside--></p>';
        const model = createEditingModel(parseHtmlFragment(source).document);
        const serialized = serializeHtmlFragment(serializeEditingModel(model));

        expect(model.blocks.map((block) => block.kind)).toEqual([
            'opaque-block',
            'opaque-block',
            'paragraph',
        ]);
        expect(serialized).toBe(source);
    });

    it('keeps attributed or empty mark elements opaque to avoid semantic loss', () => {
        const source =
            '<p><strong class="cms">A</strong><em></em><strong><!--marker--></strong></p>';
        const model = createEditingModel(parseHtmlFragment(source).document);
        const paragraph = model.blocks[0];

        expect(paragraph?.kind).toBe('paragraph');
        if (paragraph?.kind !== 'paragraph') {
            throw new Error('Expected a paragraph.');
        }
        expect(
            paragraph.inlines.every(
                (inline) => inline.kind === 'opaque-inline',
            ),
        ).toBe(true);
        expect(serializeHtmlFragment(serializeEditingModel(model))).toBe(
            source,
        );
    });

    it('uses parser recovery without inventing a second HTML parser', () => {
        const parsed = parseHtmlFragment(
            '<p>before<section>inside</section>after',
        );
        const model = createEditingModel(parsed.document);

        expect(model.blocks.map((block) => block.kind)).toEqual([
            'paragraph',
            'opaque-block',
            'opaque-block',
        ]);
        expect(serializeHtmlFragment(serializeEditingModel(model))).toBe(
            '<p>before</p><section>inside</section>after',
        );
    });

    it('returns frozen editing data', () => {
        const model = createEditingModel(
            parseHtmlFragment('<p>Text</p>').document,
        );
        const paragraph = model.blocks[0];

        expect(Object.isFrozen(model)).toBe(true);
        expect(Object.isFrozen(model.blocks)).toBe(true);
        expect(Object.isFrozen(paragraph)).toBe(true);
        if (paragraph?.kind === 'paragraph') {
            expect(Object.isFrozen(paragraph.inlines)).toBe(true);
            expect(Object.isFrozen(paragraph.inlines[0])).toBe(true);
        }
    });
});
