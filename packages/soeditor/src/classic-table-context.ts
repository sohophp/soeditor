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
    let resyncFrame: number | undefined;
    let resyncAttempts = 0;
    let resizeDragging = false;
    let projectionObserver: MutationObserver | undefined;
    const refreshCommandButtons = (): void => {
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
            propertiesButton.title = ui.translate(label);
            propertiesButton.setAttribute('aria-label', ui.translate(label));
        }
        for (const [command, button] of commandButtons) {
            button.disabled =
                command === 'table.cells.merge'
                    ? !canMerge(
                          activeTable === undefined
                              ? activeRange
                              : (selectedTableRange(activeTable, activeRange) ??
                                    activeRange),
                      )
                    : command.startsWith('table.cell.split')
                      ? !canSplit(command)
                      : !editor.commands.canExecute(command);
            button.hidden = !tableCommandApplies(command, selectionKind);
            if (button.disabled && !button.hidden) {
                if (command === 'table.cells.merge') {
                    button.title =
                        '请选择同一表格分区内、不含现有跨度的完整矩形。';
                } else if (command.startsWith('table.cell.split')) {
                    button.title =
                        command === 'table.cell.splitRows'
                            ? '当前单元格没有可按行拆分的 rowspan。'
                            : command === 'table.cell.splitColumns'
                              ? '当前单元格没有可按列拆分的 colspan。'
                              : '当前单元格没有可拆分的跨度。';
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
        if (typeof range !== 'object' || range === null) return false;
        const anchor = Reflect.get(range, 'anchor');
        const focus = Reflect.get(range, 'focus');
        if (
            typeof anchor !== 'object' ||
            anchor === null ||
            typeof focus !== 'object' ||
            focus === null
        )
            return false;
        const rows = [Reflect.get(anchor, 'row'), Reflect.get(focus, 'row')];
        const columns = [
            Reflect.get(anchor, 'column'),
            Reflect.get(focus, 'column'),
        ];
        if (![...rows, ...columns].every(Number.isInteger)) return false;
        const selectedCount =
            (Math.abs(Number(rows[0]) - Number(rows[1])) + 1) *
            (Math.abs(Number(columns[0]) - Number(columns[1])) + 1);
        if (selectedCount < 2 || table === undefined) return false;
        const selectedCells = Array.from(
            table.querySelectorAll<HTMLElement>(
                '.soeditor-table-cell.is-structurally-selected',
            ),
        );
        if (selectedCells.length !== selectedCount) return false;
        const sections = new Set(
            selectedCells.map((cell) => {
                const nativeCell = cell.matches('td,th')
                    ? cell
                    : cell.closest<HTMLElement>('td,th');
                return nativeCell?.parentElement?.parentElement;
            }),
        );
        if (sections.size !== 1) return false;
        return selectedCells.every((cell) => {
            const nativeCell = cell.matches('td,th')
                ? cell
                : cell.closest<HTMLElement>('td,th');
            return (
                (nativeCell?.getAttribute('rowspan') ?? '1') === '1' &&
                (nativeCell?.getAttribute('colspan') ?? '1') === '1'
            );
        });
    };
    const canSplit = (command: string): boolean => {
        if (classicTableSelectionKind(activeTable, activeRange) !== 'caret')
            return false;
        const nativeCell = activeTarget?.matches('td,th')
            ? activeTarget
            : activeTarget?.closest<HTMLElement>('td,th');
        const rows = Number(nativeCell?.getAttribute('rowspan') ?? '1');
        const columns = Number(nativeCell?.getAttribute('colspan') ?? '1');
        return command === 'table.cell.splitRows'
            ? rows > 1
            : command === 'table.cell.splitColumns'
              ? columns > 1
              : rows > 1 || columns > 1;
    };
    const close = (): void => {
        balloon?.close();
        balloon = undefined;
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
        const position = (): void => {
            if (!table.isConnected) return;
            const tableRect = table.getBoundingClientRect();
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
                    visual.scrollLeft,
            )}px`;
            overlay.style.insetBlockStart = `${String(
                tableRect.top -
                    containingRect.top -
                    containingBlock.clientTop +
                    visual.scrollTop,
            )}px`;
            overlay.style.width = `${String(tableRect.width)}px`;
            overlay.style.height = `${String(tableRect.height)}px`;
            const firstRow = table.querySelector('tr');
            for (const [column, cell] of Array.from(
                firstRow?.children ?? [],
            ).entries()) {
                const handle = overlay.querySelector<HTMLElement>(
                    `[data-resize-column="${String(column)}"]`,
                );
                if (handle === null) continue;
                const rectangle = cell.getBoundingClientRect();
                handle.style.insetInlineStart = `${String(rectangle.right - tableRect.left - 8)}px`;
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
            }
        };
        const redirectStalePointer = (
            event: PointerEvent,
            selector: string,
        ): boolean => {
            if (table.isConnected) return false;
            const nextTable = visual.querySelector<HTMLElement>(
                '.soeditor-table-widget',
            );
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
        const firstRow = table.querySelector('tr');
        for (const [column, cell] of Array.from(
            firstRow?.children ?? [],
        ).entries()) {
            if (!(cell instanceof HTMLTableCellElement)) continue;
            const handle = document.createElement('button');
            handle.type = 'button';
            handle.className = 'soeditor-table-column-resize';
            handle.dataset.resizeColumn = String(column);
            handle.setAttribute(
                'aria-label',
                `Resize column ${String(column + 1)}`,
            );
            let start = 0;
            let origin = 0;
            let width = 0;
            const commit = (): void => {
                if (!resizeDragging) return;
                resizeDragging = false;
                handle.style.removeProperty('transform');
                const targetTable = table.isConnected
                    ? table
                    : visual.querySelector<HTMLElement>(
                          '.soeditor-table-widget',
                      );
                const targetCell =
                    targetTable?.querySelectorAll('tr')[0]?.children[column];
                if (!(targetCell instanceof HTMLTableCellElement)) return;
                activateCellForResize(targetCell);
                editor.execute('table.selection.column');
                editor.execute('table.column.resize', { width });
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
                start = event.clientX;
                origin = event.clientX;
                width = cell.getBoundingClientRect().width;
                handle.setPointerCapture(event.pointerId);
            });
            handle.addEventListener('pointermove', (event) => {
                if (!handle.hasPointerCapture(event.pointerId)) return;
                const delta = event.clientX - origin;
                const step = event.clientX - start;
                width = Math.max(40, Math.min(1200, Math.round(width + step)));
                start = event.clientX;
                handle.style.transform = `translateX(${String(delta)}px)`;
                handle.dataset.width = `${String(width)} px`;
            });
            handle.addEventListener('pointerup', commit);
            handle.addEventListener('pointercancel', cancel);
            handle.addEventListener('keydown', (event) => {
                if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')
                    return;
                event.preventDefault();
                width = Math.max(
                    40,
                    Math.min(
                        1200,
                        Math.round(cell.getBoundingClientRect().width) +
                            (event.key === 'ArrowLeft' ? -10 : 10),
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
            let start = 0;
            let origin = 0;
            let height = 0;
            const commit = (): void => {
                if (!resizeDragging) return;
                resizeDragging = false;
                handle.style.removeProperty('transform');
                activateCellForResize(cell);
                const targetTable = table.isConnected
                    ? table
                    : visual.querySelector<HTMLElement>(
                          '.soeditor-table-widget',
                      );
                const targetRow = targetTable?.querySelectorAll('tr')[row];
                const targetCell = targetRow?.querySelector('td,th');
                if (!(targetCell instanceof HTMLTableCellElement)) return;
                activateCellForResize(targetCell);
                editor.execute('table.selection.row');
                editor.execute('table.row.properties', { height });
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
                resizeDragging = true;
                start = event.clientY;
                origin = event.clientY;
                height = tableRow.getBoundingClientRect().height;
                handle.setPointerCapture(event.pointerId);
            });
            handle.addEventListener('pointermove', (event) => {
                if (!handle.hasPointerCapture(event.pointerId)) return;
                const delta = event.clientY - origin;
                const step = event.clientY - start;
                height = Math.max(
                    24,
                    Math.min(1000, Math.round(height + step)),
                );
                start = event.clientY;
                handle.style.transform = `translateY(${String(delta)}px)`;
                handle.dataset.height = `${String(height)} px`;
            });
            handle.addEventListener('pointerup', commit);
            handle.addEventListener('pointercancel', cancel);
            handle.addEventListener('keydown', (event) => {
                if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')
                    return;
                event.preventDefault();
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
        document.defaultView?.addEventListener('resize', position);
        disposeResizePosition = () => {
            visual.removeEventListener('scroll', position);
            document.defaultView?.removeEventListener('resize', position);
        };
        position();
    };
    const resyncTableContext = (): void => {
        if (resyncFrame !== undefined) return;
        const view = document.defaultView;
        if (view === null) return;
        resyncFrame = view.requestAnimationFrame(() => {
            resyncFrame = undefined;
            if (activeTable === undefined) return;
            if (resizeDragging) return;
            const coordinator = editor.services.get(
                projectionCoordinatorServiceToken,
            );
            if (coordinator.snapshot.primary !== 'wysiwyg') return;
            const ownsResizeHandles =
                resizeOverlay?.isConnected === true ||
                activeTable.querySelector(
                    '.soeditor-table-column-resize, .soeditor-table-row-resize',
                ) !== null;
            if (activeTable.isConnected && ownsResizeHandles) {
                resyncAttempts = 0;
                return;
            }
            const nextTable = visual.querySelector<HTMLElement>(
                '.soeditor-table-widget',
            );
            if (nextTable === null) {
                if (resyncAttempts < 10) {
                    resyncAttempts += 1;
                    resyncTableContext();
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
            snapshot.primary === 'wysiwyg' &&
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
    const selection = (event: Event): void => {
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
        activeRange = selectedRange ?? selectedTableRange(table);
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
                    ['table.row.insertAfter', 'Add row'],
                    ['table.row.remove', 'Delete row'],
                    ['table.column.insertAfter', 'Add column'],
                    ['table.column.remove', 'Delete column'],
                    ['table.header.toggle', 'Toggle header'],
                    ['table.cell.splitRows', 'Split into rows'],
                    ['table.cell.splitColumns', 'Split into columns'],
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
                    button.title = label;
                    button.setAttribute('aria-label', label);
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
    document.addEventListener('keydown', keydown);
    return () => {
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
        document.removeEventListener('keydown', keydown);
    };
}

function tableSelectionActivation(event: Event): (() => void) | undefined {
    const detail: unknown = Reflect.get(event, 'detail');
    if (typeof detail !== 'object' || detail === null) return undefined;
    const activate: unknown = Reflect.get(detail, 'activate');
    return typeof activate === 'function'
        ? () => {
              Reflect.apply(activate, undefined, []);
          }
        : undefined;
}

function tableSelectionRange(event: Event): unknown {
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
    const previousBounds = tableRangeBounds(previous);
    if (
        previousBounds !== undefined &&
        cells.length ===
            (previousBounds.bottom - previousBounds.top + 1) *
                (previousBounds.right - previousBounds.left + 1)
    ) {
        return previous;
    }
    const tableRows = Array.from(table.querySelectorAll('tr'));
    const positions = cells.map((cell) => {
        const nativeCell = cell.matches('td,th')
            ? cell
            : cell.closest<HTMLElement>('td,th');
        const nativeRow = nativeCell?.closest('tr');
        const row =
            nativeRow === null || nativeRow === undefined
                ? Number(cell.dataset.row)
                : tableRows.indexOf(nativeRow);
        const rowCells =
            nativeRow === null || nativeRow === undefined
                ? []
                : Array.from(nativeRow.children).filter(
                      (child) =>
                          child.localName === 'td' || child.localName === 'th',
                  );
        const column =
            nativeCell === null || nativeCell === undefined
                ? Number(cell.dataset.column)
                : rowCells.indexOf(nativeCell);
        return { column, row };
    });
    if (
        positions.some(
            ({ column, row }) =>
                !Number.isInteger(column) || !Number.isInteger(row),
        )
    )
        return undefined;
    const rows = positions.map(({ row }) => row);
    const columns = positions.map(({ column }) => column);
    const previousKind =
        typeof previous === 'object' && previous !== null
            ? Reflect.get(previous, 'kind')
            : undefined;
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
        return ['table.cells.merge', 'table.cells.clear'].includes(command);
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
