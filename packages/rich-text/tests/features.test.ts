import { Editor, type PluginConstructor } from '@soeditor/core';
import {
    structuredEditingRegistryToken,
    visualEditingServiceToken,
    type VisualBlockTag,
    type VisualEditingService,
    type VisualLinkAttributes,
    type VisualTextMark,
} from '@soeditor/engine';
import { parseHtmlFragment } from '@soeditor/html';
import { describe, expect, it, vi } from 'vitest';

import {
    AlignmentPlugin,
    BlockquotePlugin,
    BoldPlugin,
    CodeBlockPlugin,
    FontPlugin,
    HeadingPlugin,
    HorizontalRulePlugin,
    ImagePlugin,
    InlineCodePlugin,
    ItalicPlugin,
    IndentationPlugin,
    LinkPlugin,
    linkTargetProviderServiceToken,
    ListPropertiesPlugin,
    OrderedListPlugin,
    ParagraphPlugin,
    RemoveFormatPlugin,
    RichTextArgumentError,
    SemanticStyleConfigurationError,
    SemanticStylesPlugin,
    StrikePlugin,
    SubscriptPlugin,
    SuperscriptPlugin,
    TablePlugin,
    UnderlinePlugin,
    UnorderedListPlugin,
} from '../src/index.js';

const plugins: readonly PluginConstructor[] = [
    ParagraphPlugin,
    HeadingPlugin,
    BoldPlugin,
    ItalicPlugin,
    UnderlinePlugin,
    StrikePlugin,
    SubscriptPlugin,
    SuperscriptPlugin,
    RemoveFormatPlugin,
    FontPlugin,
    AlignmentPlugin,
    IndentationPlugin,
    HorizontalRulePlugin,
    SemanticStylesPlugin,
    LinkPlugin,
    OrderedListPlugin,
    UnorderedListPlugin,
    ListPropertiesPlugin,
    BlockquotePlugin,
    InlineCodePlugin,
    CodeBlockPlugin,
    ImagePlugin,
    TablePlugin,
];

interface ServiceHarness {
    readonly adjustIndent: ReturnType<typeof vi.fn>;
    readonly service: VisualEditingService;
    readonly insertHtml: ReturnType<typeof vi.fn>;
    readonly removeInlineStyleProperty: ReturnType<typeof vi.fn>;
    readonly setBlock: ReturnType<typeof vi.fn>;
    readonly setAlignment: ReturnType<typeof vi.fn>;
    readonly setListProperties: ReturnType<typeof vi.fn>;
    readonly setLink: ReturnType<typeof vi.fn>;
    readonly toggleList: ReturnType<typeof vi.fn>;
    readonly toggleMark: ReturnType<typeof vi.fn>;
}

