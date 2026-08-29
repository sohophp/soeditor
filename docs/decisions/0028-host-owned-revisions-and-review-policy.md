# ADR 0028: Host-owned revisions and review policy

- Status: Accepted
- Date: 2026-08-30

## Context

Core undo/redo is a bounded, in-memory editing convenience. CMS revisions are
durable application records with authorship, workflow status, authorization,
retention, and audit requirements. Treating those snapshots as Core history or
temporarily replacing canonical content to view them would conflate two
lifecycles and could silently alter dirty state, comments, or unsaved work.

Review access also needs three states: ordinary editing, content-readonly with
comment actions, and fully readonly. Existing editor readonly state was fixed
at creation, so attached Visual, Source, and Markdown surfaces could not react
to an application workflow transition.

## Decision

`@soeditor/revisions` owns immutable revision contracts, a host provider/storage
boundary, commands, review UI, and a per-editor service. Historical snapshots
are loaded into non-canonical service state and shown as escaped source. HTML
comparison uses public SoEditor HTML trees without source locations; Markdown
comparison uses exact canonical lines. Both output and UI previews are bounded.

Restoration performs one explicit `replace-document` transaction marked with
the revision ID. Cross-format restoration is rejected. Since the transaction
does not claim granular editing operations, Phase 27 comments safely unlink.
Merely viewing a revision does not affect current comments or content.

Core gains only the general administrative `Editor.setReadonly(boolean)` state
transition. Projection infrastructure observes that state; review-specific
policy remains in the revisions package. The comments package accepts an
optional host policy callback so comments-only and fully readonly behavior can
be coordinated without a dependency on revisions.

## Consequences

Hosts retain revision storage, IDs, users, authorization, audit, privacy, and
retention responsibility. Revision view state cannot become a second writer,
and restore participates in normal dirty state, history, source synchronization,
and security boundaries.

The initial comparison is structural and positional, not a user-facing
track-changes algorithm. It can report a bounded summary but does not match
moved subtrees, merge branches, or render historical HTML. Those capabilities
remain explicitly deferred.
