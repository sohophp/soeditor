import { createServiceToken, type Editor } from '@soeditor/core';

import {
    compareRevisionSources,
    type RevisionComparison,
} from './comparison.js';
import {
    createRevisionSaveInput,
    freezeRevisionAuthor,
    freezeRevisionList,
    freezeRevisionSnapshot,
    validateReviewPolicy,
    type ReviewPolicy,
    type RevisionAuthor,
    type RevisionKind,
    type RevisionMetadata,
    type RevisionProvider,
    type RevisionSnapshot,
    type RevisionStorage,
} from './model.js';

const MAX_REVISIONS = 200;
const RESTORE_META = 'soeditor.revisions.restore';

export type RevisionAction = 'restore' | 'save' | 'set-policy' | 'view';

export interface RevisionPermissionContext {
    readonly action: RevisionAction;
    readonly author: RevisionAuthor;
    readonly nextPolicy?: ReviewPolicy;
    readonly policy: ReviewPolicy;
    readonly revision?: RevisionMetadata;
}

export interface RevisionPermissionProvider {
    can(context: RevisionPermissionContext): boolean;
}

export interface RevisionsPluginOptions {
    readonly author: () => RevisionAuthor;
    readonly initialPolicy?: ReviewPolicy;
    readonly permissions: RevisionPermissionProvider;
    readonly provider: RevisionProvider;
    readonly storage?: RevisionStorage;
}

export interface RevisionsSnapshot {
    readonly comparison: RevisionComparison | undefined;
    readonly error: unknown;
    readonly policy: ReviewPolicy;
    readonly revision: RevisionSnapshot | undefined;
    readonly revisions: readonly RevisionMetadata[];
    readonly viewing: 'current' | 'revision';
}

export interface RevisionsService {
    readonly snapshot: RevisionsSnapshot;
    can(
        action: RevisionAction,
        revisionId?: string,
        nextPolicy?: ReviewPolicy,
    ): boolean;
    compare(id: string): Promise<void>;
    refresh(): Promise<void>;
    restore(id: string): Promise<void>;
    save(kind: RevisionKind, label: string): Promise<RevisionSnapshot>;
    setPolicy(policy: ReviewPolicy): void;
    subscribe(listener: (snapshot: RevisionsSnapshot) => void): () => void;
    view(id: string): Promise<void>;
    viewCurrent(): void;
}

export const revisionsServiceToken =
    createServiceToken<RevisionsService>('soeditor.revisions');

export class RevisionsController {
    readonly #editor: Editor;
    readonly #listeners = new Set<(snapshot: RevisionsSnapshot) => void>();
    readonly #options: RevisionsPluginOptions;
    #comparison: RevisionComparison | undefined;
    #destroyed = false;
    #disposeDocumentChange: (() => void) | undefined;
    #error: unknown;
    #loadGeneration = 0;
    #policy: ReviewPolicy;
    #revision: RevisionSnapshot | undefined;
    #revisions: readonly RevisionMetadata[] = Object.freeze([]);

    constructor(editor: Editor, options: RevisionsPluginOptions) {
        validateOptions(options);
        this.#editor = editor;
        this.#options = options;
        this.#policy = validateReviewPolicy(options.initialPolicy ?? 'edit');
    }

    get service(): RevisionsService {
        const snapshot = (): RevisionsSnapshot => this.#snapshot();
        return Object.freeze<RevisionsService>({
            get snapshot() {
                return snapshot();
            },
            can: (
                action: RevisionAction,
                revisionId?: string,
                nextPolicy?: ReviewPolicy,
            ) => this.can(action, revisionId, nextPolicy),
            compare: (id: string) => this.compare(id),
            refresh: () => this.refresh(),
            restore: (id: string) => this.restore(id),
            save: (kind: RevisionKind, label: string) => this.save(kind, label),
            setPolicy: (policy: ReviewPolicy) => this.setPolicy(policy),
            subscribe: (listener: (value: RevisionsSnapshot) => void) =>
                this.subscribe(listener),
            view: (id: string) => this.view(id),
            viewCurrent: () => this.viewCurrent(),
        });
    }

    async init(): Promise<void> {
        this.#editor.setReadonly(this.#policy !== 'edit');
        await this.refresh();
        this.#disposeDocumentChange = this.#editor.events.on(
            'document:change',
            () => {
                if (this.#revision === undefined) return;
                this.#comparison = this.#compare(this.#revision);
                this.#notify();
            },
        );
    }

