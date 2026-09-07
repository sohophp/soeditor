import type { Editor } from '@soeditor/core';
import { projectionCoordinatorServiceToken } from '@soeditor/projections';
import type { DismissibleUiHandle, EditorUi } from '@soeditor/ui';

import type * as TableEditorAttributes from './table-editor-attributes.js';

type TableContextPropertyKind = 'cell' | 'row' | 'section' | 'table';

interface TableStructureSnapshot {
    readonly caption: {
        readonly exists: boolean;
        readonly hasRichContent: boolean;
        readonly text: string;
    };
    readonly columnGroups: readonly {
        readonly columnCount: number;
        readonly columns: readonly {
            readonly attributes: readonly {
                readonly name: string;
                readonly value: string;
            }[];
            readonly span: number;
            readonly width?: string;
        }[];
        readonly editable: boolean;
        readonly index: number;
        readonly reason?: string;
        readonly span?: number;
        readonly startColumn: number;
        readonly attributes: readonly {
            readonly name: string;
            readonly value: string;
        }[];
    }[];
    readonly diagnostics: readonly {
        readonly message: string;
        readonly repairable: boolean;
        readonly repairId?: string;
    }[];
    readonly sections: readonly {
        readonly index: number;
        readonly kind: 'body' | 'foot' | 'head';
        readonly rowCount: number;
        readonly attributes: readonly {
            readonly name: string;
            readonly value: string;
        }[];
    }[];
}

