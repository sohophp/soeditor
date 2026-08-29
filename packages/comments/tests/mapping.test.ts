import { describe, expect, it } from 'vitest';

import {
    freezeCommentThread,
    mapCommentThread,
    type CommentThread,
} from '../src/index.js';

const linked = freezeCommentThread({
    createdAt: 1,
    id: 'thread-1',
    messages: [
        {
            author: { id: 'author-1', name: 'Author' },
            body: 'Review this',
            createdAt: 1,
            id: 'message-1',
        },
    ],
    range: { from: { block: 0, offset: 2 }, to: { block: 0, offset: 5 } },
    state: 'linked',
    updatedAt: 1,
});

describe('comment range mapping', () => {
    it('maps insertions inside and outside a linked range', () => {
        expect(
            mapCommentThread(
                linked,
                [
                    {
                        block: 0,
                        from: 3,
                        insertedLength: 2,
                        kind: 'replace-text',
                        to: 3,
                    },
                ],
                2,
            ),
        ).toMatchObject({
            range: {
                from: { block: 0, offset: 2 },
                to: { block: 0, offset: 7 },
            },
            state: 'linked',
        });
        expect(
            mapCommentThread(
                linked,
                [
                    {
                        block: 0,
                        from: 0,
                        insertedLength: 1,
                        kind: 'replace-text',
                        to: 0,
                    },
                ],
                2,
            ),
        ).toMatchObject({
            range: {
                from: { block: 0, offset: 3 },
                to: { block: 0, offset: 6 },
            },
        });
    });

    it('unlinks removed ranges and ambiguous document replacements', () => {
        expect(
            mapCommentThread(
                linked,
                [
                    {
                        block: 0,
                        from: 2,
                        insertedLength: 0,
                        kind: 'replace-text',
                        to: 5,
                    },
                ],
                3,
            ),
        ).toMatchObject({ reason: 'content-removed', state: 'unlinked' });
        expect(mapCommentThread(linked, undefined, 4)).toMatchObject({
            previousRange: {
                from: { block: 0, offset: 2 },
                to: { block: 0, offset: 5 },
            },
            reason: 'ambiguous-document-change',
            state: 'unlinked',
        });
    });

    it('keeps resolved state while moving a whole structured range', () => {
        const resolved: CommentThread = freezeCommentThread({
            ...linked,
            range: {
                from: { block: 1, offset: 0 },
                to: { block: 1, offset: 1 },
            },
            resolvedAt: 2,
            resolvedBy: { id: 'author-1', name: 'Author' },
            state: 'resolved',
            updatedAt: 2,
        });
        expect(
            mapCommentThread(
                resolved,
                [{ fromBlock: 1, kind: 'move-block', toBlock: 3 }],
                3,
            ),
        ).toMatchObject({
            range: {
                from: { block: 3, offset: 0 },
                to: { block: 3, offset: 1 },
            },
            state: 'resolved',
        });
    });
});
