import { Editor } from '@soeditor/core';
import { describe, expect, it, vi } from 'vitest';

import {
    commentsServiceToken,
    createCommentsPlugin,
    freezeCommentThread,
    type CommentStorageAdapter,
    type CommentThread,
} from '../src/index.js';

const initial = freezeCommentThread({
    createdAt: 1,
    id: 'thread-1',
    messages: [
        {
            author: { id: 'author-1', name: 'Author' },
            body: 'Initial',
            createdAt: 1,
            id: 'message-1',
        },
    ],
    range: { from: { block: 0, offset: 0 }, to: { block: 0, offset: 4 } },
    state: 'linked',
    updatedAt: 1,
});

describe('CommentsController', () => {
    it('loads, persists, resolves, reopens, replies, and deletes host-owned threads', async () => {
        let stored: readonly CommentThread[] = [initial];
        const save = vi.fn(async (threads: readonly CommentThread[]) => {
            stored = threads;
        });
        let id = 1;
        let now = 10;
        const editor = await Editor.create({
            data: '<p>Test</p>',
            plugins: [
                createCommentsPlugin({
                    author: () => ({ id: 'reviewer', name: 'Reviewer' }),
                    createId: () => `generated-${String(id++)}`,
                    now: () => now++,
                    permissions: { can: () => true },
                    storage: { load: async () => stored, save },
                }),
            ],
        });
        const comments = editor.services.get(commentsServiceToken);

        await comments.reply('thread-1', 'Reply');
        await comments.resolve('thread-1');
        expect(comments.snapshot[0]).toMatchObject({
            messages: [{ body: 'Initial' }, { body: 'Reply' }],
            state: 'resolved',
        });
        await comments.reopen('thread-1');
        expect(comments.snapshot[0]?.state).toBe('linked');
        await comments.delete('thread-1');
        expect(comments.snapshot[0]?.state).toBe('deleted');
        expect(save).toHaveBeenCalledTimes(4);
        expect(stored[0]?.state).toBe('deleted');
        await editor.destroy();
        expect(() => comments.next()).toThrow('destroyed');
    });

    it('unlinks safely on source/history-shaped changes without operations', async () => {
        let stored: readonly CommentThread[] = [initial];
        const editor = await Editor.create({
            data: '<p>Test</p>',
            plugins: [
                createCommentsPlugin({
                    author: () => ({ id: 'reviewer', name: 'Reviewer' }),
                    createId: () => 'unused',
                    now: () => 20,
                    permissions: { can: () => true },
                    storage: {
                        load: async () => stored,
                        save: async (threads) => {
                            stored = threads;
                        },
                    },
                }),
            ],
        });
        const comments = editor.services.get(commentsServiceToken);
        editor.update(
            (transaction) => transaction.replaceDocument('<p>Changed</p>'),
            { origin: 'source' },
        );
        await comments.waitForIdle();
        expect(comments.snapshot[0]).toMatchObject({
            reason: 'ambiguous-document-change',
            state: 'unlinked',
        });
        expect(stored[0]?.state).toBe('unlinked');
        await editor.destroy();
    });

    it('keeps the optimistic snapshot and exposes adapter failures', async () => {
        const failure = new Error('Storage unavailable');
        const storage: CommentStorageAdapter = {
            load: async () => [initial],
            save: async () => {
                throw failure;
            },
        };
        const editor = await Editor.create({
            data: '<p>Test</p>',
            plugins: [
                createCommentsPlugin({
                    author: () => ({ id: 'reviewer', name: 'Reviewer' }),
                    createId: () => 'message-2',
                    permissions: { can: () => true },
                    storage,
                }),
            ],
        });
        const comments = editor.services.get(commentsServiceToken);
        await expect(comments.reply('thread-1', 'Reply')).rejects.toBe(failure);
        expect(comments.snapshot[0]).toMatchObject({
            messages: [{ body: 'Initial' }, { body: 'Reply' }],
        });
        expect(comments.lastError).toBe(failure);
        await editor.destroy();
    });

    it('serializes concurrent full-snapshot writes without losing replies', async () => {
        const writes: string[] = [];
        let id = 1;
        const editor = await Editor.create({
            data: '<p>Test</p>',
            plugins: [
                createCommentsPlugin({
                    author: () => ({ id: 'reviewer', name: 'Reviewer' }),
                    createId: () => `reply-${String(id++)}`,
                    permissions: { can: () => true },
                    storage: {
                        load: async () => [initial],
                        save: async (threads) => {
                            await Promise.resolve();
                            writes.push(threads[0]!.messages.at(-1)!.body);
                        },
                    },
                }),
            ],
        });
        const comments = editor.services.get(commentsServiceToken);
        const first = comments.reply('thread-1', 'First');
        const second = comments.reply('thread-1', 'Second');
        expect(comments.snapshot[0]?.messages).toHaveLength(3);
        await Promise.all([first, second]);
        expect(writes).toEqual(['First', 'Second']);
        await editor.destroy();
    });

    it('allows comments-only review and blocks every action in readonly review', async () => {
        let policy: 'comments-only' | 'readonly' = 'comments-only';
        const editor = await Editor.create({
            data: '<p>Test</p>',
            readonly: true,
            plugins: [
                createCommentsPlugin({
                    author: () => ({ id: 'reviewer', name: 'Reviewer' }),
                    createId: () => 'message-2',
                    permissions: { can: () => true },
                    reviewPolicy: () => policy,
                    storage: {
                        load: async () => [initial],
                        save: async () => undefined,
                    },
                }),
            ],
        });
        const comments = editor.services.get(commentsServiceToken);

        expect(comments.can('reply', 'thread-1')).toBe(true);
        policy = 'readonly';
        expect(comments.can('reply', 'thread-1')).toBe(false);
        expect(comments.can('delete', 'thread-1')).toBe(false);
        await expect(comments.reply('thread-1', 'Blocked')).rejects.toThrow(
            'not permitted',
        );
        await editor.destroy();
    });
});
