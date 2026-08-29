# ADR 0014: Framework-agnostic UI registry and DOM host

- Status: Accepted
- Date: 2026-08-29

## Context

Phase 8 needs a configurable editor UI that existing and third-party features
can extend without coupling Core to the DOM or making an application framework
part of editor architecture. Toolbar buttons, menus, shortcuts, dialogs, and
future UI surfaces must reuse commands instead of mutating document state.

## Decision

`@soeditor/ui` is a browser-facing, framework-independent package. `UiPlugin`
owns a per-editor registry for named toolbar factories and keyboard shortcuts.
Registrations are scoped to an editor lifecycle, reject ambiguous duplicates,
and may be removed through idempotent disposers.

`createEditorUi` attaches a controlled DOM host using the registry and an
ordered toolbar configuration. It owns only the nodes and listeners it creates,
automatically follows Core state/command events, and is destroyed when its Core
editor is destroyed. Toolbar items and shortcuts invoke registered commands;
they do not receive mutable editor internals.

Reusable overlay capabilities accept plain text or caller-created DOM nodes.
The package ships opt-in scoped CSS using SoEditor custom properties and theme
attributes. Core does not depend on `@soeditor/ui`, DOM types, or its styling.

## Consequences

CMS integrations can configure normal UI by item ID, and plugins can contribute
items without rebuilding a distribution. Multiple editor instances retain
independent registries, DOM hosts, shortcuts, overlays, and theme state.

The initial UI is intentionally small and text-label based. Localization,
icons, framework adapters, advanced positioning, command palette, Problems
panel, and feature-specific contextual editing remain later work.
