import { createServiceToken } from '@soeditor/core';

import type {
    TableCellProperties,
    TableCellRange,
    TableProperties,
    TableRowProperties,
    TableSectionProperties,
} from './table.js';

export interface TableEditorDiagnostic {
    readonly code: 'invalid-structure' | 'no-rows';
    readonly message: string;
    readonly recoverable: boolean;
}

export interface TableEditorSnapshot {
    readonly editable: boolean;
    readonly diagnostic?: TableEditorDiagnostic;
    readonly selection?: TableCellRange;
    readonly table?: Readonly<Record<string, unknown>>;
    readonly section?: Readonly<Record<string, unknown>>;
    readonly row?: Readonly<Record<string, unknown>>;
    readonly cell?: Readonly<Record<string, unknown>>;
}

export type TableStructuralAction =
    | 'add-column'
    | 'add-row'
    | 'clear-cells'
    | 'delete-column'
    | 'delete-row'
    | 'delete-table'
    | 'merge-cells'
    | 'split-cell'
    | 'toggle-header';

/** Public command-backed API for table editing UIs and CMS integrations. */
export interface TableEditorService {
    inspect(): TableEditorSnapshot;
    updateTable(properties: TableProperties): void;
    updateSection(properties: TableSectionProperties): void;
    updateRows(properties: TableRowProperties): void;
    updateCells(properties: TableCellProperties): void;
    executeStructuralAction(action: TableStructuralAction): void;
    recover(): void;
}

export const tableEditorServiceToken = createServiceToken<TableEditorService>(
    'soeditor.table-editor',
);
