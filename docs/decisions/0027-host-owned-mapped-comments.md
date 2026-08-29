# ADR 0027: Host-owned mapped comments

- Status: Accepted
- Date: 2026-08-30

## Context

Comments are application data tied to document positions, not HTML content.
Persisting them as source attributes would pollute user HTML, leak private
review data through copy/export, and make unsupported-host behavior ambiguous.
Letting a comment plugin decorate projection DOM directly would bypass engine
ownership and break rerender, selection, and teardown guarantees.

Visual transactions already publish bounded editing operations and point
mapping. Exact Source replacement and history replay deliberately do not claim
granular operations, so annotation behavior at those boundaries must be
explicit rather than heuristic.

## Decision

The engine owns a generic per-editor visual-decoration registry. Providers
replace bounded immutable editing ranges under a unique owner ID. The visual
projection renders these ranges as non-canonical markers and keeps selection,
mutation repair, node views, and teardown under engine control.

`@soeditor/comments` owns comment models, commands, mapping policy, and UI. A
factory captures host-provided author, permission, ID, and atomic snapshot
storage adapters per editor instance. Comments never enter Core state or
canonical HTML. Linked and resolved ranges map through validated Visual
operations. A removed range or a changed document without granular operations
becomes explicitly unlinked; deleted threads remain tombstones. No fuzzy text
matching is attempted.

## Consequences

HTML copy/export remains free of review metadata, and hosts retain storage,
identity, authorization, retention, and network ownership. Comments can target
paragraph text or a whole structured table/widget block; nested cell/widget
positions remain outside the current editing model.

Undo/redo restores HTML but cannot reconstruct a precise comment position from
snapshot history, so affected linked ranges become unlinked. A later revision
phase may coordinate comment snapshots with host-owned revisions, but must not
retrofit guessed positions into this phase.
