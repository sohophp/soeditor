# Phase 23 — Extensible Structured Editing Foundation

## Status

COMPLETE.

## Goal

Replace the closed 0.6 visual-editing schema with a bounded, per-editor plugin
contribution boundary while retaining canonical HTML source, controlled DOM
projection, and inert preservation of unsupported content.

## Sources of truth

- `AGENTS.md`
- `docs/PRODUCT.md`
- `docs/architecture.md`
- `docs/ROADMAP.md`
- `docs/DEVELOPMENT-POLICY.md`
- accepted ADRs, especially 0009–0011 and 0019
- the Phase 22 verified candidate and its tests

## Required implementation

1. Publish immutable SoEditor-owned structured block, attribute, point, and
   selection types needed by the existing editor and one external-style custom
   element proof.
2. Add an editor-owned structured-editing registry. Contributions have stable
   IDs and node types, explicit source match/parse/serialize functions, and
   atomic or readonly behavior. Reject duplicate IDs/types, conflicting source
   matches, malformed conversion results, and registration after schema use.
3. Keep existing paragraph, list, mark, and link support compatible. A custom
   structured block must round-trip semantically and project as inert until the
   separately planned node-view runtime exists. Unknown content must remain
   distinguishable as opaque-preserved content.
4. Route load, external source replacement, insertion, clipboard, history, and
   serialization through the same sealed schema snapshot.
5. Add granular, immutable change descriptions and deterministic position
   mapping for the current text, split/join, block-format, list, link, and
   insertion operations. Do not replace Core's canonical source transaction or
   snapshot history authority in this phase.
6. Prove per-editor isolation, lifecycle cleanup, deterministic conflicts,
   semantic round trips, malformed source locking, history behavior, and public
   packed-consumer type access.
7. Record the architecture decision and synchronize architecture, SDK, and
   migration documentation with the implemented boundary.

## Architectural constraints

- `@soeditor/core` remains DOM-free and does not own the structured visual
  model.
- Canonical `EditorDocument.source` remains authoritative across projections.
- Contribution callbacks transform SoEditor-owned HTML/tree values only; they
  receive no DOM or mutable engine internals.
- Unsupported and unsafe-looking source remains preserved but is never granted
  execution permission.
- Public node-view DOM factories and nested editable widgets are Phase 24.
- No new runtime dependency is required.

## Explicitly deferred

- node-view factories, widget interaction, drag/drop, and nested editables;
- production tables/media, comments, collaboration, framework adapters, and
  source-preserving incremental serialization;
- a universal HTML schema or speculative operation algebra.

## Definition of Done

- a third-party plugin can register and round-trip a custom structured element
  using only public SoEditor types;
- existing supported content remains editable and unknown content remains
  preserved/inert;
- operation mappings cover the changes emitted by the migrated feature set;
- lifecycle, malformed-input, history, clipboard, and browser behavior pass;
- lint, typecheck, tests, packed consumers, distribution audit, build, and
  adversarial review pass with Critical = 0 and High = 0.
