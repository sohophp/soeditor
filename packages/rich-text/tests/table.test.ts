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
    it('checks directional split limits without changing table content or history', async () => {
        const line =
            '<tr>' +
            Array.from({ length: 100 }, () => '<td>A</td>').join('') +
            '</tr>';
        const columns = await createTableHarness(
            '<table><tbody>' + line + '</tbody></table>',
        );
        const original = columns.html();
        expect(
            columns.editor.execute(
                'table.cell.canSplit',
                range(0, 0),
                'columns',
            ),
        ).toBe(false);
        expect(
            columns.editor.execute('table.cell.canSplit', range(0, 0), 'rows'),
        ).toBe(true);
        expect(
            columns.editor.execute('table.cell.canSplit', range(0, 0), 'all'),
        ).toBe(false);
        expect(columns.html()).toBe(original);
        expect(columns.replace).not.toHaveBeenCalled();
        await columns.editor.destroy();
        const cells = await createTableHarness(
            '<table><tbody>' + line.repeat(10) + '</tbody></table>',
        );
        expect(
            cells.editor.execute('table.cell.canSplit', range(0, 0), 'rows'),
        ).toBe(false);
        expect(cells.replace).not.toHaveBeenCalled();
        await cells.editor.destroy();
        const merged = await createTableHarness(
            '<table><tbody><tr><td colspan="2">A</td></tr></tbody></table>',
        );
        expect(
            merged.editor.execute('table.cell.canSplit', range(0, 0), 'all'),
        ).toBe(true);
        expect(
            merged.editor.execute(
                'table.cell.canSplit',
                range(0, 0),
                'columns',
            ),
        ).toBe(true);
        expect(merged.replace).not.toHaveBeenCalled();
        await merged.editor.destroy();
    });

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
            '<strong>Rich</strong> <a href="/docs">link</a><br /><img src="/cover.png" alt="Cover">',
        );
        expect(harness.html()).toContain(
            '<td><strong>Rich</strong> <a href="/docs">link</a><br /><img src="/cover.png" alt="Cover"></td>',
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
            '<table><tbody><tr><td rowspan="2" colspan="2">A<br />B<br />C<br />D</td></tr><tr></tr></tbody></table>',
        );
        expect(harness.replace).toHaveBeenCalledTimes(1);

        harness.editor.execute('table.cell.split', range(0, 0));
        expect(harness.html()).toBe(
            '<table><tbody><tr><td>A<br />B<br />C<br />D</td><td></td></tr><tr><td></td><td></td></tr></tbody></table>',
        );
        expect(harness.replace).toHaveBeenCalledTimes(2);
        await harness.editor.destroy();
    });

    it('merges another rectangle when an unrelated merged cell already exists', async () => {
        const harness = await createTableHarness(
            '<table><tbody><tr><td rowspan="2">A<br />C</td><td>B</td><td>D</td></tr><tr><td>E</td><td>F</td></tr></tbody></table>',
        );
        const selection = range(1, 1, 1, 2);

        expect(harness.editor.execute('table.cells.canMerge', selection)).toBe(
            true,
        );
        harness.editor.execute('table.cells.merge', selection);
        expect(harness.html()).toBe(
            '<table><tbody><tr><td rowspan="2">A<br />C</td><td>B</td><td>D</td></tr><tr><td colspan="2">E<br />F</td></tr></tbody></table>',
        );
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

    it('bisects ordinary cells while preserving neighboring content and unique IDs', async () => {
        const columns = await createTableHarness(
            '<table><tbody><tr><td id="kept">A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table>',
        );
        columns.editor.execute('table.cell.splitColumns', range(0, 0));
        expect(columns.html()).toBe(
            '<table><tbody><tr><td id="kept">A</td><td></td><td>B</td></tr><tr><td colspan="2">C</td><td>D</td></tr></tbody></table>',
        );
        await columns.editor.destroy();
        const rows = await createTableHarness(
            '<table><tbody><tr><td>A</td><td id="kept">B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table>',
        );
        rows.editor.execute('table.cell.splitRows', range(0, 1));
        expect(rows.html()).toBe(
            '<table><tbody><tr><td rowspan="2">A</td><td id="kept">B</td></tr><tr><td></td></tr><tr><td>C</td><td>D</td></tr></tbody></table>',
        );
        await rows.editor.destroy();
    });

    it('merges complete spanned rectangles and rejects partial overlaps', async () => {
        const harness = await createTableHarness(
            '<table><tbody><tr><td colspan="2">A</td><td>B</td></tr><tr><td>C</td><td>D</td><td>E</td></tr></tbody></table>',
        );
        expect(
            harness.editor.execute('table.cells.canMerge', range(0, 1, 0, 2)),
        ).toBe(false);
        expect(
            harness.editor.execute('table.cells.canMerge', range(0, 0, 0, 2)),
        ).toBe(true);
        harness.editor.execute('table.cells.merge', range(0, 0, 0, 2));
        expect(harness.html()).toContain('<td colspan="3">A<br />B</td>');
        await harness.editor.destroy();
    });

    it('preserves column metadata and section boundaries when bisecting cells', async () => {
        const harness = await createTableHarness(
            '<table><colgroup><col id="width" width="100" /><col width="200" /></colgroup><thead><tr><th id="head">H</th><!--cms--><th>I</th></tr></thead><tbody><tr><td>A</td><td>B</td></tr></tbody></table>',
        );
        harness.editor.execute('table.cell.splitColumns', range(0, 0));
        expect(harness.html()).toContain(
            '<col id="width" width="100" span="2">',
        );
        expect(harness.html()).toContain(
            '<tbody><tr><td colspan="2">A</td><td>B</td></tr></tbody>',
        );
        harness.editor.execute('table.cell.splitRows', range(0, 0));
        expect(harness.html()).toContain(
            '</tr><tr><th></th></tr></thead><tbody>',
        );
        expect(harness.html().match(/id="head"/gu)).toHaveLength(1);
        expect(harness.html()).toContain('<!--cms-->');
        await harness.editor.destroy();
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

    it('inserts through row spans and moves surviving contents when the origin row is deleted', async () => {
        const original =
            '<table><tbody><tr><td id="keep" class="cms" rowspan="2">A</td><!--marker--><td>B</td></tr><tr><td>C</td></tr></tbody></table>';
        const harness = await createTableHarness(original);
        harness.editor.execute('table.row.insertBefore', range(1, 1));
        expect(harness.html()).toContain('id="keep" class="cms" rowspan="3"');
        expect(harness.html()).toContain(
            '</tr><tr><td></td></tr><tr><td>C</td></tr>',
        );
        expect(harness.html()).toContain('<!--marker-->');
        harness.editor.execute('table.row.remove', range(1, 1));
        expect(harness.html()).toBe(original);
        harness.editor.execute('table.row.insertAfter', range(0, 0));
        expect(harness.html()).toContain('id="keep" class="cms" rowspan="2"');
        harness.editor.execute('table.row.remove', range(2, 0));
        expect(harness.html()).toBe(original);
        harness.editor.execute('table.row.remove', range(0, 1));
        expect(harness.html()).toBe(
            '<table><tbody><tr><td id="keep" class="cms">A</td><td>C</td></tr></tbody></table>',
        );
        await harness.editor.destroy();
    });

    it('inserts and deletes logical columns across spans without losing surviving identities', async () => {
        const original =
            '<table><tbody><tr><td id="wide" colspan="2">A</td><td>B</td></tr><tr><td>C</td><!--marker--><td>D</td><td>E</td></tr></tbody></table>';
        const harness = await createTableHarness(original);
        harness.editor.execute('table.column.insertBefore', range(1, 1));
        expect(harness.html()).toContain('<td id="wide" colspan="3">A</td>');
        expect(harness.html()).toContain(
            '<td>C</td><!--marker--><td></td><td>D</td><td>E</td>',
        );
        harness.editor.execute('table.column.remove', range(1, 1));
        expect(harness.html()).toBe(original);
        harness.editor.execute('table.column.insertAfter', range(0, 0));
        expect(harness.html()).toContain(
            '<td id="wide" colspan="2">A</td><td></td><td>B</td>',
        );
        harness.editor.execute('table.column.remove', range(0, 2));
        expect(harness.html()).toBe(original);
        harness.editor.execute('table.column.remove', range(0, 0));
        expect(harness.html()).toContain('<td id="wide">A</td><td>B</td>');
        expect(harness.html()).toContain('<!--marker--><td>D</td><td>E</td>');
        await harness.editor.destroy();
    });

    it('keeps header intersections when either axis is switched off', async () => {
        for (const first of ['firstRow', 'firstColumn']) {
            const other = first === 'firstRow' ? 'firstColumn' : 'firstRow';
            const harness = await createTableHarness(
                '<table><tbody><tr><td id="corner">A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table>',
            );
            harness.editor.execute(`table.header.${first}`, range(0, 0), true);
            harness.editor.execute(`table.header.${other}`, range(0, 0), true);
            harness.editor.execute(`table.header.${first}`, range(0, 0), false);
            expect(harness.html()).toContain(
                `<th id="corner" scope="${other === 'firstRow' ? 'col' : 'row'}">A</th>`,
            );
            expect(countElements(harness.block.children, 'th')).toBe(2);
            harness.editor.execute(`table.header.${other}`, range(0, 0), false);
            expect(harness.html()).toBe(
                '<table><tbody><tr><td id="corner">A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table>',
            );
            await harness.editor.destroy();
        }
    });

    it('preserves column groups and keeps row insertions in the requested section', async () => {
        const harness = await createTableHarness(
            '<table><colgroup class="cms"><col id="track" style="width:30%" span="2"></colgroup><colgroup span="1" data-grid="kept"></colgroup><thead><tr><th colspan="2">H</th><th>I</th></tr></thead><tbody><tr><td>A</td><td>B</td><td>C</td></tr></tbody></table>',
        );
        harness.editor.execute('table.column.insertBefore', range(1, 1));
        expect(harness.html()).toContain(
            '<col id="track" style="width:30%" span="3">',
        );
        harness.editor.execute('table.column.remove', range(1, 1));
        expect(harness.html()).toContain(
            '<col id="track" style="width:30%" span="2">',
        );
        harness.editor.execute('table.row.insertAfter', range(0, 2));
        expect(harness.html()).toContain(
            '</tr><tr><th></th><th></th><th></th></tr></thead>',
        );
        harness.editor.execute('table.row.insertBefore', range(2, 0));
        expect(harness.html()).toContain(
            '<tbody><tr><td></td><td></td><td></td></tr><tr><td>A</td>',
        );
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
        const beforeRejectedPaste = harness.html();
        expect(() =>
            harness.editor.execute('table.cells.paste', range(1, 1), [
                [
                    [{ type: 'text', value: 'x' }],
                    [{ type: 'text', value: 'y' }],
                ],
            ]),
        ).toThrow('does not fit the table');
        expect(harness.html()).toBe(beforeRejectedPaste);
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
            '<table><colgroup><col span="3"></colgroup><tbody><tr><td>A</td><td>B</td></tr></tbody></table>',
        );
        expect(() =>
            columns.editor.execute('table.column.insertAfter', range(0, 0)),
        ).toThrow('requires column metadata to match the table grid');
        expect(columns.html()).toContain('<colgroup><col span="3"></colgroup>');
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
            border: '1',
            cellPadding: '6',
            cellSpacing: '0',
            responsiveClass: 'cms-table responsive',
            summary: 'Quarterly results summary',
            width: '80%',
            customAttributes: [
                { name: 'data-cms', value: 'table' },
                { name: 'role', value: 'grid' },
            ],
        });
        harness.editor.execute('table.caption.set', range(0, 0), 'Results');
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
            '<table align="center" width="80%" border="1" cellpadding="6" cellspacing="0" summary="Quarterly results summary" class="cms-table responsive" aria-label="Quarterly results" data-cms="table" role="grid"><caption>Results</caption><colgroup><col width="240"><col></colgroup>',
        );
        expect(harness.html()).toContain(
            '<thead><tr aria-label="Header row" class="highlight" height="48" data-row="header"><th class="numeric" align="right" valign="middle" scope="col" headers="amount">A</th>',
        );
        expect(harness.html()).toContain(
            '<tbody><tr><td>C</td><td>D</td></tr></tbody>',
        );

        harness.editor.execute('table.column.insertAfter', range(0, 0));
        expect(harness.html()).toContain(
            '<colgroup><col width="240"><col><col></colgroup>',
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
        expect(() =>
            harness.editor.execute('table.properties', range(0, 0), {
                cellPadding: '-1',
            }),
        ).toThrow('cellPadding');
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
    it('inspects and edits captions, sections, and safe column groups', async () => {
        const harness = await createTableHarness(
            '<table data-cms="kept"><caption data-title="kept"><strong>Old</strong> title</caption><thead><tr><th scope="col">H</th></tr></thead><tbody data-body="one"><tr><td>A</td></tr></tbody><tbody data-body="two"></tbody><tfoot></tfoot></table>',
        );
        const service = harness.editor.services.get(tableEditorServiceToken);
        expect(service.inspectStructure()).toMatchObject({
            caption: { exists: true, hasRichContent: true, text: 'Old title' },
            sections: [
                { kind: 'head', rowCount: 1 },
                { kind: 'body', rowCount: 1 },
                { kind: 'body', rowCount: 0 },
                { kind: 'foot', rowCount: 0 },
            ],
        });

        service.updateCaption('New title');
        expect(harness.html()).toContain(
            '<caption data-title="kept">New title</caption>',
        );
        service.moveRows({
            placement: 'start',
            range: range(0, 0),
            targetSectionIndex: 2,
        });
        expect(service.inspectStructure().sections).toMatchObject([
            { kind: 'head', rowCount: 0 },
            { kind: 'body', rowCount: 1 },
            { kind: 'body', rowCount: 1 },
            { kind: 'foot', rowCount: 0 },
        ]);
        service.updateSection(2, {
            customAttributes: [{ name: 'data-cms-section', value: 'kept' }],
        });
        service.removeSection(3);
        expect(harness.html()).toContain(
            '<tbody data-cms-section="kept"><tr><th scope="col">H</th></tr></tbody>',
        );
        expect(harness.replace).toHaveBeenCalledTimes(4);
        await harness.editor.destroy();

        const columns = await createTableHarness(
            '<table><tbody><tr><td>A</td><td>B</td></tr></tbody></table>',
        );
        const columnService = columns.editor.services.get(
            tableEditorServiceToken,
        );
        columnService.createColumnGroup({ span: 2 });
        expect(columnService.inspectStructure()).toMatchObject({
            columnGroups: [{ columnCount: 2, editable: true, span: 2 }],
            diagnostics: [],
        });
        columnService.updateColumnGroup(0, {
            customAttributes: [{ name: 'data-cms-columns', value: 'kept' }],
            span: 2,
        });
        expect(columns.html()).toContain(
            '<colgroup span="2" data-cms-columns="kept"></colgroup>',
        );
        columnService.updateColumnGroup(0, {
            columns: [
                {
                    attributes: [{ name: 'data-cms-column', value: 'one' }],
                    span: 1,
                    width: '240px',
                },
                { attributes: [], span: 1 },
            ],
        });
        expect(columns.html()).toContain(
            '<colgroup data-cms-columns="kept"><col width="240px" data-cms-column="one"><col></colgroup>',
        );
        columns.editor.execute('table.column.resize', range(0, 1), {
            width: 320,
        });
        expect(columns.html()).toContain(
            '<colgroup data-cms-columns="kept"><col width="240px" data-cms-column="one"><col width="320px"></colgroup>',
        );
        expect(() => columnService.removeColumnGroup(0)).toThrow(
            'only an empty column group',
        );
        await columns.editor.destroy();

        const multipleGroups = await createTableHarness(
            '<table><colgroup data-group="one"><col></colgroup><!--cms-columns--><colgroup data-group="two"><col></colgroup><tbody><tr><td>A</td><td>B</td></tr></tbody></table>',
        );
        multipleGroups.editor.execute('table.column.resize', range(0, 0), {
            width: 180,
        });
        expect(multipleGroups.html()).toContain(
            '<colgroup data-group="one"><col width="180px"></colgroup><!--cms-columns--><colgroup data-group="two"><col></colgroup>',
        );
        const spanned = await createTableHarness(
            '<table><colgroup data-group="kept"><!--tracks--><col id="track" span="2" width="120"></colgroup><tbody><tr><th scope="col">A</th><th scope="col">B</th></tr></tbody></table>',
        );
        spanned.editor.execute('table.column.resize', range(0, 1), {
            width: 210,
        });
        expect(spanned.html()).toContain(
            '<colgroup data-group="kept"><!--tracks--><col id="track" width="120"><col width="210px"></colgroup>',
        );
        spanned.editor.execute('table.header.toggle', range(0, 1));
        expect(spanned.html()).toContain('<th scope="col">A</th><td>B</td>');
        await spanned.editor.destroy();
        await multipleGroups.editor.destroy();

        const repair = await createTableHarness(
            '<table><tr><td>A</td><td>B</td></tr></table>',
        );
        const repairService = repair.editor.services.get(
            tableEditorServiceToken,
        );
        expect(repairService.inspectStructure().sections).toMatchObject([
            { kind: 'body', rowCount: 1 },
        ]);
        repair.editor.execute('table.header.firstRow');
        expect(repair.html()).toBe(
            '<table><tbody><tr><th scope="col">A</th><th scope="col">B</th></tr></tbody></table>',
        );
        await repair.editor.destroy();

        const preservation = await createTableHarness(
            '<table><thead><tr><th>H</th></tr></thead><!--cms-marker--><tbody data-body="one"><tr><td>A</td></tr></tbody><tbody data-body="two"><tr><td>B</td></tr></tbody><tfoot></tfoot></table>',
        );
        const preservationService = preservation.editor.services.get(
            tableEditorServiceToken,
        );
        preservationService.reorderBodySection(1, 2);
        preservationService.createSection('body', 1);
        expect(preservation.html()).toContain('<!--cms-marker-->');
        expect(preservation.html()).toContain(
            '<tbody data-body="two"><tr><td>B</td></tr></tbody><tbody></tbody><tbody data-body="one">',
        );
        await preservation.editor.destroy();

        const duplicateSections = await createTableHarness(
            '<table><thead></thead><thead></thead><tbody><tr><td>A</td></tr></tbody><tbody></tbody></table>',
        );
        const duplicateService = duplicateSections.editor.services.get(
            tableEditorServiceToken,
        );
        expect(duplicateService.inspectStructure().diagnostics).toContainEqual(
            expect.objectContaining({
                code: 'empty-duplicate-section',
                repairId: 'remove-empty-duplicate-sections',
                repairable: true,
            }),
        );
        duplicateService.repairStructure('remove-empty-duplicate-sections');
        expect(duplicateSections.html()).toBe(
            '<table><thead></thead><tbody><tr><td>A</td></tr></tbody></table>',
        );
        await duplicateSections.editor.destroy();
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
