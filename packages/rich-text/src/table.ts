import { Plugin } from '@soeditor/core';
import {
    PastePipelinePlugin,
    StructuredEditingPlugin,
    SOEDITOR_CLIPBOARD_MIME,
    pastePipelineServiceToken,
    structuredEditingRegistryToken,
    visualEditingServiceToken,
    type EditingStructuredBlock,
    type PastePipelineService,
    type StructuredNodeViewContext,
    type StructuredNodeViewInstance,
    type VisualEditingService,
    type VisualLinkAttributes,
} from '@soeditor/engine';
import {
    parseHtmlFragment,
    serializeHtmlFragment,
    type HtmlAttribute,
    type HtmlChildNode,
    type HtmlElement,
} from '@soeditor/html';

import { RichTextArgumentError } from './features.js';
import {
    nestedEditingBridgeToken,
    type NestedEditingBridge,
} from './nested-editing.js';

const tableType = 'soeditor.table';
const maximumRows = 100;
const maximumColumns = 100;
const maximumCells = 1000;
const maximumClipboardSourceLength = 1_000_000;
const cellEditingCommands = new Set([
    'format.bold',
    'format.inlineCode',
    'format.italic',
    'format.remove',
    'format.strike',
    'format.subscript',
    'format.superscript',
    'format.underline',
    'font.backgroundColor',
    'font.color',
    'font.family',
    'font.highlight',
    'font.size',
    'image.insert',
    'link.auto',
    'link.inspect',
    'link.pick',
    'link.remove',
    'link.set',
    'link.setText',
    'specialCharacter.insert',
]);

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

export type TableAlignment = 'center' | 'left' | 'right';
export type TableSection = 'body' | 'foot' | 'head';

/** Partial table-level CMS properties accepted by `table.properties`. */
export interface TableProperties {
    readonly alignment?: TableAlignment | null;
    readonly ariaLabel?: string | null;
    readonly caption?: string | null;
    readonly responsiveClass?: string | null;
    readonly width?: string | null;
}

/** Partial selected-row properties accepted by `table.row.properties`. */
export interface TableRowProperties {
    readonly ariaLabel?: string | null;
    readonly className?: string | null;
    readonly height?: number | null;
    readonly section?: TableSection;
}

/** Partial selected-cell properties accepted by `table.cell.properties`. */
export interface TableCellProperties {
    readonly ariaLabel?: string | null;
    readonly className?: string | null;
    readonly horizontalAlignment?: TableAlignment | null;
    readonly scope?: 'col' | 'colgroup' | 'row' | 'rowgroup' | null;
    readonly verticalAlignment?:
        'baseline' | 'bottom' | 'middle' | 'top' | null;
}

/** Bounded pixel width accepted by `table.column.resize`. */
export interface TableColumnResizeOptions {
    readonly width: number | null;
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

type TableInspection = (
    table: HtmlElement,
    parsed: ParsedTable,
    range: TableCellRange,
) => Readonly<Record<string, unknown>>;

/** Structured, atomic table feature built on the public node-view runtime. */
export class TablePlugin extends Plugin {
    static readonly id = 'table';
    static readonly requires = [StructuredEditingPlugin, PastePipelinePlugin];
    #dispose: (() => void)[] = [];
    #activeCellEditing: VisualEditingService | undefined;
    readonly #nestedEditingBridge: NestedEditingBridge = Object.freeze({
        getActive: (commandId: string) =>
            commandId === '*' || cellEditingCommands.has(commandId)
                ? this.#activeCellEditing
                : undefined,
    });
    #selections = new WeakMap<EditingStructuredBlock, TableCellRange>();

    override init(): void {
        this.editor.services.register(
            nestedEditingBridgeToken,
            this.#nestedEditingBridge,
        );
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
                createTableNodeView(
                    context,
                    (range) => {
                        this.#selections.set(context.node, range);
                    },
                    this.editor.services.get(pastePipelineServiceToken),
                    (service) => {
                        this.#activeCellEditing = service;
                    },
                    (service) => {
                        if (this.#activeCellEditing === service) {
                            this.#activeCellEditing = undefined;
                        }
                    },
                ),
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
            'table.cell.setHtml',
            'Set rich table cell HTML',
            (table, parsed, range, args) => {
                const value = oneString('table.cell.setHtml', args);
                const fragment = parseHtmlFragment(value).document;
                if (findElement(fragment.children, 'table') !== undefined) {
                    throw new RichTextArgumentError(
                        'table.cell.setHtml',
                        'does not allow nested tables.',
                    );
                }
                return replaceCellContents(
                    table,
                    parsed,
                    normalizedRange(range),
                    () => fragment.children.map((child) => child),
                );
            },
        );
        this.#registerTableCommand(
            'table.cells.commitHtml',
            'Commit edited table cell HTML',
            (table, parsed, _range, args) =>
                commitCellHtmlEntries(table, parsed, readCellHtmlEntries(args)),
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
        this.#registerTableCommand(
            'table.properties',
            'Set table properties',
            (table, _parsed, _range, args) =>
                setTableProperties(table, readTableProperties(args)),
        );
        this.#registerTableCommand(
            'table.row.properties',
            'Set table row properties',
            (table, parsed, range, args) =>
                setRowProperties(
                    table,
                    parsed,
                    normalizedRange(range),
                    readRowProperties(args),
                ),
        );
        this.#registerTableCommand(
            'table.cell.properties',
            'Set table cell properties',
            (table, parsed, range, args) =>
                setCellProperties(
                    table,
                    parsed,
                    normalizedRange(range),
                    readCellProperties(args),
                ),
        );
        this.#registerTableCommand(
            'table.column.resize',
            'Resize table columns',
            (table, parsed, range, args) =>
                resizeColumns(
                    table,
                    parsed,
                    normalizedRange(range),
                    readColumnResize(args),
                ),
        );
        this.#registerTableInspection(
            'table.inspect',
            'Inspect table properties',
            (table) =>
                Object.freeze({
                    alignment:
                        attributeValue(
                            table.attributes,
                            'data-soeditor-align',
                        ) ?? '',
                    ariaLabel:
                        attributeValue(table.attributes, 'aria-label') ?? '',
                    caption:
                        plainText(
                            directElement(table.children, 'caption')
                                ?.children ?? [],
                        ) ?? '',
                    responsiveClass:
                        attributeValue(
                            table.attributes,
                            'data-soeditor-responsive-class',
                        ) ?? '',
                    width:
                        attributeValue(
                            table.attributes,
                            'data-soeditor-width',
                        ) ?? '',
                }),
        );
        this.#registerTableInspection(
            'table.row.inspect',
            'Inspect table row properties',
            (table, parsed, range) => {
                const normalized = normalizedRange(range);
                const row = parsed.rows[normalized.top];
                return Object.freeze({
                    ariaLabel:
                        attributeValue(
                            row?.element.attributes ?? [],
                            'aria-label',
                        ) ?? '',
                    className:
                        attributeValue(
                            row?.element.attributes ?? [],
                            'data-soeditor-class',
                        ) ?? '',
                    height:
                        attributeValue(
                            row?.element.attributes ?? [],
                            'data-soeditor-height',
                        ) ?? '',
                    section:
                        tableRowSections(table.children)[normalized.top] ??
                        'body',
                });
            },
        );
        this.#registerTableInspection(
            'table.cell.inspect',
            'Inspect table cell properties',
            (_table, parsed, range) => {
                const normalized = normalizedRange(range);
                const cell = parsed.grid[normalized.top]?.[normalized.left];
                const attributes = cell?.element.attributes ?? [];
                return Object.freeze({
                    ariaLabel: attributeValue(attributes, 'aria-label') ?? '',
                    className:
                        attributeValue(attributes, 'data-soeditor-class') ?? '',
                    horizontalAlignment:
                        attributeValue(attributes, 'data-soeditor-align') ?? '',
                    scope: attributeValue(attributes, 'scope') ?? '',
                    verticalAlignment:
                        attributeValue(
                            attributes,
                            'data-soeditor-vertical-align',
                        ) ?? '',
                    contentHtml:
                        cell === undefined
                            ? ''
                            : serializeHtmlFragment({
                                  children: cell.element.children,
                                  type: 'document-fragment',
                              }),
                });
            },
        );
        this.editor.commands.register({
            id: 'table.remove',
            label: 'Remove table',
            canExecute: ({ editor }) => {
                const service = editor.services.tryGet(
                    visualEditingServiceToken,
                );
                return (
                    service?.canEdit() === true &&
                    service.isStructuredBlockSelected(tableType) &&
                    service.removeSelectedStructuredBlock !== undefined
                );
            },
            execute: ({ editor }, ...args) => {
                assertNoArguments('table.remove', args);
                const service = requireTableService(
                    editor.services.tryGet(visualEditingServiceToken),
                    'table.remove',
                );
                if (service.removeSelectedStructuredBlock === undefined) {
                    throw new RichTextArgumentError(
                        'table.remove',
                        'requires structured-block removal support.',
                    );
                }
                service.removeSelectedStructuredBlock(tableType);
            },
        });
    }

    override destroy(): void {
        for (const dispose of this.#dispose.reverse()) {
            dispose();
        }
        this.#dispose = [];
        this.#activeCellEditing = undefined;
        if (
            this.editor.services.tryGet(nestedEditingBridgeToken) ===
            this.#nestedEditingBridge
        ) {
            this.editor.services.unregister(nestedEditingBridgeToken);
        }
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
                    readServiceTableRange(service) ??
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
                const nextBlock = service.getSelectedStructuredBlock(tableType);
                if (nextBlock !== undefined) {
                    this.#selections.set(nextBlock, range);
                }
            },
        });
    }

    #registerTableInspection(
        id: string,
        label: string,
        inspect: TableInspection,
    ): void {
        this.editor.commands.register({
            id,
            label,
            canExecute: ({ editor }) => {
                const service = editor.services.tryGet(
                    visualEditingServiceToken,
                );
                return service?.isStructuredBlockSelected(tableType) === true;
            },
            execute: ({ editor }, ...args) => {
                assertNoArguments(id, args);
                const service = requireTableService(
                    editor.services.tryGet(visualEditingServiceToken),
                    id,
                );
                const block = service.getSelectedStructuredBlock(tableType);
                const range =
                    readServiceTableRange(service) ??
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
                return inspect(table, parseTable(table), range);
            },
        });
    }
}

