# ADR 0017: Discoverable commands and UI-independent developer analysis

- Status: Accepted
- Date: 2026-08-29

## Context

Phase 11 needs a command palette, HTML analysis views, and navigation without
giving UI code access to mutable command internals or coupling Core to browser
DOM APIs. Developer panels also need a reusable host that does not make the
generic UI package depend on HTML.

## Decision

Core commands may provide an optional human-readable label. A label is an
explicit promise that the command is safe to offer as a no-argument palette
action. The public command collection exposes an immutable, insertion-ordered
snapshot of IDs; callers still query and execute through the existing command
capability.

`@soeditor/ui` provides a generic single docked-panel service using its existing
safe content boundary. It knows nothing about HTML diagnostics or inspector
models.

`@soeditor/dev-tools` owns HTML-specific read-only analysis and presentation.
It parses canonical source through `@soeditor/html`, consumes published Problem
and Source services, and registers normal commands and UI contributions. The
HTML Source service gains narrow range-reveal and Find/Replace capabilities;
CodeMirror types stay private.

## Consequences

Third-party plugins can make suitable commands discoverable without depending
on the command-palette implementation. Unlabeled or argument-requiring commands
remain callable but are omitted from the palette.

Developer data remains usable independently of its UI, while the supplied UI
projects it into accessible panels and dialogs. Selection inspection reads the
controlled visual DOM but never treats it as canonical state.

Split views and persistent multi-panel layout are deferred because they require
a separate synchronization and layout design.
