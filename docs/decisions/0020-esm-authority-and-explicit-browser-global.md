# ADR 0020: ESM authority and explicit browser global distribution

- Status: Accepted; npm package identity amended by ADR 0021
- Date: 2026-08-29

## Context

Phase 14 requires straightforward `soeditor` npm usage and a CDN/browser build.
Core and feature packages are already ESM-first and instance-scoped. A browser
build must not introduce a second plugin system or global mutable editor state.

## Decision

Publish a thin `soeditor` umbrella whose ESM entry re-exports intentionally
public package-root APIs and aliases `Editor` as `SoEditor`. The modular
`@soeditor/*` packages remain the source of truth and are externalized from this
ESM build.

Also publish a self-contained IIFE. It assigns an explicit immutable API
namespace to `globalThis.SoEditor`; `SoEditor.create(options)` delegates to the
same Core `Editor.create()` lifecycle. Browser users explicitly attach UI and
editing surfaces. The global facade has no plugin registry and performs no
automatic initialization.

CSS is an explicit export and standalone CDN asset. All JavaScript and
declaration outputs include source maps. Presets gain narrow subpath entries so
consumers can avoid evaluating unrelated preset families.

## Consequences

Npm and modern bundlers retain ESM/tree-shaking behavior, while script-tag users
receive a practical self-contained namespace. The global bundle is necessarily
larger because it contains optional source, Markdown, formatting, and developer
capabilities; applications concerned with size should use modular ESM imports.

The browser global is a distribution projection, not an architectural registry.
Third-party globals and automatic plugin registration remain unsupported.
