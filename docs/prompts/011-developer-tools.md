# Phase 11 Implementation Specification — Developer Tools

## Status

Active implementation specification for Phase 11 of `docs/ROADMAP.md`.

## Goal

Make HTML authoring workflows materially better than a traditional WYSIWYG
source textarea while keeping analysis, UI, and source navigation behind narrow
package capabilities.

## Command discovery

Extend the Core command definition with optional human-readable palette metadata
and expose an immutable ordered command-ID snapshot. A label marks a no-argument
command as intentionally discoverable in the command palette. Do not expose the
mutable registry or make Core depend on UI.

## Source integration

Extend the HTML source service with SoEditor-owned capabilities to reveal a
source range and open CodeMirror's built-in Find/Replace panel. Keep CodeMirror
types private. Developer commands switch through `editor.source` before using
these capabilities.

## Generic UI panel

Add one generic docked-panel capability to `@soeditor/ui`. Panels accept the
existing safe `UiContent` forms, have accessible titles and close controls, and
are cleaned with the owning UI. This is generic UI infrastructure rather than
HTML-specific behavior.

## Developer-tools package

Create browser-facing `@soeditor/dev-tools` using only public APIs from Core,
HTML, HTML tools, Source, and UI. It provides:

- a command-driven Problems panel with severity/source locations;
- source navigation from a problem;
- selection-derived element path in the existing status bar;
- an HTML inspector for the selected visual element;
- a basic heading outline with source navigation;
- a searchable command palette using labeled Core commands;
- Find/Replace integration through the Source service.

HTML analysis must use the SoEditor tree and retain unknown/custom elements.
DOM selection inspection is read-only and must not mutate canonical state.

## UI and playground

Register developer toolbar contributions and `Mod+Shift+P` within the attached
editor UI. Integrate the HTML playground with Problems, Inspector, Outline,
Find/Replace, and Command Palette controls. Markdown developer tooling is not
introduced in this phase.

## Tests

Cover analysis, unknown elements, complete documents, command discovery,
Problems navigation, status path, inspector, outline, command filtering and
execution, Find/Replace, readonly behavior, cleanup, packed declarations, and
real Chromium interaction.

## Explicitly deferred

Defer split views, accessibility/SEO provider expansion, a DOM mutation
inspector, CSS inspection, Markdown diagnostics, outline drag/reorder,
workspace-wide search, and persistent panel layout. Split views are optional in
the roadmap and would destabilize current single-projection synchronization.

## Definition of Done

- the required Phase 11 developer workflows are available in the HTML route;
- source navigation and Find/Replace reuse the existing CodeMirror surface;
- developer UI actions do not bypass commands for editor behavior;
- Critical = 0 and High = 0;
- lint, typecheck, tests, build, packed consumers, and Chromium pass.
