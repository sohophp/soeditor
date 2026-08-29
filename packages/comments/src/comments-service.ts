import { createServiceToken, type Editor } from '@soeditor/core';
import {
    readEditingOperations,
    visualDecorationsServiceToken,
    visualEditingServiceToken,
    type EditingSelection,
    type VisualDecoration,
} from '@soeditor/engine';

import { mapCommentThread } from './mapping.js';
import {
    comparePoints,
    freezeAuthor,
    freezeCommentRange,
    freezeCommentThread,
    freezeCommentThreads,
    normalizeCommentBody,
    type CommentAuthor,
    type CommentMessage,
    type CommentRange,
    type CommentThread,
} from './model.js';

const MAX_COMMENT_THREADS = 500;
const MAX_MESSAGES_PER_THREAD = 100;
const DECORATION_OWNER = 'soeditor.comments';

export type CommentAction =
    'create' | 'delete' | 'erase' | 'export' | 'reopen' | 'reply' | 'resolve';

export interface CommentPermissionContext {
    readonly action: CommentAction;
    readonly author: CommentAuthor;
    readonly editorReadonly: boolean;
    readonly thread?: CommentThread;
}

export interface CommentPermissionProvider {
    can(context: CommentPermissionContext): boolean;
}

export interface CommentStorageAdapter {
    load(): PromiseLike<readonly CommentThread[]>;
    /** Replaces the complete host-owned thread collection. */
    save(threads: readonly CommentThread[]): PromiseLike<void>;
}

export interface CommentDataExport {
    readonly schema: 'soeditor.comments';
    readonly threads: readonly CommentThread[];
    readonly version: 1;
}

export interface CommentsPluginOptions {
    readonly author: () => CommentAuthor;
    readonly createId: () => string;
    readonly now?: () => number;
    readonly permissions: CommentPermissionProvider;
    /** Optional review policy supplied by a host or revisions service. */
    readonly reviewPolicy?: () => 'comments-only' | 'edit' | 'readonly';
    readonly storage: CommentStorageAdapter;
}

export interface CommentsService {
    readonly activeThreadId: string | undefined;
    readonly lastError: unknown;
    readonly snapshot: readonly CommentThread[];
    can(action: CommentAction, threadId?: string): boolean;
    create(body: string): Promise<void>;
    delete(threadId: string): Promise<void>;
    erase(threadId: string): Promise<void>;
    exportData(): CommentDataExport;
    next(): boolean;
    open(threadId: string): boolean;
    previous(): boolean;
    reopen(threadId: string): Promise<void>;
    reply(threadId: string, body: string): Promise<void>;
    resolve(threadId: string): Promise<void>;
    subscribe(listener: () => void): () => void;
    waitForIdle(): Promise<void>;
}

export const commentsServiceToken =
    createServiceToken<CommentsService>('soeditor.comments');

export class CommentsController {
    readonly #editor: Editor;
    readonly #listeners = new Set<() => void>();
    readonly #options: CommentsPluginOptions;
    #activeThreadId: string | undefined;
    #destroyed = false;
    #disposeDocumentChange: (() => void) | undefined;
    #lastError: unknown;
    #queue: Promise<void> = Promise.resolve();
    #threads: readonly CommentThread[] = Object.freeze([]);

    constructor(editor: Editor, options: CommentsPluginOptions) {
        this.#editor = editor;
        this.#options = options;
    }

    get service(): CommentsService {
        const activeThreadId = (): string | undefined => {
            this.#assertAlive();
            return this.#activeThreadId;
        };
        const lastError = (): unknown => {
            this.#assertAlive();
            return this.#lastError;
        };
        const snapshot = (): readonly CommentThread[] => {
            this.#assertAlive();
            return this.#threads;
        };
        return Object.freeze({
            get activeThreadId() {
                return activeThreadId();
            },
            get lastError() {
                return lastError();
            },
            get snapshot() {
                return snapshot();
            },
            can: (action: CommentAction, threadId?: string) =>
                this.can(action, threadId),
            create: (body: string) => this.create(body),
            delete: (threadId: string) => this.delete(threadId),
            erase: (threadId: string) => this.erase(threadId),
            exportData: () => this.exportData(),
            next: () => this.navigate(1),
            open: (threadId: string) => this.open(threadId),
            previous: () => this.navigate(-1),
            reopen: (threadId: string) => this.reopen(threadId),
            reply: (threadId: string, body: string) =>
                this.reply(threadId, body),
            resolve: (threadId: string) => this.resolve(threadId),
            subscribe: (listener: () => void) => this.subscribe(listener),
            waitForIdle: () => {
                this.#assertAlive();
                return this.#queue;
            },
        });
    }

