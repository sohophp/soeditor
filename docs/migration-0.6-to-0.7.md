# Migrating from 0.6 to 0.7

## Status

This is a working migration record for the active 0.7 roadmap. It is not a
claim that 0.7 has been released. The current repository version remains the
verified `0.6.0` candidate until Phase 26 aligns and verifies 0.7 artifacts.

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
