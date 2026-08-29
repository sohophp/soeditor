# @soeditor/revisions

Private Phase 28 development package for host-owned draft/saved revisions,
bounded semantic comparison, explicit transaction restoration, and
edit/comments-only/readonly policy.

Historical snapshots remain outside canonical editor state. Hosts provide all
storage, identity, authorization, audit, retention, and concurrency behavior.
See [`docs/revisions.md`](../../docs/revisions.md).