    async init(): Promise<void> {
        validateOptions(this.#options);
        this.#threads = boundedThreads(
            freezeCommentThreads(await this.#options.storage.load()),
        );
        this.#syncDecorations();
        this.#disposeDocumentChange = this.#editor.events.on(
            'document:change',
            ({ transaction }) => {
                const operations = readEditingOperations(transaction);
                const updatedAt = this.#now();
                const task = this.#enqueue(
                    (threads) =>
                        threads.map((thread) =>
                            mapCommentThread(thread, operations, updatedAt),
                        ),
                    true,
                );
                void task.catch(() => undefined);
            },
        );
    }

    destroy(): void {
        this.#destroyed = true;
        this.#disposeDocumentChange?.();
        this.#disposeDocumentChange = undefined;
        this.#listeners.clear();
        this.#editor.services
            .tryGet(visualDecorationsServiceToken)
            ?.clear(DECORATION_OWNER);
    }

    can(action: CommentAction, threadId?: string): boolean {
        this.#assertAlive();
        if (
            action !== 'create' &&
            action !== 'delete' &&
            action !== 'erase' &&
            action !== 'export' &&
            action !== 'reopen' &&
            action !== 'reply' &&
            action !== 'resolve'
        ) {
            throw new TypeError('A comment action is invalid.');
        }
        const reviewPolicy = this.#options.reviewPolicy?.();
        if (
            reviewPolicy !== undefined &&
            reviewPolicy !== 'edit' &&
            reviewPolicy !== 'comments-only' &&
            reviewPolicy !== 'readonly'
        ) {
            throw new TypeError('The host returned an invalid review policy.');
        }
        if (
            reviewPolicy === 'readonly' &&
            action !== 'erase' &&
            action !== 'export'
        ) {
            return false;
        }
        const thread =
            threadId === undefined ? undefined : this.#findThread(threadId);
        if (
            action !== 'create' &&
            action !== 'export' &&
            thread === undefined
        ) {
            return false;
        }
        if (thread?.state === 'deleted' && action !== 'erase') return false;
        if (action === 'resolve' && thread?.state !== 'linked') return false;
        if (action === 'reopen' && thread?.state !== 'resolved') return false;
        if (
            action === 'reply' &&
            thread?.messages.length === MAX_MESSAGES_PER_THREAD
        ) {
            return false;
        }
        return (
            this.#options.permissions.can(
                Object.freeze({
                    action,
                    author: this.#author(),
                    editorReadonly: this.#editor.state.readonly,
                    ...(thread === undefined ? {} : { thread }),
                }),
            ) === true
        );
    }

    async create(body: string): Promise<void> {
        const normalized = normalizeCommentBody(body);
        if (!this.can('create')) throw permissionError('create');
        if (this.#editor.state.mode !== 'visual') {
            throw new Error(
                'A comment can only be created from a Visual selection.',
            );
        }
        const selection = this.#editor.services
            .get(visualEditingServiceToken)
            .getSelection();
        if (selection === undefined) {
            throw new Error('A visual selection is required to add a comment.');
        }
        const range = rangeFromSelection(selection);
        const author = this.#author();
        const createdAt = this.#now();
        const threadId = this.#id();
        const messageId = this.#id();
        await this.#enqueue((threads) => {
            assertUniqueId(threads, threadId);
            assertUniqueId(threads, messageId);
            return [
                ...threads,
                freezeCommentThread({
                    createdAt,
                    id: threadId,
                    messages: [
                        { author, body: normalized, createdAt, id: messageId },
                    ],
                    range,
                    state: 'linked',
                    updatedAt: createdAt,
                }),
            ];
        });
        this.open(threadId);
    }

    async reply(threadId: string, body: string): Promise<void> {
        const normalized = normalizeCommentBody(body);
        if (!this.can('reply', threadId)) throw permissionError('reply');
        const author = this.#author();
        const createdAt = this.#now();
        const messageId = this.#id();
        await this.#enqueue((threads) =>
            threads.map((thread) => {
                if (thread.id !== threadId) return thread;
                assertUniqueId(threads, messageId);
                const message: CommentMessage = {
                    author,
                    body: normalized,
                    createdAt,
                    id: messageId,
                };
                return freezeCommentThread({
                    ...thread,
                    messages: [...thread.messages, message],
                    updatedAt: createdAt,
                });
            }),
        );
    }

    async resolve(threadId: string): Promise<void> {
        if (!this.can('resolve', threadId)) throw permissionError('resolve');
        const author = this.#author();
        const updatedAt = this.#now();
        await this.#enqueue((threads) =>
            threads.map((thread) =>
                thread.id === threadId && thread.state === 'linked'
                    ? freezeCommentThread({
                          ...thread,
                          resolvedAt: updatedAt,
                          resolvedBy: author,
                          state: 'resolved',
                          updatedAt,
                      })
                    : thread,
            ),
        );
    }

    async reopen(threadId: string): Promise<void> {
        if (!this.can('reopen', threadId)) throw permissionError('reopen');
        const updatedAt = this.#now();
        await this.#enqueue((threads) =>
            threads.map((thread) => {
                if (thread.id !== threadId || thread.state !== 'resolved') {
                    return thread;
                }
                return freezeCommentThread({
                    createdAt: thread.createdAt,
                    id: thread.id,
                    messages: thread.messages,
                    range: thread.range,
                    state: 'linked',
                    updatedAt,
                });
            }),
        );
    }

    async delete(threadId: string): Promise<void> {
        if (!this.can('delete', threadId)) throw permissionError('delete');
        const author = this.#author();
        const updatedAt = this.#now();
        await this.#enqueue((threads) =>
            threads.map((thread) =>
                thread.id === threadId && thread.state !== 'deleted'
                    ? freezeCommentThread({
                          createdAt: thread.createdAt,
                          deletedAt: updatedAt,
                          deletedBy: author,
                          id: thread.id,
                          messages: thread.messages,
                          state: 'deleted',
                          updatedAt,
                      })
                    : thread,
            ),
        );
        if (this.#activeThreadId === threadId) {
            this.#activeThreadId = undefined;
            this.#notify();
        }
    }

    async erase(threadId: string): Promise<void> {
        if (!this.can('erase', threadId)) throw permissionError('erase');
        await this.#enqueue((threads) =>
            threads.filter(({ id }) => id !== threadId),
        );
        if (this.#activeThreadId === threadId) {
            this.#activeThreadId = undefined;
            this.#notify();
        }
    }

    exportData(): CommentDataExport {
        if (!this.can('export')) throw permissionError('export');
        return Object.freeze({
            schema: 'soeditor.comments',
            threads: this.#threads,
            version: 1,
        });
    }

    open(threadId: string): boolean {
        this.#assertAlive();
        const thread = this.#findThread(threadId);
        if (thread === undefined || thread.state === 'deleted') return false;
        this.#activeThreadId = threadId;
        if (thread.state === 'linked' || thread.state === 'resolved') {
            this.#editor.services
                .tryGet(visualEditingServiceToken)
                ?.setSelection(
                    { anchor: thread.range.from, focus: thread.range.to },
                    true,
                );
        }
        this.#notify();
        return true;
    }

    navigate(direction: -1 | 1): boolean {
        this.#assertAlive();
        const threads = this.#threads.filter(
            ({ state }) => state !== 'deleted',
        );
        if (threads.length === 0) return false;
        const current = threads.findIndex(
            ({ id }) => id === this.#activeThreadId,
        );
        const index =
            current < 0
                ? direction > 0
                    ? 0
                    : threads.length - 1
                : (current + direction + threads.length) % threads.length;
        return this.open(threads[index]!.id);
    }

    subscribe(listener: () => void): () => void {
        this.#assertAlive();
        if (typeof listener !== 'function') {
            throw new TypeError('A comments listener must be a function.');
        }
        this.#listeners.add(listener);
        return () => this.#listeners.delete(listener);
    }

    #enqueue(
        transform: (
            threads: readonly CommentThread[],
        ) => readonly CommentThread[],
        deferDecorations = false,
    ): Promise<void> {
        this.#assertAlive();
        const next = boundedThreads(
            freezeCommentThreads(transform(this.#threads)),
        );
        this.#threads = next;
        if (deferDecorations) {
            globalThis.queueMicrotask(() => {
                if (this.#destroyed) return;
                try {
                    this.#syncDecorations();
                } catch (error: unknown) {
                    this.#lastError = error;
                    this.#notify();
                }
            });
        } else {
            this.#syncDecorations();
        }
        this.#notify();
        const task = this.#queue.then(async () => {
            if (this.#destroyed) return;
            await this.#options.storage.save(next);
            if (this.#destroyed) return;
            this.#lastError = undefined;
            this.#notify();
        });
        const observed = task.catch((error: unknown) => {
            if (!this.#destroyed) {
                this.#lastError = error;
                this.#notify();
            }
            throw error;
        });
        this.#queue = observed.catch(() => undefined);
        return observed;
    }

    #syncDecorations(): void {
        const decorations: VisualDecoration[] = this.#threads.flatMap(
            (thread) => {
                if (thread.state !== 'linked' && thread.state !== 'resolved') {
                    return [];
                }
                return [
                    {
                        from: thread.range.from,
                        id: `comment.${thread.id}`,
                        label:
                            thread.state === 'resolved'
                                ? 'Resolved comment'
                                : 'Comment',
                        status:
                            thread.state === 'resolved' ? 'resolved' : 'active',
                        to: thread.range.to,
                    } satisfies VisualDecoration,
                ];
            },
        );
        this.#editor.services
            .get(visualDecorationsServiceToken)
            .replace(DECORATION_OWNER, decorations);
    }

    #notify(): void {
        const errors: unknown[] = [];
        for (const listener of [...this.#listeners]) {
            try {
                listener();
            } catch (error: unknown) {
                errors.push(error);
            }
        }
        if (errors.length > 0) {
            this.#lastError = new AggregateError(
                errors,
                'Comments listeners failed.',
            );
        }
    }

    #findThread(threadId: string): CommentThread | undefined {
        return this.#threads.find(({ id }) => id === threadId);
    }

    #author(): CommentAuthor {
        return freezeAuthor(this.#options.author());
    }

    #id(): string {
        const value = this.#options.createId();
        if (typeof value !== 'string' || value.trim().length === 0) {
            throw new TypeError('A host comment ID must not be empty.');
        }
        return value;
    }

    #now(): number {
        const value = (this.#options.now ?? Date.now)();
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
            throw new TypeError('The comment clock returned an invalid value.');
        }
        return value;
    }

    #assertAlive(): void {
        if (this.#destroyed) {
            throw new Error('The comments service has been destroyed.');
        }
    }
}

