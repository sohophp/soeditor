import { Plugin } from '@soeditor/core';
import type { DocumentChangeEvent } from '@soeditor/core';

import type { EditingSelection } from './model.js';
import {
    isHistoryReplay,
    markHistoryReplay,
    readHistoryMetadata,
} from './history-metadata.js';

interface HistoryEntry {
    readonly beforeSource: string;
    readonly afterSource: string;
    readonly beforeSelection?: EditingSelection;
    readonly afterSelection?: EditingSelection;
    readonly group?: string;
    readonly committedAt: number;
}

const GROUP_WINDOW_MS = 1_000;
const MAX_HISTORY_ENTRIES = 100;

/** Transaction-backed undo/redo history for one editor instance. */
export class HistoryPlugin extends Plugin {
    static readonly id = 'editing-history';

    readonly #redoStack: HistoryEntry[] = [];
    readonly #undoStack: HistoryEntry[] = [];
    #disposeDocumentChange: (() => void) | undefined;

    /** Returns whether an undo entry is available. */
    get canUndo(): boolean {
        return this.#undoStack.length > 0;
    }

    /** Returns whether a redo entry is available. */
    get canRedo(): boolean {
        return this.#redoStack.length > 0;
    }

    override init(): void {
        this.editor.commands.register({
            id: 'editor.undo',
            canExecute: () => this.canUndo,
            execute: () => this.#undo(),
        });
        this.editor.commands.register({
            id: 'editor.redo',
            canExecute: () => this.canRedo,
            execute: () => this.#redo(),
        });
        this.#disposeDocumentChange = this.editor.events.on(
            'document:change',
            (event) => this.#record(event),
        );
    }

    #undo(): boolean {
        const entry = this.#undoStack.at(-1);
        if (entry === undefined) {
            return false;
        }

        const error = this.#replay(entry.beforeSource, entry.beforeSelection);
        this.#undoStack.pop();
        this.#redoStack.push(entry);
        if (error.failed) {
            throw error.value;
        }
        return true;
    }

    #redo(): boolean {
        const entry = this.#redoStack.at(-1);
        if (entry === undefined) {
            return false;
        }

        const error = this.#replay(entry.afterSource, entry.afterSelection);
        this.#redoStack.pop();
        this.#undoStack.push(entry);
        if (error.failed) {
            throw error.value;
        }
        return true;
    }

    override destroy(): void {
        this.#disposeDocumentChange?.();
        this.#disposeDocumentChange = undefined;
        this.#undoStack.length = 0;
        this.#redoStack.length = 0;
    }

    #record(event: DocumentChangeEvent): void {
        if (isHistoryReplay(event.transaction)) {
            return;
        }

        const metadata = readHistoryMetadata(event.transaction);
        const group = metadata.group;
        const entry: HistoryEntry = Object.freeze({
            afterSource: event.current.source,
            beforeSource: event.previous.source,
            committedAt: Date.now(),
            ...(metadata.afterSelection === undefined
                ? {}
                : { afterSelection: metadata.afterSelection }),
            ...(metadata.beforeSelection === undefined
                ? {}
                : { beforeSelection: metadata.beforeSelection }),
            ...(group === undefined ? {} : { group }),
        });
        const previous = this.#undoStack.at(-1);

        if (previous !== undefined && canGroup(previous, entry)) {
            const { afterSelection: discardedAfterSelection, ...groupedBase } =
                previous;
            void discardedAfterSelection;
            this.#undoStack[this.#undoStack.length - 1] = Object.freeze({
                ...groupedBase,
                afterSource: entry.afterSource,
                committedAt: entry.committedAt,
                ...(entry.afterSelection === undefined
                    ? {}
                    : { afterSelection: entry.afterSelection }),
            });
        } else {
            this.#undoStack.push(entry);
            if (this.#undoStack.length > MAX_HISTORY_ENTRIES) {
                this.#undoStack.shift();
            }
        }
        this.#redoStack.length = 0;
    }

    #replay(
        source: string,
        selection: EditingSelection | undefined,
    ): { readonly failed: boolean; readonly value?: unknown } {
        let failed = false;
        let value: unknown;

        try {
            this.editor.update(
                (transaction) => {
                    transaction.replaceDocument(source);
                    markHistoryReplay(transaction, selection);
                },
                { origin: 'command' },
            );
        } catch (error: unknown) {
            failed = true;
            value = error;
            if (this.editor.getData() !== source) {
                throw error;
            }
        }

        return failed ? { failed, value } : { failed };
    }
}

function canGroup(previous: HistoryEntry, current: HistoryEntry): boolean {
    return (
        previous.group !== undefined &&
        previous.group === current.group &&
        current.committedAt - previous.committedAt >= 0 &&
        current.committedAt - previous.committedAt <= GROUP_WINDOW_MS &&
        previous.afterSource === current.beforeSource &&
        selectionsEqual(previous.afterSelection, current.beforeSelection)
    );
}

function selectionsEqual(
    left: EditingSelection | undefined,
    right: EditingSelection | undefined,
): boolean {
    if (left === undefined || right === undefined) {
        return left === right;
    }

    return (
        left.anchor.block === right.anchor.block &&
        left.anchor.offset === right.anchor.offset &&
        left.focus.block === right.focus.block &&
        left.focus.offset === right.focus.offset
    );
}
