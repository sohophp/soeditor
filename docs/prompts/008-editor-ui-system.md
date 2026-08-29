# Phase 8 Implementation Specification — Editor UI System

## Status

Active implementation specification for Phase 8 of `docs/ROADMAP.md`.

This document is subordinate to repository policy, accepted ADRs, product,
architecture, roadmap, and the Phase 1–7 implementation.

## Goal

Provide a reusable, configurable, framework-agnostic DOM UI foundation that
invokes editor behavior exclusively through commands and typed capabilities.

## Package boundary

Create `@soeditor/ui`. It may depend on browser DOM APIs and public
`@soeditor/core` APIs, but Core must remain DOM- and framework-independent. The
package must not introduce React, Vue, Svelte, Angular, or a component runtime.

## Per-editor UI registry

`UiPlugin` owns a per-editor registry exposed through a typed Core service.
Third-party plugins may register:

- named toolbar-item factories;
- named keyboard shortcuts targeting commands.

Duplicate IDs and duplicate shortcut chords must fail descriptively. Retained
registry references become terminal when the editor is destroyed. Registration
disposers are idempotent.

## UI host

`createEditorUi` attaches one controlled UI instance to a supplied host. It
must support:

- ordered toolbar configuration using item IDs and `|` separators;
- command buttons with disabled and active state;
- dropdown/menu items for headings;
- modal dialogs used by link, image, and table actions;
- a generic anchored balloon capability;
- accessible transient notifications;
- an accessible status region reflecting mode and dirty state;
- keyboard shortcut dispatch scoped to the UI host;
- explicit light, dark, and automatic theme modes;
- idempotent cleanup and automatic cleanup on editor destruction.

The default toolbar should make the existing Phase 4–7 commands normally
usable. Missing configured items must fail at attachment time rather than being
silently omitted.

## Security and accessibility

UI text is assigned as text, never interpreted as HTML. Dialog, balloon, and
notification content accepts text or caller-owned DOM nodes, not arbitrary HTML
strings. Buttons need accessible labels and state. Menus and dialogs must be
keyboard operable through native controls and Escape behavior.

## Styling

Ship explicit CSS as a separate package export. Use `--soeditor-*` custom
properties, honor `prefers-color-scheme` in automatic mode, and permit host
overrides. Styling must remain scoped to SoEditor UI classes.

## Tests

Cover normal, boundary, failure, and adversarial behavior:

- registry duplicate detection, disposal, and terminal lifecycle;
- toolbar ordering, groups, command invocation, disabled and active state;
- heading menu and link/image/table dialogs;
- host-scoped keyboard shortcuts and duplicate chord rejection;
- notification/status/balloon behavior and text-only rendering;
- light/dark/automatic theme state;
- idempotent UI destruction and editor-owned destruction;
- packed NodeNext/ESM consumption and clean public declarations;
- real Chromium interaction for buttons, menus, dialogs, shortcuts, and cleanup.

## Documentation and ADR

Add an ADR for the per-editor UI registry and DOM host boundary. Update the
architecture and README for implemented behavior.

## Explicitly deferred

Do not build preview, Markdown, command palette, Problems panel, file-manager
integration, advanced contextual link/image editing, table selection UI,
application-framework adapters, icons, localization infrastructure, or a full
design system.

## Definition of Done

- a CMS can configure a functional toolbar without rebuilding the package;
- UI actions and shortcuts invoke shared commands;
- Core remains DOM- and framework-independent;
- public UI extension points are typed and lifecycle-safe;
- Critical = 0 and High = 0;
- lint, typecheck, tests, build, packed consumers, and browser tests pass.
