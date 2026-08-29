# ADR 0022 — Persistent Projection Coordination Outside Core

## Status

Accepted for Phase 19.

## Context

SoEditor 0.5 surfaces infer visibility and editability directly from the single
Core `EditorState.mode`. That is sufficient for one visible projection, but it
cannot represent a visible Source/Preview or Visual/Source pair. Letting each
surface invent independent flags would create multiple writers and private
cross-package coupling. Adding pane state to Core would make framework-neutral
document infrastructure responsible for browser presentation.

Canonical `EditorDocument.source` already synchronizes every projection and
must remain the only cross-projection content authority.

## Decision

Create a small DOM-free `@soeditor/projections` package containing a per-editor
coordinator plugin/service and SoEditor-owned activity contracts.

The coordinator owns:

- attachment identity and lifecycle for `visual`, `source`, `markdown`, and
  `preview` projections;
- immutable `visible`, `primary`, and effective `readonly` activity;
- validation that activity is compatible with canonical document format;
- one logical writable primary among attached editable projections;
- commands for primary transfer and visibility changes;
- deterministic adapter notification and race handling.

The coordinator does not own canonical content, DOM hosts, layout, parsing,
selection, history, or rendering. Surface engines adapt through the public
service and retain their legacy `EditorState.mode` behavior when no coordinator
is installed. Preview is observable and readonly, never primary. Editor-level
readonly policy makes every surface effectively readonly without deleting the
logical primary.

Visibility and write authority are distinct. A projection may remain visible
and synchronized while readonly. Primary transfer is explicit and
command-driven; optional focus activation invokes the same command rather than
mutating coordinator state directly.

## Consequences

- Core remains DOM-free and presentation-agnostic.
- Phase 20 can build two-pane layout on a stable activity service rather than
  controlling engine internals.
- Four surface packages gain a small dependency on a SoEditor-owned contract.
- Distribution gains one focused package that must be audited with the other
  public packages in Phase 21.
- Simultaneous writers, shared selections, layout persistence, and
  collaboration remain explicitly unsupported.
