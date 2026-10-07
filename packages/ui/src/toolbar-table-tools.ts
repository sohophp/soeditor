import { createToolbarRoot } from './toolbar-root.js';

import type { DismissibleUiHandle, ToolbarItemFactory } from './types.js';
import {
    dialogCommandButton,
    field,
    inspectedValues,
    stringValue,
    updateCommandButton,
    execute,
    reportError,
} from './toolbar-tool-shared.js';
const loadLinkAttributeTools = () => import('./link-attributes.js');
const tableButton: ToolbarItemFactory = ({ document, editor, ui }) => {
    const button = createToolbarRoot(document, ui, 'button');
    button.type = 'button';
    button.className = 'soeditor-ui__button';
    ui.setIcon(button, 'table.insert', 'Table');
    button.title = 'Insert table';
    button.setAttribute('aria-label', 'Insert table');
    button.setAttribute('aria-expanded', 'false');
    let handle: DismissibleUiHandle | undefined;
    const close = (): void => {
        handle?.close();
        handle = undefined;
        button.setAttribute('aria-expanded', 'false');
    };
    const open = (): void => {
        if (handle !== undefined) {
            const visible = handle.element.isConnected;
            close();
            if (visible) return;
        }
        handle = ui.balloons.show({
            anchor: button,
            content: (container) => {
                container.classList.add('soeditor-ui__table-picker');
                container.setAttribute('aria-label', 'Choose table size');
                const status = document.createElement('span');
                status.className = 'soeditor-ui__table-picker-status';
                status.setAttribute('aria-live', 'polite');
                status.textContent = 'Choose table size';
                const grid = document.createElement('div');
                grid.className = 'soeditor-ui__table-picker-grid';
                grid.setAttribute('role', 'grid');
                for (let row = 1; row <= 10; row += 1) {
                    for (let column = 1; column <= 10; column += 1) {
                        const cell = document.createElement('button');
                        cell.type = 'button';
                        cell.className = 'soeditor-ui__table-picker-cell';
                        cell.dataset.row = String(row);
                        cell.dataset.column = String(column);
                        cell.setAttribute('role', 'gridcell');
                        cell.setAttribute(
                            'aria-label',
                            `Insert ${String(row)} by ${String(column)} table`,
                        );
                        const highlight = (): void => {
                            status.textContent = `${String(row)} × ${String(column)} table`;
                            for (const candidate of Array.from(grid.children)) {
                                candidate.classList.toggle(
                                    'is-selected',
                                    Number(
                                        candidate.getAttribute('data-row'),
                                    ) <= row &&
                                        Number(
                                            candidate.getAttribute(
                                                'data-column',
                                            ),
                                        ) <= column,
                                );
                            }
                        };
                        cell.addEventListener('pointerenter', highlight);
                        cell.addEventListener('focus', highlight);
                        cell.addEventListener('keydown', (event) => {
                            const movement =
                                event.key === 'ArrowUp'
                                    ? [-1, 0]
                                    : event.key === 'ArrowDown'
                                      ? [1, 0]
                                      : event.key === 'ArrowLeft'
                                        ? [0, -1]
                                        : event.key === 'ArrowRight'
                                          ? [0, 1]
                                          : undefined;
                            if (movement === undefined) {
                                if (event.key === 'Escape') {
                                    event.preventDefault();
                                    close();
                                    button.focus();
                                }
                                return;
                            }
                            event.preventDefault();
                            const nextRow = Math.max(
                                1,
                                Math.min(10, row + (movement[0] ?? 0)),
                            );
                            const nextColumn = Math.max(
                                1,
                                Math.min(10, column + (movement[1] ?? 0)),
                            );
                            grid.querySelector<HTMLButtonElement>(
                                `[data-row="${String(nextRow)}"][data-column="${String(nextColumn)}"]`,
                            )?.focus();
                        });
                        cell.addEventListener('click', () => {
                            if (
                                execute(editor, ui, 'table.insert', [
                                    { columns: column, rows: row },
                                ])
                            ) {
                                close();
                            }
                        });
                        grid.append(cell);
                    }
                }
                container.append(status, grid);
                void Promise.resolve()
                    .then(() => {
                        if (!container.isConnected) return;
                        appendExactTablePicker(
                            document,
                            container,
                            status,
                            (rows, columns) =>
                                execute(editor, ui, 'table.insert', [
                                    { columns, rows },
                                ]),
                            close,
                        );
                    })
                    .catch((error: unknown) => reportError(ui, error));
            },
        });
        button.setAttribute('aria-expanded', 'true');
        handle.element
            .querySelector<HTMLButtonElement>(
                '.soeditor-ui__table-picker-cell[data-row="3"][data-column="3"]',
            )
            ?.focus();
    };
    button.addEventListener('click', open);
    return {
        element: button,
        update: () => {
            updateCommandButton(button, editor, 'table.insert');
            if (button.disabled) close();
        },
        destroy: () => {
            close();
            button.removeEventListener('click', open);
        },
    };
};

