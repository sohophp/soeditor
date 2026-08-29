import { parseHtmlFragment, serializeHtmlFragment } from '../src/index.js';
import { withoutSource } from './helpers.js';

describe('namespaces and special HTML content', () => {
    it('retains SVG and MathML namespaces and namespaced attributes', () => {
        const result = parseHtmlFragment(
            '<svg viewBox="0 0 10 10"><use xlink:href="#shape"></use></svg><math><mi>x</mi></math>',
        );
        const svg = result.document.children[0];
        const math = result.document.children[1];

        expect(svg).toMatchObject({
            attributes: [{ name: 'viewBox', value: '0 0 10 10' }],
            namespace: 'svg',
            tagName: 'svg',
        });
        if (svg?.type !== 'element') {
            throw new Error('Expected SVG.');
        }
        expect(svg.children[0]).toMatchObject({
            attributes: [
                {
                    name: 'href',
                    namespace: 'http://www.w3.org/1999/xlink',
                    prefix: 'xlink',
                    value: '#shape',
                },
            ],
            namespace: 'svg',
            tagName: 'use',
        });
        expect(math).toMatchObject({
            namespace: 'mathml',
            tagName: 'math',
        });
        if (math?.type !== 'element') {
            throw new Error('Expected MathML.');
        }
        expect(math.children[0]).toMatchObject({
            namespace: 'mathml',
            tagName: 'mi',
        });
    });

    it('preserves HTML integration points inside SVG foreignObject', () => {
        const first = parseHtmlFragment(
            '<svg><foreignObject><div data-kind="html">Hello</div></foreignObject></svg>',
        );
        const svg = first.document.children[0];

        if (svg?.type !== 'element') {
            throw new Error('Expected SVG.');
        }

        const foreignObject = svg.children[0];
        if (foreignObject?.type !== 'element') {
            throw new Error('Expected foreignObject.');
        }

        expect(foreignObject).toMatchObject({
            namespace: 'svg',
            tagName: 'foreignObject',
        });
        expect(foreignObject.children[0]).toMatchObject({
            attributes: [{ name: 'data-kind', value: 'html' }],
            namespace: 'html',
            tagName: 'div',
        });

        const serialized = serializeHtmlFragment(first.document);
        const second = parseHtmlFragment(serialized);

        expect(withoutSource(second.document)).toEqual(
            withoutSource(first.document),
        );
    });

    it('preserves template content through its public children', () => {
        const result = parseHtmlFragment(
            '<template id="card"><article><!--slot--><slot name="title"></slot></article></template>',
        );
        const template = result.document.children[0];

        expect(template).toMatchObject({
            attributes: [{ name: 'id', value: 'card' }],
            children: [
                {
                    children: [
                        { type: 'comment', value: 'slot' },
                        { tagName: 'slot', type: 'element' },
                    ],
                    tagName: 'article',
                    type: 'element',
                },
            ],
            tagName: 'template',
        });

        const serialized = serializeHtmlFragment(result.document);
        expect(serialized).toContain(
            '<template id="card"><article><!--slot--><slot name="title"></slot></article></template>',
        );
    });

    it.each([
        ['script', '<script>if (a < b) value = "<x>";</script>'],
        ['style', '<style>.x::before { content: "<"; }</style>'],
        ['textarea', '<textarea>A &amp; B &lt; C</textarea>'],
    ])('preserves %s content according to HTML parsing rules', (_, source) => {
        const first = parseHtmlFragment(source);
        const serialized = serializeHtmlFragment(first.document);
        const second = parseHtmlFragment(serialized);

        expect(withoutSource(second.document)).toEqual(
            withoutSource(first.document),
        );
    });

    it('parses title content as RCDATA in a complete document', () => {
        const result = parseHtmlFragment('<title>A &amp; B &lt; C</title>');
        const title = result.document.children[0];
        if (title?.type !== 'element') {
            throw new Error('Expected a title element.');
        }

        expect(title.children).toMatchObject([
            { type: 'text', value: 'A & B < C' },
        ]);
    });

    it('preserves executable-looking markup without treating parsing as sanitization', () => {
        const source =
            '<script>alert("preserved")</script><img src="x" onerror="alert(1)">';
        const result = parseHtmlFragment(source);
        const serialized = serializeHtmlFragment(result.document);

        expect(serialized).toContain('<script>alert("preserved")</script>');
        expect(serialized).toContain('onerror="alert(1)"');
    });
});
