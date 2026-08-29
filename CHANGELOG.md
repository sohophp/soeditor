# Changelog

## Unreleased

- Added a private framework-neutral workspace controller with explicit ordered
  attachment factories, reverse teardown, controlled/uncontrolled value
  policies, observable lifecycle snapshots, and opt-in bounded recovery from
  the last known canonical source.
- Added focused unit and Chromium coverage plus an executable Workspace demo;
  public 0.9 exports remain deferred.
- Added private React and Vue lifecycle adapters with controlled values,
  readonly updates, SSR-safe rendering, React StrictMode/Error Boundary
  behavior, Vue Composition API lifecycle, and an executable comparison demo.
- Added private offline plugin scaffolding and static package checks targeting
  the 0.9 SDK, including script-free packed-artifact inspection and a generated
  plugin's clean NodeNext consumer workflow.
- Added immutable Workspace attachment requirements and bounded per-instance
  diagnostics for incompatible formats, missing services, unsafe Preview
  policy, failed recreation, and crash-limit termination.

## 0.8.0 — Review Workflow candidate

- Added bounded, non-canonical visual decorations and the public
  `@soeditor/comments` package with immutable mapped ranges, host-owned atomic
  storage, permission boundaries, command-driven review UI, and safe unlinking
  when a document change cannot be mapped precisely.
- Added unit and Chromium coverage for text and structured-block comments,
  source/history behavior, clipboard isolation, readonly review permissions,
  accessibility, adapter failures, serialized writes, and teardown.
- Added public host-owned revision history with bounded HTML/Markdown
  comparison, explicit transaction restore, dynamic edit/comments-only/
  readonly policy across editing projections, and deterministic comment
  behavior across viewing and restoration.
- Added immutable, versioned review-data exports; distinguished reversible
  comment tombstones from permission-checked permanent erasure; and added
  optional host-confirmed revision erasure.
- Added curated SDK and umbrella exports, a packed NodeNext/native ESM storage
  adapter consumer, 0.7-to-0.8 migration and privacy guidance, and aligned all
  19 MIT-licensed public packages at `0.8.0`.

This entry describes a verified local release candidate. npm publication, the
`v0.8.0` tag, hosted release, and registry/CDN verification remain pending
explicit owner authorization.

## 0.7.0 — Structured Extensions candidate

- Added deterministic structured block conversions, immutable editing models
  and operations, command-backed node views, and curated extension contracts.
- Added bounded production tables with row/column/header/merge/split,
  rectangular selection, keyboard, history, and semantic clipboard behavior.
- Added safe figure/media widgets with captions, alt text, dimensions, and a
  replaceable FileManager browse path while preserving inert unknown or unsafe
  source.
- Added a packed third-party product-card consumer proving that plugins can
  register, render, read, and replace structured content using package roots
  and the public SDK only.
- Aligned all 17 MIT-licensed public packages at `0.7.0` and hardened release,
  registry, accessibility, teardown, bundle, and migration gates.

This entry describes a verified local release candidate. npm publication, the
`v0.7.0` tag, hosted release, and registry/CDN verification remain pending
explicit owner authorization.

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
