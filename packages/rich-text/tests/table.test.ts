import { Editor } from '@soeditor/core';
import {
    visualEditingServiceToken,
    type EditingStructuredBlock,
    type VisualEditingService,
} from '@soeditor/engine';
import {
    parseHtmlFragment,
    serializeHtmlFragment,
    type HtmlChildNode,
    type HtmlElement,
} from '@soeditor/html';
import { describe, expect, it, vi } from 'vitest';

import {
    RichTextArgumentError,
    TablePlugin,
    type TableCellRange,
} from '../src/index.js';

describe('structured table feature', () => {
    it('registers bounded table structure commands and preserves source metadata', async () => {
        const harness = await createTableHarness(
            '<table data-cms="table"><tbody class="body"><tr data-row="a"><td data-cell="a">A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table>',
        );
        const firstRow = range(0, 0, 0, 1);

        harness.editor.execute('table.header.toggle', firstRow);
        expect(harness.html()).toContain(
            '<tr data-row="a"><th data-cell="a">A</th><th>B</th></tr>',
        );
        expect(harness.html()).toContain(
            '<table data-cms="table"><tbody class="body">',
        );

        harness.editor.execute('table.row.insertAfter', range(0, 0));
        expect(countElements(harness.block.children, 'tr')).toBe(3);
        harness.editor.execute('table.column.insertAfter', range(0, 0));
        expect(
            rows(harness.block).every(
                (row) =>
                    countElements(row.children, 'td') +
                        countElements(row.children, 'th') ===
                    3,
            ),
        ).toBe(true);

        harness.editor.execute(
            'table.cell.setText',
            range(1, 1),
            '<unsafe text>',
        );
        expect(harness.html()).toContain('&lt;unsafe text&gt;');
        expect(harness.replace).toHaveBeenCalled();
        await harness.editor.destroy();
    });

    it('merges and splits a rectangle through one transaction-backed content replacement', async () => {
        const harness = await createTableHarness(
            '<table><tbody><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table>',
        );
        const all = range(0, 0, 1, 1);

        harness.editor.execute('table.cells.merge', all);
        expect(harness.html()).toBe(
            '<table><tbody><tr><td rowspan="2" colspan="2">A<br>B<br>C<br>D</td></tr><tr></tr></tbody></table>',
        );
        expect(harness.replace).toHaveBeenCalledTimes(1);

        harness.editor.execute('table.cell.split', range(0, 0));
        expect(harness.html()).toBe(
            '<table><tbody><tr><td>A<br>B<br>C<br>D</td><td></td></tr><tr><td></td><td></td></tr></tbody></table>',
        );
        expect(harness.replace).toHaveBeenCalledTimes(2);
        await harness.editor.destroy();
    });

    it('pastes a bounded cell matrix and rejects destructive or unsupported operations', async () => {
        const harness = await createTableHarness(
            '<table><tbody><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table>',
        );
        const matrix = [
            [[{ type: 'text', value: '1' }]],
            [[{ type: 'text', value: '2' }]],
        ] as const;
        harness.editor.execute('table.cells.paste', range(0, 0, 1, 0), matrix);
        expect(harness.html()).toContain('<tr><td>1</td><td>B</td></tr>');
        expect(harness.html()).toContain('<tr><td>2</td><td>D</td></tr>');
        expect(() =>
            harness.editor.execute('table.row.remove', range(0, 0, 1, 0)),
        ).toThrow(RichTextArgumentError);
        expect(() =>
            harness.editor.execute('table.column.remove', range(0, 0, 0, 1)),
        ).toThrow(RichTextArgumentError);
        expect(() =>
            harness.editor.execute('table.cell.setText', range(9, 9), 'x'),
        ).toThrow(RichTextArgumentError);
        expect(() =>
            harness.editor.execute('table.cells.paste', range(0, 0), [
                [[{ type: 'script', value: 'invalid' }]],
            ]),
        ).toThrow('requires a valid matrix');
        expect(() =>
            harness.editor.execute(
                'table.cells.paste',
                range(0, 0),
                Array.from({ length: 101 }, () => [
                    [{ type: 'text', value: 'x' }],
                ]),
            ),
        ).toThrow('bounded to 100 rows');
        await harness.editor.destroy();

        const unsupported = await createTableHarness(
            '<table><tbody><tr><td>A</td></tr><script>unsafe()</script></tbody></table>',
        );
        expect(() =>
            unsupported.editor.execute('table.cell.setText', range(0, 0), 'x'),
        ).toThrow('table sections may contain only rows');
        expect(unsupported.replace).not.toHaveBeenCalled();
        expect(unsupported.html()).toContain('<script>unsafe()</script>');
        await unsupported.editor.destroy();

        const columns = await createTableHarness(
            '<table><colgroup><col span="2"></colgroup><tbody><tr><td>A</td><td>B</td></tr></tbody></table>',
        );
        expect(() =>
            columns.editor.execute('table.column.insertAfter', range(0, 0)),
        ).toThrow('does not alter tables with colgroup metadata');
        expect(columns.html()).toContain('<colgroup><col span="2"></colgroup>');
        expect(columns.replace).not.toHaveBeenCalled();
        await columns.editor.destroy();
    });
});

