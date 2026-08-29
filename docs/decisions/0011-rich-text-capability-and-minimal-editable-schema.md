# ADR 0011: Rich-text capability and minimal editable schema

- Status: Accepted
- Date: 2026-08-29

## Context

Phase 5 needs independently installable rich-text features to operate on the
controlled visual model. Giving plugins the model, DOM projection, or engine
instance would expose mutable internals and tightly couple feature packages to
one editing implementation. Treating every semantic element as editable would
also risk destructive normalization of HTML outside the demonstrated subset.

## Decision

`@soeditor/engine` registers one editor-owned `VisualEditingService` under a
typed Core service token while a visual engine is attached. The service exposes
only generic, transaction-backed actions and state queries for text marks,
blocks, lists, links, and semantic HTML insertion. It exposes no DOM node or
editing-model value. Independent engine destruction unregisters the service;
terminal Editor destruction retains ownership of final registry cleanup.

`@soeditor/rich-text` contains the Phase 5 feature plugins. Each feature
registers a command and invokes the visual service. The package neither mutates
source/DOM directly nor imports engine internals. Image and table commands build
SoEditor HTML tree values and serialize them through `@soeditor/html` before
using the controlled insertion boundary.

The editable schema expands only to the required subset:

```text
blocks: p, h1-h6, blockquote, pre
marks: strong, em, u, s, code, a
lists: attribute-free ol/ul with attribute-free li text content
```

Links retain source attributes in the model but render as anchors without URL
attributes in the editing projection. Images and tables remain inert opaque
widgets in Phase 5. Lists or elements outside the supported shape remain opaque
and source-preserved.

## Consequences

Feature plugins can share selection, history, and serialization behavior
without depending on private implementation details. Commands remain reusable
by future toolbar, menu, shortcut, and command-palette UIs. The engine service
is deliberately visual-surface-specific, so commands are unavailable until a
compatible surface attaches.

The minimal schema does not provide pending marks at a collapsed caret,
advanced links/images/tables, nested list editing, arbitrary block schemas, or
widget selection. Expanding it requires preservation and transaction evidence,
not merely adding more DOM tags to the allowlist.
