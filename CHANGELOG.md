# Changelog

## 0.6.0 — Developer Workflow candidate

- Added bounded source-only accessibility and SEO diagnostic providers with
  per-rule severity/disable policy, isolated failures, immutable snapshots,
  filtered counts, and manual or debounced validation.
- Added persistent Visual, HTML Source, Markdown, and Preview coordination with
  exactly one compatible editing authority, readonly propagation, and safe
  invalid-source behavior.
- Added accessible, command-driven Visual | Source, Source | Preview, and
  Markdown | Preview layouts with keyboard/pointer resizing, responsive
  orientation, collapse/focus controls, and exact caller-host restoration.
- Extended the curated plugin SDK with diagnostics workflow and generic
  projection/layout contracts, and updated the immutable Developer preset
  without taking engine, DOM host, Preview-policy, or FileManager ownership.
- Added migration/configuration documentation, deterministic Playground routes,
  packed SDK adapter consumers, and a narrow production tree-shaking audit.
- Added `@soeditor/projections` and `@soeditor/layout`, aligning 17 MIT-licensed
  public packages at `0.6.0` for owner-reviewed publication.

This entry describes the verified release candidate. npm publication, the
`v0.6.0` tag, hosted release, and external registry/CDN verification remain
pending explicit owner authorization.

## 0.5.1 — Complete Developer Preview release set

- Advanced all 15 public packages together after the initial `0.5.0`
  publication stopped after 14 scoped packages and before the unscoped
  `soeditor` package.
- Kept the verified `0.5.0` artifacts immutable, adopted the owner-approved
  `@soeditor/editor` umbrella after npm rejected the unscoped name, and changed
  publication order to validate the umbrella before the other packages.
- Applied the selected npm distribution tag explicitly to both protected
  publication batches.
- Added bounded retry handling to the read-only npm availability preflight so
  transient registry throttling or server/network failures do not masquerade
  as release collisions.
- Wait for npm's abbreviated installation metadata to propagate before the
  post-publish clean consumer install, preventing a successful release from
  being reported as failed during registry index convergence.
- No product API or runtime behavior changed from the verified 0.5.0 release
  candidate.

## 0.5.0 — Developer Preview

First coherent SoEditor developer preview.

- Added instance-scoped Core lifecycle, immutable state, transactions,
  commands, plugins, services, and events.
- Added semantic HTML parsing/serialization and controlled visual editing with
  history, clipboard, rich-text commands, and unknown-content preservation.
- Added CodeMirror HTML Source and Markdown editing, diagnostics, explicit
  formatting, sandboxed Preview, developer tools, and framework-independent UI.
- Added generic FileManager integration, an injected SoFinder adapter, public
  plugin SDK, immutable presets, and the `soeditor` npm/browser distribution.
- Added clean NodeNext, native ESM, Vite, packed-package, and Chromium release
  gates.
- Added public npm metadata, publication dry runs, CI/manual release workflows,
  packed-manifest checks, and automated WCAG A/AA regression scanning before
  the initial registry publication.

See `docs/status.md` for Developer Preview limitations. There is no migration
from an earlier public SoEditor version.
