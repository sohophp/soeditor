# @soeditor/revisions

Public package for host-owned draft/saved revisions, bounded semantic
comparison, explicit transaction restoration, and
edit/comments-only/readonly policy.

Historical snapshots remain outside canonical editor state. Hosts provide all
storage, identity, authorization, audit, retention, and concurrency behavior.
`exportData()` returns the bounded current revision set. Permanent erasure is
available only when the host implements optional `RevisionStorage.erase()` and
authorizes the `erase` action.
See [`docs/revisions.md`](../../docs/revisions.md).