function readServiceTableRange(
    service: VisualEditingService,
): TableCellRange | undefined {
    const value = service.getStructuredSelection?.(tableType);
    return value === undefined ? undefined : readOptionalRange(value);
}

function createTableNodeView(
    context: StructuredNodeViewContext,
    selectRange: (range: TableCellRange) => void,
    pastePipeline: PastePipelineService,
    activateCellEditing: (service: VisualEditingService) => void,
    deactivateCellEditing: (service: VisualEditingService) => void,
): StructuredNodeViewInstance {
    const ListenerController =
        context.document.defaultView?.AbortController ?? AbortController;
    const listeners = new ListenerController();
    const root = context.document.createElement('div');
    root.className = 'soeditor-table-widget';
    const nativeWysiwyg = context.projectionId === 'wysiwyg';
    if (nativeWysiwyg) {
        root.classList.add('soeditor-table-widget--wysiwyg');
    }
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

    const table = context.document.createElement('table');
    if (nativeWysiwyg) table.contentEditable = String(!readonly);
    table.setAttribute(
        'aria-label',
        attributeValue(context.node.attributes, 'aria-label') ??
            'Editable table',
    );
    const tableWidth = attributeValue(
        context.node.attributes,
        'data-soeditor-width',
    );
    if (tableWidth !== undefined) table.style.width = tableWidth;
    const tableAlignment = attributeValue(
        context.node.attributes,
        'data-soeditor-align',
    );
    if (tableAlignment === 'center') {
        table.style.marginInline = 'auto';
    } else if (tableAlignment === 'right') {
        table.style.marginInlineStart = 'auto';
    } else if (tableAlignment === 'left') {
        table.style.marginInlineEnd = 'auto';
    }
    const responsiveClass = attributeValue(
        context.node.attributes,
        'data-soeditor-responsive-class',
    );
    if (responsiveClass !== undefined) {
        table.className = responsiveClass;
    }
    const caption = directElement(context.node.children, 'caption');
    if (caption !== undefined) {
        const projectedCaption = context.document.createElement('caption');
        projectedCaption.textContent = plainText(caption.children);
        table.append(projectedCaption);
    }
    const widths = projectedColumnWidths(
        tableElement(context.node),
        parsed.columns,
    );
    if (widths.some((width) => width !== undefined)) {
        const colgroup = context.document.createElement('colgroup');
        for (const width of widths) {
            const column = context.document.createElement('col');
            if (width !== undefined) column.style.width = `${String(width)}px`;
            colgroup.append(column);
        }
        table.append(colgroup);
    }
    const rowSections = tableRowSections(context.node.children);
    let projectedSection: HTMLTableSectionElement | undefined;
    let projectedSectionName: TableSection | undefined;
    const buttons = new Map<string, HTMLElement>();
    const pendingBlurTimers = new Set<number>();
    const cellEditingServices = new Set<VisualEditingService>();
    const dirtyCells = new Map<string, HTMLElement>();
    const editingFinishers = new Map<HTMLElement, () => void>();
    const restoreNativeRange = (nativeRange: Range | undefined): void => {
        if (
            nativeRange === undefined ||
            !nativeRange.startContainer.isConnected ||
            !nativeRange.endContainer.isConnected ||
            !rangeIsInside(nativeRange, root)
        ) {
            return;
        }
        const selection = context.document.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(nativeRange);
    };
    const activateSelection = (): void => {
        const selection = context.document.getSelection();
        const liveRange =
            selection !== null &&
            selection.rangeCount > 0 &&
            rangeIsInside(selection.getRangeAt(0), root)
                ? selection.getRangeAt(0).cloneRange()
                : undefined;
        context.actions.select({ focus: false });
        selectRange(range);
        restoreNativeRange(liveRange);
    };
    const commitDirtyCells = (): void => {
        if (readonly || dirtyCells.size === 0) return;
        const entries = Array.from(dirtyCells.values(), (cell) => ({
            column: Number(cell.dataset.column),
            html: cell.innerHTML,
            row: Number(cell.dataset.row),
        }));
        dirtyCells.clear();
        context.actions.select({ focus: false });
        selectRange(range);
        context.actions.execute('table.cells.commitHtml', entries);
    };
    const finishTableEditing = (): void => {
        for (const finish of [...editingFinishers.values()]) finish();
        commitDirtyCells();
    };
    for (const row of parsed.rows) {
        const rowSection = rowSections[row.row] ?? 'body';
        if (rowSection !== projectedSectionName) {
            projectedSectionName = rowSection;
            projectedSection = context.document.createElement(
                sectionTag(rowSection),
            );
            table.append(projectedSection);
        }
        const tr = context.document.createElement('tr');
        applyProjectedProperties(tr, row.element.attributes, 'row');
        for (const cell of row.cells) {
            const td = context.document.createElement(cell.element.tagName);
            applyProjectedProperties(td, cell.element.attributes, 'cell');
            if (cell.colspan > 1) {
                td.setAttribute('colspan', String(cell.colspan));
            }
            if (cell.rowspan > 1) {
                td.setAttribute('rowspan', String(cell.rowspan));
            }
            const button = nativeWysiwyg
                ? td
                : context.document.createElement('div');
            button.classList.add('soeditor-table-cell');
            button.tabIndex = readonly ? -1 : 0;
            if (!nativeWysiwyg) {
                button.setAttribute('role', readonly ? 'button' : 'textbox');
                button.contentEditable = String(!readonly);
                if (!readonly) button.setAttribute('aria-multiline', 'true');
            }
            appendSafeCellContent(
                button,
                cell.element.children,
                context.document,
            );
            if (!button.hasChildNodes()) button.textContent = '\u00a0';
            button.dataset.cellHtml = serializeHtmlFragment({
                children: cell.element.children,
                type: 'document-fragment',
            });
            button.setAttribute(
                'aria-label',
                `Row ${String(cell.row + 1)}, column ${String(cell.column + 1)}`,
            );
            button.dataset.row = String(cell.row);
            button.dataset.column = String(cell.column);
            const selectThisCell = (): void => {
                range = {
                    anchor: { column: cell.column, row: cell.row },
                    focus: { column: cell.column, row: cell.row },
                };
                selectRange(range);
                paintTableSelection(buttons, range);
            };
            let editing = false;
            let blurTimer: number | undefined;
            let retainedRange: Range | undefined;
            const key = positionKey({ column: cell.column, row: cell.row });
            const cellEditingService = createCellEditingService({
                button,
                document: context.document,
                getRange: () => retainedRange?.cloneRange(),
                markChanged: () => {
                    dirtyCells.set(key, button);
                    retainedRange = readCellSelectionRange(
                        context.document,
                        button,
                    );
                },
                setRange: (next) => {
                    retainedRange = next.cloneRange();
                },
            });
            const startEditing = (
                initialRange?: Range,
                nativePointerPlacement = false,
            ): void => {
                if (readonly || editing) return;
                editing = true;
                if (!nativeWysiwyg) {
                    button.setAttribute('role', 'textbox');
                    button.setAttribute('aria-multiline', 'true');
                }
                button.classList.add('is-editing');
                setStructuredDragEnabled(button, false);
                if (!nativePointerPlacement) {
                    button.focus({ preventScroll: true });
                    const selection = context.document.getSelection();
                    if (
                        initialRange !== undefined &&
                        rangeIsInside(initialRange, button)
                    ) {
                        selection?.removeAllRanges();
                        selection?.addRange(initialRange);
                    } else {
                        placeCaretAtEnd(context.document, button);
                    }
                }
                retainedRange = readCellSelectionRange(
                    context.document,
                    button,
                );
                activateCellEditing(cellEditingService);
                editingFinishers.set(button, finishEditing);
                announceTableEditingStart(context.document, button);
            };
            const finishEditing = (): void => {
                if (!editing) return;
                editing = false;
                editingFinishers.delete(button);
                deactivateCellEditing(cellEditingService);
                announceTableEditingEnd(context.document, button);
                button.classList.remove('is-editing');
                setStructuredDragEnabled(
                    button,
                    !readonly && editingFinishers.size === 0,
                );
                if (blurTimer !== undefined) {
                    context.document.defaultView?.clearTimeout(blurTimer);
                    pendingBlurTimers.delete(blurTimer);
                    blurTimer = undefined;
                }
            };
            cellEditingServices.add(cellEditingService);
            button.addEventListener(
                'pointerdown',
                (event) => {
                    if (readonly || event.button !== 0) return;
                    selectThisCell();
                    // Make the cell editable before the browser performs the
                    // default pointer action, then leave focus, caret hit
                    // testing, and drag selection entirely to the browser.
                    // Reconstructing a Range here competes with that default
                    // action and can incorrectly collapse the caret at the
                    // end of short cell text.
                    startEditing(undefined, true);
                    activateCellEditing(cellEditingService);
                },
                { signal: listeners.signal },
            );
            button.addEventListener(
                'pointerup',
                () => {
                    if (!editing) return;
                    activateSelection();
                    retainedRange = readCellSelectionRange(
                        context.document,
                        button,
                    );
                    announceTableSelection(
                        context.document,
                        button,
                        activateSelection,
                    );
                },
                { signal: listeners.signal },
            );
            button.addEventListener(
                'click',
                (event) => {
                    if (editing) return;
                    const position = { column: cell.column, row: cell.row };
                    range = event.shiftKey
                        ? { anchor: range.anchor, focus: position }
                        : { anchor: position, focus: position };
                    activateSelection();
                    paintTableSelection(buttons, range);
                    announceTableSelection(
                        context.document,
                        button,
                        activateSelection,
                    );
                },
                { signal: listeners.signal },
            );
            button.addEventListener(
                'input',
                () => {
                    dirtyCells.set(key, button);
                    retainedRange = readCellSelectionRange(
                        context.document,
                        button,
                    );
                },
                { signal: listeners.signal },
            );
            button.addEventListener(
                'focus',
                () => {
                    if (blurTimer !== undefined) {
                        context.document.defaultView?.clearTimeout(blurTimer);
                        pendingBlurTimers.delete(blurTimer);
                        blurTimer = undefined;
                    }
                    if (!readonly) {
                        selectThisCell();
                        if (!editing) {
                            startEditing(
                                readCellSelectionRange(
                                    context.document,
                                    button,
                                ),
                            );
                        }
                        announceTableSelection(
                            context.document,
                            button,
                            activateSelection,
                        );
                    }
                },
                { signal: listeners.signal },
            );
            button.addEventListener(
                'blur',
                (event) => {
                    const next = event.relatedTarget;
                    const ElementConstructor =
                        context.document.defaultView?.Element;
                    if (
                        ElementConstructor !== undefined &&
                        next instanceof ElementConstructor &&
                        isEditorUiInteractionTarget(next)
                    ) {
                        return;
                    }
                    blurTimer = context.document.defaultView?.setTimeout(() => {
                        if (blurTimer !== undefined) {
                            pendingBlurTimers.delete(blurTimer);
                        }
                        blurTimer = undefined;
                        const active = context.document.activeElement;
                        if (
                            ElementConstructor !== undefined &&
                            active instanceof ElementConstructor &&
                            isEditorUiInteractionTarget(active)
                        ) {
                            return;
                        }
                        if (
                            ElementConstructor !== undefined &&
                            active instanceof ElementConstructor &&
                            root.contains(active)
                        ) {
                            finishEditing();
                            return;
                        }
                        finishTableEditing();
                    }, 100);
                    if (blurTimer !== undefined) {
                        pendingBlurTimers.add(blurTimer);
                    }
                },
                { signal: listeners.signal },
            );
            button.addEventListener(
                'keydown',
                (event) => {
                    if (editing && event.altKey && event.shiftKey) {
                        const movement = tableMovement(event.key);
                        if (movement === undefined) return;
                        event.preventDefault();
                        event.stopPropagation();
                        finishEditing();
                        range = {
                            anchor: range.anchor,
                            focus: clampPosition(parsed, {
                                column: range.focus.column + movement.column,
                                row: range.focus.row + movement.row,
                            }),
                        };
                        activateSelection();
                        paintTableSelection(buttons, range);
                        announceTableSelection(
                            context.document,
                            button,
                            activateSelection,
                        );
                        return;
                    }
                    if (editing) return;
                    if (event.key === 'Enter' || event.key === 'F2') {
                        event.preventDefault();
                        event.stopPropagation();
                        if (event.altKey) {
                            announceTableEdit(
                                context.document,
                                button,
                                activateSelection,
                            );
                        } else {
                            startEditing();
                        }
                        return;
                    }
                    const movement = tableMovement(event.key);
                    const origin = event.shiftKey
                        ? range.focus
                        : { column: cell.column, row: cell.row };
                    const position =
                        event.key === 'Tab'
                            ? nextTableTabPosition(
                                  parsed,
                                  buttons,
                                  { column: cell.column, row: cell.row },
                                  event.shiftKey,
                              )
                            : movement === undefined
                              ? undefined
                              : clampPosition(parsed, {
                                    column: origin.column + movement.column,
                                    row: origin.row + movement.row,
                                });
                    if (position === undefined) return;
                    event.preventDefault();
                    event.stopPropagation();
                    range = event.shiftKey
                        ? { anchor: range.anchor, focus: position }
                        : { anchor: position, focus: position };
                    activateSelection();
                    paintTableSelection(buttons, range);
                    const next = buttons.get(positionKey(position));
                    if (!event.shiftKey) next?.focus();
                    if (next !== undefined) {
                        announceTableSelection(
                            context.document,
                            next,
                            activateSelection,
                        );
                    }
                },
                { signal: listeners.signal },
            );
            buttons.set(
                positionKey({ column: cell.column, row: cell.row }),
                button,
            );
            if (!nativeWysiwyg) td.append(button);
            tr.append(td);
        }
        projectedSection?.append(tr);
    }
    root.append(table);
    if (nativeWysiwyg) {
        root.addEventListener(
            'input',
            (event) => {
                const selection = context.document.getSelection();
                const anchor = selection?.anchorNode;
                const ElementConstructor =
                    context.document.defaultView?.Element;
                const eventTarget = event.target;
                const origin =
                    anchor?.nodeType === 1
                        ? anchor
                        : (anchor?.parentElement ?? eventTarget);
                const cell =
                    ElementConstructor !== undefined &&
                    origin instanceof ElementConstructor
                        ? origin.closest<HTMLElement>('.soeditor-table-cell')
                        : null;
                if (cell === null || !table.contains(cell)) return;
                dirtyCells.set(
                    positionKey({
                        column: Number(cell.dataset.column),
                        row: Number(cell.dataset.row),
                    }),
                    cell,
                );
            },
            { signal: listeners.signal },
        );
    }
    root.addEventListener('soeditor:table-commit-request', finishTableEditing, {
        signal: listeners.signal,
    });
    context.document.addEventListener(
        'pointerdown',
        (event) => {
            const target = event.target;
            const NodeConstructor = context.document.defaultView?.Node;
            const ElementConstructor = context.document.defaultView?.Element;
            if (
                NodeConstructor === undefined ||
                !(target instanceof NodeConstructor) ||
                root.contains(target)
            ) {
                return;
            }
            if (
                ElementConstructor !== undefined &&
                target instanceof ElementConstructor &&
                isEditorUiInteractionTarget(target)
            ) {
                return;
            }
            finishTableEditing();
        },
        { capture: true, signal: listeners.signal },
    );
    root.addEventListener(
        'copy',
        (event) => {
            if (editingCellFromTarget(event.target) !== undefined) return;
            if (event.clipboardData === null) {
                return;
            }
            const payload = tableClipboard(parsed, range);
            event.clipboardData.setData('text/html', payload.html);
            event.clipboardData.setData('text/plain', payload.text);
            event.clipboardData.setData(
                SOEDITOR_CLIPBOARD_MIME,
                `soeditor/1\n${payload.html}`,
            );
            event.preventDefault();
            event.stopPropagation();
        },
        { signal: listeners.signal },
    );
    root.addEventListener(
        'cut',
        (event) => {
            if (editingCellFromTarget(event.target) !== undefined) return;
            if (readonly || event.clipboardData === null) {
                return;
            }
            const payload = tableClipboard(parsed, range);
            event.clipboardData.setData('text/html', payload.html);
            event.clipboardData.setData('text/plain', payload.text);
            event.clipboardData.setData(
                SOEDITOR_CLIPBOARD_MIME,
                `soeditor/1\n${payload.html}`,
            );
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
            const editingCell = editingCellFromTarget(event.target);
            if (
                editingCell !== undefined &&
                !requiresControlledCellPaste(event.clipboardData)
            ) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            const transfer = event.clipboardData;
            const internalValue = transfer.getData(SOEDITOR_CLIPBOARD_MIME);
            let processed;
            try {
                processed = pastePipeline.process({
                    files: Array.from(transfer.files).map((file) => ({
                        data: file,
                        name: file.name,
                        size: file.size,
                        type: file.type,
                    })),
                    html: transfer.getData('text/html'),
                    ...(internalValue.startsWith('soeditor/1\n')
                        ? { internalHtml: internalValue.slice(11) }
                        : {}),
                    source: 'paste',
                    text: transfer.getData('text/plain'),
                    types: Array.from(transfer.types),
                });
            } catch {
                return;
            }
            if (processed.consumed) return;
            const matrix = clipboardMatrix(
                processed.html,
                processed.text,
                processed.classification === 'internal',
            );
            if (matrix.length === 0) {
                announceEditingFeedback(
                    context.document,
                    root,
                    'The clipboard does not contain content that can be inserted into this table.',
                );
                return;
            }
            const inlineContent = matrix[0]?.[0];
            if (
                editingCell !== undefined &&
                inlineContent !== undefined &&
                matrix.length === 1 &&
                matrix[0]?.length === 1
            ) {
                insertCellNodesAtSelection(
                    context.document,
                    editingCell,
                    inlineContent,
                );
                const EventConstructor =
                    context.document.defaultView?.Event ?? Event;
                editingCell.dispatchEvent(
                    new EventConstructor('input', { bubbles: true }),
                );
                return;
            }
            if (editingCell !== undefined) finishTableEditing();
            context.actions.execute('table.cells.paste', matrix);
        },
        { signal: listeners.signal },
    );
    return {
        destroy: () => {
            listeners.abort();
            for (const timer of pendingBlurTimers) {
                context.document.defaultView?.clearTimeout(timer);
            }
            pendingBlurTimers.clear();
            for (const service of cellEditingServices) {
                deactivateCellEditing(service);
            }
            cellEditingServices.clear();
        },
        element: root,
        update: (state) => {
            readonly = state.readonly;
            if (nativeWysiwyg) {
                const editable = String(!readonly);
                if (table.contentEditable !== editable) {
                    table.contentEditable = editable;
                }
            }
            for (const control of Array.from(
                root.querySelectorAll<HTMLButtonElement | HTMLInputElement>(
                    'button, input',
                ),
            )) {
                control.disabled = readonly;
            }
            for (const cell of Array.from(
                root.querySelectorAll<HTMLElement>('.soeditor-table-cell'),
            )) {
                if (readonly) {
                    if (cell.isContentEditable) cell.blur();
                    if (!nativeWysiwyg) {
                        cell.contentEditable = 'false';
                        cell.setAttribute('role', 'button');
                        cell.removeAttribute('aria-multiline');
                    }
                    cell.classList.remove('is-editing');
                } else if (!nativeWysiwyg) {
                    // Reassigning contentEditable on an already-editable host
                    // can collapse a native caret when the structured block
                    // refreshes during pointer handling.
                    if (!cell.isContentEditable) {
                        cell.contentEditable = 'true';
                    }
                    if (cell.getAttribute('role') !== 'textbox') {
                        cell.setAttribute('role', 'textbox');
                    }
                    if (cell.getAttribute('aria-multiline') !== 'true') {
                        cell.setAttribute('aria-multiline', 'true');
                    }
                }
                cell.tabIndex = readonly ? -1 : 0;
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
    const widths = readColumnWidths(table, parsed.columns, command);
    if (
        parsed.columns >= maximumColumns ||
        parsed.rows.length * (parsed.columns + 1) > maximumCells
    ) {
        throw new RichTextArgumentError(command, 'would exceed table limits.');
    }
    const next = mapRowCells(table, (cells) => {
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
    const nextWidths = [...widths];
    nextWidths.splice(insertion, 0, undefined);
    return setColumnWidths(next, nextWidths);
}

function removeColumns(
    table: HtmlElement,
    parsed: ParsedTable,
    range: NormalizedRange,
): HtmlElement {
    requireUnmerged(parsed, 'table column removal');
    const widths = readColumnWidths(
        table,
        parsed.columns,
        'table.column.remove',
    );
    if (range.right - range.left + 1 >= parsed.columns) {
        throw new RichTextArgumentError(
            'table.column.remove',
            'cannot remove every column.',
        );
    }
    const next = mapRowCells(table, (cells) =>
        cells.filter((_, index) => index < range.left || index > range.right),
    );
    const nextWidths = widths.filter(
        (_, index) => index < range.left || index > range.right,
    );
    return setColumnWidths(next, nextWidths);
}

function readColumnWidths(
    table: HtmlElement,
    columns: number,
    command = 'table.column.resize',
): readonly (number | undefined)[] {
    const groups = table.children.filter((child) =>
        isElement(child, 'colgroup'),
    );
    if (groups.length === 0) {
        return Array.from({ length: columns }, () => undefined);
    }
    const group = groups[0];
    if (
        groups.length !== 1 ||
        group === undefined ||
        attributeValue(group.attributes, 'data-soeditor-columns') !== 'true' ||
        group.children.some(
            (child) => !isElement(child, 'col') && !isWhitespaceText(child),
        )
    ) {
        throw new RichTextArgumentError(
            command,
            'does not alter tables with colgroup metadata unless SoEditor owns it.',
        );
    }
    const columnElements = group.children.filter((child) =>
        isElement(child, 'col'),
    );
    if (columnElements.length !== columns) {
        throw new RichTextArgumentError(
            command,
            'requires owned column metadata to match the table grid.',
        );
    }
    return columnElements.map((column) => {
        const value = attributeValue(column.attributes, 'data-soeditor-width');
        if (value === undefined) return undefined;
        const width = Number(value);
        if (!Number.isInteger(width) || width < 40 || width > 1200) {
            throw new RichTextArgumentError(
                command,
                'found invalid owned column width metadata.',
            );
        }
        return width;
    });
}

function projectedColumnWidths(
    table: HtmlElement,
    columns: number,
): readonly (number | undefined)[] {
    try {
        return readColumnWidths(table, columns);
    } catch {
        return Array.from({ length: columns }, () => undefined);
    }
}

function setColumnWidths(
    table: HtmlElement,
    widths: readonly (number | undefined)[],
): HtmlElement {
    const children = table.children.filter(
        (child) => !isElement(child, 'colgroup'),
    );
    if (widths.every((width) => width === undefined)) {
        return { ...table, children };
    }
    const group = htmlElement(
        'colgroup',
        [{ name: 'data-soeditor-columns', value: 'true' }],
        widths.map((width) =>
            htmlElement(
                'col',
                width === undefined
                    ? []
                    : [
                          {
                              name: 'data-soeditor-width',
                              value: String(width),
                          },
                      ],
                [],
            ),
        ),
    );
    const insertion = children.findIndex(
        (child) => !isElement(child, 'caption'),
    );
    const next = [...children];
    next.splice(insertion < 0 ? next.length : insertion, 0, group);
    return { ...table, children: next };
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

interface CellHtmlEntry {
    readonly column: number;
    readonly html: string;
    readonly row: number;
}

function commitCellHtmlEntries(
    table: HtmlElement,
    parsed: ParsedTable,
    entries: readonly CellHtmlEntry[],
): HtmlElement {
    const replacements = new Map<ParsedCell, HtmlElement>();
    for (const entry of entries) {
        const cell = parsed.grid[entry.row]?.[entry.column];
        if (cell === undefined) {
            throw new RichTextArgumentError(
                'table.cells.commitHtml',
                'contains a cell outside the table.',
            );
        }
        const fragment = parseHtmlFragment(entry.html).document;
        if (findElement(fragment.children, 'table') !== undefined) {
            throw new RichTextArgumentError(
                'table.cells.commitHtml',
                'does not allow nested tables.',
            );
        }
        replacements.set(cell, {
            ...cell.element,
            children: fragment.children.map((child) => child),
        });
    }
    return replaceCells(table, replacements);
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

function setTableProperties(
    table: HtmlElement,
    properties: TableProperties,
): HtmlElement {
    let attributes = table.attributes;
    if (properties.alignment !== undefined) {
        attributes = updateAttribute(
            attributes,
            'data-soeditor-align',
            properties.alignment,
        );
    }
    if (properties.width !== undefined) {
        attributes = updateAttribute(
            attributes,
            'data-soeditor-width',
            properties.width,
        );
    }
    if (properties.responsiveClass !== undefined) {
        attributes = updateAttribute(
            attributes,
            'data-soeditor-responsive-class',
            properties.responsiveClass,
        );
    }
    if (properties.ariaLabel !== undefined) {
        attributes = updateAttribute(
            attributes,
            'aria-label',
            properties.ariaLabel,
        );
    }
    let children = table.children;
    if (properties.caption !== undefined) {
        const existing = directElement(children, 'caption');
        children = children.filter((child) => !isElement(child, 'caption'));
        if (properties.caption !== null) {
            const caption = htmlElement('caption', existing?.attributes ?? [], [
                Object.freeze({ type: 'text', value: properties.caption }),
            ]);
            children = [caption, ...children];
        }
    }
    return { ...table, attributes, children };
}

function setRowProperties(
    table: HtmlElement,
    parsed: ParsedTable,
    range: NormalizedRange,
    properties: TableRowProperties,
): HtmlElement {
    let next: HtmlElement = {
        ...table,
        children: transformRows(table.children, (row, rowIndex) => [
            rowIndex < range.top || rowIndex > range.bottom
                ? row
                : {
                      ...row,
                      attributes: updateProperties(row.attributes, [
                          ['aria-label', properties.ariaLabel],
                          ['data-soeditor-class', properties.className],
                          [
                              'data-soeditor-height',
                              properties.height === undefined
                                  ? undefined
                                  : properties.height === null
                                    ? null
                                    : String(properties.height),
                          ],
                      ]),
                  },
        ]),
    };
    if (properties.section !== undefined) {
        next = setRowSection(next, parsed, range, properties.section);
    }
    return next;
}

function setCellProperties(
    table: HtmlElement,
    parsed: ParsedTable,
    range: NormalizedRange,
    properties: TableCellProperties,
): HtmlElement {
    const selected = selectedCells(parsed, range);
    if (
        properties.scope !== undefined &&
        properties.scope !== null &&
        selected.some((cell) => cell.element.tagName !== 'th')
    ) {
        throw new RichTextArgumentError(
            'table.cell.properties',
            'applies scope only to header cells.',
        );
    }
    return replaceCells(
        table,
        new Map(
            selected.map((cell) => [
                cell,
                {
                    ...cell.element,
                    attributes: updateProperties(cell.element.attributes, [
                        ['aria-label', properties.ariaLabel],
                        ['data-soeditor-class', properties.className],
                        ['data-soeditor-align', properties.horizontalAlignment],
                        [
                            'data-soeditor-vertical-align',
                            properties.verticalAlignment,
                        ],
                        ['scope', properties.scope],
                    ]),
                },
            ]),
        ),
    );
}

function resizeColumns(
    table: HtmlElement,
    parsed: ParsedTable,
    range: NormalizedRange,
    options: TableColumnResizeOptions,
): HtmlElement {
    const widths = [
        ...readColumnWidths(table, parsed.columns, 'table.column.resize'),
    ];
    for (let column = range.left; column <= range.right; column += 1) {
        widths[column] = options.width ?? undefined;
    }
    return setColumnWidths(table, widths);
}

function setRowSection(
    table: HtmlElement,
    parsed: ParsedTable,
    range: NormalizedRange,
    section: TableSection,
): HtmlElement {
    const rows: { element: HtmlElement; section: TableSection }[] = [];
    for (const child of table.children) {
        if (isElement(child, 'tr')) {
            rows.push({ element: child, section: 'body' });
            continue;
        }
        if (
            child.type === 'element' &&
            (child.tagName === 'thead' ||
                child.tagName === 'tbody' ||
                child.tagName === 'tfoot')
        ) {
            if (child.attributes.length > 0) {
                throw new RichTextArgumentError(
                    'table.row.properties',
                    'does not move rows from attributed table sections.',
                );
            }
            const current: TableSection =
                child.tagName === 'thead'
                    ? 'head'
                    : child.tagName === 'tfoot'
                      ? 'foot'
                      : 'body';
            for (const row of child.children) {
                if (isElement(row, 'tr'))
                    rows.push({ element: row, section: current });
            }
        }
    }
    if (rows.length !== parsed.rows.length) {
        throw new RichTextArgumentError(
            'table.row.properties',
            'could not map every row to a table section.',
        );
    }
    for (let index = range.top; index <= range.bottom; index += 1) {
        const row = rows[index];
        if (row !== undefined) rows[index] = { ...row, section };
    }
    const sections: HtmlElement[] = [];
    for (const row of rows) {
        const tagName = sectionTag(row.section);
        const previous = sections.at(-1);
        if (previous?.tagName === tagName) {
            sections[sections.length - 1] = {
                ...previous,
                children: [...previous.children, row.element],
            };
        } else {
            sections.push(htmlElement(tagName, [], [row.element]));
        }
    }
    const metadata = table.children.filter(
        (child) => isElement(child, 'caption') || isElement(child, 'colgroup'),
    );
    return { ...table, children: [...metadata, ...sections] };
}

function tableRowSections(
    children: readonly HtmlChildNode[],
): readonly TableSection[] {
    const sections: TableSection[] = [];
    for (const child of children) {
        if (isElement(child, 'tr')) {
            sections.push('body');
        } else if (
            child.type === 'element' &&
            (child.tagName === 'thead' ||
                child.tagName === 'tbody' ||
                child.tagName === 'tfoot')
        ) {
            const section: TableSection =
                child.tagName === 'thead'
                    ? 'head'
                    : child.tagName === 'tfoot'
                      ? 'foot'
                      : 'body';
            for (const row of child.children) {
                if (isElement(row, 'tr')) sections.push(section);
            }
        }
    }
    return sections;
}

function sectionTag(section: TableSection): 'tbody' | 'tfoot' | 'thead' {
    return section === 'head'
        ? 'thead'
        : section === 'foot'
          ? 'tfoot'
          : 'tbody';
}

function updateProperties(
    attributes: readonly HtmlAttribute[],
    properties: readonly (readonly [string, string | null | undefined])[],
): readonly HtmlAttribute[] {
    let next = attributes;
    for (const [name, value] of properties) {
        if (value !== undefined) next = updateAttribute(next, name, value);
    }
    return next;
}

function updateAttribute(
    attributes: readonly HtmlAttribute[],
    name: string,
    value: string | null,
): readonly HtmlAttribute[] {
    return [
        ...attributes.filter((attribute) => attribute.name !== name),
        ...(value === null ? [] : [{ name, value }]),
    ];
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
    trusted = false,
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
                            ? trusted
                                ? cell.element.children
                                : sanitizeExternalCellNodes(
                                      cell.element.children,
                                  )
                            : [],
                    ),
                );
            } catch {
                // Fall through to inert plain text.
            }
        }
        const fragment = parseHtmlFragment(html).document.children;
        const content = trusted
            ? fragment
            : sanitizeExternalCellNodes(fragment);
        if (content.length > 0) {
            return [[content]];
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

function sanitizeExternalCellNodes(
    nodes: readonly HtmlChildNode[],
): readonly HtmlChildNode[] {
    return nodes.flatMap((node): readonly HtmlChildNode[] => {
        if (node.type === 'text') return [node];
        if (node.type !== 'element' || node.namespace !== 'html') return [];
        const normalizedTag =
            node.tagName === 'b'
                ? 'strong'
                : node.tagName === 'i'
                  ? 'em'
                  : node.tagName;
        if (
            ![
                'a',
                'br',
                'code',
                'em',
                'img',
                'li',
                'ol',
                'p',
                's',
                'span',
                'strong',
                'u',
                'ul',
            ].includes(normalizedTag)
        ) {
            return sanitizeExternalCellNodes(node.children);
        }
        const attributes =
            normalizedTag === 'a'
                ? node.attributes.filter(
                      (attribute) =>
                          (attribute.name === 'href' &&
                              safeExternalLink(attribute.value)) ||
                          (attribute.name === 'title' &&
                              attribute.value.length <= 512 &&
                              !hasControlCharacters(attribute.value)),
                  )
                : normalizedTag === 'img'
                  ? node.attributes.filter((attribute) => {
                        if (attribute.name === 'src') {
                            return safeExternalImage(attribute.value);
                        }
                        if (
                            attribute.name === 'alt' ||
                            attribute.name === 'title'
                        ) {
                            return (
                                attribute.value.length <= 1024 &&
                                !hasControlCharacters(attribute.value)
                            );
                        }
                        return (
                            (attribute.name === 'width' ||
                                attribute.name === 'height') &&
                            /^\d{1,5}$/u.test(attribute.value)
                        );
                    })
                  : [];
        return [
            htmlElement(
                normalizedTag,
                attributes,
                sanitizeExternalCellNodes(node.children),
            ),
        ];
    });
}

function safeExternalImage(value: string): boolean {
    const source = value.trim();
    return (
        source.length <= 4096 &&
        !hasControlCharacters(source) &&
        (/^(?:https?:|blob:|data:image\/(?:png|jpe?g|gif|webp|avif);base64,)/iu.test(
            source,
        ) ||
            /^(?!\/\/)(?![a-z][a-z\d+.-]*:)[^\s]+$/iu.test(source))
    );
}

function safeExternalLink(value: string): boolean {
    return (
        value.length <= 2048 &&
        !hasControlCharacters(value) &&
        !value.includes('\\') &&
        !/^\s*(?:data|file|javascript|vbscript):/iu.test(value) &&
        !value.startsWith('//')
    );
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

function readTableProperties(args: readonly unknown[]): TableProperties {
    const value = propertiesRecord('table.properties', args, [
        'alignment',
        'ariaLabel',
        'caption',
        'responsiveClass',
        'width',
    ]);
    const alignment = nullableChoice('table.properties', value.alignment, [
        'center',
        'left',
        'right',
    ] as const);
    const width = nullableString('table.properties', value.width, 16);
    if (
        typeof width === 'string' &&
        !/^(?:[1-9][0-9]{0,3}px|(?:100|[1-9][0-9]?)%)$/u.test(width)
    ) {
        throw new RichTextArgumentError(
            'table.properties',
            'requires width from 1px to 9999px, or 1% to 100%.',
        );
    }
    const responsiveClass = nullableClassTokens(
        'table.properties',
        value.responsiveClass,
    );
    return Object.freeze({
        ...(alignment === undefined ? {} : { alignment }),
        ...nullableStringProperty('table.properties', value, 'ariaLabel', 512),
        ...nullableStringProperty('table.properties', value, 'caption', 2048),
        ...(responsiveClass === undefined ? {} : { responsiveClass }),
        ...(width === undefined ? {} : { width }),
    });
}

function readRowProperties(args: readonly unknown[]): TableRowProperties {
    const value = propertiesRecord('table.row.properties', args, [
        'ariaLabel',
        'className',
        'height',
        'section',
    ]);
    const height = value.height;
    if (
        height !== undefined &&
        height !== null &&
        (!Number.isInteger(height) ||
            Number(height) < 20 ||
            Number(height) > 2000)
    ) {
        throw new RichTextArgumentError(
            'table.row.properties',
            'requires height from 20 to 2000 pixels.',
        );
    }
    const section = optionalChoice('table.row.properties', value.section, [
        'body',
        'foot',
        'head',
    ] as const);
    const className = nullableClassTokens(
        'table.row.properties',
        value.className,
    );
    return Object.freeze({
        ...nullableStringProperty(
            'table.row.properties',
            value,
            'ariaLabel',
            512,
        ),
        ...(className === undefined ? {} : { className }),
        ...(height === undefined
            ? {}
            : { height: height === null ? null : Number(height) }),
        ...(section === undefined ? {} : { section }),
    });
}

function readCellProperties(args: readonly unknown[]): TableCellProperties {
    const value = propertiesRecord('table.cell.properties', args, [
        'ariaLabel',
        'className',
        'horizontalAlignment',
        'scope',
        'verticalAlignment',
    ]);
    const className = nullableClassTokens(
        'table.cell.properties',
        value.className,
    );
    const horizontalAlignment = nullableChoice(
        'table.cell.properties',
        value.horizontalAlignment,
        ['center', 'left', 'right'] as const,
    );
    const scope = nullableChoice('table.cell.properties', value.scope, [
        'col',
        'colgroup',
        'row',
        'rowgroup',
    ] as const);
    const verticalAlignment = nullableChoice(
        'table.cell.properties',
        value.verticalAlignment,
        ['baseline', 'bottom', 'middle', 'top'] as const,
    );
    return Object.freeze({
        ...nullableStringProperty(
            'table.cell.properties',
            value,
            'ariaLabel',
            512,
        ),
        ...(className === undefined ? {} : { className }),
        ...(horizontalAlignment === undefined ? {} : { horizontalAlignment }),
        ...(scope === undefined ? {} : { scope }),
        ...(verticalAlignment === undefined ? {} : { verticalAlignment }),
    });
}

function readColumnResize(args: readonly unknown[]): TableColumnResizeOptions {
    const value = propertiesRecord('table.column.resize', args, ['width']);
    const width = value.width;
    if (
        width !== null &&
        (!Number.isInteger(width) || Number(width) < 40 || Number(width) > 1200)
    ) {
        throw new RichTextArgumentError(
            'table.column.resize',
            'requires width from 40 to 1200 pixels or null.',
        );
    }
    return Object.freeze({ width: width === null ? null : Number(width) });
}

function propertiesRecord(
    command: string,
    args: readonly unknown[],
    keys: readonly string[],
): Record<string, unknown> {
    if (
        args.length !== 1 ||
        typeof args[0] !== 'object' ||
        args[0] === null ||
        Array.isArray(args[0])
    ) {
        throw new RichTextArgumentError(
            command,
            'requires one properties object.',
        );
    }
    const value = args[0] as Record<string, unknown>;
    if (Object.keys(value).some((key) => !keys.includes(key))) {
        throw new RichTextArgumentError(
            command,
            'received an unknown property.',
        );
    }
    return value;
}

function nullableStringProperty(
    command: string,
    value: Record<string, unknown>,
    key: string,
    maximum: number,
): Record<string, string | null> {
    const candidate = nullableString(command, value[key], maximum);
    return candidate === undefined ? {} : { [key]: candidate };
}

function nullableString(
    command: string,
    value: unknown,
    maximum: number,
): string | null | undefined {
    if (value === undefined || value === null) return value;
    if (
        typeof value !== 'string' ||
        value.length > maximum ||
        hasControlCharacters(value)
    ) {
        throw new RichTextArgumentError(
            command,
            'requires a bounded string property.',
        );
    }
    return value;
}

function nullableClassTokens(
    command: string,
    value: unknown,
): string | null | undefined {
    const candidate = nullableString(command, value, 256);
    if (
        typeof candidate === 'string' &&
        (candidate.length === 0 ||
            candidate.split(/\s+/u).length > 8 ||
            !candidate
                .split(/\s+/u)
                .every((token) =>
                    /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/u.test(token),
                ))
    ) {
        throw new RichTextArgumentError(
            command,
            'requires bounded CSS class tokens.',
        );
    }
    return candidate;
}

function optionalChoice<const Choice extends string>(
    command: string,
    value: unknown,
    choices: readonly Choice[],
): Choice | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== 'string' || !choices.includes(value as Choice)) {
        throw new RichTextArgumentError(
            command,
            'contains an unsupported property value.',
        );
    }
    return value as Choice;
}

function nullableChoice<const Choice extends string>(
    command: string,
    value: unknown,
    choices: readonly Choice[],
): Choice | null | undefined {
    return value === null ? null : optionalChoice(command, value, choices);
}

function hasControlCharacters(value: string): boolean {
    return Array.from(value).some((character) => {
        const code = character.codePointAt(0);
        return code !== undefined && (code < 32 || code === 127);
    });
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

function readCellHtmlEntries(
    args: readonly unknown[],
): readonly CellHtmlEntry[] {
    if (args.length !== 1 || !Array.isArray(args[0])) {
        throw new RichTextArgumentError(
            'table.cells.commitHtml',
            'requires an array of edited cells.',
        );
    }
    if (args[0].length === 0 || args[0].length > maximumCells) {
        throw new RichTextArgumentError(
            'table.cells.commitHtml',
            'requires between 1 and 1,000 edited cells.',
        );
    }
    return args[0].map((candidate): CellHtmlEntry => {
        if (typeof candidate !== 'object' || candidate === null) {
            throw invalidCellHtmlEntry();
        }
        const row: unknown = Reflect.get(candidate, 'row');
        const column: unknown = Reflect.get(candidate, 'column');
        const html: unknown = Reflect.get(candidate, 'html');
        if (
            !Number.isInteger(row) ||
            !Number.isInteger(column) ||
            typeof row !== 'number' ||
            typeof column !== 'number' ||
            row < 0 ||
            column < 0 ||
            typeof html !== 'string' ||
            html.length > maximumClipboardSourceLength
        ) {
            throw invalidCellHtmlEntry();
        }
        return Object.freeze({ column, html, row });
    });
}

function invalidCellHtmlEntry(): RichTextArgumentError {
    return new RichTextArgumentError(
        'table.cells.commitHtml',
        'contains an invalid edited cell.',
    );
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
    buttons: ReadonlyMap<string, HTMLElement>,
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

function announceTableSelection(
    document: Document,
    anchor: HTMLElement,
    activate: () => void,
): void {
    const EventConstructor = document.defaultView?.CustomEvent ?? CustomEvent;
    anchor.dispatchEvent(
        new EventConstructor('soeditor:table-selection', {
            bubbles: true,
            detail: Object.freeze({
                column: Number(anchor.dataset.column),
                row: Number(anchor.dataset.row),
                activate,
            }),
        }),
    );
}

function announceTableEdit(
    document: Document,
    anchor: HTMLElement,
    activate: () => void,
): void {
    const EventConstructor = document.defaultView?.CustomEvent ?? CustomEvent;
    anchor.dispatchEvent(
        new EventConstructor('soeditor:table-edit', {
            bubbles: true,
            detail: Object.freeze({ activate }),
        }),
    );
}

function announceTableEditingStart(
    document: Document,
    anchor: HTMLElement,
): void {
    const EventConstructor = document.defaultView?.CustomEvent ?? CustomEvent;
    anchor.dispatchEvent(
        new EventConstructor('soeditor:table-editing-start', {
            bubbles: true,
        }),
    );
}

function announceTableEditingEnd(
    document: Document,
    anchor: HTMLElement,
): void {
    const EventConstructor = document.defaultView?.CustomEvent ?? CustomEvent;
    anchor.dispatchEvent(
        new EventConstructor('soeditor:table-editing-end', {
            bubbles: true,
        }),
    );
}

function rangeIsInside(range: Range, container: HTMLElement): boolean {
    return (
        container.contains(range.startContainer) &&
        container.contains(range.endContainer)
    );
}

interface CellEditingServiceOptions {
    readonly button: HTMLElement;
    readonly document: Document;
    readonly getRange: () => Range | undefined;
    readonly markChanged: () => void;
    readonly setRange: (range: Range) => void;
}

function createCellEditingService(
    options: CellEditingServiceOptions,
): VisualEditingService {
    const selectedRange = (): Range | undefined => {
        const live = readCellSelectionRange(options.document, options.button);
        return live ?? options.getRange();
    };
    const restore = (range: Range): void => {
        options.button.focus({ preventScroll: true });
        const selection = options.document.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
    };
    const finishMutation = (range: Range): void => {
        restore(range);
        options.setRange(range);
        options.markChanged();
    };
    const service: VisualEditingService = {
        canEdit: () =>
            options.button.isConnected && options.button.isContentEditable,
        getLinkAttributes: () => {
            const link = selectedElement(options, 'a');
            if (link === undefined) return undefined;
            const href = link.getAttribute('href');
            if (href === null) return undefined;
            const attributes: {
                href: string;
                rel?: string;
                target?: string;
                title?: string;
            } = { href };
            const rel = link.getAttribute('rel');
            const target = link.getAttribute('target');
            const title = link.getAttribute('title');
            if (rel !== null) attributes.rel = rel;
            if (target !== null) attributes.target = target;
            if (title !== null) attributes.title = title;
            return attributes satisfies VisualLinkAttributes;
        },
        getSelectedStructuredBlock: () => undefined,
        getSelection: () => undefined,
        insertHtml: (html, insertionOptions) => {
            const selected = selectedRange();
            if (selected === undefined) return;
            const range = selected.cloneRange();
            if (insertionOptions?.placement === 'selection-start') {
                range.collapse(true);
            }
            const nodes = sanitizeExternalCellNodes(
                parseHtmlFragment(html).document.children,
            );
            const next = insertCellNodesAtRange(options.document, range, nodes);
            finishMutation(next);
        },
        isBlockActive: () => false,
        isLinkActive: () => selectedElement(options, 'a') !== undefined,
        isListActive: () => false,
        isMarkActive: (mark) => selectedElement(options, mark) !== undefined,
        isStructuredBlockSelected: () => false,
        removeFormat: () => {
            const range = selectedRange();
            if (range === undefined) return;
            const next = removeCellFormatting(options.document, range);
            finishMutation(next);
        },
        replaceStructuredBlockContent: () => {
            throw new Error('A table cell does not contain a selected widget.');
        },
        setBlock: () => {
            throw new Error(
                'Block formatting is not enabled inside a table cell.',
            );
        },
        setLink: (attributes) => {
            const range = selectedRange();
            if (range === undefined) return;
            const active = selectedElement(options, 'a');
            if (attributes === undefined) {
                if (active === undefined) return;
                const next = unwrapElement(options.document, active, range);
                finishMutation(next);
                return;
            }
            const link = active ?? options.document.createElement('a');
            link.setAttribute('href', attributes.href);
            setOptionalAttribute(link, 'target', attributes.target);
            setOptionalAttribute(link, 'rel', attributes.rel);
            setOptionalAttribute(link, 'title', attributes.title);
            if (active !== undefined) {
                const next = options.document.createRange();
                next.selectNodeContents(link);
                finishMutation(next);
                return;
            }
            const next = wrapCellRange(range, link);
            finishMutation(next);
        },
        setListProperties: () => undefined,
        setSelection: () => false,
        setStructuredBlockAttributes: () => {
            throw new Error('A table cell does not contain a selected widget.');
        },
        toggleList: () => {
            throw new Error(
                'List formatting is not enabled inside a table cell.',
            );
        },
        toggleMark: (mark) => {
            const range = selectedRange();
            if (range === undefined) return;
            const active = selectedElement(options, mark);
            const next =
                active === undefined
                    ? wrapCellRange(range, options.document.createElement(mark))
                    : unwrapElement(options.document, active, range);
            finishMutation(next);
        },
    };
    return Object.freeze(service);
}

function readCellSelectionRange(
    document: Document,
    cell: HTMLElement,
): Range | undefined {
    const selection = document.getSelection();
    if (selection === null || selection.rangeCount === 0) return undefined;
    const range = selection.getRangeAt(0);
    return rangeIsInside(range, cell) ? range.cloneRange() : undefined;
}

function selectedElement(
    options: CellEditingServiceOptions,
    tagName: string,
): HTMLElement | undefined {
    const range =
        readCellSelectionRange(options.document, options.button) ??
        options.getRange();
    let node = range?.commonAncestorContainer;
    if (node === undefined) return undefined;
    if (node.nodeType === 3) node = node.parentNode ?? node;
    const ElementConstructor = options.document.defaultView?.Element;
    const element =
        ElementConstructor !== undefined && node instanceof ElementConstructor
            ? node.closest<HTMLElement>(tagName)
            : null;
    return element !== null && options.button.contains(element)
        ? element
        : undefined;
}

function wrapCellRange(range: Range, wrapper: HTMLElement): Range {
    const fragment = range.extractContents();
    wrapper.append(fragment);
    range.insertNode(wrapper);
    const next = wrapper.ownerDocument.createRange();
    next.selectNodeContents(wrapper);
    next.collapse(fragment.childNodes.length === 0);
    return next;
}

function unwrapElement(
    document: Document,
    element: HTMLElement,
    original: Range,
): Range {
    const parent = element.parentNode;
    if (parent === null) return original;
    const children = Array.from(element.childNodes);
    const first = children[0];
    const last = children.at(-1);
    element.replaceWith(...children);
    const next = document.createRange();
    if (first !== undefined && last !== undefined) {
        next.setStartBefore(first);
        next.setEndAfter(last);
    } else {
        next.setStart(
            parent,
            Math.min(original.startOffset, parent.childNodes.length),
        );
        next.collapse(true);
    }
    return next;
}

function removeCellFormatting(document: Document, range: Range): Range {
    const fragment = range.extractContents();
    for (const element of Array.from(fragment.querySelectorAll('*'))) {
        if (
            ['A', 'CODE', 'EM', 'S', 'STRONG', 'SUB', 'SUP', 'U'].includes(
                element.tagName,
            )
        ) {
            element.replaceWith(...Array.from(element.childNodes));
        } else {
            element.removeAttribute('class');
            element.removeAttribute('style');
        }
    }
    const first = fragment.firstChild;
    const last = fragment.lastChild;
    range.insertNode(fragment);
    const next = document.createRange();
    if (first !== null && last !== null) {
        next.setStartBefore(first);
        next.setEndAfter(last);
    } else {
        next.setStart(range.startContainer, range.startOffset);
        next.collapse(true);
    }
    return next;
}

function setOptionalAttribute(
    element: HTMLElement,
    name: string,
    value: string | undefined,
): void {
    if (value === undefined) element.removeAttribute(name);
    else element.setAttribute(name, value);
}

function placeCaretAtEnd(document: Document, container: HTMLElement): void {
    const selection = document.getSelection();
    if (selection === null) return;
    const range = document.createRange();
    range.selectNodeContents(container);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
}

function setStructuredDragEnabled(cell: HTMLElement, enabled: boolean): void {
    const boundary = cell.closest<HTMLElement>(
        '[data-soeditor-structured-block]',
    );
    if (boundary !== null) boundary.draggable = enabled;
}

function announceEditingFeedback(
    document: Document,
    anchor: HTMLElement,
    message: string,
): void {
    const EventConstructor = document.defaultView?.CustomEvent ?? CustomEvent;
    anchor.dispatchEvent(
        new EventConstructor('soeditor:editing-feedback', {
            bubbles: true,
            detail: Object.freeze({ message, severity: 'warning' }),
        }),
    );
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

function nextTableTabPosition(
    parsed: ParsedTable,
    buttons: ReadonlyMap<string, HTMLElement>,
    current: TableCellPosition,
    reverse: boolean,
): TableCellPosition | undefined {
    const step = reverse ? -1 : 1;
    let index = current.row * parsed.columns + current.column + step;
    while (index >= 0 && index < parsed.rows.length * parsed.columns) {
        const candidate = {
            column: index % parsed.columns,
            row: Math.floor(index / parsed.columns),
        };
        if (buttons.has(positionKey(candidate))) return candidate;
        index += step;
    }
    return undefined;
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

function directElement<TagName extends string>(
    nodes: readonly HtmlChildNode[],
    tagName: TagName,
): (HtmlElement & { readonly tagName: TagName }) | undefined {
    return nodes.find((node) => isElement(node, tagName)) as
        (HtmlElement & { readonly tagName: TagName }) | undefined;
}

function attributeValue(
    attributes: readonly HtmlAttribute[],
    name: string,
): string | undefined {
    return attributes.find((attribute) => attribute.name === name)?.value;
}

function applyProjectedProperties(
    element: HTMLElement,
    attributes: readonly HtmlAttribute[],
    kind: 'cell' | 'row',
): void {
    const ariaLabel = attributeValue(attributes, 'aria-label');
    if (ariaLabel !== undefined) element.setAttribute('aria-label', ariaLabel);
    const className = attributeValue(attributes, 'data-soeditor-class');
    if (className !== undefined) element.className = className;
    const height = attributeValue(attributes, 'data-soeditor-height');
    if (kind === 'row' && height !== undefined) {
        element.style.height = `${height}px`;
    }
    if (kind === 'cell') {
        const alignment = attributeValue(attributes, 'data-soeditor-align');
        if (
            alignment === 'center' ||
            alignment === 'left' ||
            alignment === 'right'
        ) {
            element.style.textAlign = alignment;
        }
        const vertical = attributeValue(
            attributes,
            'data-soeditor-vertical-align',
        );
        if (
            vertical === 'baseline' ||
            vertical === 'bottom' ||
            vertical === 'middle' ||
            vertical === 'top'
        ) {
            element.style.verticalAlign = vertical;
        }
        const scope = attributeValue(attributes, 'scope');
        if (scope !== undefined) element.setAttribute('scope', scope);
    }
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

const safeCellElements = new Set([
    'a',
    'br',
    'code',
    'em',
    'img',
    'kbd',
    'li',
    'mark',
    'ol',
    'p',
    's',
    'small',
    'span',
    'strong',
    'sub',
    'sup',
    'u',
    'ul',
]);

/** Projects rich cell fragments without executing preserved unsafe HTML. */
function appendSafeCellContent(
    parent: HTMLElement,
    nodes: readonly HtmlChildNode[],
    document: Document,
): void {
    for (const node of nodes) {
        if (node.type === 'text') {
            parent.append(document.createTextNode(node.value));
            continue;
        }
        if (
            node.type !== 'element' ||
            node.namespace !== 'html' ||
            !safeCellElements.has(node.tagName)
        ) {
            continue;
        }
        const element = document.createElement(node.tagName);
        for (const attribute of node.attributes) {
            if (isSafeProjectedCellAttribute(node.tagName, attribute)) {
                element.setAttribute(attribute.name, attribute.value);
            }
        }
        appendSafeCellContent(element, node.children, document);
        parent.append(element);
    }
}

function insertCellNodesAtSelection(
    document: Document,
    cell: HTMLElement,
    nodes: readonly HtmlChildNode[],
): Range {
    const range =
        readCellSelectionRange(document, cell) ?? document.createRange();
    if (!rangeIsInside(range, cell)) {
        range.selectNodeContents(cell);
        range.collapse(false);
    }
    const next = insertCellNodesAtRange(document, range, nodes);
    const selection = document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(next);
    return next;
}

function insertCellNodesAtRange(
    document: Document,
    range: Range,
    nodes: readonly HtmlChildNode[],
): Range {
    const container = document.createElement('span');
    appendSafeCellContent(container, nodes, document);
    const inserted = Array.from(container.childNodes);
    range.deleteContents();
    const fragment = document.createDocumentFragment();
    fragment.append(...inserted);
    range.insertNode(fragment);
    const next = document.createRange();
    const last = inserted.at(-1);
    if (last === undefined) {
        next.setStart(range.startContainer, range.startOffset);
    } else {
        next.setStartAfter(last);
    }
    next.collapse(true);
    return next;
}

function editingCellFromTarget(
    target: EventTarget | null,
): HTMLElement | undefined {
    return target instanceof Element
        ? (target.closest<HTMLElement>('.soeditor-table-cell.is-editing') ??
              undefined)
        : undefined;
}

function isEditorUiInteractionTarget(element: Element): boolean {
    return (
        element.closest(
            '.soeditor-ui__toolbar, .soeditor-ui__panels, .soeditor-ui__overlays, dialog[open], [data-soeditor-ui-interaction]',
        ) !== null
    );
}

function requiresControlledCellPaste(transfer: DataTransfer): boolean {
    if (
        transfer.files.length > 0 ||
        transfer.getData(SOEDITOR_CLIPBOARD_MIME).length > 0
    ) {
        return true;
    }
    const html = transfer.getData('text/html');
    if (html.length === 0) return false;
    return /(?:<(?:embed|iframe|object|script|style|table)\b|\bon[a-z]+\s*=|\bsrcdoc\s*=|(?:javascript|vbscript)\s*:|\bclass\s*=\s*["']?Mso|\bmso-|urn:schemas-microsoft-com:office)/iu.test(
        html,
    );
}

function isSafeProjectedCellAttribute(
    tagName: string,
    attribute: HtmlAttribute,
): boolean {
    if (attribute.namespace !== undefined || attribute.name.startsWith('on')) {
        return false;
    }
    if (['class', 'dir', 'lang', 'title'].includes(attribute.name)) return true;
    if (tagName === 'a') {
        if (attribute.name === 'href') return safeExternalLink(attribute.value);
        return ['rel', 'target'].includes(attribute.name);
    }
    if (tagName === 'img') {
        if (attribute.name === 'src') {
            return safeExternalImage(attribute.value);
        }
        return ['alt', 'height', 'width'].includes(attribute.name);
    }
    return false;
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
