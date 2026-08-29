# @soeditor/comments

Host-owned mapped comments for SoEditor.

Create a configured plugin with `createCommentsPlugin()`. The host supplies the
current author, permission policy, unique IDs, clock, and atomic snapshot
storage. Thread data never enters canonical HTML. Linked ranges map through
Visual editing operations and become explicitly unlinked when a Source or
history boundary cannot provide a precise mapping.

Comments are limited to 500 threads and 100 messages per thread. Message bodies
are rendered as plain text. Current ranges can cover paragraph text or one
whole structured block; nested table-cell and widget-editable positions are
not supported.

An optional `reviewPolicy` callback distinguishes host-authorized
`comments-only` access from a fully `readonly` review. Content readonly state
alone does not grant or revoke comment permission.

`exportData()` returns a versioned immutable archive including tombstones.
`delete()` is a reversible tombstone; `erase()` permanently removes a thread
through the adapter's full-collection replacement contract. Both governance
actions require explicit host permission. See
[`docs/review-data-governance.md`](../../docs/review-data-governance.md).
