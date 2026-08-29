# Comments and mapped annotations

`@soeditor/comments` is a public 0.8 package. It is not part of the published
0.5.1 set or the unpublished 0.7 candidate.

Comments are host data, not HTML. The host supplies identity, authorization,
unique IDs, a clock, and atomic full-snapshot storage:

```ts
import { createCommentsPlugin, type CommentThread } from '@soeditor/comments';

let stored: readonly CommentThread[] = [];

const CommentsPlugin = createCommentsPlugin({
    author: () => ({ id: currentUser.id, name: currentUser.name }),
    createId: () => crypto.randomUUID(),
    permissions: {
        can: ({ action, author, thread }) =>
            policy.allows(action, author.id, thread?.id),
    },
    storage: {
        load: async () => stored,
        save: async (threads) => {
            await commentsApi.replaceDocumentComments(documentId, threads);
            stored = threads;
        },
    },
});
```

Add the returned constructor to one editor's plugins and add `comments` to its
toolbar. The adapter must persist the supplied immutable snapshot atomically.
Writes are serialized in invocation order. The service updates optimistically;
`lastError` exposes a failed host save so the application can report or retry
according to its own network policy.

## Range and state policy

Threads are explicitly `linked`, `resolved`, `unlinked`, or `deleted`. Linked
and resolved ranges use Visual editing-model points and map through validated
operations. Insertions inside a range expand it; movement follows block moves;
removing the complete range unlinks it. A Source replacement or history replay
without granular operations also unlinks it with
`ambiguous-document-change`. SoEditor does not guess by searching text.

Paragraph text and an entire structured table/widget (`0..1`) are supported.
Table-cell and nested widget positions are not represented by the current
editing model. Comments are absent from HTML copy, paste, source, preview, and
document export. Pasting annotated content does not clone threads.

Comment bodies and author names render through `textContent`. SoEditor limits
one editor to 500 threads, 100 messages per thread, and 10,000 characters per
message.

Readonly content does not automatically forbid review actions. The supplied
permission provider decides whether a reviewer can create, reply, resolve,
reopen, or delete; content mutation remains independently readonly.

When Phase 28 review modes are enabled, pass `reviewPolicy` from the revisions
service. `comments-only` continues to consult the permission provider, while
`readonly` disables editor-facing comment actions before host permissions are
called. Explicitly authorized `export` and `erase` governance actions remain
available independently of document edit policy.

## Export and deletion

`service.exportData()` returns an immutable versioned envelope containing all
loaded threads, including deleted tombstones. `service.delete(id)` is a
reversible workflow tombstone and retains message content. `service.erase(id)`
permanently removes the thread through the adapter's full-snapshot `save()`
contract. See [review data governance](review-data-governance.md) for adapter,
authorization, privacy, and backend-retention requirements.
