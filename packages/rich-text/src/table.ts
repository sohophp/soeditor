import { Plugin } from '@soeditor/core';
import {
    StructuredEditingPlugin,
    structuredEditingRegistryToken,
    visualEditingServiceToken,
    type EditingStructuredBlock,
    type StructuredNodeViewContext,
    type StructuredNodeViewInstance,
    type VisualEditingService,
} from '@soeditor/engine';
import {
    parseHtmlFragment,
    serializeHtmlFragment,
    type HtmlAttribute,
    type HtmlChildNode,
    type HtmlElement,
} from '@soeditor/html';

import { RichTextArgumentError } from './features.js';

const tableType = 'soeditor.table';
const maximumRows = 100;
const maximumColumns = 100;
const maximumCells = 1000;
const maximumClipboardSourceLength = 1_000_000;

/** Bounded dimensions accepted by `table.insert`. */
export interface TableInsertOptions {
    readonly rows: number;
    readonly columns: number;
}

/** Zero-based logical table cell coordinate. */
export interface TableCellPosition {
    readonly row: number;
    readonly column: number;
}

/** Rectangular table selection used by structural table commands. */
export interface TableCellRange {
    readonly anchor: TableCellPosition;
    readonly focus: TableCellPosition;
}

interface ParsedCell {
    readonly cellIndex: number;
    readonly column: number;
    readonly colspan: number;
    readonly element: HtmlElement;
    readonly row: number;
    readonly rowspan: number;
}

interface ParsedRow {
    readonly cells: readonly ParsedCell[];
    readonly element: HtmlElement;
    readonly row: number;
}

interface ParsedTable {
    readonly columns: number;
    readonly grid: readonly (readonly ParsedCell[])[];
    readonly rows: readonly ParsedRow[];
}

type TableCommand = (
    table: HtmlElement,
    parsed: ParsedTable,
    range: TableCellRange,
    args: readonly unknown[],
) => HtmlElement;

/** Structured, atomic table feature built on the public node-view runtime. */
export class TablePlugin extends Plugin {
    static readonly id = 'table';
    static readonly requires = [StructuredEditingPlugin];
    #dispose: (() => void)[] = [];
    #selections = new WeakMap<EditingStructuredBlock, TableCellRange>();

    override init(): void {
        const registry = this.editor.services.get(
            structuredEditingRegistryToken,
        );
        this.#dispose.push(
            registry.registerBlock({
                behavior: 'atomic',
                fromHtml: (node) => ({
                    attributes: node.attributes,
                    children: node.children,
                }),
                id: tableType,
                matches: (node) =>
                    node.namespace === 'html' && node.tagName === 'table',
                toHtml: (block): HtmlElement => ({
                    attributes: block.attributes,
                    children: block.children,
                    namespace: 'html',
                    tagName: 'table',
                    type: 'element',
                }),
                type: tableType,
            }),
        );
        this.#dispose.push(
            registry.registerNodeView(tableType, (context) =>
                createTableNodeView(context, (range) => {
                    this.#selections.set(context.node, range);
                }),
            ),
        );
        this.#registerInsert();
        this.#registerTableCommand(
            'table.row.insertBefore',
            'Insert table row before',
            (table, parsed, range, args) => {
                assertNoArguments('table.row.insertBefore', args);
                return insertRow(
                    table,
                    parsed,
                    normalizedRange(range).top,
                    'table.row.insertBefore',
                );
            },
        );
        this.#registerTableCommand(
            'table.row.insertAfter',
            'Insert table row after',
            (table, parsed, range, args) => {
                assertNoArguments('table.row.insertAfter', args);
                return insertRow(
                    table,
                    parsed,
                    normalizedRange(range).bottom + 1,
                    'table.row.insertAfter',
                );
            },
        );
        this.#registerTableCommand(
            'table.row.remove',
            'Remove table rows',
            (table, parsed, range, args) => {
                assertNoArguments('table.row.remove', args);
                return removeRows(table, parsed, normalizedRange(range));
            },
        );
        this.#registerTableCommand(
            'table.column.insertBefore',
            'Insert table column before',
            (table, parsed, range, args) => {
                assertNoArguments('table.column.insertBefore', args);
                return insertColumn(
                    table,
                    parsed,
                    normalizedRange(range).left,
                    'table.column.insertBefore',
                );
            },
        );
        this.#registerTableCommand(
            'table.column.insertAfter',
            'Insert table column after',
            (table, parsed, range, args) => {
                assertNoArguments('table.column.insertAfter', args);
                return insertColumn(
                    table,
                    parsed,
                    normalizedRange(range).right + 1,
                    'table.column.insertAfter',
                );
            },
        );
        this.#registerTableCommand(
            'table.column.remove',
            'Remove table columns',
            (table, parsed, range, args) => {
                assertNoArguments('table.column.remove', args);
                return removeColumns(table, parsed, normalizedRange(range));
            },
        );
        this.#registerTableCommand(
            'table.header.toggle',
            'Toggle table headers',
            (table, parsed, range, args) => {
                assertNoArguments('table.header.toggle', args);
                return toggleHeaders(table, parsed, normalizedRange(range));
            },
        );
        this.#registerTableCommand(
            'table.cells.merge',
            'Merge table cells',
            (table, parsed, range, args) => {
                assertNoArguments('table.cells.merge', args);
                return mergeCells(table, parsed, normalizedRange(range));
            },
        );
        this.#registerTableCommand(
            'table.cell.split',
            'Split table cell',
            (table, parsed, range, args) => {
                assertNoArguments('table.cell.split', args);
                return splitCell(table, parsed, normalizedRange(range));
            },
        );
        this.#registerTableCommand(
            'table.cells.clear',
            'Clear table cells',
            (table, parsed, range, args) => {
                assertNoArguments('table.cells.clear', args);
                return replaceCellContents(
                    table,
                    parsed,
                    normalizedRange(range),
                    () => [],
                );
            },
        );
        this.#registerTableCommand(
            'table.cell.setText',
            'Set table cell text',
            (table, parsed, range, args) => {
                const value = oneString('table.cell.setText', args);
                const target = normalizedRange(range);
                return replaceCellContents(table, parsed, target, () => [
                    Object.freeze({ type: 'text', value }),
                ]);
            },
        );
        this.#registerTableCommand(
            'table.cells.paste',
            'Paste table cells',
            (table, parsed, range, args) =>
                pasteCells(
                    table,
                    parsed,
                    normalizedRange(range),
                    readCellMatrix(args),
                ),
        );
    }

    override destroy(): void {
        for (const dispose of this.#dispose.reverse()) {
            dispose();
        }
        this.#dispose = [];
        this.#selections = new WeakMap();
    }

    #registerInsert(): void {
        this.editor.commands.register({
            id: 'table.insert',
            label: 'Insert table',
            canExecute: ({ editor }) =>
                editor.services.tryGet(visualEditingServiceToken)?.canEdit() ??
                false,
            execute: ({ editor }, candidate) => {
                const options = readTableOptions(candidate);
                editor.services
                    .get(visualEditingServiceToken)
                    .insertHtml(serializeHtmlFragment(createTable(options)));
            },
        });
    }

    #registerTableCommand(
        id: string,
        label: string,
        transform: TableCommand,
    ): void {
        this.editor.commands.register({
            id,
            label,
            canExecute: ({ editor }) => {
                const service = editor.services.tryGet(
                    visualEditingServiceToken,
                );
                return (
                    service?.canEdit() === true &&
                    service.isStructuredBlockSelected(tableType)
                );
            },
            execute: ({ editor }, ...args) => {
                const service = requireTableService(
                    editor.services.tryGet(visualEditingServiceToken),
                    id,
                );
                const block = service.getSelectedStructuredBlock(tableType);
                const explicitRange = readOptionalRange(args[0]);
                const range =
                    explicitRange ??
                    (block === undefined
                        ? undefined
                        : this.#selections.get(block));
                if (block === undefined || range === undefined) {
                    throw new RichTextArgumentError(
                        id,
                        'requires a selected table cell.',
                    );
                }
                const table = tableElement(block);
                const parsed = parseTable(table);
                assertRange(parsed, range, id);
                const next = transform(
                    table,
                    parsed,
                    range,
                    explicitRange === undefined ? args : args.slice(1),
                );
                service.replaceStructuredBlockContent(tableType, {
                    attributes: next.attributes,
                    children: next.children,
                });
            },
        });
    }
}