    destroy(): void {
        this.#destroyed = true;
        this.#loadGeneration += 1;
        this.#disposeDocumentChange?.();
        this.#disposeDocumentChange = undefined;
        this.#listeners.clear();
        this.#revision = undefined;
        this.#comparison = undefined;
    }

    async refresh(): Promise<void> {
        this.#assertAlive();
        try {
            const revisions = boundedRevisions(
                freezeRevisionList(await this.#options.provider.list()),
            );
            this.#assertAlive();
            this.#revisions = Object.freeze(
                [...revisions].sort(
                    (left, right) =>
                        right.createdAt - left.createdAt ||
                        left.id.localeCompare(right.id),
                ),
            );
            this.#error = undefined;
            this.#notify();
        } catch (error: unknown) {
            if (!this.#destroyed) {
                this.#error = error;
                this.#notify();
            }
            throw error;
        }
    }

    async view(id: string): Promise<void> {
        if (!this.can('view', id)) throw permissionError('view');
        const revision = await this.#loadLatest(id);
        if (revision === undefined) return;
        let comparison: RevisionComparison;
        try {
            comparison = this.#compare(revision);
        } catch (error: unknown) {
            this.#recordError(error);
            throw error;
        }
        this.#revision = revision;
        this.#comparison = comparison;
        this.#notify();
    }

    viewCurrent(): void {
        this.#assertAlive();
        this.#loadGeneration += 1;
        this.#revision = undefined;
        this.#comparison = undefined;
        this.#error = undefined;
        this.#notify();
    }

    async compare(id: string): Promise<void> {
        return this.view(id);
    }

