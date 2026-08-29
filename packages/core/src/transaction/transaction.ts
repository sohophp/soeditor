import {
    StaleTransactionError,
    TransactionAlreadyCommittedError,
    TransactionOwnershipError,
} from '../errors/errors.js';
import type { EditorMode } from '../state/editor-state.js';
import type { Operation } from './operation.js';

/** Describes the source of a state transaction. */
export type TransactionOrigin =
    'user' | 'command' | 'plugin' | 'source' | 'system';

/** An immutable key/value view of opaque transaction metadata values. */
export interface TransactionMetadata {
    readonly [key: string]: unknown;
}

/** Options used by an editor when creating a transaction. */
export interface TransactionOptions {
    /** Identifies the system that initiated the transaction. */
    readonly origin?: TransactionOrigin;
}

/**
 * A mutable, single-use transaction created by `Editor.createTransaction()`.
 *
 * Metadata values are opaque and retain their original object identity. The
 * metadata container is exposed as an immutable snapshot.
 */
export interface Transaction {
    /** The system that initiated this transaction. */
    readonly origin: TransactionOrigin;
    /** A snapshot of operations currently queued for this transaction. */
    readonly operations: readonly Operation[];
    /** A frozen snapshot of the transaction's opaque metadata entries. */
    readonly metadata: TransactionMetadata;
    /** Queues replacement of the canonical document source. */
    replaceDocument(source: string): this;
    /** Queues a change to the editor's requested mode. */
    setMode(mode: EditorMode): this;
    /** Adds or replaces an opaque metadata value. */
    setMeta(key: string, value: unknown): this;
    /** Returns an opaque metadata value, or undefined when absent. */
    getMeta(key: string): unknown;
}

interface TransactionRecord {
    readonly baseVersion: number;
    committed: boolean;
    readonly metadata: Map<string, unknown>;
    readonly operations: Operation[];
    readonly origin: TransactionOrigin;
    readonly owner: object;
}

const records = new WeakMap<Transaction, TransactionRecord>();

class EditorTransaction implements Transaction {
    constructor(record: TransactionRecord) {
        records.set(this, record);
    }

    get origin(): TransactionOrigin {
        return getRecord(this).origin;
    }

    get operations(): readonly Operation[] {
        return [...getRecord(this).operations];
    }

    get metadata(): TransactionMetadata {
        return Object.freeze(Object.fromEntries(getRecord(this).metadata));
    }

    replaceDocument(source: string): this {
        const record = getMutableRecord(this);
        record.operations.push(
            Object.freeze({ type: 'replace-document', source }),
        );
        return this;
    }

    setMode(mode: EditorMode): this {
        const record = getMutableRecord(this);
        record.operations.push(Object.freeze({ type: 'set-mode', mode }));
        return this;
    }

    setMeta(key: string, value: unknown): this {
        getMutableRecord(this).metadata.set(key, value);
        return this;
    }

    getMeta(key: string): unknown {
        return getRecord(this).metadata.get(key);
    }
}

function getRecord(transaction: Transaction): TransactionRecord {
    const record = records.get(transaction);

    if (record === undefined) {
        throw new TransactionOwnershipError();
    }

    return record;
}

function getMutableRecord(transaction: Transaction): TransactionRecord {
    const record = getRecord(transaction);

    if (record.committed) {
        throw new TransactionAlreadyCommittedError();
    }

    return record;
}

/** @internal Creates an editor-owned transaction. */
export function createTransaction(
    owner: object,
    baseVersion: number,
    options: TransactionOptions,
): Transaction {
    return new EditorTransaction({
        baseVersion,
        committed: false,
        metadata: new Map(),
        operations: [],
        origin: options.origin ?? 'system',
        owner,
    });
}

/** @internal Validates and consumes a transaction for one dispatch attempt. */
export function commitTransaction(
    transaction: Transaction,
    owner: object,
    currentVersion: number,
): readonly Operation[] {
    const record = getMutableRecord(transaction);

    if (record.owner !== owner) {
        throw new TransactionOwnershipError();
    }

    if (record.baseVersion !== currentVersion) {
        throw new StaleTransactionError(record.baseVersion, currentVersion);
    }

    record.committed = true;
    return Object.freeze([...record.operations]);
}