describe('rich-text feature plugins', () => {
    it('registers every feature as a stable command', async () => {
        const { editor } = await createHarness();

        expect(editor.services.has(structuredEditingRegistryToken)).toBe(true);

        expect(
            [
                'paragraph.set',
                'paragraph.heading',
                'format.bold',
                'format.italic',
                'format.underline',
                'format.strike',
                'format.inlineCode',
                'format.subscript',
                'format.superscript',
                'format.remove',
                'font.color',
                'font.backgroundColor',
                'font.backgroundColor.remove',
                'font.size',
                'font.color.remove',
                'font.highlight.remove',
                'format.alignment',
                'format.indent',
                'format.outdent',
                'horizontalRule.insert',
                'blockquote.toggle',
                'codeBlock.toggle',
                'list.ordered',
                'list.unordered',
                'list.properties',
                'link.set',
                'link.setText',
                'link.remove',
                'link.auto',
                'link.attributes.catalog',
                'link.inspect',
                'link.pick',
                'image.insert',
                'table.insert',
            ].every((id) => editor.commands.has(id)),
        ).toBe(true);
    });

    it('routes mark, block, and list commands through the visual service', async () => {
        const { editor, harness } = await createHarness();

        editor.execute('paragraph.set');
        editor.execute('paragraph.heading', 3);
        editor.execute('format.bold');
        editor.execute('format.italic');
        editor.execute('format.underline');
        editor.execute('format.strike');
        editor.execute('format.inlineCode');
        editor.execute('format.subscript');
        editor.execute('format.superscript');
        editor.execute('format.remove');
        editor.execute('format.alignment', 'center');
        editor.execute('format.indent');
        editor.execute('format.outdent');
        editor.execute('horizontalRule.insert');
        editor.execute('blockquote.toggle');
        editor.execute('codeBlock.toggle');
        editor.execute('list.ordered');
        editor.execute('list.unordered');
        editor.execute('list.properties', { start: 4, type: 'A' });

        expect(harness.setBlock.mock.calls).toEqual([
            ['p'],
            ['h3'],
            ['blockquote'],
            ['pre'],
        ]);
        expect(harness.toggleMark.mock.calls).toEqual([
            ['strong'],
            ['em'],
            ['u'],
            ['s'],
            ['code'],
            ['sub'],
            ['sup'],
        ]);
        expect(harness.toggleList.mock.calls).toEqual([['ol'], ['ul']]);
        expect(harness.setAlignment).toHaveBeenCalledWith('center');
        expect(harness.adjustIndent.mock.calls).toEqual([[1], [-1]]);
        expect(harness.setListProperties).toHaveBeenCalledWith({
            start: 4,
            type: 'A',
        });
        expect(harness.insertHtml).toHaveBeenCalledWith('<hr>');
    });

    it('uses active state to toggle structural commands back to paragraphs', async () => {
        const activeBlocks = new Set<VisualBlockTag>(['blockquote']);
        const { editor, harness } = await createHarness({ activeBlocks });

        expect(editor.commands.isActive('blockquote.toggle')).toBe(true);
        editor.execute('blockquote.toggle');
        expect(harness.setBlock).toHaveBeenCalledWith('p');
    });

    it('reflects service availability and active marks', async () => {
        const activeMarks = new Set<VisualTextMark>(['strong']);
        const created = await createHarness({ activeMarks, canEdit: false });

        expect(created.editor.commands.canExecute('format.bold')).toBe(false);
        expect(created.editor.commands.isActive('format.bold')).toBe(true);
        expect(created.editor.execute('format.bold')).toBeUndefined();
        expect(created.harness.toggleMark).not.toHaveBeenCalled();
    });

    it('validates heading and link arguments before calling the service', async () => {
        const { editor, harness } = await createHarness();

        expect(() => editor.execute('paragraph.heading', 0)).toThrow(
            RichTextArgumentError,
        );
        expect(() =>
            editor.execute('link.set', { href: '', unsafe: true }),
        ).toThrow(RichTextArgumentError);
        expect(() =>
            editor.execute('link.set', { href: 'javascript:alert(1)' }),
        ).toThrow(RichTextArgumentError);
        expect(() =>
            editor.execute('link.set', {
                href: 'https://trusted.test@evil.test/path',
            }),
        ).toThrow(RichTextArgumentError);
        expect(() =>
            editor.execute('link.set', { href: '//evil.test/path' }),
        ).toThrow(RichTextArgumentError);
        editor.execute('link.set', {
            href: 'https://example.test/article',
            rel: 'nofollow privacy-policy',
            target: 'articlePreview',
            title: 'preserved',
        });
        editor.execute('link.remove');

        expect(harness.setLink.mock.calls).toEqual([
            [
                {
                    href: 'https://example.test/article',
                    rel: 'nofollow privacy-policy',
                    target: 'articlePreview',
                    title: 'preserved',
                },
            ],
            [undefined],
        ]);
        expect(() =>
            editor.execute('link.set', {
                href: '/invalid-target',
                target: '_unsupported',
            }),
        ).toThrow(RichTextArgumentError);
        expect(() =>
            editor.execute('link.set', {
                href: '/invalid-rel',
                rel: 'not/one-token',
            }),
        ).toThrow(RichTextArgumentError);
        editor.execute('link.setText', {
            href: '/renamed',
            text: 'Renamed & safe',
        });
        expect(harness.insertHtml).toHaveBeenCalledWith(
            '<a href="/renamed">Renamed &amp; safe</a>',
        );
    });

    it('normalizes automatic links and accepts cancellable CMS target providers', async () => {
        const { editor, harness } = await createHarness();
        editor.services.register(linkTargetProviderServiceToken, {
            select: vi
                .fn()
                .mockResolvedValueOnce({ href: '/articles/42', title: 'Story' })
                .mockResolvedValueOnce(null),
        });

        editor.execute('link.auto', 'writer@example.test');
        editor.execute('link.auto', 'www.example.test/docs');
        editor.execute('link.auto', '+86 (21) 5555-1234');
        await editor.execute('link.pick', 'internal');
        await editor.execute('link.pick', 'file');

        expect(harness.setLink.mock.calls).toEqual([
            [{ href: 'mailto:writer@example.test' }],
            [{ href: 'https://www.example.test/docs' }],
            [{ href: 'tel:+862155551234' }],
            [{ href: '/articles/42', title: 'Story' }],
        ]);
    });

    it('validates and serializes custom link attributes without allowing managed or unsafe names', async () => {
        const { editor, harness } = await createHarness();
        expect(editor.execute('link.attributes.catalog')).toEqual(
            expect.arrayContaining([
                { name: 'download' },
                {
                    name: 'dir',
                    values: ['ltr', 'rtl', 'auto'],
                },
            ]),
        );
        const customAttributes = [
            { name: ' DATA-CMS-ID ', value: 'article-42' },
            { name: 'aria-label', value: 'Read article' },
            { name: 'referrerpolicy', value: 'strict-origin' },
            { name: 'download', value: '' },
        ];

        editor.execute('link.set', {
            href: '/article',
            customAttributes,
        });
        editor.execute('link.setText', {
            href: '/download',
            text: 'Download',
            customAttributes,
        });

        expect(harness.setLink).toHaveBeenCalledWith({
            href: '/article',
            customAttributes: [
                { name: 'data-cms-id', value: 'article-42' },
                { name: 'aria-label', value: 'Read article' },
                { name: 'referrerpolicy', value: 'strict-origin' },
                { name: 'download', value: '' },
            ],
        });
        expect(harness.insertHtml).toHaveBeenCalledWith(
            '<a href="/download" data-cms-id="article-42" aria-label="Read article" referrerpolicy="strict-origin" download="">Download</a>',
        );

        for (const customAttributes of [
            [{ name: 'href', value: '/bypass' }],
            [{ name: 'hreflang2', value: 'zh-TW' }],
            [{ name: 'aria-made-up', value: 'x' }],
            [{ name: 'onclick', value: 'alert(1)' }],
            [{ name: 'style', value: 'display:none' }],
            [{ name: 'data-soeditor-private', value: 'x' }],
            [
                { name: 'data-id', value: 'first' },
                { name: 'DATA-ID', value: 'second' },
            ],
            [{ name: 'referrerpolicy', value: 'invalid' }],
            [{ name: 'aria-current', value: 'selected' }],
            [{ name: 'role', value: 'Alert Dialog' }],
            [{ name: 'tabindex', value: '99999' }],
            [{ name: 'ping', value: 'javascript:alert(1)' }],
        ]) {
            expect(() =>
                editor.execute('link.set', {
                    href: '/article',
                    customAttributes,
                }),
            ).toThrow(RichTextArgumentError);
        }
    });

    it('keeps provider failure observable without mutating a link', async () => {
        const { editor, harness } = await createHarness();
        editor.services.register(linkTargetProviderServiceToken, {
            select: () => Promise.reject(new Error('Picker unavailable')),
        });

        await expect(editor.execute('link.pick', 'internal')).rejects.toThrow(
            'Picker unavailable',
        );
        expect(harness.setLink).not.toHaveBeenCalled();
    });

    it('registers validated per-instance semantic styles and rejects executable attributes', async () => {
        const created = await createHarness({
            styles: [
                {
                    attributes: [{ name: 'class', value: 'cms-lead' }],
                    element: 'span',
                    id: 'lead',
                    label: 'Lead',
                    target: 'inline',
                },
                {
                    attributes: [{ name: 'class', value: 'cms-callout' }],
                    element: 'blockquote',
                    id: 'callout',
                    label: 'Callout',
                    target: 'block',
                },
            ],
        });
        created.editor.execute('style.lead');
        created.editor.execute('style.callout');
        expect(created.harness.service.applyInlineStyle).toHaveBeenCalledWith({
            attributes: [{ name: 'class', value: 'cms-lead' }],
            tagName: 'span',
        });
        expect(created.harness.setBlock).toHaveBeenCalledWith('blockquote');
        expect(
            created.harness.service.applyBlockAttributes,
        ).toHaveBeenCalledWith([{ name: 'class', value: 'cms-callout' }]);

        await expect(
            createHarness({
                styles: [
                    {
                        attributes: [{ name: 'onclick', value: 'run()' }],
                        element: 'span',
                        id: 'unsafe',
                        label: 'Unsafe',
                        target: 'inline',
                    },
                ],
            }),
        ).rejects.toBeInstanceOf(SemanticStyleConfigurationError);
    });

    it('applies validated font families, colors, highlights, and sizes', async () => {
        const { editor, harness } = await createHarness();

        editor.execute('font.color', '#2563EB');
        editor.execute('font.backgroundColor', 'rgb(254, 249, 195)');
        editor.execute('font.highlight', '#fef08a');
        editor.execute('font.family', 'Georgia');
        editor.execute('font.size', 24);
        editor.execute('font.color.remove');
        editor.execute('font.backgroundColor.remove');
        editor.execute('font.highlight.remove');

        expect(harness.service.applyInlineStyle).toHaveBeenNthCalledWith(1, {
            attributes: [{ name: 'style', value: 'color: #2563eb;' }],
            tagName: 'span',
        });
        expect(harness.service.applyInlineStyle).toHaveBeenNthCalledWith(2, {
            attributes: [
                {
                    name: 'style',
                    value: 'background-color: rgb(254, 249, 195);',
                },
            ],
            tagName: 'span',
        });
        expect(harness.service.applyInlineStyle).toHaveBeenNthCalledWith(3, {
            attributes: [
                { name: 'style', value: 'background-color: #fef08a;' },
            ],
            tagName: 'span',
        });
        expect(harness.service.applyInlineStyle).toHaveBeenNthCalledWith(4, {
            attributes: [{ name: 'style', value: 'font-family: georgia;' }],
            tagName: 'span',
        });
        expect(harness.service.applyInlineStyle).toHaveBeenNthCalledWith(5, {
            attributes: [{ name: 'style', value: 'font-size: 24px;' }],
            tagName: 'span',
        });
        expect(harness.removeInlineStyleProperty).toHaveBeenNthCalledWith(
            1,
            'color',
        );
        expect(harness.removeInlineStyleProperty).toHaveBeenNthCalledWith(
            2,
            'background-color',
        );
        expect(harness.removeInlineStyleProperty).toHaveBeenNthCalledWith(
            3,
            'background-color',
        );
        expect(() => editor.execute('font.color', 'url(javascript:x)')).toThrow(
            RichTextArgumentError,
        );
        expect(() => editor.execute('font.size', '200px')).toThrow(
            RichTextArgumentError,
        );
        expect(() => editor.execute('font.family', 'Comic Sans MS')).toThrow(
            RichTextArgumentError,
        );
    });

    it('builds escaped semantic image HTML and validates dimensions', async () => {
        const { editor, harness } = await createHarness();

        editor.execute('image.insert', {
            alt: 'A & "B"',
            height: 45,
            src: 'x" onerror="alert(1)',
            width: 80,
        });
        expect(() =>
            editor.execute('image.insert', { src: 'x', width: -1 }),
        ).toThrow(RichTextArgumentError);

        const html = String(harness.insertHtml.mock.calls[0]?.[0]);
        const image = parseHtmlFragment(html).document.children[0];
        expect(image).toMatchObject({ tagName: 'img', type: 'element' });
        if (image?.type !== 'element') {
            throw new Error('Expected an image element.');
        }
        expect(
            image.attributes.map(({ name, value }) => ({ name, value })),
        ).toEqual([
            { name: 'src', value: 'x" onerror="alert(1)' },
            { name: 'alt', value: 'A & "B"' },
            { name: 'width', value: '80' },
            { name: 'height', value: '45' },
        ]);
    });

    it('builds bounded semantic tables', async () => {
        const { editor, harness } = await createHarness();

        editor.execute('table.insert', { columns: 3, rows: 2 });
        expect(() =>
            editor.execute('table.insert', { columns: 11, rows: 100 }),
        ).toThrow(RichTextArgumentError);

        const html = String(harness.insertHtml.mock.calls[0]?.[0]);
        const table = parseHtmlFragment(html).document.children[0];
        expect(table).toMatchObject({ tagName: 'table', type: 'element' });
        if (table?.type !== 'element') {
            throw new Error('Expected a table element.');
        }
        const body = table.children[0];
        expect(body).toMatchObject({ tagName: 'tbody', type: 'element' });
        if (body?.type !== 'element') {
            throw new Error('Expected a table body.');
        }
        expect(body.children).toHaveLength(2);
        expect(
            body.children.every(
                (row) => row.type === 'element' && row.children.length === 3,
            ),
        ).toBe(true);
    });
});