function createTableNodeView(
    context: StructuredNodeViewContext,
    selectRange: (range: TableCellRange) => void,
): StructuredNodeViewInstance {
    const ListenerController =
        context.document.defaultView?.AbortController ?? AbortController;
    const listeners = new ListenerController();
    const root = context.document.createElement('div');
    root.className = 'soeditor-table-widget';
    let readonly = context.readonly;
    let range: TableCellRange = {
        anchor: { column: 0, row: 0 },
        focus: { column: 0, row: 0 },
    };
    let parsed: ParsedTable;
    try {
        parsed = parseTable(tableElement(context.node));
    } catch (error: unknown) {
        root.setAttribute('role', 'note');
        root.textContent =
            error instanceof Error
                ? `Unsupported table preserved: ${error.message}`
                : 'Unsupported table preserved.';
        return { element: root };
    }

    const toolbar = context.document.createElement('div');
    toolbar.className = 'soeditor-table-toolbar';
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('aria-label', 'Table actions');
    const actions = [
        ['Add row', 'table.row.insertAfter'],
        ['Add column', 'table.column.insertAfter'],
        ['Toggle header', 'table.header.toggle'],
        ['Merge cells', 'table.cells.merge'],
        ['Split cell', 'table.cell.split'],
    ] as const;
    for (const [label, command] of actions) {
        const button = context.document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.disabled = readonly;
        button.dataset.tableCommand = command;
        button.addEventListener(
            'click',
            () => {
                context.actions.select({ focus: false });
                selectRange(range);
                context.actions.execute(command);
            },
            { signal: listeners.signal },
        );
        toolbar.append(button);
    }

    const table = context.document.createElement('table');
    table.setAttribute('aria-label', 'Editable table');
    const body = context.document.createElement('tbody');
    const buttons = new Map<string, HTMLButtonElement>();
    for (const row of parsed.rows) {
        const tr = context.document.createElement('tr');
        for (const cell of row.cells) {
            const td = context.document.createElement(cell.element.tagName);
            if (cell.colspan > 1) {
                td.setAttribute('colspan', String(cell.colspan));
            }
            if (cell.rowspan > 1) {
                td.setAttribute('rowspan', String(cell.rowspan));
            }
            const button = context.document.createElement('button');
            button.type = 'button';
            button.className = 'soeditor-table-cell';
            button.textContent = plainText(cell.element.children) || '\u00a0';
            button.setAttribute(
                'aria-label',
                `Row ${String(cell.row + 1)}, column ${String(cell.column + 1)}`,
            );
            button.dataset.row = String(cell.row);
            button.dataset.column = String(cell.column);
            button.disabled = readonly;
            button.addEventListener(
                'click',
                (event) => {
                    const position = { column: cell.column, row: cell.row };
                    range = event.shiftKey
                        ? { anchor: range.anchor, focus: position }
                        : { anchor: position, focus: position };
                    context.actions.select({ focus: false });
                    selectRange(range);
                    paintTableSelection(buttons, range);
                },
                { signal: listeners.signal },
            );
            button.addEventListener(
                'keydown',
                (event) => {
                    const movement = tableMovement(event.key);
                    if (movement === undefined) {
                        return;
                    }
                    event.preventDefault();
                    event.stopPropagation();
                    const position = clampPosition(parsed, {
                        column: cell.column + movement.column,
                        row: cell.row + movement.row,
                    });
                    range = event.shiftKey
                        ? { anchor: range.anchor, focus: position }
                        : { anchor: position, focus: position };
                    context.actions.select({ focus: false });
                    selectRange(range);
                    paintTableSelection(buttons, range);
                    buttons.get(positionKey(position))?.focus();
                },
                { signal: listeners.signal },
            );
            buttons.set(
                positionKey({ column: cell.column, row: cell.row }),
                button,
            );
            td.append(button);
            tr.append(td);
        }
        body.append(tr);
    }
    table.append(body);
    root.append(toolbar, table);
    root.addEventListener(
        'copy',
        (event) => {
            if (event.clipboardData === null) {
                return;
            }
            const payload = tableClipboard(parsed, range);
            event.clipboardData.setData('text/html', payload.html);
            event.clipboardData.setData('text/plain', payload.text);
            event.preventDefault();
            event.stopPropagation();
        },
        { signal: listeners.signal },
    );
    root.addEventListener(
        'cut',
        (event) => {
            if (readonly || event.clipboardData === null) {
                return;
            }
            const payload = tableClipboard(parsed, range);
            event.clipboardData.setData('text/html', payload.html);
            event.clipboardData.setData('text/plain', payload.text);
            event.preventDefault();
            event.stopPropagation();
            context.actions.execute('table.cells.clear');
        },
        { signal: listeners.signal },
    );
    root.addEventListener(
        'paste',
        (event) => {
            if (readonly || event.clipboardData === null) {
                return;
            }
            const matrix = clipboardMatrix(
                event.clipboardData.getData('text/html'),
                event.clipboardData.getData('text/plain'),
            );
            if (matrix.length === 0) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            context.actions.execute('table.cells.paste', matrix);
        },
        { signal: listeners.signal },
    );
    paintTableSelection(buttons, range);
    selectRange(range);
    return {
        destroy: () => listeners.abort(),
        element: root,
        update: (state) => {
            readonly = state.readonly;
            for (const button of Array.from(root.querySelectorAll('button'))) {
                button.disabled = readonly;
            }
        },
    };
}

