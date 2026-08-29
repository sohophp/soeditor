# ADR 0029: Host-owned review data governance

- Status: Accepted
- Date: 2026-08-30

## Context

Comments and revisions become public in 0.8. Their content can include personal
data and preserved raw document source. A workflow delete, a privacy erasure,
and closing an editor have materially different meanings. SoEditor cannot know
the host's tenancy, backend, backups, audit policy, legal holds, or identity
rules.

## Decision

Review data remains outside canonical editor state and entirely host-owned.
Both packages expose immutable schema-versioned export envelopes and require
host permission for `export` and `erase`.

Comment `delete` remains a tombstone that retains messages. Comment `erase`
removes a thread through the existing atomic full-collection replacement
adapter and remains optimistic like other comment writes. Revision erasure is
available only when the optional storage `erase(id)` capability exists; local
metadata changes only after host confirmation.

Exports cover only the bounded data visible to the editor instance. Hosts must
provide authoritative regulatory exports and govern server authorization,
retention, audit events, replicas, backups, and legal holds. Editor destruction
never implies data deletion.

## Consequences

- applications can clearly distinguish ordinary workflow deletion from
  permanent removal;
- no persistence, identity, or privacy-policy implementation enters Core;
- existing adapters remain source-compatible, with revision erasure opt-in;
- comment adapters must honor their documented full-replacement `save()`
  contract for erasure to be meaningful;
- adapter failures remain observable and require host reconciliation;
- exports containing raw source must be handled as untrusted sensitive data.
