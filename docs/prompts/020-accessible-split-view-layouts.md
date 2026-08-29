# Phase 20 — Accessible Split-View Layouts

## Status

ACTIVE.

## Goal

Provide an application-attached, framework-independent split-view layout for
the supported projection pairs without moving canonical content, rendering,
Preview policy, or write authority into the layout layer.

## Architecture boundary

Add browser-facing `@soeditor/layout`. `SplitViewPlugin` owns per-editor layout
state, commands, validation, and a typed service. `createSplitViewLayout()` owns
only layout DOM, accessibility behavior, host placement, resizing, focus, and
responsive observation.

The package depends on the public `@soeditor/projections` contract. It must not
depend on Visual, Source, Markdown, Preview, CodeMirror, developer tools, or
private engine APIs. Applications create those engines and their security
configuration explicitly, then pass caller-owned host elements to the layout.

## Required implementation

1. Support exactly `visual-source`, `source-preview`, and `markdown-preview`.
   Reject pairs incompatible with the canonical document format or missing
   attached projection adapters before changing layout state.
2. Expose immutable split snapshots containing pair, requested orientation,
   effective orientation, bounded ratio, collapsed projection, and responsive
   fallback state. Retained services become terminal after destruction.
3. Represent open, close, orientation, bounded resize, collapse, restore, and
   focus actions as commands. Layout commands may invoke projection commands;
   they must never edit canonical source or mutate projection internals.
4. Keep both pair members mounted and visible while open. Transfer write
   authority only through `projection.activate`; Preview remains readonly.
5. Render named pane regions, visible labels, and one semantic separator. The
   separator exposes orientation and bounded `aria-valuenow/min/max`, supports
   Arrow keys, Home, and End, and has an accessible name.
6. Support horizontal and vertical layouts, pointer resizing, keyboard
   resizing, deliberate pane focus, collapse/restore, and a deterministic
   narrow-container vertical fallback without overwriting the requested
   orientation.
7. Require an empty layout root and explicit host mapping. Move only the
   caller-provided hosts into layout-owned pane wrappers; on teardown restore
   every host to its exact original parent/position and restore changed host
   attributes/classes.
8. Make attachment exclusive and cleanup idempotent. Isolate cleanup failures
   so remaining DOM/listener/observer/service cleanup still finishes and errors
   remain observable.
9. Demonstrate all three pairs in opt-in Playground routes and cover rapid
   pair/orientation/collapse changes, readonly, invalid HTML, responsive
   fallback, keyboard/pointer resize, focus transfer, accessibility, and
   repeated lifecycle behavior in real Chromium.

## Explicitly deferred

- arbitrary docking, tabs, floating panes, or more than two projections;
- persisted workspaces or storage policy;
- simultaneous writers, shared selections, or cursor mirroring;
- implicit engine construction or Preview security defaults;
- React, Vue, Svelte, or other framework adapters.

## Definition of Done

- all three pairs synchronize through canonical source and keep at most one
  writable projection;
- layout controls pass keyboard and automated WCAG A/AA regression coverage;
- legacy and projection-only consumers remain compatible;
- cleanup restores caller-owned hosts exactly;
- ADR 0023 and architecture documentation match implementation;
- Critical = 0, High = 0, and all repository verification passes.
