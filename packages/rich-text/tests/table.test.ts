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
    tableEditorServiceToken,
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
        harness.editor.execute(
            'table.cell.setHtml',
            range(1, 1),
            '<strong>Rich</strong> <a href="/docs">link</a><br><img src="/cover.png" alt="Cover">',
        );
        expect(harness.html()).toContain(
            '<td><strong>Rich</strong> <a href="/docs">link</a><br><img src="/cover.png" alt="Cover"></td>',
        );
        expect(() =>
            harness.editor.execute(
                'table.cell.setHtml',
                range(1, 1),
                '<table><tr><td>nested</td></tr></table>',
            ),
        ).toThrow('does not allow nested tables');
        expect(harness.replace).toHaveBeenCalled();
        expect(harness.editor.commands.canExecute('table.remove')).toBe(true);
        harness.editor.execute('table.remove');
        expect(harness.remove).toHaveBeenCalledWith('soeditor.table');
        await harness.editor.destroy();
    });

    it('inserts multiple rows and columns in one command transaction', async () => {
        const harness = await createTableHarness(
            '<table><tbody><tr><td>A</td><td>B</td></tr></tbody></table>',
        );
        harness.editor.execute('table.row.insertAfter', range(0, 0), {
            count: 2,
        });
        expect(countElements(harness.block.children, 'tr')).toBe(3);
        expect(harness.replace).toHaveBeenCalledTimes(1);
        harness.editor.execute('table.column.insertAfter', range(0, 0), {
            count: 2,
        });
        expect(
            rows(harness.block).every(
                (row) => countElements(row.children, 'td') === 4,
            ),
        ).toBe(true);
        expect(harness.replace).toHaveBeenCalledTimes(2);
        await harness.editor.destroy();
    });

    it('selects rows, columns, and the complete table through commands', async () => {
        const harness = await createTableHarness(
            '<table><tbody><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table>',
        );
        harness.editor.execute('table.selection.row');
        expect(
            harness.editor.services.get(tableEditorServiceToken).inspect(),
        ).toMatchObject({ selectionKind: 'rows' });
        harness.editor.execute('table.selection.column');
        expect(
            harness.editor.services.get(tableEditorServiceToken).inspect(),
        ).toMatchObject({ selectionKind: 'columns' });
        harness.editor.execute('table.selection.table');
        expect(
            harness.editor.services.get(tableEditorServiceToken).inspect(),
        ).toMatchObject({ selectionKind: 'table' });
        await harness.editor.destroy();
    });

    it('merges and splits a rectangle through one transaction-backed content replacement', async () => {
        const harness = await createTableHarness(
            '<table><tbody><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table>',
        );
        const all = range(0, 0, 1, 1);

        expect(
            harness.editor.execute('table.cells.canMerge', range(0, 0)),
        ).toBe(false);
        expect(harness.editor.execute('table.cells.canMerge', all)).toBe(true);
        harness.editor.execute('table.cells.merge', all);
        expect(harness.editor.execute('table.cells.canMerge', all)).toBe(false);
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

    it('splits merged cells by rows or columns without duplicating ids', async () => {
        const columns = await createTableHarness(
            '<table><tbody><tr><td id="kept" colspan="3">A</td></tr></tbody></table>',
        );
        columns.editor.execute('table.cell.splitColumns', range(0, 0));
        expect(columns.html()).toBe(
            '<table><tbody><tr><td id="kept">A</td><td></td><td></td></tr></tbody></table>',
        );
        await columns.editor.destroy();

        const rows = await createTableHarness(
            '<table><tbody><tr><td id="kept" rowspan="2">A</td><td>B</td></tr><tr><td>C</td></tr></tbody></table>',
        );
        rows.editor.execute('table.cell.splitRows', range(0, 0));
        expect(rows.html()).toBe(
            '<table><tbody><tr><td id="kept">A</td><td>B</td></tr><tr><td></td><td>C</td></tr></tbody></table>',
        );
        await rows.editor.destroy();
    });

    it('does not merge cells across explicit table sections', async () => {
        const harness = await createTableHarness(
            '<table><thead><tr><th>Head</th></tr></thead><tbody><tr><td>Body</td></tr></tbody></table>',
        );
        const selection = range(0, 0, 1, 0);
        expect(harness.editor.execute('table.cells.canMerge', selection)).toBe(
            false,
        );
        expect(() =>
            harness.editor.execute('table.cells.merge', selection),
        ).toThrow('cannot merge cells across table sections');
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

    it('applies bounded CMS table, row, cell, section, and column properties', async () => {
        const harness = await createTableHarness(
            '<table data-cms="kept"><tbody><tr data-row="kept"><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table>',
        );
        harness.editor.execute('table.properties', range(0, 0), {
            alignment: 'center',
            ariaLabel: 'Quarterly results',
            caption: 'Results',
            responsiveClass: 'cms-table responsive',
            width: '80%',
            customAttributes: [
                { name: 'data-cms', value: 'table' },
                { name: 'role', value: 'grid' },
            ],
        });
        harness.editor.execute('table.row.properties', range(0, 0, 0, 1), {
            ariaLabel: 'Header row',
            className: 'highlight',
            height: 48,
            section: 'head',
            customAttributes: [{ name: 'data-row', value: 'header' }],
        });
        harness.editor.execute('table.header.toggle', range(0, 0, 0, 1));
        harness.editor.execute('table.cell.properties', range(0, 0, 0, 1), {
            className: 'numeric',
            horizontalAlignment: 'right',
            scope: 'col',
            verticalAlignment: 'middle',
            customAttributes: [{ name: 'headers', value: 'amount' }],
        });
        harness.editor.execute('table.column.resize', range(0, 0, 1, 0), {
            width: 240,
        });

        expect(harness.html()).toContain(
            '<table data-soeditor-align="center" width="80%" data-soeditor-responsive-class="cms-table responsive" aria-label="Quarterly results" data-cms="table" role="grid"><caption>Results</caption><colgroup data-soeditor-columns="true"><col data-soeditor-width="240"><col></colgroup>',
        );
        expect(harness.html()).toContain(
            '<thead><tr aria-label="Header row" data-soeditor-class="highlight" height="48" data-row="header"><th data-soeditor-class="numeric" data-soeditor-align="right" data-soeditor-vertical-align="middle" scope="col" headers="amount">A</th>',
        );
        expect(harness.html()).toContain(
            '<tbody><tr><td>C</td><td>D</td></tr></tbody>',
        );

        harness.editor.execute('table.column.insertAfter', range(0, 0));
        expect(harness.html()).toContain(
            '<colgroup data-soeditor-columns="true"><col data-soeditor-width="240"><col><col></colgroup>',
        );
        const beforeInvalid = harness.html();
        expect(() =>
            harness.editor.execute('table.properties', range(0, 0), {
                width: '0%',
            }),
        ).toThrow('1px to 9999px, or 1% to 100%');
        expect(() =>
            harness.editor.execute('table.properties', range(0, 0), {
                width: '10000px',
            }),
        ).toThrow('1px to 9999px, or 1% to 100%');
        expect(harness.html()).toBe(beforeInvalid);
        expect(() =>
            harness.editor.execute('table.cell.properties', range(0, 0), {
                customAttributes: [{ name: 'href', value: '/invalid' }],
            }),
        ).toThrow('invalid or reserved');
        expect(harness.html()).toBe(beforeInvalid);
        expect(() =>
            harness.editor.execute('table.column.resize', range(0, 0), {
                width: 5000,
            }),
        ).toThrow('40 to 1200');
        expect(harness.html()).toBe(beforeInvalid);
        await harness.editor.destroy();
    });

    it('exposes a diagnostic service and safely recovers an empty table', async () => {
        const harness = await createTableHarness(
            '<table data-cms="kept"><caption>Empty</caption><tbody></tbody></table>',
        );
        const service = harness.editor.services.get(tableEditorServiceToken);

        expect(service.inspect()).toMatchObject({
            diagnostic: { code: 'no-rows', recoverable: true },
            editable: true,
        });
        service.recover();
        expect(harness.html()).toBe(
            '<table data-cms="kept"><caption>Empty</caption><tbody><tr><td></td></tr></tbody></table>',
        );
        expect(harness.replace).toHaveBeenCalledTimes(1);
        expect(service.inspect().diagnostic).toBeUndefined();
        await harness.editor.destroy();
    });

    it('applies native dimensions and tag-specific attributes through the service', async () => {
        const harness = await createTableHarness(
            '<table><tbody data-cms="body"><tr><th>A</th><th>B</th></tr></tbody></table>',
        );
        const service = harness.editor.services.get(tableEditorServiceToken);
        expect(service.inspect()).toMatchObject({
            capabilities: {
                clear: { enabled: true },
                merge: { enabled: false },
                split: { enabled: false },
            },
            selectionKind: 'caret',
        });
        service.updateTable({ height: '320px', width: '75%' });
        service.updateSection({
            customAttributes: [{ name: 'data-cms', value: 'updated' }],
        });
        service.updateCells({ height: '40', width: '25%' });

        expect(harness.html()).toContain(
            '<table width="75%" height="320"><tbody data-cms="updated"><tr><th height="40" width="25%">A</th>',
        );
        expect(harness.html()).not.toContain('<colgroup');
        expect(() =>
            service.updateCells({
                customAttributes: [{ name: 'href', value: '/invalid' }],
            }),
        ).toThrow('invalid or reserved');
        await harness.editor.destroy();
    });
});

async function createTableHarness(source: string): Promise<{
    readonly block: EditingStructuredBlock;
    readonly editor: Editor;
    readonly html: () => string;
    readonly remove: ReturnType<typeof vi.fn>;
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
    const remove = vi.fn();
    let structuredSelection = range(0, 0);
    const service: VisualEditingService = {
        canEdit: () => true,
        getSelection: () => undefined,
        getStructuredSelection: () => structuredSelection,
        getSelectedStructuredBlock: () => block,
        insertHtml: vi.fn(),
        isBlockActive: () => false,
        isLinkActive: () => false,
        isListActive: () => false,
        isMarkActive: () => false,
        isStructuredBlockSelected: (type) =>
            type === undefined || type === block.type,
        replaceStructuredBlockContent: replace,
        removeSelectedStructuredBlock: remove,
        setBlock: vi.fn(),
        setLink: vi.fn(),
        setSelection: () => false,
        setStructuredSelection: (type, selection) => {
            if (type !== 'soeditor.table') return false;
            structuredSelection = selection as TableCellRange;
            return true;
        },
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
        remove,
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