function parseTable(table: HtmlElement): ParsedTable {
    const rowElements = collectRows(table.children);
    if (rowElements.length === 0 || rowElements.length > maximumRows) {
        throw new Error('table requires between 1 and 100 rows');
    }
    const occupancy: ParsedCell[][] = [];
    const rows: ParsedRow[] = [];
    let columns = 0;
    for (let rowIndex = 0; rowIndex < rowElements.length; rowIndex += 1) {
        const row = rowElements[rowIndex];
        if (row === undefined) {
            continue;
        }
        const cellElements = row.children.filter(isCell);
        if (
            (cellElements.length === 0 &&
                (occupancy[rowIndex]?.length ?? 0) === 0) ||
            row.children.some(
                (child) => !isCell(child) && !isWhitespaceText(child),
            )
        ) {
            throw new Error('rows may contain only table cells');
        }
        occupancy[rowIndex] ??= [];
        const cells: ParsedCell[] = [];
        let column = 0;
        for (
            let cellIndex = 0;
            cellIndex < cellElements.length;
            cellIndex += 1
        ) {
            while (occupancy[rowIndex]?.[column] !== undefined) {
                column += 1;
            }
            const element = cellElements[cellIndex];
            if (element === undefined) {
                continue;
            }
            const rowspan = spanValue(element.attributes, 'rowspan');
            const colspan = spanValue(element.attributes, 'colspan');
            if (rowIndex + rowspan > rowElements.length) {
                throw new Error('rowspan exceeds table bounds');
            }
            const cell: ParsedCell = {
                cellIndex,
                column,
                colspan,
                element,
                row: rowIndex,
                rowspan,
            };
            for (let rowOffset = 0; rowOffset < rowspan; rowOffset += 1) {
                const occupiedRow = (occupancy[rowIndex + rowOffset] ??= []);
                for (
                    let columnOffset = 0;
                    columnOffset < colspan;
                    columnOffset += 1
                ) {
                    if (occupiedRow[column + columnOffset] !== undefined) {
                        throw new Error('overlapping row or column spans');
                    }
                    occupiedRow[column + columnOffset] = cell;
                }
            }
            cells.push(cell);
            column += colspan;
        }
        columns = Math.max(columns, occupancy[rowIndex]?.length ?? 0);
        rows.push({ cells, element: row, row: rowIndex });
    }
    if (
        columns === 0 ||
        columns > maximumColumns ||
        rows.length * columns > maximumCells ||
        occupancy.some(
            (row) =>
                row.length !== columns ||
                Array.from(
                    { length: columns },
                    (_, column) => row[column],
                ).some((cell) => cell === undefined),
        )
    ) {
        throw new Error(
            'table grid must be rectangular and at most 1000 cells',
        );
    }
    return { columns, grid: occupancy, rows };
}