async function createTableHarness(source: string): Promise<{
    readonly block: EditingStructuredBlock;
    readonly editor: Editor;
    readonly html: () => string;
    readonly replace: ReturnType<typeof vi.fn>;
}> {
    const editor = await Editor.create({ plugins: [TablePlugin] });
    const parsed = parseHtmlFragment(source).document.children[0];
    if (parsed?.type !== 'element' || parsed.tagName !== 'table') {
        throw new Error('A table fixture is required.');
    }
    let block: EditingStructuredBlock = {
        attributes: parsed.attributes,
        behavior: 'atomic',
        children: parsed.children,
        kind: 'structured-block',
        type: 'soeditor.table',
    };
    const replace = vi.fn(
        (
            _type: string,
            content: Pick<EditingStructuredBlock, 'attributes' | 'children'>,
        ) => {
            block = { ...block, ...content };
        },
    );
    const service: VisualEditingService = {
        canEdit: () => true,
        getSelection: () => undefined,
        getSelectedStructuredBlock: () => block,
        insertHtml: vi.fn(),
        isBlockActive: () => false,
        isLinkActive: () => false,
        isListActive: () => false,
        isMarkActive: () => false,
        isStructuredBlockSelected: (type) =>
            type === undefined || type === block.type,
        replaceStructuredBlockContent: replace,
        setBlock: vi.fn(),
        setLink: vi.fn(),
        setSelection: () => false,
        setStructuredBlockAttributes: vi.fn(),
        toggleList: vi.fn(),
        toggleMark: vi.fn(),
    };
    editor.services.register(visualEditingServiceToken, service);
    return {
        get block() {
            return block;
        },
        editor,
        html: () =>
            serializeHtmlFragment({
                children: [tableFromBlock(block)],
                type: 'document-fragment',
            }),
        replace,
    };
}

function range(
    row: number,
    column: number,
    focusRow = row,
    focusColumn = column,
): TableCellRange {
    return {
        anchor: { column, row },
        focus: { column: focusColumn, row: focusRow },
    };
}

function tableFromBlock(block: EditingStructuredBlock): HtmlElement {
    return {
        attributes: block.attributes,
        children: block.children,
        namespace: 'html',
        tagName: 'table',
        type: 'element',
    };
}

function rows(block: EditingStructuredBlock): readonly HtmlElement[] {
    return descendants(block.children, 'tr');
}

function countElements(
    nodes: readonly HtmlChildNode[],
    tagName: string,
): number {
    return descendants(nodes, tagName).length;
}

function descendants(
    nodes: readonly HtmlChildNode[],
    tagName: string,
): readonly HtmlElement[] {
    return nodes.flatMap((node): readonly HtmlElement[] =>
        node.type !== 'element'
            ? []
            : [
                  ...(node.tagName === tagName ? [node] : []),
                  ...descendants(node.children, tagName),
              ],
    );
}
