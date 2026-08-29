# Migrating from 0.6 to 0.7

## Status

This guide covers the verified local `0.7.0` release candidate. It is not a
claim that 0.7 has been published; the public stable reference remains 0.5.1
until owner-authorized publication and external registry/CDN verification.

## Phase 23–24 additive APIs

The first 0.7 foundation adds public structured editing contracts from
`@soeditor/engine` and the curated `@soeditor/plugin-sdk` facade:

- `StructuredEditingPlugin` and `structuredEditingRegistryToken`;
- `StructuredBlockConversion`, `StructuredBlockBehavior`, and
  `EditingStructuredBlock`;
- `StructuredNodeViewFactory`, its context/state/instance contracts, and
  `StructuredEditingRegistry.registerNodeView()`;
- public immutable editing model/point/selection types;
- `EditingOperation`, `EditingPointAffinity`, `mapEditingPoint()`, and
  `readEditingOperations()` for visual transaction observers.

Existing 0.6 applications do not need to register a schema. The established
paragraph/list/mark/link behavior and opaque preservation fallback remain.
Rich-text plugins now require the structured registry infrastructure
transitively, so presets and normal plugin dependency resolution load it
without application changes.

Custom element plugins should register their conversion before an optional node
view during `init()` and invoke returned disposers in reverse order during
`destroy()`. Registrations after the first Visual engine
attaches are rejected because that engine uses one deterministic sealed schema
snapshot. Node views receive immutable state and narrow selection/command
actions. Migrate DOM rendering into the factory, and migrate data changes into
commands backed by `VisualEditingService.setStructuredBlockAttributes()`.

Do not convert previously unknown HTML merely to make it visible. Register only
shapes the plugin can serialize semantically, use unique namespaced IDs/types,
and keep conversion callbacks free of DOM access and execution behavior.
Do not render preserved children as executable DOM merely because a node view
exists; view DOM is presentation, while canonical HTML stays authoritative.

## Phase 25 structured tables and media

`TablePlugin` now recognizes supported table-shaped HTML as a structured block
and provides bounded commands for rows, columns, headers, merge/split,
rectangular selection, keyboard control, and semantic clipboard operations.
Tables are limited to 100 rows, 100 columns, and 1000 logical cells. Tables
with unsupported grammar remain preserved and inert; column-changing commands
reject `colgroup` metadata rather than silently normalizing it.

`MediaPlugin` recognizes a figure containing one direct image and an optional
caption. It preserves unrelated attributes and unsafe source while its node
view constructs only controlled, non-executable DOM. The Developer toolbar
adds media insertion/browse actions, and `FileManagerPlugin` now depends on
`MediaPlugin` so `media.browse` can delegate validated selections to the media
command. Custom plugin sets that instantiate `FileManagerPlugin` must allow
normal dependency resolution or include the required rich-text feature.

The internal selected-cell marker changed from `aria-selected` to
`aria-pressed`, and toolbar boundary markers use `aria-current`. Applications
must not style undocumented internal selectors or ARIA attributes; use the
documented classes and theme variables.

## Public API changes

The following additions are experimental public structured-extension APIs
available from `@soeditor/engine` and the curated SDK:

- `VisualEditingService.getSelectedStructuredBlock()`;
- `VisualEditingService.replaceStructuredBlockContent()` and
  `EditingStructuredBlockContent`;
- the `replace-structured-content` editing operation;
- `StructuredNodeViewActions.select({ focus })`;
- `visualEditingServiceToken`, `VisualEditingService`, `VisualBlockTag`,
  `VisualLinkAttributes`, and `VisualTextMark` from `@soeditor/plugin-sdk`.

These changes are additive for normal applications. A structural mock that
implements the complete `VisualEditingService` interface must implement the
two new methods. Prefer resolving the real typed service token rather than
maintaining a broad mock. Operation observers must handle the new operation
kind or preserve an exhaustive default branch.

See `public-api.md` for application-public, extension-author public,
experimental, and internal classifications. Import declared package roots
only; `src`, private `dist` paths, concrete registries, and projection
internals are not compatibility surfaces.

## Upgrade checklist

1. Align every installed `@soeditor/*` dependency and peer dependency at a
   compatible `0.7.x` version; do not mix 0.6 and 0.7 packages.
2. Update complete visual-service mocks and exhaustive editing-operation
   switches.
3. If a custom element should become visually structured, register its
   conversion and optional node view during plugin `init()` and dispose both
   during `destroy()`.
4. Route node-view edits through commands and
   `replaceStructuredBlockContent()`; never treat node-view DOM as data.
5. Re-test readonly, history, clipboard, source preservation, accessibility,
   and teardown in the host application.