function collectRows(
    children: readonly HtmlChildNode[],
): readonly HtmlElement[] {
    const rows: HtmlElement[] = [];
    for (const child of children) {
        if (isElement(child, 'tr')) {
            rows.push(child);
        } else if (
            child.type === 'element' &&
            ['thead', 'tbody', 'tfoot'].includes(child.tagName)
        ) {
            if (
                child.children.some(
                    (candidate) =>
                        !isElement(candidate, 'tr') &&
                        !isWhitespaceText(candidate),
                )
            ) {
                throw new Error('table sections may contain only rows');
            }
            rows.push(
                ...child.children.filter((candidate) =>
                    isElement(candidate, 'tr'),
                ),
            );
        } else if (
            !isWhitespaceText(child) &&
            !(
                child.type === 'element' &&
                ['caption', 'colgroup'].includes(child.tagName)
            )
        ) {
            throw new Error('unsupported table child');
        }
    }
    return rows;
}

function transformRows(
    children: readonly HtmlChildNode[],
    transform: (row: HtmlElement, rowIndex: number) => readonly HtmlElement[],
): readonly HtmlChildNode[] {
    let rowIndex = 0;
    return children.flatMap((child): readonly HtmlChildNode[] => {
        if (isElement(child, 'tr')) {
            return transform(child, rowIndex++);
        }
        if (
            child.type === 'element' &&
            ['thead', 'tbody', 'tfoot'].includes(child.tagName)
        ) {
            return [
                {
                    ...child,
                    children: child.children.flatMap(
                        (candidate): readonly HtmlChildNode[] =>
                            isElement(candidate, 'tr')
                                ? transform(candidate, rowIndex++)
                                : [candidate],
                    ),
                },
            ];
        }
        return [child];
    });
}

function insertRow(
    table: HtmlElement,
    parsed: ParsedTable,
    insertion: number,
    command: string,
): HtmlElement {
    requireUnmerged(parsed, 'table row insertion');
    if (
        parsed.rows.length >= maximumRows ||
        (parsed.rows.length + 1) * parsed.columns > maximumCells
    ) {
        throw new RichTextArgumentError(command, 'would exceed table limits.');
    }
    const reference = parsed.rows[Math.min(insertion, parsed.rows.length - 1)];
    const header =
        reference?.cells.every((cell) => cell.element.tagName === 'th') ??
        false;
    const row = htmlElement(
        'tr',
        [],
        Array.from({ length: parsed.columns }, () =>
            htmlElement(header ? 'th' : 'td', [], []),
        ),
    );
    let inserted = false;
    const children = transformRows(table.children, (candidate, rowIndex) => {
        if (rowIndex === insertion) {
            inserted = true;
            return [row, candidate];
        }
        if (
            rowIndex === parsed.rows.length - 1 &&
            insertion >= parsed.rows.length
        ) {
            inserted = true;
            return [candidate, row];
        }
        return [candidate];
    });
    if (!inserted) {
        throw new Error('Table row insertion target was not found.');
    }
    return { ...table, children };
}

function removeRows(
    table: HtmlElement,
    parsed: ParsedTable,
    range: NormalizedRange,
): HtmlElement {
    requireUnmerged(parsed, 'table row removal');
    if (range.bottom - range.top + 1 >= parsed.rows.length) {
        throw new RichTextArgumentError(
            'table.row.remove',
            'cannot remove every row.',
        );
    }
    return {
        ...table,
        children: transformRows(table.children, (row, rowIndex) =>
            rowIndex >= range.top && rowIndex <= range.bottom ? [] : [row],
        ),
    };
}

function insertColumn(
    table: HtmlElement,
    parsed: ParsedTable,
    insertion: number,
    command: string,
): HtmlElement {
    requireUnmerged(parsed, 'table column insertion');
    requireEditableColumns(table, command);
    if (
        parsed.columns >= maximumColumns ||
        parsed.rows.length * (parsed.columns + 1) > maximumCells
    ) {
        throw new RichTextArgumentError(command, 'would exceed table limits.');
    }
    return mapRowCells(table, (cells) => {
        const reference = cells[Math.min(insertion, cells.length - 1)];
        const cell = htmlElement(
            reference?.tagName === 'th' ? 'th' : 'td',
            [],
            [],
        );
        const next = [...cells];
        next.splice(insertion, 0, cell);
        return next;
    });
}

function removeColumns(
    table: HtmlElement,
    parsed: ParsedTable,
    range: NormalizedRange,
): HtmlElement {
    requireUnmerged(parsed, 'table column removal');
    requireEditableColumns(table, 'table.column.remove');
    if (range.right - range.left + 1 >= parsed.columns) {
        throw new RichTextArgumentError(
            'table.column.remove',
            'cannot remove every column.',
        );
    }
    return mapRowCells(table, (cells) =>
        cells.filter((_, index) => index < range.left || index > range.right),
    );
}

