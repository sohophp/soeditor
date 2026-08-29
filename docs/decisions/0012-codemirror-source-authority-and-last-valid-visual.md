# ADR 0012: CodeMirror source authority and last-valid visual projection

- Status: Accepted
- Date: 2026-08-29

## Context

Phase 6 needs a first-class HTML source editor without moving browser or
CodeMirror dependencies into Core. Source input may be malformed or
recoverable, and parsing it into a tree then immediately serializing would
silently replace what the user typed. At the same time, letting the visual
engine edit a parser-recovered tree could later overwrite invalid canonical
source with a normalized representation.

## Decision

`@soeditor/source` owns the CodeMirror 6 integration. It depends on public Core
and HTML APIs plus the engine's narrow public history-group helper, while Core
remains unaware of CodeMirror and the DOM. The package
exports a source-mode plugin, a browser engine/factory, and a narrow typed
service whose public values use SoEditor-owned diagnostic types. CodeMirror
state, view, transaction, and diagnostic types remain implementation details.

The exact CodeMirror document is authoritative source input. A source edit
commits its complete string directly through a Core document transaction. It
does not parse and serialize before commit. External Core document changes
replace CodeMirror content without entering CodeMirror's user undo history or
creating synchronization loops.

`@soeditor/html` diagnostics are projected into CodeMirror's lint UI and remain
available through the source service. Parser diagnostics do not block source
commit or mode switching.

The visual engine tracks its last parse-valid fragment model. When canonical
source reports parser errors, it retains that model as a locked visual
projection. If no valid model exists, it displays an inert invalid-source
placeholder. Once source becomes parse-valid, normal visual projection and
editing resume. Complete documents retain their existing independently locked
policy.

Mode transitions are commands over Core transactions. Visual and source
surfaces observe Core mode and only their active surface is visible/editable.

## Consequences

Users can inspect and repair exact malformed source without silent formatting,
sanitization, or parser recovery rewriting it. A visual edit cannot accidentally
serialize a recovered invalid tree over canonical source. Source and visual
surfaces share Core lifecycle and document events without either becoming the
canonical document store.

The Phase 6 source engine commits complete source snapshots per CodeMirror
document change. When Core history commands exist, high-priority source
shortcuts invoke them and consecutive `source`-origin transactions group within
the existing bounded history window. Without Core history, CodeMirror's local
history remains the fallback. Incremental source patches, shared cross-surface
selection, extensible diagnostic providers, formatting, and customizable source
themes are deferred.
