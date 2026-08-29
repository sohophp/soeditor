import type { EditingPoint } from '@soeditor/engine';

export interface CommentRange {
    readonly from: EditingPoint;
    readonly to: EditingPoint;
}

export interface CommentAuthor {
    readonly id: string;
    readonly name: string;
}

export interface CommentMessage {
    readonly author: CommentAuthor;
    readonly body: string;
    readonly createdAt: number;
    readonly id: string;
}

interface CommentThreadBase {
    readonly createdAt: number;
    readonly id: string;
    readonly messages: readonly CommentMessage[];
    readonly updatedAt: number;
}

export interface LinkedCommentThread extends CommentThreadBase {
    readonly range: CommentRange;
    readonly state: 'linked';
}

export interface ResolvedCommentThread extends CommentThreadBase {
    readonly range: CommentRange;
    readonly resolvedAt: number;
    readonly resolvedBy: CommentAuthor;
    readonly state: 'resolved';
}

export type CommentUnlinkReason =
    'ambiguous-document-change' | 'content-removed';

export interface UnlinkedCommentThread extends CommentThreadBase {
    readonly previousRange: CommentRange;
    readonly reason: CommentUnlinkReason;
    readonly state: 'unlinked';
}

export interface DeletedCommentThread extends CommentThreadBase {
    readonly deletedAt: number;
    readonly deletedBy: CommentAuthor;
    readonly state: 'deleted';
}

export type CommentThread =
    | LinkedCommentThread
    | ResolvedCommentThread
    | UnlinkedCommentThread
    | DeletedCommentThread;

export function freezeCommentThreads(
    threads: readonly CommentThread[],
): readonly CommentThread[] {
    if (!Array.isArray(threads)) {
        throw new TypeError('Comment threads must be an array.');
    }
    const ids = new Set<string>();
    const frozen = threads.map((thread) => {
        const value = freezeCommentThread(thread);
        if (ids.has(value.id)) {
            throw new Error(`Comment thread "${value.id}" is duplicated.`);
        }
        ids.add(value.id);
        return value;
    });
    return Object.freeze(frozen);
}

export function freezeCommentThread(thread: CommentThread): CommentThread {
    if (typeof thread !== 'object' || thread === null) {
        throw new TypeError('A comment thread must be an object.');
    }
    const base = {
        createdAt: timestamp(thread.createdAt, 'createdAt'),
        id: identity(thread.id, 'thread ID'),
        messages: freezeMessages(thread.messages),
        updatedAt: timestamp(thread.updatedAt, 'updatedAt'),
    };
    if (base.updatedAt < base.createdAt) {
        throw new RangeError(
            'A comment thread updatedAt must not precede createdAt.',
        );
    }
    if (
        base.messages.some(
            ({ createdAt }) =>
                createdAt < base.createdAt || createdAt > base.updatedAt,
        )
    ) {
        throw new RangeError(
            'Comment message timestamps must fall within the thread lifetime.',
        );
    }
    switch (thread.state) {
        case 'linked':
            return Object.freeze({
                ...base,
                range: freezeCommentRange(thread.range),
                state: thread.state,
            });
        case 'resolved':
            if (
                thread.resolvedAt < base.createdAt ||
                thread.resolvedAt > base.updatedAt
            ) {
                throw new RangeError(
                    'A resolvedAt timestamp must fall within the thread lifetime.',
                );
            }
            return Object.freeze({
                ...base,
                range: freezeCommentRange(thread.range),
                resolvedAt: timestamp(thread.resolvedAt, 'resolvedAt'),
                resolvedBy: freezeAuthor(thread.resolvedBy),
                state: thread.state,
            });
        case 'unlinked':
            if (
                thread.reason !== 'ambiguous-document-change' &&
                thread.reason !== 'content-removed'
            ) {
                throw new TypeError('A comment unlink reason is invalid.');
            }
            return Object.freeze({
                ...base,
                previousRange: freezeCommentRange(thread.previousRange),
                reason: thread.reason,
                state: thread.state,
            });
        case 'deleted':
            if (
                thread.deletedAt < base.createdAt ||
                thread.deletedAt > base.updatedAt
            ) {
                throw new RangeError(
                    'A deletedAt timestamp must fall within the thread lifetime.',
                );
            }
            return Object.freeze({
                ...base,
                deletedAt: timestamp(thread.deletedAt, 'deletedAt'),
                deletedBy: freezeAuthor(thread.deletedBy),
                state: thread.state,
            });
        default:
            throw new TypeError('A comment thread state is invalid.');
    }
}

export function freezeCommentRange(range: CommentRange): CommentRange {
    if (typeof range !== 'object' || range === null) {
        throw new TypeError('A comment range must be an object.');
    }
    const from = freezePoint(range.from);
    const to = freezePoint(range.to);
    if (comparePoints(from, to) >= 0) {
        throw new RangeError('A comment range must not be empty.');
    }
    return Object.freeze({ from, to });
}

export function freezeAuthor(author: CommentAuthor): CommentAuthor {
    if (typeof author !== 'object' || author === null) {
        throw new TypeError('A comment author must be an object.');
    }
    return Object.freeze({
        id: identity(author.id, 'author ID'),
        name: text(author.name, 'author name', 256),
    });
}

export function normalizeCommentBody(body: unknown): string {
    if (typeof body !== 'string') {
        throw new TypeError('A comment body must be a string.');
    }
    const normalized = body.trim();
    if (normalized.length === 0 || normalized.length > 10_000) {
        throw new RangeError(
            'A comment body must contain 1 to 10000 characters.',
        );
    }
    return normalized;
}

function freezeMessages(
    messages: readonly CommentMessage[],
): readonly CommentMessage[] {
    if (!Array.isArray(messages) || messages.length === 0) {
        throw new TypeError('A comment thread requires at least one message.');
    }
    const ids = new Set<string>();
    return Object.freeze(
        messages.map((message) => {
            if (typeof message !== 'object' || message === null) {
                throw new TypeError('A comment message must be an object.');
            }
            const frozen = Object.freeze({
                author: freezeAuthor(message.author),
                body: normalizeCommentBody(message.body),
                createdAt: timestamp(message.createdAt, 'message createdAt'),
                id: identity(message.id, 'message ID'),
            });
            if (ids.has(frozen.id)) {
                throw new Error(
                    `Comment message "${frozen.id}" is duplicated in one thread.`,
                );
            }
            ids.add(frozen.id);
            return frozen;
        }),
    );
}

function freezePoint(point: EditingPoint): EditingPoint {
    if (
        typeof point !== 'object' ||
        point === null ||
        !Number.isInteger(point.block) ||
        point.block < 0 ||
        !Number.isInteger(point.offset) ||
        point.offset < 0
    ) {
        throw new TypeError('A comment point requires non-negative indexes.');
    }
    return Object.freeze({ block: point.block, offset: point.offset });
}

function identity(value: unknown, label: string): string {
    return text(value, label, 256);
}

function text(value: unknown, label: string, maximum: number): string {
    if (
        typeof value !== 'string' ||
        value.trim().length === 0 ||
        value.length > maximum
    ) {
        throw new TypeError(
            `A comment ${label} must contain 1 to ${String(maximum)} characters.`,
        );
    }
    return value;
}

function timestamp(value: unknown, label: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        throw new TypeError(`A comment ${label} must be a positive timestamp.`);
    }
    return value;
}

export function comparePoints(left: EditingPoint, right: EditingPoint): number {
    return left.block === right.block
        ? left.offset - right.offset
        : left.block - right.block;
}
