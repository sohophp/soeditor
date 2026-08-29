# Phase 21 — 0.6 SDK, Presets, Documentation, and Distribution

## Status

ACTIVE.

## Goal

Curate the intentional SoEditor 0.6 extension and application surface, update
static presets without taking ownership away from applications, and prove that
diagnostics and split-view workflows work through packed public packages and
tree-shakeable ESM.

## Sources of truth

- `AGENTS.md`
- `docs/PRODUCT.md`
- `docs/architecture.md`
- `docs/ROADMAP.md`
- `docs/DEVELOPMENT-POLICY.md`
- accepted ADRs, especially 0019, 0020, 0021, 0022, and 0023
- completed Phase 17–20 prompts and the current implementation

## Required implementation

1. Audit the Phase 17–20 package roots and classify each new API as public,
   extension-author public, experimental, or internal. Keep implementation
   registries and third-party parser/editor types out of public facades.
2. Extend `@soeditor/plugin-sdk` only with generic diagnostics workflow and
   projection/layout contracts that third-party plugins or alternate layout
   adapters need. Feature-specific accessibility/SEO implementations and DOM
   factories remain owned by `@soeditor/html-tools` and `@soeditor/layout`.
3. Update the Developer preset to opt into the bounded accessibility and SEO
   providers and projection/split infrastructure. Presets remain frozen
   format/plugin/toolbar data: they must not construct engines, choose DOM
   hosts, attach layouts, register global state, provide FileManager instances,
   or choose Preview security policy.
4. Preserve aggregate and narrow preset imports. Verify preset dependency IDs,
   immutability, duplicate rejection, and that unrelated preset families are
   excluded from narrow production bundles.
5. Add opt-in Playground routes or controls that demonstrate manual validation,
   debounced automatic validation, rule severity/disable configuration, and all
   three supported split pairs. Keep demonstrations deterministic and suitable
   for browser regression tests.
6. Document the 0.5-to-0.6 migration, API ownership/classification, diagnostics
   rule scope and limitations, manual/debounced validation, split host
   ownership, keyboard accessibility, Preview isolation, invalid-source and
   readonly behavior, exact teardown order, modular npm imports, umbrella ESM,
   browser global, stylesheet, and CDN usage.
7. Keep `@soeditor/editor`, the browser global, standalone CSS, declarations,
   declaration maps, JavaScript source maps, explicit exports, license metadata,
   and release counts synchronized with every public package.
8. Exercise packed package roots from strict NodeNext and native Node ESM
   consumers, including SDK-authored diagnostics and layout adapters. Exercise
   a clean Vite production consumer and add focused bundle assertions proving
   that narrow Core/SDK/preset imports do not accidentally include CodeMirror,
   Markdown, Preview, or layout DOM families when unused.
9. Measure the CDN global, standalone CSS, umbrella facade, Playground, and
   focused consumer bundles. Tighten or deliberately update guards with written
   justification; do not hide regressions by broadly increasing budgets.
10. Run the full repository release gate and a read-only adversarial review.
    Fix every Critical and High finding before completing the phase.

## Public API policy

- Owning package roots are authoritative for application APIs.
- `@soeditor/plugin-sdk` is a curated extension facade, not a second runtime or
  an aggregate export of every feature.
- Generic provider, service, snapshot, adapter, pair, orientation, and
  attachment contracts may be SDK-public when third-party implementations need
  them.
- Built-in quality rule codes/configuration remain public from
  `@soeditor/html-tools`; built-in DOM layout construction remains public from
  `@soeditor/layout`.
- No wildcard exports or undocumented `src`/private `dist` subpaths are added.

## Explicitly deferred

- version alignment, changelog finalization, protected publication, tags, and
  external CDN verification (Phase 22);
- framework adapters, automatic mounting, global registries, or implicit DOM
  discovery;
- plugin scaffolding CLI or marketplace infrastructure;
- persisted workspaces, arbitrary docking, or simultaneous writers;
- new diagnostic rule families or claims of WCAG/SEO compliance.

## Definition of Done

- the SDK exposes only documented extension-author contracts and clean packed
  consumers compile and run against them;
- Developer preset quality/split capabilities are present without implicit
  engine, host, layout, FileManager, or Preview-policy ownership;
- manual/debounced diagnostics and all split pairs are demonstrable and covered
  in Chromium;
- migration, configuration, distribution, plugin, architecture, status, and
  package documentation agree with the implementation;
- narrow bundle tests demonstrate that unused heavy feature families remain
  removable while release budgets still pass;
- lint, strict typecheck, unit, packed-consumer, distribution, release,
  Chromium, build, license, and security gates pass;
- adversarial review reports Critical = 0 and High = 0.