export function attachClassicTableContext(
    editor: Editor,
    ui: EditorUi,
    visual: HTMLElement,
    initialEvent?: Pick<Event, 'target' | 'type'>,
): () => void {
    const document = visual.ownerDocument;
    let balloon: DismissibleUiHandle | undefined;
    let activeTable: HTMLElement | undefined;
    let activeTarget: HTMLElement | undefined;
    let activeSelection: (() => void) | undefined;
    let activeRange: unknown;
    let selectionObserver: MutationObserver | undefined;
    let resizeOverlay: HTMLDivElement | undefined;
    let resizeObserver: ResizeObserver | undefined;
    let disposeResizePosition: (() => void) | undefined;
    const commandButtons = new Map<string, HTMLButtonElement>();
    const scopeButtons: HTMLButtonElement[] = [];
    let captionButton: HTMLButtonElement | undefined;
    let cellPropertiesButton: HTMLButtonElement | undefined;
    let propertiesButton: HTMLButtonElement | undefined;
    let disposed = false;
    let resyncFrame: number | undefined;
    let resyncAttempts = 0;
    let resizeDragging = false;
    let tableBookmark:
        { index: number; count: number; id: string; text: string } | undefined;
    let resizeSession:
        | { handle: HTMLElement; pointerId: number; cancel: () => void }
        | undefined;
    const rememberTable = (table: HTMLElement): void => {
        const tables = Array.from(
            visual.querySelectorAll<HTMLElement>('.soeditor-table-widget'),
        );
        tableBookmark = {
            index: tables.indexOf(table),
            count: tables.length,
            id: table.id,
            text: table.textContent ?? '',
        };
    };
    const resolveTable = (): HTMLElement | null => {
        if (tableBookmark === undefined) return null;
        const tables = Array.from(
            visual.querySelectorAll<HTMLElement>('.soeditor-table-widget'),
        );
        if (tableBookmark.id !== '') {
            const matches = tables.filter(
                (table) => table.id === tableBookmark?.id,
            );
            if (matches.length === 1) return matches[0] ?? null;
            const indexed = tables[tableBookmark.index];
            return tables.length === tableBookmark.count &&
                indexed?.id === tableBookmark.id
                ? indexed
                : null;
        }
        if (tables.length === tableBookmark.count)
            return tables[tableBookmark.index] ?? null;
        const matches = tables.filter(
            (table) => table.textContent === tableBookmark?.text,
        );
        return matches.length === 1 ? (matches[0] ?? null) : null;
    };
    const finishResize = (): void => {
        const session = resizeSession;
        resizeSession = undefined;
        if (session === undefined) return;
        session.handle.removeAttribute('data-width');
        session.handle.removeAttribute('data-height');
        session.handle.style.removeProperty('transform');
        if (session.handle.hasPointerCapture(session.pointerId))
            session.handle.releasePointerCapture(session.pointerId);
        resizeOverlay?.querySelector('[data-resize-feedback]')?.remove();
    };
    const cancelResize = (): void => {
        const session = resizeSession;
        finishResize();
        session?.cancel();
        resizeDragging = false;
    };

    let projectionObserver: MutationObserver | undefined;
    let refreshMenus: (() => void) | undefined;
    let dismissMenus: (() => void) | undefined;
    const refreshCommandButtons = (): void => {
        refreshMenus?.();
        const selectionKind = classicTableSelectionKind(
            activeTable,
            activeRange,
        );
        ui.setStatus(
            `${ui.translate(capitalizeMode(editor.state.mode))} · ${tableScopeLabel(ui, selectionKind, activeRange)} · ${ui.translate(editor.state.dirty ? 'Unsaved' : 'Saved')}`,
        );
        const isSingleCell = selectionKind === 'caret';
        if (captionButton !== undefined) captionButton.hidden = !isSingleCell;
        if (cellPropertiesButton !== undefined) {
            cellPropertiesButton.hidden = !isSingleCell;
        }
        if (propertiesButton !== undefined) {
            const label =
                selectionKind === 'rows'
                    ? 'Row properties'
                    : 'Table properties';
            if (
                propertiesButton.closest('.soeditor-table-context__menu') !==
                null
            ) {
                propertiesButton.textContent = ui.translate(label);
            }
            propertiesButton.title = ui.translate(label);
            propertiesButton.setAttribute('aria-label', ui.translate(label));
        }
        for (const [command, button] of commandButtons) {
            button.disabled =
                command === 'table.cells.merge'
                    ? selectionKind === 'caret' ||
                      !canMerge(
                          activeTable === undefined
                              ? activeRange
                              : (selectedTableRange(activeTable, activeRange) ??
                                    activeRange),
                      )
                    : command.startsWith('table.cell.split')
                      ? !canSplit(command)
                      : !editor.commands.canExecute(command);
            button.hidden =
                command === 'table.cells.merge' && selectionKind === 'caret';
            button.disabled ||= !tableCommandApplies(command, selectionKind);
            if (button.disabled && !button.hidden) {
                if (command === 'table.cells.merge') {
                    button.title = ui.translate(
                        'Select complete cells in one rectangular table section.',
                    );
                } else if (command.startsWith('table.cell.split')) {
                    button.title = ui.translate(
                        selectionKind !== 'caret'
                            ? 'Select one cell to split.'
                            : command === 'table.cell.split'
                              ? 'Select a merged cell to split completely.'
                              : 'Splitting would exceed table limits.',
                    );
                }
            } else {
                button.title = button.getAttribute('aria-label') ?? '';
            }
        }
        for (const button of scopeButtons) {
            const bounds = tableRangeBounds(activeRange);
            const scope = button.dataset.selectionScope;
            button.hidden =
                selectionKind === 'cells' &&
                bounds !== undefined &&
                ((scope === 'column' &&
                    bounds.left === bounds.right &&
                    bounds.top !== bounds.bottom) ||
                    (scope === 'row' &&
                        bounds.top === bounds.bottom &&
                        bounds.left !== bounds.right));
        }
    };
    const canMerge = (
        range: unknown,
        table: HTMLElement | undefined = activeTable,
    ): boolean => {
        if (table === undefined || range === undefined) return false;
        try {
            return editor.execute('table.cells.canMerge', range) === true;
        } catch {
            return false;
        }
    };
    const canSplit = (command: string): boolean => {
        if (classicTableSelectionKind(activeTable, activeRange) !== 'caret')
            return false;
        if (!editor.commands.canExecute(command)) return false;
        try {
            return (
                editor.execute(
                    'table.cell.canSplit',
                    activeRange,
                    command === 'table.cell.splitRows'
                        ? 'rows'
                        : command === 'table.cell.splitColumns'
                          ? 'columns'
                          : 'all',
                ) === true
            );
        } catch {
            return false;
        }
    };
    const close = (): void => {
        cancelResize();
        balloon?.close();
        balloon = undefined;
        refreshMenus = undefined;
        dismissMenus = undefined;
        ui.setStatus();
        commandButtons.clear();
        scopeButtons.length = 0;
        resizeObserver?.disconnect();
        resizeObserver = undefined;
        disposeResizePosition?.();
        disposeResizePosition = undefined;
        resizeOverlay?.remove();
        resizeOverlay = undefined;
    };
    const attachResizeHandles = (table: HTMLElement): void => {
        rememberTable(table);
        // The rich-text table node view already owns resize handles in the
        // native WYSIWYG projection. Do not add a second overlay on top of
        // those controls: the duplicate hit target can turn a boundary drag
        // into the neighboring table toolbar action (such as Add column).
        const shadow = visual.getRootNode();
        const resizeHost =
            table.closest<HTMLElement>('.soeditor-table-widget--wysiwyg') ??
            table.parentElement;
        if (
            table.classList.contains('soeditor-table-widget--wysiwyg') ||
            resizeHost?.classList.contains('soeditor-table-widget--wysiwyg') ||
            (shadow instanceof ShadowRoot &&
                shadow.querySelector(
                    '.soeditor-table-column-resize, .soeditor-table-row-resize',
                ) !== null) ||
            resizeHost?.querySelector(
                '.soeditor-table-column-resize, .soeditor-table-row-resize',
            ) !== null
        ) {
            return;
        }
        resizeObserver?.disconnect();
        disposeResizePosition?.();
        resizeOverlay?.remove();
        if (!(shadow instanceof ShadowRoot)) return;
        const overlay = document.createElement('div');
        overlay.className = 'soeditor-table-resize-overlay';
        const beginResize = (
            handle: HTMLElement,
            event: PointerEvent,
            cancel: () => void,
        ): void => {
            finishResize();
            resizeSession = { handle, pointerId: event.pointerId, cancel };
        };
        const feedback = (
            event: PointerEvent,
            value: number,
            label: string,
            min: number,
            max: number,
        ): void => {
            let output = overlay.querySelector<HTMLElement>(
                '[data-resize-feedback]',
            );
            if (output === null) {
                output = document.createElement('output');
                output.dataset.resizeFeedback = 'true';
                output.className = 'soeditor-table-resize-feedback';
                output.setAttribute('role', 'status');
                overlay.append(output);
            }
            const bounds = table.getBoundingClientRect();
            const viewport = shadow.host.getBoundingClientRect();
            output.textContent = `${ui.translate(label)}: ${Math.round(value)} px${value === min || value === max ? ` · ${ui.translate('Limit reached')}` : ''}`;
            output.style.left = `${Math.max(viewport.left + 4, Math.min(event.clientX + 12, viewport.right - 170)) - bounds.left}px`;
            output.style.top = `${Math.max(viewport.top + 4, event.clientY - 32) - bounds.top}px`;
        };

        const activateCellForResize = (cell: HTMLTableCellElement): void => {
            const PointerEventConstructor = document.defaultView?.PointerEvent;
            if (PointerEventConstructor === undefined) {
                cell.click();
                return;
            }
            cell.dispatchEvent(
                new PointerEventConstructor('pointerdown', {
                    bubbles: true,
                    button: 0,
                }),
            );
            cell.dispatchEvent(
                new PointerEventConstructor('pointerup', {
                    bubbles: true,
                    button: 0,
                }),
            );
        };
        const scrollHost = shadow.host;
        const position = (): void => {
            if (!table.isConnected) return;
            const tableRect = table.getBoundingClientRect();
            const tableRows = Array.from(table.querySelectorAll('tr'));
            // The overlay is an absolutely positioned shadow child. In split
            // mode `contain: paint` makes the visual pane its containing
            // block; otherwise the positioned classic root is the containing
            // block. Convert the viewport rectangle to whichever coordinate
            // system the browser is actually using.
            const shadowRoot = visual.getRootNode();
            const visualHost =
                shadowRoot instanceof ShadowRoot ? shadowRoot.host : visual;
            const hostStyle = getComputedStyle(visualHost);
            const containingBlock = hostStyle.contain.includes('paint')
                ? visualHost
                : (visualHost.closest<HTMLElement>('.soeditor-classic') ??
                  visualHost);
            const containingRect = containingBlock.getBoundingClientRect();
            overlay.style.insetInlineStart = `${String(
                tableRect.left -
                    containingRect.left -
                    containingBlock.clientLeft +
                    containingBlock.scrollLeft,
            )}px`;
            overlay.style.insetBlockStart = `${String(
                tableRect.top -
                    containingRect.top -
                    containingBlock.clientTop +
                    containingBlock.scrollTop,
            )}px`;
            overlay.style.width = `${String(tableRect.width)}px`;
            overlay.style.height = `${String(tableRect.height)}px`;
            for (const [column, cell] of resizeColumns.entries()) {
                const handle = overlay.querySelector<HTMLElement>(
                    `[data-resize-column="${String(column)}"]`,
                );
                if (handle === null) continue;
                const rectangle = cell.getBoundingClientRect();
                // Only expose segments where this logical boundary is an
                // actual cell border, leaving spanning cell interiors editable.
                const segments = resizeGrid.flatMap((line, row) => {
                    if (line[column] === line[column + 1]) return [];
                    const rowBox = tableRows[row]?.getBoundingClientRect();
                    if (rowBox === undefined) return [];
                    const top = rowBox.top - tableRect.top;
                    const bottom = rowBox.bottom - tableRect.top;
                    return [`M0 ${top}H8V${bottom}H0Z`];
                });
                handle.style.clipPath = `path("${segments.join(' ') || 'M0 0Z'}")`;
                // Center the 8px hit target and its 2px guide on the border.
                handle.style.insetInlineStart = `${String(rectangle.left + (rectangle.width * (column - (resizeGrid.find((line) => line.includes(cell))?.indexOf(cell) ?? column) + 1)) / cell.colSpan - tableRect.left - 4)}px`;
            }
            for (const [row, tableRow] of Array.from(
                table.querySelectorAll('tr'),
            ).entries()) {
                const handle = overlay.querySelector<HTMLElement>(
                    `[data-resize-row="${String(row)}"]`,
                );
                if (handle === null) continue;
                const rectangle = tableRow.getBoundingClientRect();
                handle.style.insetBlockStart = `${String(rectangle.bottom - tableRect.top - 4)}px`;
                const segments = [...new Set(resizeGrid[row] ?? [])].flatMap(
                    (cell) => {
                        const column = resizeGrid[row]?.indexOf(cell) ?? -1;
                        if (resizeGrid[row + 1]?.[column] === cell) return [];
                        const box = cell.getBoundingClientRect();
                        return [
                            `M${box.left - tableRect.left} 0H${box.right - tableRect.left}V8H${box.left - tableRect.left}Z`,
                        ];
                    },
                );
                handle.style.clipPath = `path("${segments.join(' ') || 'M0 0Z'}")`;
            }
        };
        // Border handles may overlap flush-left text in unpadded CMS tables.
        // Let the browser place its native caret when hovering actual content.
        const avoidText = (event: PointerEvent): void => {
            if (resizeDragging) return;
            for (const handle of Array.from(
                overlay.querySelectorAll<HTMLElement>('button'),
            )) {
                const box = handle.getBoundingClientRect();
                if (
                    event.clientX < box.left ||
                    event.clientX > box.right ||
                    event.clientY < box.top ||
                    event.clientY > box.bottom
                ) {
                    handle.style.removeProperty('pointer-events');
                    continue;
                }
                const overText = Array.from(
                    table.querySelectorAll<HTMLTableCellElement>('td,th'),
                ).some((cell) => {
                    const bounds = cell.getBoundingClientRect();
                    if (
                        event.clientX < bounds.left ||
                        event.clientX > bounds.right ||
                        event.clientY < bounds.top ||
                        event.clientY > bounds.bottom
                    )
                        return false;
                    // A logical boundary hidden by a spanning cell is not a
                    // visible drag line at this pointer position.
                    if (
                        handle.dataset.resizeColumn !== undefined &&
                        cell.colSpan > 1 &&
                        event.clientX > bounds.left + 4 &&
                        event.clientX < bounds.right - 4
                    )
                        return true;
                    if (
                        handle.dataset.resizeRow !== undefined &&
                        cell.rowSpan > 1 &&
                        event.clientY > bounds.top + 4 &&
                        event.clientY < bounds.bottom - 4
                    )
                        return true;
                    const walker = document.createTreeWalker(cell, 4);
                    for (
                        let node = walker.nextNode();
                        node !== null;
                        node = walker.nextNode()
                    ) {
                        const range = document.createRange();
                        range.selectNodeContents(node);
                        if (
                            Array.from(range.getClientRects()).some(
                                (rect) =>
                                    event.clientX >= rect.left &&
                                    event.clientX <= rect.right &&
                                    event.clientY >= rect.top &&
                                    event.clientY <= rect.bottom,
                            )
                        )
                            return true;
                    }
                    return false;
                });
                handle.style.pointerEvents = overText ? 'none' : 'auto';
            }
        };
        document.addEventListener('pointermove', avoidText, true);
        const redirectStalePointer = (
            event: PointerEvent,
            selector: string,
        ): boolean => {
            if (table.isConnected) return false;
            const nextTable = resolveTable();
            const PointerEventConstructor = document.defaultView?.PointerEvent;
            if (nextTable === null || PointerEventConstructor === undefined) {
                return false;
            }
            close();
            activeTable = nextTable;
            activeTarget =
                nextTable.querySelector<HTMLElement>('.soeditor-table-cell') ??
                undefined;
            activeSelection = undefined;
            activeRange = undefined;
            attachResizeHandles(nextTable);
            const replacement =
                resizeOverlay?.querySelector<HTMLElement>(selector);
            if (replacement === null || replacement === undefined) {
                return false;
            }
            replacement.dispatchEvent(
                new PointerEventConstructor('pointerdown', {
                    bubbles: true,
                    button: event.button,
                    clientX: event.clientX,
                    clientY: event.clientY,
                    pointerId: event.pointerId,
                    pointerType: event.pointerType,
                }),
            );
            return true;
        };
        const resizeGrid = tableCellGrid(table);
        const resizeColumns = (resizeGrid[0] ?? []).map((fallback, column) =>
            resizeGrid.reduce((best, line) => {
                const candidate = line[column];
                return candidate !== undefined &&
                    candidate.colSpan < best.colSpan
                    ? candidate
                    : best;
            }, fallback),
        );
        for (const [column, cell] of resizeColumns.entries()) {
            if (!(cell instanceof HTMLTableCellElement)) continue;
            const handle = document.createElement('button');
            handle.type = 'button';
            handle.className = 'soeditor-table-column-resize';
            handle.dataset.resizeColumn = String(column);
            handle.setAttribute(
                'aria-label',
                `Resize column ${String(column + 1)}`,
            );
            let origin = 0;
            let width = 0;
            let initialWidth = 0;
            const firstColumn =
                resizeGrid.find((line) => line.includes(cell))?.indexOf(cell) ??
                column;
            const affectedColumns = column - firstColumn + 1;
            const commit = (): void => {
                if (!resizeDragging) return;
                if (resizeSession !== undefined && width === initialWidth) {
                    cancelResize();
                    return;
                }
                finishResize();
                resizeDragging = false;
                handle.style.removeProperty('transform');
                const targetTable = table.isConnected ? table : resolveTable();
                const targetCell = tableCellGrid(targetTable ?? undefined)[0]?.[
                    column
                ];
                if (!(targetCell instanceof HTMLTableCellElement)) return;
                activateCellForResize(targetCell);
                editor.execute(
                    'table.column.resize',
                    {
                        anchor: { row: 0, column: firstColumn },
                        focus: { row: 0, column },
                    },
                    { width },
                );
                resyncTableContext();
            };
            const cancel = (): void => {
                if (!resizeDragging) return;
                resizeDragging = false;
                handle.style.removeProperty('transform');
                resyncTableContext();
            };
            handle.addEventListener('pointerdown', (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (
                    redirectStalePointer(
                        event,
                        `[data-resize-column="${String(column)}"]`,
                    )
                ) {
                    return;
                }
                resizeDragging = true;
                origin = event.clientX;
                width = cell.getBoundingClientRect().width / cell.colSpan;
                initialWidth = width;
                beginResize(handle, event, cancel);
                handle.setPointerCapture(event.pointerId);
                feedback(event, width, 'Column width', 40, 1200);
            });
            handle.addEventListener('pointermove', (event) => {
                if (!handle.hasPointerCapture(event.pointerId)) return;
                const delta = event.clientX - origin;

                width =
                    delta === 0
                        ? initialWidth
                        : Math.max(
                              40,
                              Math.min(
                                  1200,
                                  Math.round(
                                      initialWidth + delta / affectedColumns,
                                  ),
                              ),
                          );
                handle.style.transform = `translateX(${String((width - initialWidth) * affectedColumns)}px)`;
                feedback(event, width, 'Column width', 40, 1200);
                handle.dataset.width = `${String(width)} px`;
            });
            handle.addEventListener('pointerup', commit);
            handle.addEventListener('pointercancel', () => {
                if (resizeSession?.handle === handle) cancelResize();
            });
            handle.addEventListener('lostpointercapture', () => {
                if (resizeSession?.handle === handle) cancelResize();
            });
            handle.addEventListener('keydown', (event) => {
                if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')
                    return;
                event.preventDefault();
                width = Math.max(
                    40,
                    Math.min(
                        1200,
                        Math.round(
                            cell.getBoundingClientRect().width / cell.colSpan,
                        ) + (event.key === 'ArrowLeft' ? -10 : 10),
                    ),
                );
                resizeDragging = true;
                commit();
            });
            overlay.append(handle);
        }
        for (const [row, tableRow] of Array.from(
            table.querySelectorAll('tr'),
        ).entries()) {
            const cell = tableRow.querySelector('td,th');
            if (!(cell instanceof HTMLTableCellElement)) continue;
            const handle = document.createElement('button');
            handle.type = 'button';
            handle.className = 'soeditor-table-row-resize';
            handle.dataset.resizeRow = String(row);
            handle.setAttribute('role', 'slider');
            handle.setAttribute('aria-label', `Resize row ${String(row + 1)}`);
            let origin = 0;
            let height = 0;
            let initialHeight = 0;
            let startX = 0;
            let crossColumn: HTMLElement | undefined;
            const commit = (): void => {
                if (!resizeDragging) return;
                if (resizeSession !== undefined && height === initialHeight) {
                    cancelResize();
                    return;
                }
                finishResize();
                resizeDragging = false;
                if (crossColumn !== undefined) {
                    crossColumn = undefined;
                    return;
                }
                handle.style.removeProperty('transform');
                const targetTable = table.isConnected ? table : resolveTable();
                const targetRow = targetTable?.querySelectorAll('tr')[row];
                const targetCell = targetRow?.querySelector('td,th');
                if (!(targetCell instanceof HTMLTableCellElement)) return;
                activateCellForResize(targetCell);
                editor.execute(
                    'table.row.properties',
                    { anchor: { row, column: 0 }, focus: { row, column: 0 } },
                    { height },
                );
                resyncTableContext();
            };
            const cancel = (): void => {
                if (!resizeDragging) return;
                resizeDragging = false;
                handle.style.removeProperty('transform');
                resyncTableContext();
            };
            handle.addEventListener('pointerdown', (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (
                    redirectStalePointer(
                        event,
                        `[data-resize-row="${String(row)}"]`,
                    )
                ) {
                    return;
                }
                startX = event.clientX;
                crossColumn = Array.from(
                    overlay.querySelectorAll<HTMLElement>(
                        '[data-resize-column]',
                    ),
                ).find((candidate) => {
                    const bounds = candidate.getBoundingClientRect();
                    const column = Number(candidate.dataset.resizeColumn);
                    return (
                        candidate.style.pointerEvents !== 'none' &&
                        event.clientX >= bounds.left &&
                        event.clientX <= bounds.right &&
                        resizeGrid.some((line, index) => {
                            if (line[column] === line[column + 1]) return false;
                            const rowBounds = table
                                .querySelectorAll('tr')
                                .item(index)
                                ?.getBoundingClientRect();
                            return (
                                rowBounds !== undefined &&
                                event.clientY >= rowBounds.top - 4 &&
                                event.clientY <= rowBounds.bottom + 4
                            );
                        })
                    );
                });
                resizeDragging = true;
                origin = event.clientY;
                height = tableRow.getBoundingClientRect().height;
                initialHeight = height;
                beginResize(handle, event, cancel);
                handle.setPointerCapture(event.pointerId);
                feedback(event, height, 'Row height', 24, 1000);
            });
            handle.addEventListener('pointermove', (event) => {
                if (!handle.hasPointerCapture(event.pointerId)) return;
                const delta = event.clientY - origin;
                if (crossColumn !== undefined) {
                    const horizontal = event.clientX - startX;
                    if (Math.max(Math.abs(horizontal), Math.abs(delta)) < 3)
                        return;
                    const target = crossColumn;
                    crossColumn = undefined;
                    if (Math.abs(horizontal) > Math.abs(delta)) {
                        // Row and column hit targets overlap at crossings.
                        // Transfer the gesture once its direction is clear.
                        finishResize();
                        const Pointer =
                            document.defaultView?.PointerEvent ?? PointerEvent;
                        target.dispatchEvent(
                            new Pointer('pointerdown', {
                                bubbles: true,
                                pointerId: event.pointerId,
                                pointerType: event.pointerType,
                                button: 0,
                                buttons: 1,
                                clientX: startX,
                                clientY: origin,
                            }),
                        );
                        target.dispatchEvent(
                            new Pointer('pointermove', {
                                bubbles: true,
                                pointerId: event.pointerId,
                                pointerType: event.pointerType,
                                buttons: 1,
                                clientX: event.clientX,
                                clientY: event.clientY,
                            }),
                        );
                        return;
                    }
                }

                height =
                    delta === 0
                        ? initialHeight
                        : Math.max(
                              24,
                              Math.min(1000, Math.round(initialHeight + delta)),
                          );
                handle.style.transform = `translateY(${String(height - initialHeight)}px)`;
                feedback(event, height, 'Row height', 24, 1000);
                handle.dataset.height = `${String(height)} px`;
            });
            handle.addEventListener('pointerup', commit);
            handle.addEventListener('pointercancel', () => {
                if (resizeSession?.handle === handle) cancelResize();
            });
            handle.addEventListener('lostpointercapture', () => {
                if (resizeSession?.handle === handle) cancelResize();
            });
            handle.addEventListener('keydown', (event) => {
                if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')
                    return;
                event.preventDefault();
                crossColumn = undefined;
                height = Math.max(
                    24,
                    Math.min(
                        1000,
                        Math.round(tableRow.getBoundingClientRect().height) +
                            (event.key === 'ArrowUp' ? -10 : 10),
                    ),
                );
                resizeDragging = true;
                commit();
            });
            overlay.append(handle);
        }
        shadow.append(overlay);
        resizeOverlay = overlay;
        const ResizeObserverConstructor = document.defaultView?.ResizeObserver;
        if (ResizeObserverConstructor !== undefined) {
            resizeObserver = new ResizeObserverConstructor(position);
            resizeObserver.observe(table);
            resizeObserver.observe(visual);
            if (shadow instanceof ShadowRoot) {
                resizeObserver.observe(shadow.host);
                const editorRoot = shadow.host.closest('.soeditor-classic');
                if (editorRoot !== null) resizeObserver.observe(editorRoot);
            }
        }
        visual.addEventListener('scroll', position);
        scrollHost.addEventListener('scroll', position);
        document.defaultView?.addEventListener('resize', position);
        disposeResizePosition = () => {
            document.removeEventListener('pointermove', avoidText, true);
            visual.removeEventListener('scroll', position);
            scrollHost.removeEventListener('scroll', position);
            document.defaultView?.removeEventListener('resize', position);
        };
        position();
    };
    const resyncTableContext = (): void => {
        if (disposed || resyncFrame !== undefined) return;
        const view = document.defaultView;
        if (view === null) return;
        resyncFrame = view.requestAnimationFrame(() => {
            resyncFrame = undefined;
            if (activeTable === undefined) return;
            if (resizeDragging) {
                if (
                    resizeSession?.handle.isConnected === true &&
                    activeTable.isConnected
                )
                    return;
                cancelResize();
            }
            const coordinator = editor.services.get(
                projectionCoordinatorServiceToken,
            );
            if (
                !coordinator.snapshot.activities.some(
                    (activity) => activity.id === 'wysiwyg' && activity.visible,
                )
            )
                return;
            const ownsResizeHandles =
                resizeOverlay?.isConnected === true ||
                activeTable.querySelector(
                    '.soeditor-table-column-resize, .soeditor-table-row-resize',
                ) !== null;
            if (activeTable.isConnected && ownsResizeHandles) {
                resyncAttempts = 0;
                return;
            }
            const nextTable = resolveTable();
            if (nextTable === null) {
                if (visual.querySelector('.soeditor-table-widget') !== null) {
                    close();
                    activeTable = undefined;
                    return;
                }
                if (resyncAttempts < 10) {
                    resyncAttempts += 1;
                    resyncTableContext();
                } else {
                    close();
                    activeTable = undefined;
                }
                return;
            }
            resyncAttempts = 0;
            close();
            activeTable = nextTable;
            activeTarget =
                nextTable.querySelector<HTMLElement>('.soeditor-table-cell') ??
                undefined;
            activeSelection = undefined;
            activeRange = undefined;
            attachResizeHandles(nextTable);
        });
    };
    const coordinator = editor.services.get(projectionCoordinatorServiceToken);
    const disposeProjection = coordinator.subscribe((snapshot) => {
        if (
            snapshot.activities.some(
                (activity) => activity.id === 'wysiwyg' && activity.visible,
            )
        ) {
            resyncTableContext();
        }
    });
    const disposeDocumentChange = editor.events.on(
        'document:change',
        resyncTableContext,
    );
    projectionObserver = new MutationObserver(() => {
        resyncTableContext();
    });
    projectionObserver.observe(visual, { childList: true });
    const execute = (command: string, ...args: readonly unknown[]): boolean => {
        const EventConstructor = document.defaultView?.Event ?? Event;
        activeTarget?.dispatchEvent(
            new EventConstructor('soeditor:table-commit-request', {
                bubbles: true,
            }),
        );
        close();
        try {
            activeSelection?.();
            editor.execute(command, ...args);
            return true;
        } catch (error: unknown) {
            ui.notifications.show({
                message: error instanceof Error ? error.message : String(error),
                severity: 'error',
            });
            return false;
        }
    };
    const openCellEditor = async (
        anchor: HTMLElement,
        activate: () => void,
    ): Promise<void> => {
        anchor.focus();
        activate();
        let inspected: unknown;
        try {
            inspected = editor.execute('table.cell.inspect');
        } catch (error: unknown) {
            ui.notifications.show({
                message: error instanceof Error ? error.message : String(error),
                severity: 'error',
            });
            return;
        }
        close();
        const module = await import('./table-editor-attributes.js');
        module.openTableCellHtmlDialog(
            document,
            (options) => ui.dialogs.open(options),
            tableContextProperty(inspected, 'contentHtml'),
            (value) => {
                anchor.focus();
                activate();
                return execute('table.cell.setHtml', value);
            },
        );
    };
    const openProperties = async (
        anchor: HTMLElement,
        activate: () => void,
        kind: TableContextPropertyKind,
    ): Promise<void> => {
        anchor.focus();
        activate();
        const inspectCommand =
            kind === 'table' ? 'table.inspect' : `table.${kind}.inspect`;
        let inspected: unknown;
        try {
            inspected = editor.execute(inspectCommand);
        } catch (error: unknown) {
            ui.notifications.show({
                message: error instanceof Error ? error.message : String(error),
                severity: 'error',
            });
            return;
        }
        close();
        let attributeModule: typeof TableEditorAttributes;
        try {
            attributeModule = await import('./table-editor-attributes.js');
        } catch {
            ui.notifications.show({
                message: '表格附加属性编辑器加载失败，请重试。',
                severity: 'error',
            });
            return;
        }
        const fields = attributeModule.tablePropertyFields(kind);
        const controls = new Map<
            string,
            HTMLInputElement | HTMLSelectElement
        >();
        const dimensionControls = new Map<
            string,
            TableEditorAttributes.TableDimensionControl
        >();
        const body = document.createElement('div');
        body.className = 'soeditor-table-properties';
        if (kind === 'cell') {
            const selectionHelp = document.createElement('p');
            selectionHelp.className = 'soeditor-table-properties__help';
            selectionHelp.textContent = 'Changes apply to all selected cells.';
            body.append(selectionHelp);
        }
        const primaryFields = document.createElement('div');
        primaryFields.className =
            'soeditor-ui__link-target-controls soeditor-table-properties__primary';
        const advanced = document.createElement('details');
        advanced.className =
            'soeditor-ui__link-advanced soeditor-table-properties__advanced';
        const advancedSummary = document.createElement('summary');
        advancedSummary.textContent = 'Advanced settings';
        const advancedFields = document.createElement('div');
        advancedFields.className =
            'soeditor-ui__link-target-controls soeditor-ui__link-advanced-fields soeditor-table-properties__advanced-fields';
        let hasAdvancedFields = false;
        for (const field of fields) {
            const existing = tableContextProperty(inspected, field.key);
            const target = field.advanced ? advancedFields : primaryFields;
            if (field.advanced) {
                hasAdvancedFields = true;
                if (existing.length > 0) advanced.open = true;
            }
            if (field.type === 'dimension') {
                const dimension = attributeModule.createTableDimensionControl(
                    document,
                    existing,
                    ui.translate,
                    field.label,
                    field.key,
                );
                dimensionControls.set(field.key, dimension);
                target.append(dimension.element);
                continue;
            }
            const label = document.createElement('label');
            label.className = 'soeditor-ui__field';
            label.dataset.tableField = field.key;
            const caption = document.createElement('span');
            caption.textContent = field.label;
            let control: HTMLInputElement | HTMLSelectElement;
            if (field.type === 'select') {
                const select = document.createElement('select');
                const empty = document.createElement('option');
                empty.value = '';
                empty.textContent = 'Default';
                select.append(empty);
                for (const value of field.options ?? []) {
                    const option = document.createElement('option');
                    option.value = value;
                    option.textContent =
                        attributeModule.tablePropertyOptionLabel(value);
                    select.append(option);
                }
                select.value = existing;
                control = select;
            } else {
                const input = document.createElement('input');
                input.type = 'text';
                input.value = existing;
                input.readOnly = field.type === 'readonly';
                control = input;
            }
            controls.set(field.key, control);
            label.append(caption, control);
            target.append(label);
        }
        body.append(primaryFields);
        if (hasAdvancedFields) {
            advanced.append(advancedSummary, advancedFields);
            body.append(advanced);
        }
        const customAttributes = attributeModule.createTableTagAttributeEditor(
            document,
            attributeModule.readTableTagAttributes(
                tableContextValue(inspected, 'customAttributes'),
            ),
            attributeModule.tableAttributeSuggestions(
                kind,
                tableContextProperty(inspected, 'tagName'),
            ),
            attributeModule.managedTableAttributes(kind),
        );
        body.append(customAttributes.element);
        const title =
            kind === 'table'
                ? 'Table properties'
                : kind === 'row'
                  ? 'Row properties'
                  : kind === 'section'
                    ? 'Section properties'
                    : 'Cell properties';
        const command =
            kind === 'table' ? 'table.properties' : `table.${kind}.properties`;
        const dialog = ui.dialogs.open({
            title,
            content: body,
            actions: [
                {
                    kind: 'primary',
                    label: 'Apply',
                    run: () => {
                        for (const dimension of dimensionControls.values()) {
                            if (!dimension.validate()) {
                                dimension.focus();
                                return;
                            }
                        }
                        const attributes = customAttributes.value();
                        if (attributes === undefined) return;
                        const properties: Record<string, unknown> = {};
                        for (const field of fields) {
                            if (field.type === 'readonly') continue;
                            const rawValue =
                                field.type === 'dimension'
                                    ? (dimensionControls
                                          .get(field.key)
                                          ?.value() ?? '')
                                    : (controls.get(field.key)?.value.trim() ??
                                      '');
                            const value = rawValue;
                            properties[field.key] =
                                field.key === 'section'
                                    ? value
                                    : value.length === 0
                                      ? null
                                      : value;
                        }
                        properties.customAttributes = attributes;
                        anchor.focus();
                        activate();
                        if (execute(command, properties)) {
                            dialog.close();
                        }
                    },
                },
            ],
        });
        dialog.element.classList.add(
            'soeditor-ui__link-dialog',
            'soeditor-table-properties-dialog',
        );
        const firstControl = controls.values().next().value;
        if (firstControl !== undefined) firstControl.focus();
        else dimensionControls.values().next().value?.focus();
    };
    const selectScope = (kind: 'row' | 'column' | 'table'): void => {
        try {
            editor.execute(`table.selection.${kind}`);
        } catch (error: unknown) {
            ui.notifications.show({
                message: error instanceof Error ? error.message : String(error),
                severity: 'error',
            });
        }
    };
    const openCaption = async (
        anchor: HTMLElement,
        activate: () => void,
    ): Promise<void> => {
        anchor.focus();
        activate();
        const structureRange = activeRange;
        const hasStructureRange =
            tableRangeBounds(structureRange) !== undefined;
        close();
        let attributeModule: typeof TableEditorAttributes;
        try {
            attributeModule = await import('./table-editor-attributes.js');
        } catch {
            ui.notifications.show({
                message: '表格附加属性编辑器加载失败，请重试。',
                severity: 'error',
            });
            return;
        }
        const service = {
            createColumnGroup: (options: Readonly<Record<string, unknown>>) =>
                editor.execute('table.colgroup.create', options),
            createSection: (kind: 'body' | 'foot' | 'head') =>
                editor.execute('table.section.create', { kind }),
            inspectStructure: () =>
                editor.execute(
                    'table.structure.inspect',
                ) as TableStructureSnapshot,
            moveRows: (options: Readonly<Record<string, unknown>>) =>
                editor.execute('table.section.moveRows', options),
            removeColumnGroup: (groupIndex: number) =>
                editor.execute('table.colgroup.remove', groupIndex),
            removeSection: (sectionIndex: number) =>
                editor.execute('table.section.remove', sectionIndex),
            reorderBodySection: (sectionIndex: number, targetIndex: number) =>
                editor.execute('table.section.reorderBody', {
                    sectionIndex,
                    targetIndex,
                }),
            repairStructure: (repairId: string) =>
                editor.execute('table.structure.repair', repairId),
            updateCaption: (text: string | null) =>
                editor.execute(
                    text === null
                        ? 'table.caption.remove'
                        : 'table.caption.set',
                    ...(text === null ? [] : [text]),
                ),
            updateColumnGroup: (
                groupIndex: number,
                properties: Readonly<Record<string, unknown>>,
            ) =>
                editor.execute('table.colgroup.properties', {
                    groupIndex,
                    properties,
                }),
            updateSection: (
                sectionIndex: number,
                properties: Readonly<Record<string, unknown>>,
            ) =>
                editor.execute('table.section.properties', {
                    sectionIndex,
                    properties,
                }),
        };
        const body = document.createElement('div');
        body.className = 'soeditor-table-structure';
        const status = document.createElement('p');
        status.className = 'soeditor-table-properties__help';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        const run = (action: () => void, message: string): void => {
            try {
                anchor.focus();
                activate();
                action();
                render();
                status.textContent = message;
            } catch (error: unknown) {
                ui.notifications.show({
                    message:
                        error instanceof Error ? error.message : String(error),
                    severity: 'error',
                });
            }
        };
        const actionButton = (
            label: string,
            action: () => void,
            disabled = false,
        ): HTMLButtonElement => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'soeditor-ui__dialog-action';
            if (/^(?:Remove|Delete|删除)/u.test(label)) {
                button.classList.add('is-danger');
            } else if (/^(?:Apply|Save|保存)/u.test(label)) {
                button.classList.add('is-primary');
            }
            button.textContent = label;
            button.disabled = disabled;
            button.addEventListener('click', action);
            return button;
        };
        const render = (): void => {
            let snapshot: TableStructureSnapshot;
            try {
                snapshot = service.inspectStructure();
            } catch (error: unknown) {
                ui.notifications.show({
                    message:
                        error instanceof Error ? error.message : String(error),
                    severity: 'error',
                });
                return;
            }
            const content = document.createElement('div');
            content.className = 'soeditor-table-structure__content';
            const captionCard = document.createElement('section');
            captionCard.className =
                'soeditor-table-structure__card soeditor-table-structure__caption';
            const captionTitle = document.createElement('h3');
            captionTitle.textContent = '表格标题';
            const captionField = document.createElement('label');
            captionField.className = 'soeditor-ui__field';
            const captionLabel = document.createElement('span');
            captionLabel.textContent = '标题文字';
            const captionInput = document.createElement('input');
            captionInput.type = 'text';
            captionInput.value = snapshot.caption.text;
            captionField.append(captionLabel, captionInput);
            const captionActions = document.createElement('div');
            captionActions.className = 'soeditor-table-structure__actions';
            captionActions.append(
                actionButton('保存标题', () =>
                    run(
                        () => service.updateCaption(captionInput.value),
                        '表格标题已保存。',
                    ),
                ),
                actionButton(
                    '删除标题',
                    () =>
                        run(
                            () => service.updateCaption(null),
                            '表格标题已删除。',
                        ),
                    !snapshot.caption.exists,
                ),
            );
            if (snapshot.caption.hasRichContent) {
                const warning = document.createElement('p');
                warning.className = 'soeditor-table-properties__help';
                warning.textContent =
                    '当前标题包含行内结构；只有提交新文字时才会替换为纯文本。';
                captionCard.append(
                    captionTitle,
                    captionField,
                    warning,
                    captionActions,
                );
            } else {
                captionCard.append(captionTitle, captionField, captionActions);
            }
            content.append(captionCard);

            if (body.dataset.advanced === 'true') {
                const sectionTitle = document.createElement('h3');
                sectionTitle.textContent = '表格分区';
                const sectionList = document.createElement('ul');
                for (const section of snapshot.sections) {
                    const item = document.createElement('li');
                    item.className = 'soeditor-table-structure__card';
                    item.dataset.sectionKind = section.kind;
                    const sectionName = document.createElement('strong');
                    sectionName.className =
                        'soeditor-table-structure__item-title';
                    sectionName.textContent = `${section.kind === 'head' ? '表头 thead' : section.kind === 'foot' ? '表尾 tfoot' : '表体 tbody'} · ${String(section.rowCount)} 行`;
                    item.append(sectionName);
                    const sectionAttributes =
                        attributeModule.createTableTagAttributeEditor(
                            document,
                            attributeModule.readTableTagAttributes(
                                section.attributes,
                            ),
                            attributeModule.tableAttributeSuggestions(
                                'section',
                                section.kind === 'head'
                                    ? 'thead'
                                    : section.kind === 'foot'
                                      ? 'tfoot'
                                      : 'tbody',
                            ),
                            attributeModule.managedTableAttributes('section'),
                        );
                    const bodyIndexes = snapshot.sections
                        .filter((candidate) => candidate.kind === 'body')
                        .map((candidate) => candidate.index);
                    const bodyPosition = bodyIndexes.indexOf(section.index);
                    item.append(
                        actionButton(
                            '选中行移到开头',
                            () =>
                                run(
                                    () =>
                                        service.moveRows({
                                            placement: 'start',
                                            range: structureRange,
                                            targetSectionIndex: section.index,
                                        }),
                                    '选中行已移到分区开头。',
                                ),
                            !hasStructureRange,
                        ),
                        actionButton(
                            '选中行移到末尾',
                            () =>
                                run(
                                    () =>
                                        service.moveRows({
                                            placement: 'end',
                                            range: structureRange,
                                            targetSectionIndex: section.index,
                                        }),
                                    '选中行已移到分区末尾。',
                                ),
                            !hasStructureRange,
                        ),
                        actionButton('保存属性', () => {
                            const attributes = sectionAttributes.value();
                            if (attributes === undefined) return;
                            run(
                                () =>
                                    service.updateSection(section.index, {
                                        customAttributes: attributes,
                                    }),
                                '分区属性已保存。',
                            );
                        }),
                        actionButton(
                            '删除空分区',
                            () =>
                                run(
                                    () => service.removeSection(section.index),
                                    '空分区已删除。',
                                ),
                            section.rowCount > 0,
                        ),
                    );
                    if (section.kind === 'body') {
                        item.append(
                            actionButton(
                                '上移',
                                () =>
                                    run(
                                        () =>
                                            service.reorderBodySection(
                                                section.index,
                                                bodyIndexes[bodyPosition - 1] ??
                                                    section.index,
                                            ),
                                        '表体分区已上移。',
                                    ),
                                bodyPosition <= 0,
                            ),
                            actionButton(
                                '下移',
                                () =>
                                    run(
                                        () =>
                                            service.reorderBodySection(
                                                section.index,
                                                bodyIndexes[bodyPosition + 1] ??
                                                    section.index,
                                            ),
                                        '表体分区已下移。',
                                    ),
                                bodyPosition < 0 ||
                                    bodyPosition === bodyIndexes.length - 1,
                            ),
                        );
                    }
                    const attributeDetails = document.createElement('details');
                    attributeDetails.className =
                        'soeditor-table-structure__attributes';
                    const attributeSummary = document.createElement('summary');
                    attributeSummary.textContent = '附加属性';
                    attributeDetails.append(
                        attributeSummary,
                        sectionAttributes.element,
                    );
                    item.append(attributeDetails);
                    sectionList.append(item);
                }
                const createActions = document.createElement('div');
                createActions.className = 'soeditor-table-structure__actions';
                for (const [kind, label] of [
                    ['head', '添加表头'],
                    ['body', '添加表体'],
                    ['foot', '添加表尾'],
                ] as const) {
                    createActions.append(
                        actionButton(
                            label,
                            () =>
                                run(
                                    () => service.createSection(kind),
                                    `${label} created.`,
                                ),
                            kind !== 'body' &&
                                snapshot.sections.some(
                                    (section) => section.kind === kind,
                                ),
                        ),
                    );
                }
                content.append(sectionTitle, sectionList, createActions);

                const columnTitle = document.createElement('h3');
                columnTitle.textContent = '列组';
                const columnList = document.createElement('ul');
                for (const group of snapshot.columnGroups) {
                    const item = document.createElement('li');
                    item.className = 'soeditor-table-structure__card';
                    item.textContent = `Columns ${String(group.startColumn + 1)}–${String(group.startColumn + group.columnCount)} `;
                    if (!group.editable) {
                        item.append(
                            document.createTextNode(group.reason ?? '只读'),
                        );
                    } else if (group.columns.length > 0) {
                        const groupAttributes =
                            attributeModule.createTableTagAttributeEditor(
                                document,
                                attributeModule.readTableTagAttributes(
                                    group.attributes,
                                ),
                                attributeModule.tableAttributeSuggestions(
                                    'section',
                                    'colgroup',
                                ),
                                ['span', 'style'],
                            );
                        const controls = group.columns.map((column, index) => {
                            const definition =
                                document.createElement('section');
                            definition.className =
                                'soeditor-table-structure__column';
                            const heading = document.createElement('strong');
                            heading.textContent = `列定义 ${String(index + 1)}`;
                            const span = document.createElement('input');
                            span.type = 'number';
                            span.min = '1';
                            span.max = '100';
                            span.value = String(column.span);
                            span.setAttribute(
                                'aria-label',
                                `Column ${String(index + 1)} span`,
                            );
                            const spanField = document.createElement('label');
                            spanField.className = 'soeditor-ui__field';
                            const spanCaption = document.createElement('span');
                            spanCaption.textContent = '跨度';
                            spanField.append(spanCaption, span);
                            const width = document.createElement('input');
                            width.type = 'number';
                            width.min = '40';
                            width.max = '1200';
                            width.value =
                                column.width?.replace(/px$/u, '') ?? '';
                            width.placeholder = 'Width';
                            width.setAttribute(
                                'aria-label',
                                `Column ${String(index + 1)} width in pixels`,
                            );
                            const widthField = document.createElement('label');
                            widthField.className = 'soeditor-ui__field';
                            const widthCaption = document.createElement('span');
                            widthCaption.textContent = '宽度（px）';
                            widthField.append(widthCaption, width);
                            const attributes =
                                attributeModule.createTableTagAttributeEditor(
                                    document,
                                    attributeModule.readTableTagAttributes(
                                        column.attributes,
                                    ),
                                    attributeModule.tableAttributeSuggestions(
                                        'section',
                                        'col',
                                    ),
                                    ['span', 'style', 'width'],
                                );
                            const details = document.createElement('details');
                            details.className =
                                'soeditor-table-structure__attributes';
                            const summary = document.createElement('summary');
                            summary.textContent = '附加属性';
                            details.append(summary, attributes.element);
                            definition.append(
                                heading,
                                spanField,
                                widthField,
                                details,
                            );
                            item.append(definition);
                            return { attributes, span, width };
                        });
                        item.append(
                            actionButton('保存列定义', () => {
                                const customAttributes =
                                    groupAttributes.value();
                                const columnAttributes = controls.map(
                                    ({ attributes }) => attributes.value(),
                                );
                                if (
                                    customAttributes === undefined ||
                                    columnAttributes.some(
                                        (attributes) =>
                                            attributes === undefined,
                                    )
                                ) {
                                    return;
                                }
                                run(
                                    () =>
                                        service.updateColumnGroup(group.index, {
                                            customAttributes,
                                            columns: controls.map(
                                                ({ span, width }, index) => ({
                                                    attributes:
                                                        columnAttributes[
                                                            index
                                                        ] ?? [],
                                                    span: Number(span.value),
                                                    ...(width.value.length === 0
                                                        ? {}
                                                        : {
                                                              width: `${width.value}px`,
                                                          }),
                                                }),
                                            ),
                                        }),
                                    '列定义已保存。',
                                );
                            }),
                        );
                        const groupDetails = document.createElement('details');
                        groupDetails.className =
                            'soeditor-table-structure__attributes';
                        const groupSummary = document.createElement('summary');
                        groupSummary.textContent = '列组属性';
                        groupDetails.append(
                            groupSummary,
                            groupAttributes.element,
                        );
                        item.append(groupDetails);
                    } else {
                        const span = document.createElement('input');
                        span.type = 'number';
                        span.min = '1';
                        span.max = '100';
                        span.value = String(group.span ?? group.columnCount);
                        span.setAttribute('aria-label', '列组跨度');
                        item.append(
                            span,
                            actionButton('保存跨度', () =>
                                run(
                                    () =>
                                        service.updateColumnGroup(group.index, {
                                            span: Number(span.value),
                                        }),
                                    '列组跨度已保存。',
                                ),
                            ),
                            actionButton(
                                '删除空列组',
                                () =>
                                    run(
                                        () =>
                                            service.removeColumnGroup(
                                                group.index,
                                            ),
                                        '空列组已删除。',
                                    ),
                                group.columns.length > 0 ||
                                    group.span !== undefined,
                            ),
                        );
                    }
                    columnList.append(item);
                }
                content.append(
                    columnTitle,
                    columnList,
                    actionButton(
                        '添加列组',
                        () =>
                            run(
                                () => service.createColumnGroup({ span: 1 }),
                                '列组已添加。',
                            ),
                        snapshot.columnGroups.length > 0 &&
                            !snapshot.diagnostics.some((diagnostic) =>
                                diagnostic.message.includes('列组覆盖'),
                            ),
                    ),
                );
                for (const diagnostic of snapshot.diagnostics) {
                    const warning = document.createElement('p');
                    warning.className = 'soeditor-table-properties__help';
                    warning.textContent = diagnostic.message;
                    content.append(warning);
                    if (
                        diagnostic.repairable &&
                        diagnostic.repairId !== undefined
                    ) {
                        content.append(
                            actionButton('查看修复', () => {
                                const confirmation =
                                    document.createElement('p');
                                confirmation.textContent = diagnostic.message;
                                const confirmDialog = ui.dialogs.open({
                                    title: '确认修复表格结构',
                                    content: confirmation,
                                    actions: [
                                        {
                                            kind: 'primary',
                                            label: '执行修复',
                                            run: () => {
                                                run(
                                                    () =>
                                                        service.repairStructure(
                                                            diagnostic.repairId ??
                                                                '',
                                                        ),
                                                    '表格结构已修复。',
                                                );
                                                confirmDialog.close();
                                            },
                                        },
                                    ],
                                });
                            }),
                        );
                    }
                }
            }
            body.replaceChildren(content, status);
        };
        render();
        const dialog = ui.dialogs.open({
            title: '表格标题',
            content: body,
            actions: [{ label: '完成', run: () => dialog.close() }],
        });
        dialog.element.classList.add('soeditor-table-structure-dialog');
        body.querySelector<HTMLElement>('input,button')?.focus();
    };
    const selection = (event: Pick<Event, 'target' | 'type'>): void => {
        const origin = event.target;
        if (!(origin instanceof Element)) return;
        const target = origin.closest<HTMLElement>('.soeditor-table-cell');
        if (target === null) return;
        if (
            !target.classList.contains('soeditor-table-cell') ||
            !visual.contains(target)
        ) {
            return;
        }
        const activate = tableSelectionActivation(event);
        const selectedRange = tableSelectionRange(event);
        if (activate === undefined) return;
        const table = target.closest<HTMLElement>('.soeditor-table-widget');
        if (table === null) return;
        if (balloon !== undefined && !balloon.element.isConnected) {
            balloon = undefined;
            commandButtons.clear();
            scopeButtons.length = 0;
        }
        activeTarget = target;
        activeSelection = activate;
        activeRange = selectedTableRange(table, selectedRange) ?? selectedRange;
        ui.refresh();
        if (activeTable !== table) {
            selectionObserver?.disconnect();
            selectionObserver = new MutationObserver(() => {
                activeRange =
                    selectedTableRange(table, activeRange) ?? activeRange;
                refreshCommandButtons();
            });
            selectionObserver.observe(table, {
                attributeFilter: ['class'],
                attributes: true,
                subtree: true,
            });
        }
        globalThis.queueMicrotask(() => {
            if (activeTable !== table) return;
            activeRange = selectedTableRange(table, activeRange) ?? activeRange;
            refreshCommandButtons();
        });
        if (balloon !== undefined && activeTable === table) {
            refreshCommandButtons();
            return;
        }
        close();
        activeTable = table;
        attachResizeHandles(table);
        balloon = ui.balloons.show({
            anchor: table,
            placement: 'above',
            avoid: () => {
                const cell = table.querySelector(
                    '.soeditor-table-cell.is-editing',
                );
                return cell ? [cell.getBoundingClientRect()] : [];
            },
            content: (container) => {
                container.classList.add('soeditor-table-context');
                container.setAttribute('aria-label', 'Table tools');
                const caption = document.createElement('button');
                caption.type = 'button';
                caption.className = 'soeditor-table-context__button';
                ui.setIcon(caption, 'table.properties', 'Table caption');
                caption.title = 'Table caption';
                caption.setAttribute('aria-label', 'Table caption');
                captionButton = caption;
                caption.addEventListener('click', () => {
                    const current = activeTarget;
                    const select = activeSelection;
                    if (current !== undefined && select !== undefined) {
                        void openCaption(current, select);
                    }
                });
                container.append(caption);
                const properties = document.createElement('button');
                properties.type = 'button';
                properties.className = 'soeditor-table-context__button';
                ui.setIcon(properties, 'table.properties', 'Table properties');
                properties.title = 'Table properties';
                properties.setAttribute('aria-label', 'Table properties');
                propertiesButton = properties;
                properties.addEventListener('click', () => {
                    const current = activeTarget;
                    const select = activeSelection;
                    if (current !== undefined && select !== undefined) {
                        const kind = classicTableSelectionKind(
                            activeTable,
                            activeRange,
                        );
                        void openProperties(
                            current,
                            select,
                            kind === 'rows' ? 'row' : 'table',
                        );
                    }
                });
                container.append(properties);
                const cellProperties = document.createElement('button');
                cellProperties.type = 'button';
                cellProperties.className = 'soeditor-table-context__button';
                ui.setIcon(
                    cellProperties,
                    'table.properties',
                    'Cell properties',
                );
                cellProperties.title = 'Cell properties';
                cellProperties.setAttribute('aria-label', 'Cell properties');
                cellPropertiesButton = cellProperties;
                cellProperties.addEventListener('click', () => {
                    const current = activeTarget;
                    const select = activeSelection;
                    if (current !== undefined && select !== undefined) {
                        void openProperties(current, select, 'cell');
                    }
                });
                container.append(cellProperties);
                const sectionProperties = document.createElement('button');
                sectionProperties.type = 'button';
                sectionProperties.className = 'soeditor-table-context__button';
                ui.setIcon(
                    sectionProperties,
                    'table.properties',
                    'Section properties',
                );
                sectionProperties.title = 'Section properties';
                sectionProperties.setAttribute(
                    'aria-label',
                    'Section properties',
                );
                sectionProperties.disabled = !editor.commands.canExecute(
                    'table.section.properties',
                );
                commandButtons.set(
                    'table.section.properties',
                    sectionProperties,
                );
                sectionProperties.addEventListener('click', () => {
                    const current = activeTarget;
                    const select = activeSelection;
                    if (current !== undefined && select !== undefined) {
                        void openProperties(current, select, 'section');
                    }
                });
                container.append(sectionProperties);
                const editCellHtml = document.createElement('button');
                editCellHtml.type = 'button';
                editCellHtml.className = 'soeditor-table-context__button';
                ui.setIcon(editCellHtml, 'editor.source', 'Edit cell HTML');
                editCellHtml.title = 'Edit cell HTML';
                editCellHtml.setAttribute('aria-label', 'Edit cell HTML');
                editCellHtml.disabled =
                    !editor.commands.canExecute('table.cell.setHtml');
                commandButtons.set('table.cell.setHtml', editCellHtml);
                editCellHtml.addEventListener('click', () => {
                    const current = activeTarget;
                    const select = activeSelection;
                    if (current !== undefined && select !== undefined) {
                        void openCellEditor(current, select);
                    }
                });
                container.append(editCellHtml);
                for (const [kind, label, icon] of [
                    ['row', 'Select row', 'table.row.insertAfter'],
                    ['column', 'Select column', 'table.column.insertAfter'],
                ] as const) {
                    const selectButton = document.createElement('button');
                    selectButton.type = 'button';
                    selectButton.className = 'soeditor-table-context__button';
                    ui.setIcon(selectButton, icon, label);
                    selectButton.title = label;
                    selectButton.setAttribute('aria-label', label);
                    selectButton.dataset.selectionScope = kind;
                    selectButton.addEventListener('click', () =>
                        selectScope(kind),
                    );
                    scopeButtons.push(selectButton);
                    container.append(selectButton);
                }
                const actions = [
                    ['table.cells.merge', 'Merge cells'],
                    ['table.cells.clear', 'Clear cells'],
                    ['table.row.insertBefore', 'Insert row above'],
                    ['table.row.insertAfter', 'Insert row below'],
                    ['table.row.remove', 'Delete row'],
                    ['table.column.insertBefore', 'Insert column left'],
                    ['table.column.insertAfter', 'Insert column right'],
                    ['table.column.remove', 'Delete column'],
                    ['table.header.toggle', 'Toggle header cell'],
                    ['table.cell.splitColumns', 'Split cell vertically'],
                    ['table.cell.splitRows', 'Split cell horizontally'],
                    ['table.cell.split', 'Split completely'],
                    ['table.remove', 'Delete table'],
                ] as const;
                for (const [command, label] of actions) {
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'soeditor-table-context__button';
                    if (command === 'table.cells.merge') {
                        button.classList.add(
                            'soeditor-table-context__button--primary',
                        );
                    }
                    button.dataset.command = command;
                    ui.setIcon(
                        button,
                        command.startsWith('table.cell.split')
                            ? 'table.cell.split'
                            : command,
                        label,
                    );
                    button.title = ui.translate(label);
                    button.setAttribute('aria-label', ui.translate(label));
                    button.disabled =
                        command === 'table.cells.merge'
                            ? !canMerge(activeRange, table)
                            : command.startsWith('table.cell.split')
                              ? !canSplit(command)
                              : !editor.commands.canExecute(command);
                    commandButtons.set(command, button);
                    button.addEventListener('click', () => {
                        if (command === 'table.remove') {
                            const confirmation = document.createElement('p');
                            confirmation.textContent =
                                '删除整张表格及其中所有内容？此操作可以撤销。';
                            const confirmDialog = ui.dialogs.open({
                                title: 'Delete table',
                                content: confirmation,
                                actions: [
                                    {
                                        kind: 'danger',
                                        label: 'Delete table',
                                        run: () => {
                                            confirmDialog.close();
                                            activeSelection?.();
                                            execute(command);
                                        },
                                    },
                                    {
                                        label: 'Cancel',
                                        run: () => confirmDialog.close(),
                                    },
                                ],
                            });
                            return;
                        }
                        if (activeRange !== undefined) {
                            const insertOptions = tableInsertOptions(
                                command,
                                activeTable,
                                activeRange,
                            );
                            execute(
                                command,
                                activeRange,
                                ...(insertOptions === undefined
                                    ? []
                                    : [insertOptions]),
                            );
                        } else {
                            execute(command);
                        }
                    });
                    container.append(button);
                }
                const extras = Array.from(
                    container.children,
                ) as HTMLButtonElement[];
                container.replaceChildren();
                container.setAttribute('role', 'toolbar');
                const menus: {
                    button: HTMLButtonElement;
                    panel: HTMLElement;
                }[] = [];
                const hideMenus = (): void => {
                    for (const { button, panel } of menus) {
                        panel.hidden = true;
                        button.setAttribute('aria-expanded', 'false');
                    }
                };
                dismissMenus = hideMenus;
                const menu = (label: string, axis: string): HTMLElement => {
                    const group = document.createElement('div');
                    group.className = 'soeditor-table-context__dropdown';
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'soeditor-table-context__button';
                    button.dataset.tableMenu = axis;
                    button.title = ui.translate(label);
                    button.setAttribute('aria-label', ui.translate(label));
                    button.setAttribute('aria-haspopup', 'true');
                    button.setAttribute('aria-expanded', 'false');
                    const icon = document.createElement('span');
                    icon.className = `soeditor-table-context__grid soeditor-table-context__grid--${axis}`;
                    icon.setAttribute('aria-hidden', 'true');
                    for (let index = 0; index < 9; index++)
                        icon.append(document.createElement('i'));
                    if (axis === 'properties') icon.replaceChildren();
                    const arrow = document.createElement('span');
                    arrow.className = 'soeditor-table-context__chevron';
                    arrow.setAttribute('aria-hidden', 'true');
                    button.append(icon, arrow);
                    const panel = document.createElement('div');
                    panel.className = 'soeditor-table-context__menu';
                    panel.setAttribute('role', 'group');
                    panel.setAttribute('aria-label', ui.translate(label));
                    panel.hidden = true;
                    menus.push({ button, panel });
                    const open = (): void => {
                        hideMenus();
                        panel.hidden = false;
                        refreshCommandButtons();
                        panel.style.transform = '';
                        panel.style.top = 'calc(100% + 4px)';
                        panel.style.bottom = 'auto';
                        panel.hidden = false;
                        button.setAttribute('aria-expanded', 'true');
                        const trigger = button.getBoundingClientRect();
                        const below =
                            (document.defaultView?.innerHeight ?? 768) -
                            trigger.bottom -
                            12;
                        const above = trigger.top - 12;
                        const upward =
                            panel.scrollHeight > below && above > below;
                        panel.style.maxHeight = `${Math.max(48, upward ? above : below)}px`;
                        if (upward) {
                            panel.style.top = 'auto';
                            panel.style.bottom = 'calc(100% + 4px)';
                        }
                        const bounds = panel.getBoundingClientRect();
                        panel.style.transform = `translateX(${Math.min(0, document.documentElement.clientWidth - bounds.right - 8)}px)`;
                    };
                    button.addEventListener('click', () =>
                        panel.hidden ? open() : hideMenus(),
                    );
                    let returnFocus = button;
                    const openFromKeyboard = (event: KeyboardEvent): void => {
                        if (event.key !== 'ArrowDown') return;
                        returnFocus = event.currentTarget as HTMLButtonElement;
                        event.preventDefault();
                        open();
                        panel
                            .querySelector<HTMLButtonElement>(
                                'button:not(:disabled):not([hidden])',
                            )
                            ?.focus();
                    };
                    button.addEventListener('keydown', openFromKeyboard);
                    button.addEventListener('click', () => {
                        returnFocus = button;
                    });
                    group.addEventListener('keydown', (event) => {
                        if (event.key === 'Escape') {
                            event.preventDefault();
                            event.stopPropagation();
                            hideMenus();
                            returnFocus.focus();
                            return;
                        }
                        if (event.key === 'Tab') {
                            hideMenus();
                            return;
                        }
                        if (!panel.contains(event.target as Node)) return;
                        const buttons = Array.from(
                            panel.querySelectorAll<HTMLButtonElement>(
                                'button:not(:disabled):not([hidden])',
                            ),
                        );
                        const current = buttons.indexOf(
                            event.target as HTMLButtonElement,
                        );
                        const index =
                            event.key === 'Home'
                                ? 0
                                : event.key === 'End'
                                  ? buttons.length - 1
                                  : event.key === 'ArrowDown'
                                    ? (current + 1) % buttons.length
                                    : event.key === 'ArrowUp'
                                      ? (current + buttons.length - 1) %
                                        buttons.length
                                      : -1;
                        if (index < 0) return;
                        event.preventDefault();
                        buttons[index]?.focus();
                    });
                    if (axis === 'merge') {
                        const primary = document.createElement('button');
                        primary.type = 'button';
                        primary.className = 'soeditor-table-context__button';
                        primary.dataset.tableMerge = 'true';
                        primary.title = ui.translate('Merge selected cells');
                        primary.setAttribute(
                            'aria-label',
                            ui.translate('Merge selected cells'),
                        );
                        primary.append(icon);
                        primary.addEventListener('keydown', openFromKeyboard);
                        primary.addEventListener('click', () => {
                            returnFocus = primary;
                            const range =
                                activeTable === undefined
                                    ? activeRange
                                    : (selectedTableRange(
                                          activeTable,
                                          activeRange,
                                      ) ?? activeRange);
                            if (
                                classicTableSelectionKind(
                                    activeTable,
                                    range,
                                ) !== 'caret'
                            ) {
                                if (canMerge(range))
                                    execute('table.cells.merge', range);
                                else open();
                            } else open();
                        });
                        group.classList.add(
                            'soeditor-table-context__dropdown--split',
                        );
                        group.append(primary);
                    }
                    group.append(button, panel);
                    container.append(group);
                    return panel;
                };
                const columnMenu = menu('Column', 'column');
                const rowMenu = menu('Row', 'row');
                const mergeMenu = menu('Merge and split cells', 'merge');
                const moreMenu = menu('More table tools', 'properties');
                container.addEventListener('keydown', (event) => {
                    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')
                        return;
                    const target = event.target;
                    if (!(target instanceof Element)) return;
                    const group = target.closest(
                        '.soeditor-table-context__dropdown',
                    );
                    const index = menus.findIndex(
                        ({ button }) => button.parentElement === group,
                    );
                    if (index < 0) return;
                    event.preventDefault();
                    event.stopPropagation();
                    const direction =
                        (event.key === 'ArrowRight' ? 1 : -1) *
                        (getComputedStyle(container).direction === 'rtl'
                            ? -1
                            : 1);
                    const next =
                        menus[
                            (index + direction + menus.length) % menus.length
                        ];
                    if (next === undefined) return;
                    const wasOpen = menus.some(({ panel }) => !panel.hidden);
                    next.button.focus();
                    if (wasOpen) {
                        const Keyboard =
                            document.defaultView?.KeyboardEvent ??
                            KeyboardEvent;
                        next.button.dispatchEvent(
                            new Keyboard('keydown', {
                                key: 'ArrowDown',
                                bubbles: true,
                            }),
                        );
                    }
                });
                const item = (
                    panel: HTMLElement,
                    label: string,
                    run: () => void,
                ): HTMLButtonElement => {
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'soeditor-table-context__button';
                    button.textContent = ui.translate(label);
                    button.setAttribute('aria-label', ui.translate(label));
                    button.addEventListener('click', run);
                    panel.append(button);
                    return button;
                };
                const headerButtons: {
                    button: HTMLButtonElement;
                    axis: 'row' | 'column';
                }[] = [];
                for (const axis of ['column', 'row'] as const) {
                    const button = item(
                        axis === 'column' ? columnMenu : rowMenu,
                        axis === 'column' ? 'Header column' : 'Header row',
                        () => {
                            execute(
                                axis === 'row'
                                    ? 'table.header.firstRow'
                                    : 'table.header.firstColumn',
                                activeRange,
                                button.getAttribute('aria-checked') !== 'true',
                            );
                        },
                    );
                    button.setAttribute('role', 'switch');
                    button.classList.add('soeditor-table-context__switch');
                    headerButtons.push({ button, axis });
                }
                const directions: {
                    button: HTMLButtonElement;
                    row: number;
                    column: number;
                }[] = [];
                for (const [label, row, column] of [
                    ['Merge cell up', -1, 0],
                    ['Merge cell right', 0, 1],
                    ['Merge cell down', 1, 0],
                    ['Merge cell left', 0, -1],
                ] as const) {
                    const button = item(mergeMenu, label, () => {
                        const range = neighborRange(row, column);
                        if (range !== undefined)
                            execute('table.cells.merge', range);
                    });
                    directions.push({ button, row, column });
                }
                const neighborRange = (
                    row: number,
                    column: number,
                ): unknown => {
                    const bounds = tableRangeBounds(activeRange);
                    if (
                        bounds === undefined ||
                        bounds.top !== bounds.bottom ||
                        bounds.left !== bounds.right
                    )
                        return undefined;
                    const cell = activeTarget?.matches('td,th')
                        ? activeTarget
                        : activeTarget?.closest('td,th');
                    const rowspan = Number(cell?.getAttribute('rowspan') ?? 1);
                    const colspan = Number(cell?.getAttribute('colspan') ?? 1);
                    const candidate = {
                        anchor: {
                            row: bounds.top + Math.min(row, 0),
                            column: bounds.left + Math.min(column, 0),
                        },
                        focus: {
                            row: bounds.top + rowspan - 1 + Math.max(row, 0),
                            column:
                                bounds.left + colspan - 1 + Math.max(column, 0),
                        },
                    };
                    const grid = tableCellGrid(activeTable);
                    const limits = tableRangeBounds(candidate);
                    if (
                        limits === undefined ||
                        limits.top < 0 ||
                        limits.left < 0 ||
                        limits.bottom >= grid.length ||
                        limits.right >= (grid[0]?.length ?? 0)
                    )
                        return undefined;
                    const cells = new Set(
                        grid
                            .slice(limits.top, limits.bottom + 1)
                            .flatMap((line) =>
                                line.slice(limits.left, limits.right + 1),
                            ),
                    );
                    for (const [r, line] of grid.entries())
                        for (const [c, cell] of line.entries()) {
                            if (!cells.has(cell)) continue;
                            candidate.anchor.row = Math.min(
                                candidate.anchor.row,
                                r,
                            );
                            candidate.anchor.column = Math.min(
                                candidate.anchor.column,
                                c,
                            );
                            candidate.focus.row = Math.max(
                                candidate.focus.row,
                                r,
                            );
                            candidate.focus.column = Math.max(
                                candidate.focus.column,
                                c,
                            );
                        }
                    return candidate;
                };
                refreshMenus = () => {
                    for (const { button, row, column } of directions) {
                        if (mergeMenu.hidden) continue;
                        const range = neighborRange(row, column);
                        try {
                            button.disabled =
                                range === undefined ||
                                editor.execute(
                                    'table.cells.canMerge',
                                    range,
                                ) !== true;
                        } catch {
                            button.disabled = true;
                        }
                        button.title = button.disabled
                            ? ui.translate(
                                  classicTableSelectionKind(
                                      activeTable,
                                      activeRange,
                                  ) === 'caret'
                                      ? 'Cannot merge with the cell in this direction.'
                                      : 'Select one cell to merge with its neighbor.',
                              )
                            : (button.getAttribute('aria-label') ?? '');
                    }
                    const grid = tableCellGrid(activeTable);
                    for (const { button, axis } of headerButtons) {
                        const cells = [
                            ...new Set(
                                axis === 'column'
                                    ? grid.map((row) => row[0])
                                    : (grid[0] ?? []),
                            ),
                        ].filter(
                            (cell): cell is HTMLTableCellElement =>
                                cell !== undefined,
                        );
                        const exclusive = cells.filter((cell) =>
                            axis === 'row'
                                ? !grid.map((row) => row[0]).includes(cell)
                                : !(grid[0] ?? []).includes(cell),
                        );
                        const checked =
                            exclusive.length > 0
                                ? exclusive.every(
                                      (cell) => cell.tagName === 'TH',
                                  )
                                : cells.length > 0 &&
                                  cells.every(
                                      (cell) =>
                                          cell.tagName === 'TH' &&
                                          (!cell.hasAttribute('scope') ||
                                              cell.getAttribute('scope') ===
                                                  (axis === 'row'
                                                      ? 'col'
                                                      : 'row')),
                                  );
                        button.setAttribute('aria-checked', String(checked));
                        button.disabled = !editor.commands.canExecute(
                            axis === 'row'
                                ? 'table.header.firstRow'
                                : 'table.header.firstColumn',
                        );
                    }
                };
                for (const button of extras) {
                    const command = button.dataset.command ?? '';
                    const scope = button.dataset.selectionScope;
                    const panel =
                        command.startsWith('table.column.') ||
                        scope === 'column'
                            ? columnMenu
                            : command.startsWith('table.row.') ||
                                scope === 'row'
                              ? rowMenu
                              : command === 'table.cells.merge' ||
                                  command === 'table.cell.splitRows' ||
                                  command === 'table.cell.splitColumns'
                                ? mergeMenu
                                : moreMenu;
                    button.textContent = ui.translate(
                        button.getAttribute('aria-label') ?? '',
                    );
                    panel.append(button);
                }
                // Keep selection last, matching the row/column operation order.
                for (const button of scopeButtons) {
                    (button.dataset.selectionScope === 'column'
                        ? columnMenu
                        : rowMenu
                    ).append(button);
                }
                refreshMenus();
            },
        });
        balloon.element.classList.add('soeditor-ui__table-balloon');
    };
    const edit = (event: Event): void => {
        const origin = event.target;
        const target =
            origin instanceof Element
                ? origin.closest<HTMLElement>('.soeditor-table-cell')
                : null;
        const activate = tableSelectionActivation(event);
        if (
            target !== null &&
            target.classList.contains('soeditor-table-cell') &&
            visual.contains(target) &&
            activate !== undefined
        ) {
            openCellEditor(target, activate);
        }
    };
    const editingStart = (): void => ui.refresh();
    const editingEnd = (): void => ui.refresh();
    const refreshSelectionState = (): void => {
        globalThis.queueMicrotask(() => {
            if (activeTable === undefined) return;
            activeRange =
                selectedTableRange(activeTable, activeRange) ?? activeRange;
            refreshCommandButtons();
        });
    };
    const pointerDown = (event: PointerEvent): void => {
        const path = event.composedPath();
        const target = path.find(
            (candidate): candidate is Node => candidate instanceof Node,
        );
        if (!(target instanceof Node)) return;
        if (
            path.some(
                (candidate) =>
                    candidate instanceof Element &&
                    candidate.closest('.soeditor-table-resize-overlay') !==
                        null,
            )
        ) {
            return;
        }
        if (
            path.some(
                (candidate) =>
                    candidate instanceof Element &&
                    candidate.closest(
                        '.soeditor-ui__chrome, .soeditor-classic__source, .soeditor-classic__workspace-picker, [data-classic-action], .soeditor-classic__pane-resize-handle, .soeditor-classic__resize-handle',
                    ) !== null,
            )
        ) {
            return;
        }
        if (
            balloon !== undefined &&
            path.some(
                (candidate) =>
                    candidate instanceof Node &&
                    balloon?.element.contains(candidate) === true,
            )
        ) {
            return;
        }
        if (
            path.some(
                (candidate) =>
                    candidate instanceof Element &&
                    candidate.closest('.soeditor-table-cell') !== null,
            )
        ) {
            dismissMenus?.();
            return;
        }
        close();
        activeTable = undefined;
        activeTarget = undefined;
        activeSelection = undefined;
        activeRange = undefined;
        selectionObserver?.disconnect();
        selectionObserver = undefined;
    };
    const keydown = (event: KeyboardEvent): void => {
        if (event.key === 'Escape' && resizeSession !== undefined) {
            event.preventDefault();
            event.stopPropagation();
            cancelResize();
            return;
        }
        if (
            event.target instanceof Node &&
            balloon?.element.contains(event.target)
        )
            return;
        if (event.key === 'Escape' && balloon !== undefined) {
            event.preventDefault();
            close();
            visual.focus();
        }
    };
    visual.addEventListener('soeditor:table-selection', selection);
    visual.addEventListener('soeditor:table-edit', edit);
    visual.addEventListener('soeditor:table-editing-start', editingStart);
    visual.addEventListener('soeditor:table-editing-end', editingEnd);
    visual.addEventListener('click', refreshSelectionState);
    document.addEventListener('pointerdown', pointerDown, true);
    document.addEventListener('keydown', keydown, true);
    document.defaultView?.addEventListener('blur', cancelResize);
    if (initialEvent !== undefined) selection(initialEvent);
    return () => {
        disposed = true;
        document.defaultView?.removeEventListener('blur', cancelResize);
        disposeDocumentChange();
        disposeProjection();
        projectionObserver?.disconnect();
        projectionObserver = undefined;
        if (resyncFrame !== undefined) {
            document.defaultView?.cancelAnimationFrame(resyncFrame);
            resyncFrame = undefined;
        }
        close();
        selectionObserver?.disconnect();
        visual.removeEventListener('soeditor:table-selection', selection);
        visual.removeEventListener('soeditor:table-edit', edit);
        visual.removeEventListener(
            'soeditor:table-editing-start',
            editingStart,
        );
        visual.removeEventListener('soeditor:table-editing-end', editingEnd);
        visual.removeEventListener('click', refreshSelectionState);
        document.removeEventListener('pointerdown', pointerDown, true);
        document.removeEventListener('keydown', keydown, true);
    };
}