const commonTagAttributeCatalog = [
    { name: 'id' },
    { name: 'title' },
    { name: 'role' },
    { name: 'aria-describedby' },
    { name: 'aria-labelledby' },
] as const;
const tableAttributeCatalog = commonTagAttributeCatalog;
const rowAttributeCatalog = [
    ...commonTagAttributeCatalog,
    { name: 'aria-rowindex' },
    { name: 'aria-selected', values: ['true', 'false'] },
] as const;
const cellAttributeCatalog = [
    ...commonTagAttributeCatalog,
    { name: 'headers' },
    { name: 'aria-colindex' },
    { name: 'aria-rowindex' },
    { name: 'aria-selected', values: ['true', 'false'] },
] as const;

interface TablePropertyField {
    readonly key: string;
    readonly label: string;
    readonly numeric?: boolean;
    readonly omitEmpty?: boolean;
}

function tablePropertyButton(
    label: string,
    command: string,
    inspectCommand: string,
    fields: readonly TablePropertyField[],
    catalog:
        | typeof tableAttributeCatalog
        | typeof rowAttributeCatalog
        | typeof cellAttributeCatalog,
    managedAttributes: readonly string[],
): ToolbarItemFactory {
    return dialogCommandButton(
        label,
        command,
        async (document, run, editor) => {
            const { readInspectedCustomAttributes, tagCustomAttributeField } =
                await loadLinkAttributeTools();
            const inputs = new Map<TablePropertyField, HTMLInputElement>();
            let customAttributes: ReturnType<typeof tagCustomAttributeField>;
            return {
                content: (container) => {
                    const values = inspectedValues(editor, inspectCommand);
                    for (const specification of fields) {
                        const input = field(
                            document,
                            container,
                            specification.label,
                            specification.numeric ? 'number' : 'text',
                            false,
                            stringValue(values[specification.key]),
                        );
                        if (specification.numeric) {
                            input.min = '20';
                            input.max = '2000';
                        }
                        inputs.set(specification, input);
                    }
                    customAttributes = tagCustomAttributeField(
                        document,
                        container,
                        readInspectedCustomAttributes(values),
                        catalog,
                        (message) => message,
                        managedAttributes,
                    );
                },
                run: () => {
                    const attributes = customAttributes.value();
                    if (attributes === undefined) return;
                    const values: Record<string, string | number | null> = {};
                    for (const [specification, input] of inputs) {
                        if (input.value.length === 0 && specification.omitEmpty)
                            continue;
                        values[specification.key] =
                            input.value.length === 0
                                ? null
                                : specification.numeric
                                  ? Number(input.value)
                                  : input.value;
                    }
                    run({ ...values, customAttributes: attributes });
                },
            };
        },
    );
}

const tablePropertiesButton = tablePropertyButton(
    'Table properties',
    'table.properties',
    'table.inspect',
    [
        { key: 'caption', label: 'Caption' },
        { key: 'width', label: 'Width (px or %)' },
        { key: 'alignment', label: 'Alignment (left, center, right)' },
        { key: 'responsiveClass', label: 'Responsive classes' },
        { key: 'ariaLabel', label: 'Accessible label' },
    ],
    tableAttributeCatalog,
    ['aria-label', 'class', 'style', 'width'],
);

const tableRowPropertiesButton = tablePropertyButton(
    'Table row properties',
    'table.row.properties',
    'table.row.inspect',
    [
        {
            key: 'section',
            label: 'Section (head, body, foot)',
            omitEmpty: true,
        },
        { key: 'className', label: 'Row classes' },
        { key: 'height', label: 'Height', numeric: true },
    ],
    rowAttributeCatalog,
    ['aria-label', 'class', 'height', 'style'],
);

const tableCellPropertiesButton = tablePropertyButton(
    'Table cell properties',
    'table.cell.properties',
    'table.cell.inspect',
    [
        {
            key: 'horizontalAlignment',
            label: 'Alignment (left, center, right)',
        },
        { key: 'verticalAlignment', label: 'Vertical alignment' },
        { key: 'scope', label: 'Header scope' },
        { key: 'className', label: 'Cell classes' },
    ],
    cellAttributeCatalog,
    ['aria-label', 'class', 'colspan', 'rowspan', 'scope', 'style'],
);

export {
    tableButton,
    tablePropertiesButton,
    tableRowPropertiesButton,
    tableCellPropertiesButton,
};

function appendExactTablePicker(
    document: Document,
    container: HTMLElement,
    status: HTMLElement,
    insertTable: (rows: number, columns: number) => boolean,
    close: () => void,
): void {
    const exact = document.createElement('fieldset');
    exact.className = 'soeditor-ui__table-picker-exact';
    exact.innerHTML =
        '<legend>Exact size</legend><input type=number min=1 max=100 value=3 aria-label="Table rows"><input type=number min=1 max=100 value=3 aria-label="Table columns"><button type=button>Insert</button>';
    const inputs = exact.getElementsByTagName('input');
    const rows = inputs.item(0);
    const columns = inputs.item(1);
    const insert = exact.querySelector('button');
    if (!rows || !columns || !insert) return;
    insert.addEventListener('click', () => {
        const rowCount = +rows.value;
        const columnCount = +columns.value;
        if (
            !rows.checkValidity() ||
            !columns.checkValidity() ||
            rowCount * columnCount > 1000
        ) {
            status.textContent = 'Limits: 1–100 each; 1000 cells.';
            return;
        }
        if (insertTable(rowCount, columnCount)) close();
    });
    container.append(exact);
}
