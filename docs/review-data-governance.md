# Review data ownership, export, and deletion

`@soeditor/comments` and `@soeditor/revisions` are clients of host-owned data.
They do not create a hidden database, browser cache, analytics stream, or
telemetry channel. Canonical HTML/Markdown does not contain comments or
revision history.

## Ownership and authorization

The host owns identities, permissions, storage, retention, audit records,
backups, replicas, tenancy, encryption, and regulatory decisions. Every
`export` and `erase` call is checked through the same required permission
provider as editor-facing actions. Applications should authorize these actions
server-side again; a client callback is a UX and defense-in-depth boundary, not
a replacement for backend access control.

Export objects are immutable, JSON-compatible envelopes with a package schema
name and version `1`:

```ts
const comments = editor.services.get(commentsServiceToken);
const commentArchive = comments.exportData();

const revisions = editor.services.get(revisionsServiceToken);
const revisionArchive = await revisions.exportData();
```

Comment exports include every loaded thread, including tombstones, because an
access/export request must not silently hide retained personal data. Revision
exports load every snapshot in the bounded current list (at most 200). For
larger archives, pagination, or a legally authoritative export, use the host
backend directly.

Both exports can contain personal data. Revision exports also contain raw
document source, including preserved inert HTML that must not be rendered as
trusted content.

## Tombstone versus permanent erasure

`comments.delete(id)` is a reversible workflow deletion. It writes a
`deleted` tombstone and intentionally retains messages, author records, and
timestamps. It is not privacy erasure.

`comments.erase(id)` permanently removes the thread from the full collection
passed to `CommentStorageAdapter.save()`. The adapter contract requires that
`save()` replace the complete collection. If persistence fails, `lastError`
remains observable; the in-memory service is optimistic, so the host must
reconcile or reload before claiming erasure succeeded.

`revisions.erase(id)` is available only when `RevisionStorage.erase` exists.
The service removes local metadata only after the adapter resolves. An adapter
must resolve only after its authoritative active store has accepted permanent
removal.

Neither operation can promise immediate removal from backups, replicas, legal
holds, audit systems, exports already downloaded, or another open editor. The
host must document and enforce those lifecycles. Destroying an editor instance
does not delete host data.

## Recommended adapter behavior

- bind every call to an authenticated tenant and document ID;
- re-check authorization on the server;
- use atomic replacement or conditional writes for comments;
- make erasure idempotent and observable;
- encrypt transport and storage as appropriate;
- define retention separately for active records, tombstones, revisions,
  backups, and security audit events;
- avoid logging comment bodies or revision source;
- report adapter failures to users and do not claim completion before the
  authoritative backend confirms it.