function tableSelectionActivation(event: object): (() => void) | undefined {
    const detail: unknown = Reflect.get(event, 'detail');
    if (typeof detail !== 'object' || detail === null) return undefined;
    const activate: unknown = Reflect.get(detail, 'activate');
    return typeof activate === 'function'
        ? () => {
              Reflect.apply(activate, undefined, []);
          }
        : undefined;
}

function tableSelectionRange(event: object): unknown {
    const detail: unknown = Reflect.get(event, 'detail');
    return typeof detail === 'object' && detail !== null
        ? Reflect.get(detail, 'range')
        : undefined;
}

function selectedTableRange(table: HTMLElement, previous?: unknown): unknown {
    const cells = Array.from(
        table.querySelectorAll<HTMLElement>(
            '.soeditor-table-cell.is-structurally-selected',
        ),
    );
    if (cells.length === 0) return undefined;
    const grid = tableCellGrid(table);
    const selected = new Set(
        cells.map((cell) =>
            cell.matches('td,th') ? cell : cell.closest('td,th'),
        ),
    );
    // Row/column selections intentionally cut across spans for insertion
    // and deletion. Only a cell rectangle expands to full cell extents.
    const previousKind =
        typeof previous === 'object' && previous !== null
            ? Reflect.get(previous, 'kind')
            : undefined;
    const previousBounds = tableRangeBounds(previous);
    if (
        previousBounds !== undefined &&
        ['rows', 'columns', 'table'].includes(String(previousKind))
    ) {
        const previousCells = new Set(
            grid
                .slice(previousBounds.top, previousBounds.bottom + 1)
                .flatMap((line) =>
                    line.slice(previousBounds.left, previousBounds.right + 1),
                ),
        );
        if (
            previousCells.size === selected.size &&
            [...previousCells].every((cell) => selected.has(cell))
        )
            return previous;
    }
    const positions: { row: number; column: number }[] = [];
    for (const [row, line] of grid.entries())
        for (const [column, cell] of line.entries()) {
            if (selected.has(cell)) positions.push({ row, column });
        }
    if (positions.length === 0) return undefined;
    const rows = positions.map((position) => position.row);
    const columns = positions.map((position) => position.column);
    if (selected.size === 1)
        return {
            anchor: { row: Math.min(...rows), column: Math.min(...columns) },
            focus: { row: Math.min(...rows), column: Math.min(...columns) },
        };
    return {
        anchor: { column: Math.min(...columns), row: Math.min(...rows) },
        focus: { column: Math.max(...columns), row: Math.max(...rows) },
        ...(['cells', 'columns', 'rows', 'table'].includes(String(previousKind))
            ? { kind: previousKind }
            : {}),
    };
}

