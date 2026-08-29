# Phase 24 — Node Views and Widget Runtime

## Status

COMPLETE.

## Goal

Let feature plugins present and interact with registered structured blocks while
keeping canonical HTML, selection changes, and document mutation under the
controlled engine and Core transaction boundaries.

## Sources of truth

- `AGENTS.md`
- `docs/PRODUCT.md`
- `docs/architecture.md`
- `docs/ROADMAP.md`
- `docs/DEVELOPMENT-POLICY.md`
- accepted ADRs, especially 0009–0011, 0019, and 0024
- the completed Phase 23 schema, operation, and position-mapping contracts

## Required implementation

1. Add a host-scoped, framework-neutral node-view factory contribution keyed
   by a registered structured node type. Keep conversion callbacks DOM-free;
   only the separately declared view factory receives the host `Document`.
2. Mount plugin DOM inside an engine-owned inert boundary. Validate returned
   elements, expose immutable node snapshots and narrow actions, update
   readonly/selection state, and guarantee destroy exactly once across rerender,
   explicit engine destruction, editor destruction, and partial failures.
3. Extend the existing point/selection model to represent one whole atomic
   structured block without replacing the public 0.6 text selection shape.
   Support pointer/focus selection, visual state, Arrow entry/exit, Backspace,
   Delete, copy, cut, paste replacement, and history restoration.
4. Add controlled structured-block attribute replacement as a granular
   operation and narrow visual service action. Reference UI must invoke a
   command that uses this service; node-view DOM must not mutate canonical
   source or model values directly.
5. Define bounded internal drag/drop rules for one selected structured block,
   including semantic HTML clipboard data, valid drop positions, readonly
   behavior, same-editor move history, and external HTML insertion through the
   existing parser/schema path.
6. Upgrade the Playground CMS product card into an external-style accessible
   reference widget that preserves meaningful attributes/children and remains
   inert when its node-view plugin is absent.
7. Prove security, focus, keyboard, selection, history, clipboard, drag/drop,
   source synchronization, invalid-source locking, per-editor isolation,
   lifecycle cleanup, packed consumer types, and bounded repeated rendering.

## Architectural constraints

- Canonical `EditorDocument.source` and Core transactions remain authoritative.
- A node view receives no mutable model, private engine, or raw source-writing
  capability.
- Unknown/opaque HTML never invokes a node-view factory. Executable-looking
  children are not injected by the fallback projection.
- Node-view DOM is host-scoped and framework-neutral. No React/Vue dependency
  enters the editor.
- Nested editable regions are not required unless deterministic selection,
  history, clipboard, and teardown can be demonstrated in this phase.
- Exact Source replacements remain ambiguous source changes rather than
  invented granular operations.

## Explicitly deferred

- framework-specific node-view runtimes, arbitrary nested editors, remote
  component execution, and simultaneous writers;
- production table/media behavior, comments, collaboration, and general
  drag/drop between editor instances;
- arbitrary inline node views unless required by a demonstrated current
  feature.

## Definition of Done

- an external-style plugin implements an accessible custom widget without
  private imports or direct canonical-source mutation;
- atomic selection, deletion, clipboard, same-editor drag/drop, readonly,
  history, source synchronization, and teardown pass real Chromium tests;
- unknown/unsafe source remains preserved and inert;
- lint, typecheck, tests, packed consumers, distribution/release audits, build,
  license/security checks, and adversarial review pass with Critical = 0 and
  High = 0.