async function createHarness(options?: {
    readonly activeBlocks?: ReadonlySet<VisualBlockTag>;
    readonly activeMarks?: ReadonlySet<VisualTextMark>;
    readonly canEdit?: boolean;
    readonly styles?: readonly unknown[];
}): Promise<{ readonly editor: Editor; readonly harness: ServiceHarness }> {
    const editor = await Editor.create({
        plugins,
        ...(options?.styles === undefined
            ? {}
            : { config: { cms: { styles: options.styles } } }),
    });
    const insertHtml = vi.fn();
    const removeInlineStyleProperty = vi.fn();
    const adjustIndent = vi.fn();
    const setAlignment = vi.fn();
    const setListProperties = vi.fn();
    const setBlock = vi.fn();
    const setLink = vi.fn();
    const toggleList = vi.fn();
    const toggleMark = vi.fn();
    const service: VisualEditingService = {
        adjustIndent,
        applyBlockAttributes: vi.fn(),
        applyInlineStyle: vi.fn(),
        areBlockAttributesActive: () => false,
        canEdit: () => options?.canEdit ?? true,
        getSelection: () => undefined,
        getSelectedStructuredBlock: () => undefined,
        insertHtml,
        isBlockActive: (tagName) =>
            options?.activeBlocks?.has(tagName) ?? false,
        isAlignmentActive: () => false,
        isInlineStyleActive: () => false,
        isLinkActive: () => false,
        isListActive: () => false,
        isMarkActive: (mark) => options?.activeMarks?.has(mark) ?? false,
        isStructuredBlockSelected: () => false,
        replaceStructuredBlockContent: vi.fn(),
        removeFormat: vi.fn(),
        removeInlineStyleProperty,
        setAlignment,
        setBlock,
        setLink: setLink as (
            attributes: VisualLinkAttributes | undefined,
        ) => void,
        setSelection: () => false,
        setListProperties,
        setStructuredBlockAttributes: vi.fn(),
        toggleList,
        toggleMark,
    };
    editor.services.register(visualEditingServiceToken, service);
    return {
        editor,
        harness: {
            adjustIndent,
            removeInlineStyleProperty,
            insertHtml,
            service,
            setBlock,
            setAlignment,
            setListProperties,
            setLink,
            toggleList,
            toggleMark,
        },
    };
}