    async restore(id: string): Promise<void> {
        this.#assertAlive();
        if (!this.can('restore', id)) throw permissionError('restore');
        const revision = await this.#loadLatest(id);
        if (revision === undefined) return;
        if (revision.format !== this.#editor.state.document.format) {
            const error = new Error(
                `Revision "${revision.id}" uses ${revision.format}, not ${this.#editor.state.document.format}.`,
            );
            this.#recordError(error);
            throw error;
        }
        this.#editor.update(
            (transaction) => {
                transaction.replaceDocument(revision.source);
                transaction.setMeta(RESTORE_META, revision.id);
            },
            { origin: 'command' },
        );
        this.viewCurrent();
    }

    async save(kind: RevisionKind, label: string): Promise<RevisionSnapshot> {
        this.#assertAlive();
        if (!this.can('save')) throw permissionError('save');
        const storage = this.#options.storage;
        if (storage === undefined) {
            throw new Error('No revision storage adapter is configured.');
        }
        const document = this.#editor.state.document;
        let saved: RevisionSnapshot;
        try {
            saved = freezeRevisionSnapshot(
                await storage.save(
                    createRevisionSaveInput({
                        author: freezeRevisionAuthor(this.#options.author()),
                        format: document.format,
                        kind,
                        label,
                        source: document.source,
                    }),
                ),
            );
        } catch (error: unknown) {
            this.#recordError(error);
            throw error;
        }
        this.#assertAlive();
        if (
            saved.format !== document.format ||
            saved.source !== document.source
        ) {
            const error = new Error(
                'Revision storage returned a snapshot that does not match the saved document.',
            );
            this.#recordError(error);
            throw error;
        }
        const remaining = this.#revisions.filter(({ id }) => id !== saved.id);
        this.#revisions = boundedRevisions(
            freezeRevisionList([saved, ...remaining]),
        );
        this.#error = undefined;
        this.#notify();
        return saved;
    }

    setPolicy(policy: ReviewPolicy): void {
        this.#assertAlive();
        const next = validateReviewPolicy(policy);
        if (next === this.#policy) return;
        if (!this.can('set-policy', undefined, next)) {
            throw permissionError('set-policy');
        }
        const previous = this.#policy;
        this.#policy = next;
        try {
            this.#editor.setReadonly(next !== 'edit');
        } catch (error: unknown) {
            this.#policy = previous;
            throw error;
        }
        this.#notify();
    }

    can(
        action: RevisionAction,
        revisionId?: string,
        nextPolicy?: ReviewPolicy,
    ): boolean {
        this.#assertAlive();
        if (
            action !== 'view' &&
            action !== 'save' &&
            action !== 'restore' &&
            action !== 'set-policy'
        ) {
            throw new TypeError('A revision action is invalid.');
        }
        const revision =
            revisionId === undefined
                ? undefined
                : this.#revisions.find(({ id }) => id === revisionId);
        if (
            (action === 'view' || action === 'restore') &&
            revision === undefined
        ) {
            return false;
        }
        if (
            action === 'save' &&
            (this.#policy !== 'edit' || this.#options.storage === undefined)
        ) {
            return false;
        }
        if (action === 'restore' && this.#policy !== 'edit') return false;
        if (action === 'set-policy' && nextPolicy === undefined) return false;
        return (
            this.#options.permissions.can(
                Object.freeze({
                    action,
                    author: freezeRevisionAuthor(this.#options.author()),
                    ...(nextPolicy === undefined ? {} : { nextPolicy }),
                    policy: this.#policy,
                    ...(revision === undefined ? {} : { revision }),
                }),
            ) === true
        );
    }

    subscribe(listener: (snapshot: RevisionsSnapshot) => void): () => void {
        this.#assertAlive();
        if (typeof listener !== 'function') {
            throw new TypeError('A revisions listener must be a function.');
        }
        this.#listeners.add(listener);
        return () => this.#listeners.delete(listener);
    }

    async #loadLatest(id: string): Promise<RevisionSnapshot | undefined> {
        this.#assertAlive();
        const expectedId = requiredId(id);
        const generation = ++this.#loadGeneration;
        try {
            const revision = freezeRevisionSnapshot(
                await this.#options.provider.load(expectedId),
            );
            if (revision.id !== expectedId) {
                throw new Error(
                    `Revision provider returned "${revision.id}" for requested revision "${expectedId}".`,
                );
            }
            if (this.#destroyed || generation !== this.#loadGeneration) {
                return undefined;
            }
            this.#error = undefined;
            return revision;
        } catch (error: unknown) {
            if (!this.#destroyed && generation === this.#loadGeneration) {
                this.#error = error;
                this.#notify();
            }
            throw error;
        }
    }

    #compare(revision: RevisionSnapshot): RevisionComparison {
        const document = this.#editor.state.document;
        if (revision.format !== document.format) {
            throw new Error(
                `Revision "${revision.id}" cannot be compared with ${document.format}.`,
            );
        }
        return compareRevisionSources(
            document.format,
            revision.source,
            document.source,
        );
    }

    #snapshot(): RevisionsSnapshot {
        this.#assertAlive();
        return Object.freeze({
            comparison: this.#comparison,
            error: this.#error,
            policy: this.#policy,
            revision: this.#revision,
            revisions: this.#revisions,
            viewing: this.#revision === undefined ? 'current' : 'revision',
        });
    }

    #notify(): void {
        const snapshot = this.#snapshot();
        const errors: unknown[] = [];
        for (const listener of [...this.#listeners]) {
            try {
                listener(snapshot);
            } catch (error: unknown) {
                errors.push(error);
            }
        }
        if (errors.length > 0) {
            this.#error = new AggregateError(
                errors,
                'Revision listeners failed.',
            );
        }
    }

    #recordError(error: unknown): void {
        if (this.#destroyed) return;
        this.#error = error;
        this.#notify();
    }

    #assertAlive(): void {
        if (this.#destroyed) {
            throw new Error('The revisions service has been destroyed.');
        }
    }
}

function validateOptions(options: RevisionsPluginOptions): void {
    if (
        typeof options !== 'object' ||
        options === null ||
        typeof options.author !== 'function' ||
        typeof options.permissions?.can !== 'function' ||
        typeof options.provider?.list !== 'function' ||
        typeof options.provider.load !== 'function' ||
        (options.storage !== undefined &&
            (typeof options.storage.list !== 'function' ||
                typeof options.storage.load !== 'function' ||
                typeof options.storage.save !== 'function'))
    ) {
        throw new TypeError(
            'Revisions require author and provider adapters; storage is optional.',
        );
    }
}

function permissionError(action: RevisionAction): Error {
    return new Error(`Revision action "${action}" is not permitted.`);
}

function boundedRevisions(
    revisions: readonly RevisionMetadata[],
): readonly RevisionMetadata[] {
    if (revisions.length > MAX_REVISIONS) {
        throw new RangeError(
            `Revision lists are limited to ${String(MAX_REVISIONS)} entries.`,
        );
    }
    return revisions;
}

function requiredId(id: unknown): string {
    if (typeof id !== 'string' || id.trim().length === 0 || id.length > 256) {
        throw new TypeError('A revision ID must contain 1 to 256 characters.');
    }
    return id;
}