type ClassicTableSelectionKind =
    'caret' | 'cells' | 'rows' | 'columns' | 'table';

function classicTableSelectionKind(
    _table: HTMLElement | undefined,
    range: unknown,
): ClassicTableSelectionKind {
    const bounds = tableRangeBounds(range);
    if (bounds === undefined) return 'caret';
    if (bounds.top === bounds.bottom && bounds.left === bounds.right)
        return 'caret';
    if (typeof range === 'object' && range !== null) {
        const explicit = Reflect.get(range, 'kind');
        if (['cells', 'columns', 'rows', 'table'].includes(String(explicit))) {
            return explicit as Exclude<ClassicTableSelectionKind, 'caret'>;
        }
    }
    return 'cells';
}

function tableScopeLabel(
    ui: EditorUi,
    kind: ClassicTableSelectionKind,
    range: unknown,
): string {
    const bounds = tableRangeBounds(range);
    if (kind === 'table') return ui.translate('Table');
    if (kind === 'rows') {
        const count = bounds === undefined ? 1 : bounds.bottom - bounds.top + 1;
        return `${ui.translate('Row')} · ${String(count)}`;
    }
    if (kind === 'columns') {
        const count = bounds === undefined ? 1 : bounds.right - bounds.left + 1;
        return `${ui.translate('Column')} · ${String(count)}`;
    }
    if (kind === 'cells' && bounds !== undefined) {
        return `${ui.translate('Cell')} · ${String(bounds.right - bounds.left + 1)} × ${String(bounds.bottom - bounds.top + 1)}`;
    }
    if (bounds !== undefined) {
        return `${ui.translate('Cell')} · R${String(bounds.top + 1)} C${String(bounds.left + 1)}`;
    }
    return ui.translate('Cell');
}

