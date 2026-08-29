# ADR 0010: Transaction history and controlled clipboard

- Status: Accepted
- Date: 2026-08-29

## Context

Phase 4 needs deterministic visual undo/redo, selection restoration, and
clipboard behavior without delegating authoritative state to browser history or
native contenteditable mutation.

## Decision

Undo/redo is implemented by `HistoryPlugin` over committed Core document
transactions. History entries contain canonical before/after HTML source and,
when supplied by the visual engine, DOM-independent selection snapshots.
`editor.undo` and `editor.redo` replay canonical source through new Core
transactions rather than invoking browser undo.

Private namespaced transaction metadata carries history grouping, before/after
selection, replay identity, and replay selection. This metadata is an internal
bridge between the visual engine and history plugin; native DOM selections do
not enter Core state or the public history API.

Compatible typing and deletion transactions group only when their group IDs,
source continuity, selection continuity, and one-second time window agree.
Paragraph operations, formatting, paste, cut, external replacements, and
discontinuous edits remain separate entries. Phase 4 stores bounded source
snapshots instead of introducing speculative tree-operation inversion.

Copy, cut, and paste are controlled visual-surface boundaries. Copy produces
plain text and semantic HTML from the structured selection. Paste prefers HTML,
parses it through `@soeditor/html`, normalizes inline/block structure, and falls
back to newline-normalized plain-text paragraphs. Insertions become editing
model operations and Core transactions. Unknown or unsafe markup remains opaque
structured data and is never injected as executable editing DOM.

## Consequences

Visual and programmatic source changes share deterministic history, browser
native undo cannot diverge from canonical state, and clipboard input cannot
bypass the Phase 3 projection/security boundary. Redo is invalidated by a new
committed edit, and opaque selections are rejected rather than silently
discarded.

Source snapshots have linear memory cost and the visual engine still rerenders
after transactions. Advanced operation inversion, collaborative history,
platform word deletion, office-grade paste cleanup, table/widget selection, and
source-preserving clipboard fidelity are deferred.
