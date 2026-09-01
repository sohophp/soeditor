import type { Editor } from '@soeditor/core';
import type { DismissibleUiHandle, EditorUi } from '@soeditor/ui';

import type * as TableEditorAttributes from './table-editor-attributes.js';

type TableContextPropertyKind = 'cell' | 'row' | 'section' | 'table';

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
    const commandButtons = new Map<string, HTMLButtonElement>();
    const scopeButtons: HTMLButtonElement[] = [];
    const refreshCommandButtons = (): void => {
        const selectionKind = classicTableSelectionKind(
            activeTable,
            activeRange,
        );
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
            button.hidden = selectionKind === 'cells';
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
        commandButtons.clear();
    };
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
        dialog.element.classList.add('soeditor-ui__link-dialog');
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
        activeTarget = target;
        activeSelection = activate;
        activeRange = selectedRange ?? selectedTableRange(table);
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
        balloon = ui.balloons.show({
            anchor: table,
            placement: 'above',
            content: (container) => {
                container.classList.add('soeditor-table-context');
                container.setAttribute('aria-label', 'Table tools');
                const properties = document.createElement('button');
                properties.type = 'button';
                properties.className = 'soeditor-table-context__button';
                ui.setIcon(properties, 'table.properties', 'Table editor');
                properties.title = 'Table editor';
                properties.setAttribute('aria-label', 'Table editor');
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
                            kind === 'table'
                                ? 'table'
                                : kind === 'rows'
                                  ? 'row'
                                  : 'cell',
                        );
                    }
                });
                container.append(properties);
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
                    ['table', 'Select table', 'table.properties'],
                ] as const) {
                    const selectButton = document.createElement('button');
                    selectButton.type = 'button';
                    selectButton.className = 'soeditor-table-context__button';
                    ui.setIcon(selectButton, icon, label);
                    selectButton.title = label;
                    selectButton.setAttribute('aria-label', label);
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
                        if (
                            activeRange !== undefined &&
                            command !== 'table.remove'
                        ) {
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
            'table.remove',
        ].includes(command);
    }
    return command !== 'table.cells.merge';
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