function capitalizeMode(mode: string): string {
    return mode.length === 0
        ? mode
        : `${mode[0]?.toUpperCase() ?? ''}${mode.slice(1)}`;
}

function tableRangeBounds(
    range: unknown,
):
    | Readonly<{ bottom: number; left: number; right: number; top: number }>
    | undefined {
    if (typeof range !== 'object' || range === null) return undefined;
    const anchor = Reflect.get(range, 'anchor');
    const focus = Reflect.get(range, 'focus');
    if (
        typeof anchor !== 'object' ||
        anchor === null ||
        typeof focus !== 'object' ||
        focus === null
    )
        return undefined;
    const anchorRow = Reflect.get(anchor, 'row');
    const anchorColumn = Reflect.get(anchor, 'column');
    const focusRow = Reflect.get(focus, 'row');
    const focusColumn = Reflect.get(focus, 'column');
    if (
        typeof anchorRow !== 'number' ||
        !Number.isInteger(anchorRow) ||
        typeof anchorColumn !== 'number' ||
        !Number.isInteger(anchorColumn) ||
        typeof focusRow !== 'number' ||
        !Number.isInteger(focusRow) ||
        typeof focusColumn !== 'number' ||
        !Number.isInteger(focusColumn)
    )
        return undefined;
    return {
        bottom: Math.max(anchorRow, focusRow),
        left: Math.min(anchorColumn, focusColumn),
        right: Math.max(anchorColumn, focusColumn),
        top: Math.min(anchorRow, focusRow),
    };
}