function requireEditableColumns(table: HtmlElement, command: string): void {
    if (table.children.some((child) => isElement(child, 'colgroup'))) {
        throw new RichTextArgumentError(
            command,
            'does not alter tables with colgroup metadata.',
        );
    }
}

function toggleHeaders(
    table: HtmlElement,
    parsed: ParsedTable,
    range: NormalizedRange,
): HtmlElement {
    const selected = selectedCells(parsed, range);
    const makeHeader = selected.some((cell) => cell.element.tagName !== 'th');
    return replaceCells(
        table,
        new Map(
            selected.map((cell) => [
                cell,
                {
                    ...cell.element,
                    tagName: makeHeader ? 'th' : 'td',
                },
            ]),
        ),
    );
}

function mergeCells(
    table: HtmlElement,
    parsed: ParsedTable,
    range: NormalizedRange,
): HtmlElement {
    requireUnmerged(parsed, 'table cell merge');
    if (range.top === range.bottom && range.left === range.right) {
        throw new RichTextArgumentError(
            'table.cells.merge',
            'requires multiple cells.',
        );
    }
    const selected = selectedCells(parsed, range);
    const anchor = parsed.grid[range.top]?.[range.left];
    if (anchor === undefined) {
        throw new Error('Selected table cell was not found.');
    }
    const combined: HtmlChildNode[] = [];
    for (const cell of selected) {
        if (cell.element.children.length > 0) {
            if (combined.length > 0) {
                combined.push(htmlElement('br', [], []));
            }
            combined.push(...cell.element.children);
        }
    }
    const replacement = {
        ...anchor.element,
        attributes: setSpanAttributes(
            anchor.element.attributes,
            range.bottom - range.top + 1,
            range.right - range.left + 1,
        ),
        children: combined,
    };
    const removed = new Set(selected.filter((cell) => cell !== anchor));
    return replaceCells(table, new Map([[anchor, replacement]]), removed);
}

function splitCell(
    table: HtmlElement,
    parsed: ParsedTable,
    range: NormalizedRange,
): HtmlElement {
    if (range.top !== range.bottom || range.left !== range.right) {
        throw new RichTextArgumentError(
            'table.cell.split',
            'requires one cell.',
        );
    }
    const anchor = parsed.grid[range.top]?.[range.left];
    if (
        anchor === undefined ||
        (anchor.rowspan === 1 && anchor.colspan === 1)
    ) {
        throw new RichTextArgumentError(
            'table.cell.split',
            'requires a merged cell.',
        );
    }
    const additions = new Map<
        number,
        { column: number; cell: HtmlElement }[]
    >();
    for (let row = anchor.row; row < anchor.row + anchor.rowspan; row += 1) {
        for (
            let column = anchor.column;
            column < anchor.column + anchor.colspan;
            column += 1
        ) {
            if (row === anchor.row && column === anchor.column) {
                continue;
            }
            const rowAdditions = additions.get(row) ?? [];
            rowAdditions.push({
                cell: htmlElement(
                    anchor.element.tagName,
                    removeSpanAttributes(anchor.element.attributes),
                    [],
                ),
                column,
            });
            additions.set(row, rowAdditions);
        }
    }
    const replacement = {
        ...anchor.element,
        attributes: removeSpanAttributes(anchor.element.attributes),
    };
    return mapParsedRows(table, parsed, (row) => {
        const cells = row.cells.map((cell) =>
            cell === anchor ? replacement : cell.element,
        );
        const positioned = row.cells.map((cell, index) => ({
            cell: cells[index]!,
            column: cell.column,
        }));
        positioned.push(...(additions.get(row.row) ?? []));
        positioned.sort((left, right) => left.column - right.column);
        return positioned.map(({ cell }) => cell);
    });
}

function replaceCellContents(
    table: HtmlElement,
    parsed: ParsedTable,
    range: NormalizedRange,
    content: (
        cell: ParsedCell,
        rowOffset: number,
        columnOffset: number,
    ) => readonly HtmlChildNode[],
): HtmlElement {
    const selected = selectedCells(parsed, range);
    return replaceCells(
        table,
        new Map(
            selected.map((cell) => [
                cell,
                {
                    ...cell.element,
                    children: content(
                        cell,
                        cell.row - range.top,
                        cell.column - range.left,
                    ),
                },
            ]),
        ),
    );
}

function pasteCells(
    table: HtmlElement,
    parsed: ParsedTable,
    range: NormalizedRange,
    matrix: readonly (readonly (readonly HtmlChildNode[])[])[],
): HtmlElement {
    const columns = Math.max(...matrix.map((row) => row.length));
    const target: NormalizedRange = {
        bottom: Math.min(parsed.rows.length - 1, range.top + matrix.length - 1),
        left: range.left,
        right: Math.min(parsed.columns - 1, range.left + columns - 1),
        top: range.top,
    };
    return replaceCellContents(
        table,
        parsed,
        target,
        (_cell, row, column) => matrix[row]?.[column] ?? [],
    );
}

