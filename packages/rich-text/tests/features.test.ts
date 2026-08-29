import { Editor, type PluginConstructor } from '@soeditor/core';
import {
    visualEditingServiceToken,
    type VisualBlockTag,
    type VisualEditingService,
    type VisualLinkAttributes,
    type VisualTextMark,
} from '@soeditor/engine';
import { parseHtmlFragment } from '@soeditor/html';
import { describe, expect, it, vi } from 'vitest';

import {
    BlockquotePlugin,
    BoldPlugin,
    CodeBlockPlugin,
    HeadingPlugin,
    ImagePlugin,
    InlineCodePlugin,
    ItalicPlugin,
    LinkPlugin,
    OrderedListPlugin,
    ParagraphPlugin,
    RichTextArgumentError,
    StrikePlugin,
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
    LinkPlugin,
    OrderedListPlugin,
    UnorderedListPlugin,
    BlockquotePlugin,
    InlineCodePlugin,
    CodeBlockPlugin,
    ImagePlugin,
    TablePlugin,
];

interface ServiceHarness {
    readonly service: VisualEditingService;
    readonly insertHtml: ReturnType<typeof vi.fn>;
    readonly setBlock: ReturnType<typeof vi.fn>;
    readonly setLink: ReturnType<typeof vi.fn>;
    readonly toggleList: ReturnType<typeof vi.fn>;
    readonly toggleMark: ReturnType<typeof vi.fn>;
}

describe('rich-text feature plugins', () => {
    it('registers every feature as a stable command', async () => {
        const { editor } = await createHarness();

        expect(
            [
                'paragraph.set',
                'paragraph.heading',
                'format.bold',
                'format.italic',
                'format.underline',
                'format.strike',
                'format.inlineCode',
                'blockquote.toggle',
                'codeBlock.toggle',
                'list.ordered',
                'list.unordered',
                'link.set',
                'link.remove',
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
        editor.execute('blockquote.toggle');
        editor.execute('codeBlock.toggle');
        editor.execute('list.ordered');
        editor.execute('list.unordered');

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
        ]);
        expect(harness.toggleList.mock.calls).toEqual([['ol'], ['ul']]);
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
        editor.execute('link.set', {
            href: 'javascript:alert(1)',
            rel: 'nofollow',
            title: 'preserved',
        });
        editor.execute('link.remove');

        expect(harness.setLink.mock.calls).toEqual([
            [
                {
                    href: 'javascript:alert(1)',
                    rel: 'nofollow',
                    title: 'preserved',
                },
            ],
            [undefined],
        ]);
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
}): Promise<{ readonly editor: Editor; readonly harness: ServiceHarness }> {
    const editor = await Editor.create({ plugins });
    const insertHtml = vi.fn();
    const setBlock = vi.fn();
    const setLink = vi.fn();
    const toggleList = vi.fn();
    const toggleMark = vi.fn();
    const service: VisualEditingService = {
        canEdit: () => options?.canEdit ?? true,
        insertHtml,
        isBlockActive: (tagName) =>
            options?.activeBlocks?.has(tagName) ?? false,
        isLinkActive: () => false,
        isListActive: () => false,
        isMarkActive: (mark) => options?.activeMarks?.has(mark) ?? false,
        setBlock,
        setLink: setLink as (
            attributes: VisualLinkAttributes | undefined,
        ) => void,
        toggleList,
        toggleMark,
    };
    editor.services.register(visualEditingServiceToken, service);
    return {
        editor,
        harness: {
            insertHtml,
            service,
            setBlock,
            setLink,
            toggleList,
            toggleMark,
        },
    };
}