function tableCommandApplies(
    command: string,
    kind: ClassicTableSelectionKind,
): boolean {
    if (command === 'table.remove') {
        return kind === 'caret' || kind === 'table';
    }
    if (command === 'table.section.properties') {
        return kind === 'caret' || kind === 'rows';
    }
    if (command === 'table.cell.setHtml') {
        return kind === 'caret';
    }
    if (kind === 'table') {
        return ['table.cells.clear', 'table.remove'].includes(command);
    }
    if (kind === 'rows') {
        return (
            !command.startsWith('table.column.') &&
            !command.startsWith('table.cell.split')
        );
    }
    if (kind === 'columns') {
        return (
            !command.startsWith('table.row.') &&
            !command.startsWith('table.cell.split')
        );
    }
    if (kind === 'cells') {
        return [
            'table.cells.merge',
            'table.cells.clear',
            'table.header.toggle',
        ].includes(command);
    }
    if (kind === 'caret') return command !== 'table.cells.merge';
    return command !== 'table.cells.merge' && command !== 'table.remove';
}

function tableInsertOptions(
    command: string,
    table: HTMLElement | undefined,
    range: unknown,
): Readonly<{ count: number }> | undefined {
    const bounds = tableRangeBounds(range);
    const kind = classicTableSelectionKind(table, range);
    if (bounds === undefined) return undefined;
    if (command.startsWith('table.row.insert') && kind === 'rows') {
        return { count: bounds.bottom - bounds.top + 1 };
    }
    if (command.startsWith('table.column.insert') && kind === 'columns') {
        return { count: bounds.right - bounds.left + 1 };
    }
    return undefined;
}