function replaceCells(
    table: HtmlElement,
    replacements: ReadonlyMap<ParsedCell, HtmlElement>,
    removed: ReadonlySet<ParsedCell> = new Set(),
): HtmlElement {
    return {
        ...table,
        children: transformRows(table.children, (row, rowIndex) => {
            const parsedRow = [...replacements.keys(), ...removed].find(
                (cell) => cell.row === rowIndex,
            );
            if (parsedRow === undefined) {
                return [row];
            }
            const cells = row.children.filter(isCell);
            return [
                {
                    ...row,
                    children: cells.flatMap((element, cellIndex) => {
                        const parsedCell = [
                            ...replacements.keys(),
                            ...removed,
                        ].find(
                            (candidate) =>
                                candidate.row === rowIndex &&
                                candidate.cellIndex === cellIndex,
                        );
                        if (parsedCell === undefined) {
                            return [element];
                        }
                        if (removed.has(parsedCell)) {
                            return [];
                        }
                        return [replacements.get(parsedCell) ?? element];
                    }),
                },
            ];
        }),
    };
}

function mapRowCells(
    table: HtmlElement,
    transform: (
        cells: readonly HtmlElement[],
        row: number,
    ) => readonly HtmlElement[],
): HtmlElement {
    return {
        ...table,
        children: transformRows(table.children, (row, rowIndex) => [
            {
                ...row,
                children: transform(row.children.filter(isCell), rowIndex),
            },
        ]),
    };
}

function mapParsedRows(
    table: HtmlElement,
    parsed: ParsedTable,
    transform: (row: ParsedRow) => readonly HtmlElement[],
): HtmlElement {
    return mapRowCells(table, (_cells, rowIndex) => {
        const row = parsed.rows[rowIndex];
        return row === undefined ? [] : transform(row);
    });
}

function tableClipboard(
    parsed: ParsedTable,
    range: TableCellRange,
): { readonly html: string; readonly text: string } {
    const normalized = normalizedRange(range);
    const rows: HtmlElement[] = [];
    const textRows: string[] = [];
    for (let row = normalized.top; row <= normalized.bottom; row += 1) {
        const cells: HtmlElement[] = [];
        const texts: string[] = [];
        for (
            let column = normalized.left;
            column <= normalized.right;
            column += 1
        ) {
            const cell = parsed.grid[row]?.[column];
            if (cell === undefined) {
                continue;
            }
            const intersectionRow = Math.max(cell.row, normalized.top);
            const intersectionColumn = Math.max(cell.column, normalized.left);
            const startsIntersection =
                row === intersectionRow && column === intersectionColumn;
            texts.push(
                startsIntersection ? plainText(cell.element.children) : '',
            );
            if (startsIntersection) {
                cells.push(
                    htmlElement(
                        cell.element.tagName,
                        setSpanAttributes(
                            [],
                            Math.min(
                                cell.row + cell.rowspan - 1,
                                normalized.bottom,
                            ) -
                                intersectionRow +
                                1,
                            Math.min(
                                cell.column + cell.colspan - 1,
                                normalized.right,
                            ) -
                                intersectionColumn +
                                1,
                        ),
                        cell.element.children,
                    ),
                );
            }
        }
        rows.push(htmlElement('tr', [], cells));
        textRows.push(texts.join('\t'));
    }
    return {
        html: serializeHtmlFragment(createTableFragment(rows)),
        text: textRows.join('\n'),
    };
}

function clipboardMatrix(
    html: string,
    text: string,
): readonly (readonly (readonly HtmlChildNode[])[])[] {
    if (html.trim().length > 0 && html.length <= maximumClipboardSourceLength) {
        const table = findElement(
            parseHtmlFragment(html).document.children,
            'table',
        );
        if (table !== undefined) {
            try {
                const parsed = parseTable(table);
                return parsed.grid.map((row, rowIndex) =>
                    row.map((cell, columnIndex) =>
                        cell.row === rowIndex && cell.column === columnIndex
                            ? cell.element.children
                            : [],
                    ),
                );
            } catch {
                // Fall through to inert plain text.
            }
        }
    }
    if (text.length === 0 || text.length > maximumClipboardSourceLength) {
        return [];
    }
    const result: HtmlChildNode[][][] = [];
    let cells = 0;
    for (const row of text.split(/\r?\n/u).slice(0, maximumRows)) {
        const values = row.split('\t').slice(0, maximumColumns);
        if (cells + values.length > maximumCells) {
            break;
        }
        result.push(
            values.map((value) => [
                Object.freeze({ type: 'text' as const, value }),
            ]),
        );
        cells += values.length;
    }
    return result;
}

function createTable(options: TableInsertOptions) {
    const rows = Array.from({ length: options.rows }, () =>
        htmlElement(
            'tr',
            [],
            Array.from({ length: options.columns }, () =>
                htmlElement(
                    'td',
                    [],
                    [Object.freeze({ type: 'text', value: '\u00a0' })],
                ),
            ),
        ),
    );
    return createTableFragment(rows);
}

function createTableFragment(rows: readonly HtmlElement[]) {
    return Object.freeze({
        children: Object.freeze([
            htmlElement('table', [], [htmlElement('tbody', [], rows)]),
        ]),
        type: 'document-fragment' as const,
    });
}

