# Migrating from 0.6 to 0.7

## Status

This is a working migration record for the active 0.7 roadmap. It is not a
claim that 0.7 has been released. The current repository version remains the
verified `0.6.0` candidate until Phase 26 aligns and verifies 0.7 artifacts.

## Phase 23 additive APIs

The first 0.7 foundation adds public structured editing contracts from
`@soeditor/engine` and the curated `@soeditor/plugin-sdk` facade:

- `StructuredEditingPlugin` and `structuredEditingRegistryToken`;
- `StructuredBlockConversion`, `StructuredBlockBehavior`, and
  `EditingStructuredBlock`;
- public immutable editing model/point/selection types;
- `EditingOperation`, `EditingPointAffinity`, `mapEditingPoint()`, and
  `readEditingOperations()` for visual transaction observers.

Existing 0.6 applications do not need to register a schema. The established
paragraph/list/mark/link behavior and opaque preservation fallback remain.
Rich-text plugins now require the structured registry infrastructure
transitively, so presets and normal plugin dependency resolution load it
without application changes.

Custom element plugins should register during `init()` and invoke the returned
disposer during `destroy()`. Registrations after the first Visual engine
attaches are rejected because that engine uses one deterministic sealed schema
snapshot. Phase 23 structured blocks are atomic or readonly and inert; migrate
custom DOM rendering only after the Phase 24 node-view API is available.

Do not convert previously unknown HTML merely to make it visible. Register only
shapes the plugin can serialize semantically, use unique namespaced IDs/types,
and keep conversion callbacks free of DOM access and execution behavior.
