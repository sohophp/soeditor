import type { Transaction } from '@soeditor/core';

import { freezeSelection, type EditingSelection } from './model.js';

const BEFORE_SELECTION = 'soeditor.history.beforeSelection';
const AFTER_SELECTION = 'soeditor.history.afterSelection';
const GROUP = 'soeditor.history.group';
const REPLAY = 'soeditor.history.replay';
const REPLAY_SELECTION = 'soeditor.history.replaySelection';

export interface HistoryMetadata {
    readonly beforeSelection?: EditingSelection;
    readonly afterSelection?: EditingSelection;
    readonly group?: string;
}

export function setHistoryMetadata(
    transaction: Transaction,
    metadata: HistoryMetadata,
): void {
    if (metadata.beforeSelection !== undefined) {
        transaction.setMeta(
            BEFORE_SELECTION,
            freezeSelection(metadata.beforeSelection),
        );
    }
    if (metadata.afterSelection !== undefined) {
        transaction.setMeta(
            AFTER_SELECTION,
            freezeSelection(metadata.afterSelection),
        );
    }
    if (metadata.group !== undefined) {
        transaction.setMeta(GROUP, metadata.group);
    }
}

export function readHistoryMetadata(transaction: Transaction): HistoryMetadata {
    const beforeSelection = readSelection(
        transaction.getMeta(BEFORE_SELECTION),
    );
    const afterSelection = readSelection(transaction.getMeta(AFTER_SELECTION));
    const group = transaction.getMeta(GROUP);

    return Object.freeze({
        ...(beforeSelection === undefined ? {} : { beforeSelection }),
        ...(afterSelection === undefined ? {} : { afterSelection }),
        ...(typeof group === 'string' ? { group } : {}),
    });
}

export function markHistoryReplay(
    transaction: Transaction,
    selection: EditingSelection | undefined,
): void {
    transaction.setMeta(REPLAY, true);
    if (selection !== undefined) {
        transaction.setMeta(REPLAY_SELECTION, freezeSelection(selection));
    }
}

export function isHistoryReplay(transaction: Transaction): boolean {
    return transaction.getMeta(REPLAY) === true;
}

export function readReplaySelection(
    transaction: Transaction,
): EditingSelection | undefined {
    return readSelection(transaction.getMeta(REPLAY_SELECTION));
}

function readSelection(value: unknown): EditingSelection | undefined {
    if (typeof value !== 'object' || value === null) {
        return undefined;
    }

    const candidate = value as {
        readonly anchor?: unknown;
        readonly focus?: unknown;
    };
    const anchor = readPoint(candidate.anchor);
    const focus = readPoint(candidate.focus);
    return anchor === undefined || focus === undefined
        ? undefined
        : freezeSelection({ anchor, focus });
}

function readPoint(
    value: unknown,
): { readonly block: number; readonly offset: number } | undefined {
    if (typeof value !== 'object' || value === null) {
        return undefined;
    }

    const candidate = value as {
        readonly block?: unknown;
        readonly offset?: unknown;
    };
    return typeof candidate.block === 'number' &&
        Number.isInteger(candidate.block) &&
        candidate.block >= 0 &&
        typeof candidate.offset === 'number' &&
        Number.isInteger(candidate.offset) &&
        candidate.offset >= 0
        ? { block: candidate.block, offset: candidate.offset }
        : undefined;
}