function validateOptions(options: CommentsPluginOptions): void {
    if (
        typeof options !== 'object' ||
        options === null ||
        typeof options.author !== 'function' ||
        typeof options.createId !== 'function' ||
        typeof options.storage?.load !== 'function' ||
        typeof options.storage.save !== 'function' ||
        typeof options.permissions?.can !== 'function' ||
        (options.reviewPolicy !== undefined &&
            typeof options.reviewPolicy !== 'function') ||
        (options.now !== undefined && typeof options.now !== 'function')
    ) {
        throw new TypeError(
            'Comments require author, ID, permission, and storage adapters.',
        );
    }
}

function boundedThreads(
    threads: readonly CommentThread[],
): readonly CommentThread[] {
    if (threads.length > MAX_COMMENT_THREADS) {
        throw new RangeError(
            `Comments are limited to ${String(MAX_COMMENT_THREADS)} threads per editor.`,
        );
    }
    if (
        threads.some(
            ({ messages }) => messages.length > MAX_MESSAGES_PER_THREAD,
        )
    ) {
        throw new RangeError(
            `A comment thread is limited to ${String(MAX_MESSAGES_PER_THREAD)} messages.`,
        );
    }
    return threads;
}

function rangeFromSelection(selection: EditingSelection): CommentRange {
    const forward = comparePoints(selection.anchor, selection.focus) <= 0;
    return freezeCommentRange({
        from: forward ? selection.anchor : selection.focus,
        to: forward ? selection.focus : selection.anchor,
    });
}

function assertUniqueId(threads: readonly CommentThread[], id: string): void {
    if (
        threads.some(
            (thread) =>
                thread.id === id ||
                thread.messages.some((message) => message.id === id),
        )
    ) {
        throw new Error(`Host comment ID "${id}" is already in use.`);
    }
}

function permissionError(action: CommentAction): Error {
    return new Error(`Comment action "${action}" is not permitted.`);
}
