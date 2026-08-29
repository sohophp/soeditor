import { mapEditingPoint, type EditingOperation } from '@soeditor/engine';

import {
    comparePoints,
    freezeCommentThread,
    type CommentThread,
} from './model.js';

/** Maps one thread or unlinks it when the document change is ambiguous. */
export function mapCommentThread(
    thread: CommentThread,
    operations: readonly EditingOperation[] | undefined,
    updatedAt: number,
): CommentThread {
    if (thread.state !== 'linked' && thread.state !== 'resolved') {
        return thread;
    }
    if (operations === undefined) {
        return freezeCommentThread({
            createdAt: thread.createdAt,
            id: thread.id,
            messages: thread.messages,
            previousRange: thread.range,
            reason: 'ambiguous-document-change',
            state: 'unlinked',
            updatedAt,
        });
    }
    const from = mapEditingPoint(thread.range.from, operations, 'forward');
    const to = mapEditingPoint(thread.range.to, operations, 'backward');
    if (comparePoints(from, to) >= 0) {
        return freezeCommentThread({
            createdAt: thread.createdAt,
            id: thread.id,
            messages: thread.messages,
            previousRange: thread.range,
            reason: 'content-removed',
            state: 'unlinked',
            updatedAt,
        });
    }
    return freezeCommentThread({
        ...thread,
        range: { from, to },
        updatedAt,
    });
}