function tableContextProperty(value: unknown, key: string): string {
    if (typeof value !== 'object' || value === null) return '';
    const candidate: unknown = Reflect.get(value, key);
    return typeof candidate === 'string' || typeof candidate === 'number'
        ? String(candidate)
        : '';
}

function tableContextValue(value: unknown, key: string): unknown {
    return typeof value === 'object' && value !== null
        ? Reflect.get(value, key)
        : undefined;
}

function tableCellGrid(
    table: HTMLElement | undefined,
): HTMLTableCellElement[][] {
    const native = table?.matches('table')
        ? table
        : table?.querySelector('table');
    if (!(native instanceof HTMLTableElement)) return [];
    if (native.rows.length > 100) return [];
    let positions = 0;
    const grid: HTMLTableCellElement[][] = [];
    for (const [rowIndex, row] of Array.from(native.rows).entries()) {
        const line = (grid[rowIndex] ??= []);
        let column = 0;
        for (const cell of Array.from(row.cells)) {
            while (line[column] !== undefined) column++;
            for (
                let y = rowIndex;
                y <
                Math.min(
                    native.rows.length,
                    rowIndex + Math.max(1, cell.rowSpan),
                );
                y++
            ) {
                const target = (grid[y] ??= []);
                for (let x = column; x < column + cell.colSpan; x++) {
                    if (x >= 100 || ++positions > 1000) return [];
                    target[x] = cell;
                }
            }
            column += cell.colSpan;
        }
    }
    return grid;
}