function readTableOptions(candidate: unknown): TableInsertOptions {
    if (
        typeof candidate !== 'object' ||
        candidate === null ||
        Array.isArray(candidate)
    ) {
        throw new RichTextArgumentError(
            'table.insert',
            'requires an options object.',
        );
    }
    const value = candidate as Record<string, unknown>;
    if (Object.keys(value).some((key) => key !== 'rows' && key !== 'columns')) {
        throw new RichTextArgumentError(
            'table.insert',
            'received an unknown option.',
        );
    }
    const rows = positiveInteger(value.rows);
    const columns = positiveInteger(value.columns);
    if (
        rows === undefined ||
        columns === undefined ||
        rows > maximumRows ||
        columns > maximumColumns ||
        rows * columns > maximumCells
    ) {
        throw new RichTextArgumentError(
            'table.insert',
            'supports 1–100 rows, 1–100 columns, and at most 1000 cells.',
        );
    }
    return { columns, rows };
}

function readCellMatrix(
    args: readonly unknown[],
): readonly (readonly (readonly HtmlChildNode[])[])[] {
    if (args.length !== 1 || !Array.isArray(args[0])) {
        throw new RichTextArgumentError(
            'table.cells.paste',
            'requires a cell matrix.',
        );
    }
    const candidate = args[0];
    if (candidate.length === 0 || candidate.length > maximumRows) {
        throw invalidCellMatrix();
    }
    const matrix: HtmlChildNode[][][] = [];
    let cells = 0;
    const limits = { characters: maximumClipboardSourceLength, nodes: 10_000 };
    for (const row of candidate) {
        if (
            !Array.isArray(row) ||
            row.length === 0 ||
            row.length > maximumColumns ||
            cells + row.length > maximumCells
        ) {
            throw invalidCellMatrix();
        }
        const nextRow: HtmlChildNode[][] = [];
        for (const cell of row) {
            if (
                !Array.isArray(cell) ||
                !cell.every((node) => isHtmlChildNode(node, limits, 0))
            ) {
                throw invalidCellMatrix();
            }
            nextRow.push([...cell]);
        }
        matrix.push(nextRow);
        cells += row.length;
    }
    return matrix;
}

function invalidCellMatrix(): RichTextArgumentError {
    return new RichTextArgumentError(
        'table.cells.paste',
        'requires a valid matrix bounded to 100 rows, 100 columns, and 1000 cells.',
    );
}

function isHtmlChildNode(
    value: unknown,
    limits: { characters: number; nodes: number },
    depth: number,
): value is HtmlChildNode {
    limits.nodes -= 1;
    if (
        limits.nodes < 0 ||
        depth > 64 ||
        typeof value !== 'object' ||
        value === null ||
        Array.isArray(value)
    ) {
        return false;
    }
    const node = value as Record<string, unknown>;
    if (node.type === 'text' || node.type === 'comment') {
        if (typeof node.value !== 'string') {
            return false;
        }
        limits.characters -= node.value.length;
        return limits.characters >= 0;
    }
    if (
        node.type !== 'element' ||
        typeof node.tagName !== 'string' ||
        !['html', 'svg', 'mathml'].includes(String(node.namespace)) ||
        !Array.isArray(node.attributes) ||
        !Array.isArray(node.children)
    ) {
        return false;
    }
    return (
        node.attributes.every((attribute) =>
            isHtmlAttribute(attribute, limits),
        ) &&
        node.children.every((child) =>
            isHtmlChildNode(child, limits, depth + 1),
        )
    );
}

function isHtmlAttribute(
    value: unknown,
    limits: { characters: number },
): value is HtmlAttribute {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return false;
    }
    const attribute = value as Record<string, unknown>;
    const name = attribute.name;
    const attributeValue = attribute.value;
    const valid =
        typeof name === 'string' &&
        typeof attributeValue === 'string' &&
        (attribute.namespace === undefined ||
            typeof attribute.namespace === 'string') &&
        (attribute.prefix === undefined ||
            typeof attribute.prefix === 'string');
    if (!valid) {
        return false;
    }
    limits.characters -= name.length + attributeValue.length;
    return limits.characters >= 0;
}

function tableElement(block: EditingStructuredBlock): HtmlElement {
    return {
        attributes: block.attributes,
        children: block.children,
        namespace: 'html',
        tagName: 'table',
        type: 'element',
    };
}

function requireTableService(
    service: VisualEditingService | undefined,
    command: string,
): VisualEditingService {
    if (service === undefined) {
        throw new RichTextArgumentError(command, 'requires the visual editor.');
    }
    return service;
}

interface NormalizedRange {
    readonly bottom: number;
    readonly left: number;
    readonly right: number;
    readonly top: number;
}

function normalizedRange(range: TableCellRange): NormalizedRange {
    return {
        bottom: Math.max(range.anchor.row, range.focus.row),
        left: Math.min(range.anchor.column, range.focus.column),
        right: Math.max(range.anchor.column, range.focus.column),
        top: Math.min(range.anchor.row, range.focus.row),
    };
}

function readOptionalRange(value: unknown): TableCellRange | undefined {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return undefined;
    }
    const record = value as Record<string, unknown>;
    const anchor = readPosition(record.anchor);
    const focus = readPosition(record.focus);
    return anchor === undefined || focus === undefined
        ? undefined
        : { anchor, focus };
}

function readPosition(value: unknown): TableCellPosition | undefined {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return undefined;
    }
    const record = value as Record<string, unknown>;
    return isIndex(record.row) && isIndex(record.column)
        ? { column: record.column, row: record.row }
        : undefined;
}

