# Changelog

## 1.2.0 — Optional CMS video and editing stability

- Add the explicit `@soeditor/editor/video` plugin for native video and YouTube, with lazy properties, asset picking, subtitle options and one-step undo.
- Suggest title, cover and link-based aspect ratio without overwriting manual values. Explain that the ratio is a suggestion, not a measurement of original video dimensions.
- Load whole-article preview players on viewport entry and retain unchanged players and scroll through text edits and template changes; keep authored scripts and unknown embeds inert.
- Share loading, retry and original-video controls between preview surfaces. Group native playback and subtitle settings under More settings.
- Add typed optional `@soeditor/preview/media` services and atomic WYSIWYG projection hooks.
- Keep ordinary toolbar tools as icons and support configured drawers; synchronously capture selection before keyboard focus enters toolbar chrome.
- Fix table/image paragraph insertion handles and preserve existing HTML, selection and instance isolation.
- Preserve default CMS loading budgets and lazy Source, video properties and dialog enhancements.
- Align all 24 public packages at 1.2.0; no stable API removals or new runtime dependencies.

## 1.1.0 — CMS WYSIWYG + Source

- Add the lightweight CMS Classic Editor with textarea binding, canonical HTML preservation, inert unknown/unsafe content, form submit/reset, dirty state and safe teardown.
- Load optional HTML Source on first use, keep formatting and recovery behind separate demand boundaries, and support bounded horizontal/vertical WYSIWYG + Source views.
- Improve table selection and resizing, nested lists, block formatting, links, image properties/alignment/resizing, keyboard controls, localized menus and upload/asset integration.
- Prevent queued color-menu initialization from overwriting a color entered immediately after opening the menu.
- Restore Show Blocks in the Classic demo and isolate the read-only element path from document statistics; Source no longer reports CodeMirror DOM as a body path.
- Count semantic body text across block boundaries, exclude source indentation and static hidden content, and define deterministic Chinese/Japanese character and other word units.
- Add `@soeditor/editor/content.css` for frontend rendering of saved image alignment, sharing the editing rules without editor JavaScript.
- Reduce repeated serialization work, defer coalesced statistics, and prevent accumulated Source parsing cost during external history updates. Add reproducible article, image-list and table baselines.
- Align all 24 public MIT-licensed packages at 1.1.0. Retain historical compatibility capabilities behind explicit entries and document migration from 1.0.

Owner-authorized for publication on 2026-09-08. Publication and registry/CDN verification are recorded in the GitHub release and publishing workflow; local builds alone do not prove publication.

Automated evidence: 406 unit tests, 145 Chromium product tests, 16 CMS desktop/touch tests, 148 Firefox/WebKit checks (4 existing Chromium-only skips), and 27 Source checks. Real-device Safari, OS IME, Office clipboard, assistive-technology and customer-material qualification remain unverified. See [current acceptance](cms-followup-2026-09-08.zh-CN.md).

## 1.0.0 — Stable release

- Froze and classified every declared public package entry with generated
  symbol/signature and declaration-tree compatibility evidence.
- Documented the 1.x compatibility, deprecation, runtime, security,
  maintenance, migration, troubleshooting, deployment, and operations
  contracts.
- Added Source/Markdown CSP nonce forwarding, dark-theme and forced-colors
  fixes, explicit-GC retention and accessibility qualification gates.
- Aligned all 23 MIT-licensed public packages, framework adapters, plugin
  tooling, packed consumers, ESM/global artifacts, and release checks at 1.0.0.
- Advanced the plugin scaffold to template version 2 with 1.x SDK peer and
  development ranges; the checker now rejects pre-1.0 SDK ranges.

All 23 packages were published from commit
`f6196545a0054fda3f63a10ead5b21e86ec90339`. Public npm installation and
jsDelivr/Chromium lifecycle verification passed after registry propagation.

## 0.9.0 — Integration candidate

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
- Promoted `@soeditor/workspace`, `@soeditor/react`, `@soeditor/vue`, and
  `@soeditor/plugin-tools`; added Workspace to the framework-neutral umbrella
  while keeping framework and Node-only dependencies in their owning packages.
- Added 0.8-to-0.9 migration guidance, packed consumers for all 23 public
  packages, framework/CMS/SSR verification, and measured integration budgets.
- Added a generated symbol/declaration API report and explicit candidate 1.x
  compatibility, deprecation, runtime, security, and maintenance policies.
  This entry describes a verified local release candidate. npm publication, the
  `v0.9.0` tag, hosted release, and registry/CDN verification remain pending
  explicit owner authorization.

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
