# Phase 6 Implementation Specification — Source Editing

## Status

Active implementation specification for Phase 6 of `docs/ROADMAP.md`.

This document is subordinate to repository policy, accepted ADRs, product,
architecture, roadmap, and the Phase 1–5 implementation.

## Goal

Make exact HTML source editing a first-class SoEditor mode through a mature
CodeMirror 6 surface, predictable Core synchronization, and parser diagnostics.

## Package boundary

Create a browser-dependent `@soeditor/source` package. It may depend on public
APIs from `@soeditor/core`, `@soeditor/html`, the narrow public history-group
helper in `@soeditor/engine`, and focused CodeMirror 6 packages.
It must not add CodeMirror or DOM dependencies to Core, leak CodeMirror types
through public SoEditor APIs, or import another package's internals.

The package exports:

- a source-mode plugin that registers command-driven mode switching;
- a source editing engine/factory that attaches to one editor and one host;
- a narrow typed service for source focus and diagnostics where consumers need
  programmatic access.

## Commands and mode lifecycle

Register stable commands:

```text
editor.source
editor.visual
```

Commands change Core mode through a transaction. `isActive()` reflects current
mode. The source surface is interactive only in source mode; the visual surface
is interactive only in visual mode. Both surfaces restore host attributes and
unregister owned capabilities on independent destruction. Duplicate source or
visual surface attachment must fail before mutating a second host.

Preview behavior remains deferred.

## Source authority and synchronization

CodeMirror's document is initialized from the exact canonical Core source.
Every user document change commits the exact CodeMirror string through a Core
transaction. No parse/serialize round trip occurs on source keystrokes.

Programmatic, history, visual, and external Core document changes synchronize
back into CodeMirror without feedback loops and without entering CodeMirror's
local undo history as user edits.

Invalid or recoverable source remains canonical and visible exactly as typed.
Switching modes must not format, repair, sanitize, or silently rewrite source.

## Language support and diagnostics

Use CodeMirror 6 HTML language support for syntax highlighting and ordinary
source-editor behavior. Feed `@soeditor/html` parser diagnostics into
CodeMirror's diagnostics UI with clamped UTF-16 ranges. Diagnostic data exposed
by SoEditor must use SoEditor-owned HTML diagnostic types, not CodeMirror types.

Choose document versus fragment parsing consistently with the visual engine's
existing complete-document detection. Recompute diagnostics after source and
external document changes.

## Last-valid visual behavior

When newly committed source has parser errors, the visual engine must not
replace its last valid editing model with a recovered/normalized model that a
later visual edit could serialize destructively. Preserve canonical source,
retain the last valid visual model as a locked projection, and resume visual
editing automatically after source becomes parse-valid.

If the initial source is invalid and no valid visual model exists, render an
inert locked diagnostic placeholder. Complete documents remain source-preserved
and visually locked under the existing policy.

## Error and readonly behavior

- Source mode honors editor readonly state.
- Unsupported/invalid input is represented by diagnostics rather than thrown
  away.
- Engine destruction is idempotent and terminal.
- Construction failures and duplicate attachment do not leave mutated hosts or
  registered services.
- Exceptions are not silently swallowed.

## Tests

Add unit and real-browser coverage for:

- plugin command registration, execution, active state, and lifecycle;
- exact source typing and HTML highlighting;
- visual → source → edit → visual transitions;
- source ↔ Core synchronization without loops;
- parser diagnostic rendering and source ranges;
- malformed, recoverable, custom, SVG/template, comment, and unsafe HTML;
- last-valid locked visual projection and recovery;
- readonly behavior;
- CodeMirror/source selection and undo behavior;
- duplicate attachment and idempotent destruction;
- packed NodeNext/type consumers without accidental CodeMirror type leakage;
- browser bundle construction.

## Documentation and ADR

Add an ADR for the CodeMirror package boundary, exact-source authority, and
last-valid visual policy. Update architecture and package documentation to
describe only the implemented Phase 6 system.

## Explicitly deferred

Do not implement HTML formatting, extensible diagnostic-provider
infrastructure, source find/replace product UI, toolbar/tabs, preview, Markdown,
autosave, collaboration, or configurable source themes in this phase.

CodeMirror may provide ordinary built-in editor affordances, but they do not
constitute implementation of later SoEditor product features.

## Definition of Done

- users can perform Visual → Source → edit → Visual predictably;
- exact invalid/recoverable source is never silently rewritten;
- source diagnostics are visible and programmatically available;
- last-valid visual content cannot overwrite invalid source accidentally;
- Core remains DOM- and CodeMirror-free;
- public declarations expose no unintended CodeMirror types;
- Critical = 0 and High = 0;
- lint, typecheck, tests, build, packed consumers, and browser tests pass.
