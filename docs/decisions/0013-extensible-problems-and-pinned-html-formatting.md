# ADR 0013: Extensible problems and pinned HTML formatting

- Status: Accepted
- Date: 2026-08-29

## Context

Phase 7 needs diagnostics that can be consumed independently of a particular UI
and extended by third parties. It also needs predictable browser-compatible HTML
formatting without placing formatter dependencies or third-party types in Core.
Formatting is intentionally transformative and must not silently repair invalid
or concurrently changed source.

## Decision

`@soeditor/html-tools` owns HTML diagnostics and formatting. Its public problem
model uses SoEditor severity, code, message, provider identity, and SoEditor
source ranges. A per-editor diagnostics service stores an ordered provider
registry. Providers may be asynchronous; validation preserves registration and
provider result order. Only the newest successful validation of the current
canonical source is published as current problems.

The initial providers map `@soeditor/html` parser diagnostics and add selected
structural warnings for duplicate IDs, missing image alternative text, and a
missing complete-document root language. Unknown elements, comments,
namespaced content, templates, and unsafe attributes are not diagnosed merely
for existing.

`document.validate` invokes the provider registry. `document.format` first
validates a source snapshot, refuses parser errors, formats asynchronously, and
commits only if the canonical revision/source still match that snapshot.

Formatting uses pinned Prettier 3.9.6 standalone with its HTML plugin. Prettier
is a runtime dependency and external library import of `@soeditor/html-tools`;
its options and AST types are not public SoEditor APIs. The public formatter
accepts a small validated SoEditor-owned option subset. Formatting occurs only
through an explicit command/service call.

## Consequences

Future Problems panels, status bars, command palettes, and third-party rules can
consume one stable model without depending on CodeMirror or Prettier.
Formatting is deterministic for the pinned version, undoable through ordinary
Core history, and cannot overwrite invalid or newer source.

Phase 7 validation reparses source independently in built-in providers, and
formatting runs on the main thread. Provider priorities, fixes/actions,
incremental/worker validation, rule configuration, automatic formatting, and
the reusable Problems UI are deferred.
