# Phase 14 Implementation Specification — Distribution and Integration Hardening

## Status

Completed implementation record for Phase 14 of `docs/ROADMAP.md`.

## Goal

Make the Phase 13 public APIs consumable from a clean npm/Vite/NodeNext project
and from a direct browser script without repository-internal imports.

## Umbrella package

Add publishable package `soeditor`. Export `Editor` as `SoEditor` for the
document/lifecycle API described by the roadmap, plus deliberately public
package-root capabilities needed to assemble surfaces. The umbrella is a
convenience distribution; original `@soeditor/*` packages remain authoritative
and independently consumable.

Ship ESM, declarations, declaration maps, JavaScript source maps, and
`soeditor/styles.css`. Internal SoEditor packages remain external in the ESM
build so normal bundlers can tree-shake them.

## Browser/CDN distribution

Ship `dist/soeditor.global.js`, its source map, and `dist/soeditor.css`. The
script creates one `globalThis.SoEditor` namespace with an explicit `create`
function, public constructors/factories, and presets. It must not auto-create an
editor, register global mutable plugins, execute preserved content, or become
the architectural source of truth.

## Fine-grained presets

Add `@soeditor/presets/minimal`, `/classic`, `/developer`, and `/markdown`
exports backed by separate build entries. Importing a narrow preset must not
load unrelated preset modules. Keep the aggregate root for convenience.

## Verification

Extend the packed-package test to install every tarball and consume `soeditor`
from strict NodeNext and Node ESM. Add a clean Vite fixture that imports the
umbrella ESM and CSS. Smoke-test the built global script in real Chromium and
verify its namespace, source map, CSS, and basic editor lifecycle.

Audit every publishable manifest for explicit exports, ESM type, side-effect
metadata, included files, declarations, and maps. Document npm, modular, Vite,
and CDN usage.

## Explicitly deferred

Do not add React/Vue wrappers, CommonJS, automatic global plugin registration,
remote plugin loading, SSR DOM emulation, a hosted CDN, or publication tokens.

## Definition of Done

- `import { SoEditor } from 'soeditor'` works in a clean typed consumer.
- A clean Vite production build consumes ESM and CSS.
- A direct browser script exposes and runs the documented global facade.
- Critical = 0 and High = 0.
- lint, typecheck, tests, build, packed consumers, and Chromium pass.