function assertRange(
    parsed: ParsedTable,
    range: TableCellRange,
    command: string,
): void {
    const normalized = normalizedRange(range);
    if (
        normalized.top < 0 ||
        normalized.left < 0 ||
        normalized.bottom >= parsed.rows.length ||
        normalized.right >= parsed.columns
    ) {
        throw new RichTextArgumentError(
            command,
            'received a cell range outside the table.',
        );
    }
}

function selectedCells(
    parsed: ParsedTable,
    range: NormalizedRange,
): ParsedCell[] {
    const cells = new Set<ParsedCell>();
    for (let row = range.top; row <= range.bottom; row += 1) {
        for (let column = range.left; column <= range.right; column += 1) {
            const cell = parsed.grid[row]?.[column];
            if (cell !== undefined) {
                cells.add(cell);
            }
        }
    }
    return [...cells];
}

function requireUnmerged(parsed: ParsedTable, operation: string): void {
    if (
        parsed.rows.some((row) =>
            row.cells.some((cell) => cell.rowspan !== 1 || cell.colspan !== 1),
        )
    ) {
        throw new RichTextArgumentError(operation, 'requires split cells.');
    }
}

function paintTableSelection(
    buttons: ReadonlyMap<string, HTMLButtonElement>,
    range: TableCellRange,
): void {
    const selected = normalizedRange(range);
    for (const [key, button] of buttons) {
        const [rowValue, columnValue] = key.split(':');
        const row = Number(rowValue);
        const column = Number(columnValue);
        const active =
            row >= selected.top &&
            row <= selected.bottom &&
            column >= selected.left &&
            column <= selected.right;
        button.setAttribute('aria-pressed', String(active));
    }
}

function tableMovement(key: string): TableCellPosition | undefined {
    switch (key) {
        case 'ArrowUp':
            return { column: 0, row: -1 };
        case 'ArrowDown':
            return { column: 0, row: 1 };
        case 'ArrowLeft':
            return { column: -1, row: 0 };
        case 'ArrowRight':
            return { column: 1, row: 0 };
        default:
            return undefined;
    }
}

function clampPosition(
    parsed: ParsedTable,
    position: TableCellPosition,
): TableCellPosition {
    return {
        column: Math.max(0, Math.min(parsed.columns - 1, position.column)),
        row: Math.max(0, Math.min(parsed.rows.length - 1, position.row)),
    };
}

function positionKey(position: TableCellPosition): string {
    return `${String(position.row)}:${String(position.column)}`;
}

function spanValue(attributes: readonly HtmlAttribute[], name: string): number {
    const value = attributes.find(
        (attribute) => attribute.name === name,
    )?.value;
    if (value === undefined) {
        return 1;
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
        throw new Error(`${name} must be an integer from 1 to 100`);
    }
    return parsed;
}

function setSpanAttributes(
    attributes: readonly HtmlAttribute[],
    rows: number,
    columns: number,
): readonly HtmlAttribute[] {
    return [
        ...removeSpanAttributes(attributes),
        ...(rows === 1 ? [] : [{ name: 'rowspan', value: String(rows) }]),
        ...(columns === 1 ? [] : [{ name: 'colspan', value: String(columns) }]),
    ];
}

function removeSpanAttributes(
    attributes: readonly HtmlAttribute[],
): readonly HtmlAttribute[] {
    return attributes.filter(
        (attribute) =>
            attribute.name !== 'rowspan' && attribute.name !== 'colspan',
    );
}

function htmlElement(
    tagName: string,
    attributes: readonly HtmlAttribute[],
    children: readonly HtmlChildNode[],
): HtmlElement {
    return Object.freeze({
        attributes: Object.freeze([...attributes]),
        children: Object.freeze([...children]),
        namespace: 'html',
        tagName,
        type: 'element',
    });
}

function isCell(node: HtmlChildNode): node is HtmlElement {
    return isElement(node, 'td') || isElement(node, 'th');
}

function isElement<TagName extends string>(
    node: HtmlChildNode,
    tagName: TagName,
): node is HtmlElement & { readonly tagName: TagName } {
    return (
        node.type === 'element' &&
        node.namespace === 'html' &&
        node.tagName === tagName
    );
}

function isWhitespaceText(node: HtmlChildNode): boolean {
    return node.type === 'text' && node.value.trim().length === 0;
}

function plainText(nodes: readonly HtmlChildNode[]): string {
    return nodes
        .map((node) =>
            node.type === 'text'
                ? node.value
                : node.type === 'element'
                  ? plainText(node.children)
                  : '',
        )
        .join('');
}

function findElement(
    nodes: readonly HtmlChildNode[],
    tagName: string,
): HtmlElement | undefined {
    for (const node of nodes) {
        if (node.type === 'element') {
            if (node.namespace === 'html' && node.tagName === tagName) {
                return node;
            }
            const nested = findElement(node.children, tagName);
            if (nested !== undefined) {
                return nested;
            }
        }
    }
    return undefined;
}

function positiveInteger(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isInteger(value) && value > 0
        ? value
        : undefined;
}

function isIndex(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function assertNoArguments(command: string, args: readonly unknown[]): void {
    if (args.length !== 0) {
        throw new RichTextArgumentError(command, 'does not accept arguments.');
    }
}

function oneString(command: string, args: readonly unknown[]): string {
    if (args.length !== 1 || typeof args[0] !== 'string') {
        throw new RichTextArgumentError(command, 'requires one string.');
    }
    return args[0];
}
