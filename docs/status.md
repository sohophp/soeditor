# SoEditor development status

## Current development

The approved SoEditor 0.6 Developer Workflow roadmap is complete through Phase 22. Visual, HTML Source, Markdown, and Preview can remain synchronized under
one write authority and appear in accessible Visual | Source, Source | Preview,
or Markdown | Preview layouts. The Developer preset now selects bounded
accessibility/SEO diagnostics and projection/split infrastructure without
owning engines or DOM. That candidate was not published.

The evidence-derived 0.7–1.0 roadmap is now approved. Phase 25 — Production
Tables and Media — is complete. Bounded structured tables now provide
transaction-backed row, column, header, merge/split, rectangular selection,
keyboard, and semantic clipboard behavior. Safe figure/media widgets add
captions, alt text, dimensions, and generic FileManager insertion while
unsupported or executable source remains preserved and inert. Public and SDK
packed consumers plus 109 Chromium scenarios pass; the final Phase 25
adversarial review found Critical 0 and High 0. Phase 26 — SoEditor 0.7 SDK and
Release Hardening — has aligned the curated SDK, packed third-party widget
consumer, public API classification, migration, and release boundaries for the
local `0.7.0` release candidate. Its full release and adversarial gates pass
with Critical 0 and High 0. Phase 27 — Mapped Annotations and Comments — is
complete. It introduced the then-private `@soeditor/comments` package with
host-owned immutable threads, deterministic operation mapping, safe unlinking,
non-canonical decorations, command-driven review UI, and explicit permission
and persistence boundaries. Its full gate passes with 112 Chromium scenarios,
Critical 0, and High 0. Phase 28 — Revision History and Review Modes — is
complete. It introduced the then-private `@soeditor/revisions` package with
draft/saved snapshots, bounded semantic comparison, non-canonical historical
viewing, explicit transaction restore, permission-checked review policy, and
deterministic comment behavior. All 117 Chromium scenarios pass with Critical
0 and High 0. Phase 29 — SoEditor 0.8 Review Workflow Release — is complete. It
promoted both review packages to public SDK/umbrella surfaces, added
permission-checked versioned export and permanent erasure contracts, and
aligned the local `0.8.0` release candidate. All release gates pass with
Critical 0 and High 0. Phase 30 — Framework-neutral Workspace and Recovery —
is complete. Its private Core-only application controller provides explicit
attachment lifecycle, controlled/uncontrolled policies, latest-owner-value
handling during recovery, bounded restart behavior, documentation, and an
executable demo. All 120 Chromium scenarios pass with Critical 0 and High 0.
Phase 31 — React and Vue Adapters — is complete. Private framework packages now
bind Workspace through React StrictMode-safe Effects and Vue mounted/unmounted
lifecycle, with controlled values, readonly updates, SSR-safe rendering, Error
Boundary behavior, and explicit cleanup. All 121 Chromium scenarios pass with
Critical 0 and High 0. Phase 32 — Plugin Tooling and Integration Diagnostics —
is complete. Its private offline scaffold/check package targets the 0.9 SDK,
and Workspace now rejects incompatible format, missing service, and unsafe
Preview integration before attachment while retaining bounded recovery
diagnostics. The generated plugin/packed consumer, 23-directory distribution,
19-public-package release, all 121 Chromium scenarios, and supply-chain gates
pass with Critical 0 and High 0. Phase 33 — SoEditor 0.9 Integration Release —
is complete. The local `0.9.0` release candidate promotes Workspace, React,
Vue, and Node-only plugin tooling as four independent public package roots.
Its 23-package release, consumer, performance, browser, supply-chain, and
adversarial gates pass with Critical 0 and High 0. Phase 34 — 1.0 Public API
Stabilization — is complete. Every declared public entry is now covered by a
generated symbol/signature/declaration-tree report and explicit compatibility,
deprecation, runtime, security, and maintenance policies. The complete 0.9
consumer and release gates remain unchanged and pass with Critical 0 and High 0. Phase 35 — 1.0 Qualification and Documentation — is complete. It adds
production security, operations, troubleshooting, API, qualification, and
migration guidance plus deterministic CSP, accessibility, lifecycle, memory,
and large-document evidence. All 126 Chromium scenarios and complete release
gates pass with Critical 0 and High 0. Phase 36 — SoEditor 1.0 Release
Candidate and Hardening — is complete. All 23 public packages, external
consumer fixtures, release checks, and the version-2 plugin template are
aligned at 1.0.0. The final release, supply-chain, and adversarial gates pass
with Critical 0 and High 0.

All 23 public package manifests are aligned and published at `1.0.0`.
`@soeditor/editor@1.0.0` is the current stable registry reference.

## Published 0.5 release scope

Phases 1–15 of the 0.5 roadmap are implemented: Core, HTML document handling,
controlled visual editing, history/clipboard, rich text, HTML Source,
diagnostics/formatting, UI, isolated Preview, Markdown, developer tools,
FileManager/SoFinder adapter, plugin SDK/presets, and npm/CDN distribution.

This is a developer preview, not a stable 1.0 API promise. There is no migration
from an earlier public SoEditor release. Future 0.x changes should remain
deliberate and documented under SemVer principles.

## Release evidence

- 15 MIT-licensed ESM packages published at version 0.5.1; every packed
  artifact includes the repository license text.
- strict declarations, declaration maps, JavaScript source maps, packed
  NodeNext/native ESM/Vite consumers, and a real Chromium CDN smoke test.
- real-browser coverage for visual/source/Markdown/Preview/UI/developer tools,
  security, FileManager, SoFinder, accessibility semantics, CMS integration,
  and repeated lifecycle cleanup.
- automated axe WCAG A/AA scans cover the primary Visual, HTML Source,
  Markdown, and outer Preview UI; CI repeats the complete release gate and npm
  publication dry run from a frozen install.
- the GitHub `npm` environment requires an explicit `sohophp` review, and
  private vulnerability reporting is enabled.
- `@soeditor/editor@0.5.1` and its 14 supporting packages were published from
  commit `f2e5478`; a clean public-registry consumer installed the scoped
  umbrella, completed a Vite production build, validated all package metadata,
  and passed the jsDelivr/Chromium lifecycle smoke test.
- current global bundle guard: 1.29 MB raw / 415 kB gzip; measured 1,287.60 kB
  raw / 414.08 kB gzip. Standalone CSS is 8.01 kB. The full Playground chunk
  is guarded at 1.04 MB and measures 834.38 kB after comments/revisions and
  their shared review infrastructure were split into dynamic chunks.
- current minimal Vite consumer: approximately 27.9 kB raw / 8.74 kB gzip.
- the Phase 21 narrow Core/SDK/minimal-preset packed consumer is approximately
  28.0 kB raw and proves unused Source, Markdown, Preview, split DOM, and CSS
  families are absent; all 117 Chromium scenarios pass.
- the Phase 22 frozen candidate aligns all 17 packages at 0.6.0, passes strict
  typecheck, unit/consumer/distribution/release/Chromium/build/license/security
  gates, completes a 17-package npm dry run, and confirms read-only that every
  0.6.0 package version is unpublished.
- the Phase 26 `0.7.0` release candidate adds a strict packed third-party
  product-card consumer using only public package roots and the curated SDK;
  Vite and Chromium verify command-backed immutable replacement, inert unsafe
  source preservation, accessibility, and teardown.
- the aligned candidate passes lint, strict typecheck, unit/consumer/
  distribution/release tests, all 109 Chromium scenarios, build, MIT license
  verification, high-severity dependency audit, 17-package npm publication dry
  run, and a read-only check that all 17 `0.7.0` versions are unpublished.
- Phase 27 adds eight focused unit tests and three Chromium workflows covering
  mapped text and whole-block comments, source/history unlinking, safe text
  rendering, clipboard isolation, readonly permissions, keyboard navigation,
  storage failure/race behavior, accessibility, and cleanup. The comments
  package remains private until the Phase 29 0.8 release gate.
- Phase 28 adds ten focused revision unit tests and five Chromium workflows for
  immutable provider/storage validation, HTML/Markdown comparison bounds,
  stale-load races, permissions, draft/saved viewing, restore metadata,
  comments, dynamic Visual/Source/Markdown policy, accessibility, security,
  and terminal cleanup. Distribution audits cover 19 package directories while
  the frozen public 0.7 release audit remains exactly 17 packages.
- Phase 29 adds public comments/revisions package roots, curated SDK and
  umbrella exports, immutable versioned data archives, permission-checked
  governance operations, a full-replacement comment erasure path, and optional
  host-confirmed revision erasure. A clean packed 19-package consumer verifies
  strict TypeScript, NodeNext/native ESM, real adapters, Vite, Chromium,
  accessibility, security, and teardown.
- the aligned 0.8 candidate passes lint, strict typecheck, all unit/consumer/
  distribution/release tests, 117 Chromium scenarios, build, MIT license
  verification, high-severity dependency audit, a 19-package npm dry run, and
  a read-only check that every `0.8.0` package version is unpublished. The
  final adversarial review also fixed stale refresh resurrection after revision
  erasure.
- final adversarial review: Critical 0, High 0.
- Phase 30 adds 10 focused Workspace unit tests and three Chromium workflows
  covering ordered/reverse lifecycle, partial startup failure, controlled
  feedback and recovery races, unsaved canonical source recovery, crash-rate
  terminal state, asynchronous destruction, accessibility, and DOM cleanup.
  Strict typecheck, all unit tests, all 120 Chromium scenarios, build,
  distribution/release audits, MIT verification, zero high-severity known
  vulnerabilities, 19-package npm dry run, and unpublished registry preflight
  pass. Final adversarial review: Critical 0, High 0.
- Phase 31 adds two Node SSR tests and one real-browser React/Vue workflow for
  StrictMode setup/cleanup, controlled prop updates, readonly, Suspense
  compatibility, Error Boundary propagation, Vue lifecycle, axe, and terminal
  cleanup. All strict type, unit, 121-scenario Chromium, build, 22-directory
  distribution, 19-public-package release, and high-severity audit gates pass.
  Final adversarial review: Critical 0, High 0.
- Phase 32 adds three plugin-tool unit tests, 14 Workspace unit tests, and the
  existing three Workspace Chromium workflows with an explicit crash-limit
  diagnostic assertion. A generated strict ESM plugin builds, passes static and
  script-disabled packed inspection, and runs from a clean NodeNext consumer.
  Lint, strict typecheck, all unit/consumer/distribution/release tests, all 121
  Chromium scenarios, 23-package-directory builds, MIT verification, zero
  known high-severity vulnerabilities, 19-package npm dry run, and unpublished
  registry preflight pass. Final adversarial review: Critical 0, High 0.
- Phase 33 promotes Workspace, React, Vue, and Node-only plugin tooling as four
  public roots in an aligned 23-package `0.9.0` candidate. Packed NodeNext,
  native ESM, Vite, framework, SSR-import, CMS, and generated-plugin consumers
  pass alongside deterministic Node performance budgets, all 122 Chromium
  scenarios, accessibility, distribution/release, MIT license, zero known
  high-severity vulnerability, 23-package npm dry-run, and unpublished registry
  preflight gates. Final adversarial review: Critical 0, High 0.
- Phase 34 inventories all 23 public packages and declared subpaths in a
  generated API report. Across independently consumable roots it records 816
  stable and 121 experimental symbol entries, no deprecated exports, per-
  symbol signature hashes, entry hashes, full declaration-tree hashes, CSS,
  and CLI resources; undeclared subpaths remain internal. The frozen 0.9
  packed consumers, strict typecheck, unit/performance/API/distribution/release,
  all 122 Chromium scenarios, MIT, security, dry-run, and registry gates pass.
  Final adversarial review: Critical 0, High 0.
- Phase 35 adds CSP nonces to both CodeMirror-backed editing engines, scopes
  theme ownership to SoEditor chrome, and verifies keyboard focus restoration,
  contrast, forced-colors, reduced-motion, isolated-document CSP styles, and
  2,000-instance explicit-GC retention. Security, deployment, troubleshooting,
  qualification, API overview, and 0.9-to-1.0 migration documentation are
  linked and audited. Lint, strict typecheck, unit/performance/API/docs,
  consumer/distribution/release, all 126 Chromium scenarios, MIT, dependency
  audit, npm dry-run, and unpublished registry preflight pass. Final
  adversarial review: Critical 0, High 0.
- Phase 36 aligns the root, all 23 public packages, packed consumers, release
  scripts, current distribution guidance, and generated plugin tooling at
  `1.0.0`. Template version 2 declares 1.x SDK ranges and its checker rejects
  pre-1.0 SDK peers. Frozen install, lint, strict typecheck, unit/performance/
  API/docs, packed consumers, distribution/release, all 126 Chromium scenarios,
  build, MIT, dependency audit, 23-package npm dry-run, and read-only registry
  preflight pass. Final adversarial review: Critical 0, High 0.
- The owner-authorized `1.0.0` workflow published all 23 packages from commit
  `f6196545a0054fda3f63a10ead5b21e86ec90339`. After npm index propagation, a
  clean anonymous consumer installed the public umbrella, built with Vite,
  validated every package's metadata, and passed jsDelivr JavaScript, CSS,
  source-map, frozen-global, and Chromium lifecycle checks. The annotated
  `v1.0.0` tag and GitHub Release point to the published commit.

## Accepted Medium limitations

- Revision comparison is a bounded structural/positional summary, not track
  changes. It does not match moved subtrees or branches and stops after 2,000
  reported changes. Historical UI is escaped source, not a rendered
  side-by-side WYSIWYG view.
- Revision lists are capped at 200 and snapshots at 5,000,000 characters.
  Storage, authorization, audit, retention, pagination beyond that bounded
  window, real-time concurrency, and merge conflicts remain host concerns.
- Restoring a snapshot is intentionally an ambiguous full-document transaction,
  so linked comments become unlinked. Coordinated revision-specific comment
  snapshots and fuzzy position recovery are not inferred.

- Comment ranges currently cover text or an entire structured block. Cell-local
  and nested-widget comments are deferred. Source replacement and snapshot
  history cannot supply granular operations, so affected comments become
  explicitly unlinked instead of using fuzzy recovery.
- Comment storage is optimistic and serialized per editor instance. Hosts must
  observe `lastError` and provide retry/reconciliation; real-time concurrency
  is deferred. `delete` tombstones retain messages, while `erase` removes the
  active full snapshot. Backups, replicas, legal holds, audit records, and
  authoritative regulatory export/deletion remain host responsibilities.

- The self-contained global and full Developer Playground are large because
  CodeMirror, Prettier, Markdown, and developer tools are bundled together.
  ESM/narrow preset imports are recommended for production-size evaluation.
- Visual editing intentionally supports a bounded schema. Unknown HTML is
  preserved as opaque content; complete documents remain Source-oriented.
  Structured contributions and node views remain experimental and block-only.
  Table selection is view-local and resets after a source-changing transaction;
  column changes
  explicitly reject `colgroup` metadata. Inline node views and nested editables
  remain deferred until their selection, clipboard, and ownership rules can be
  demonstrated deterministically.
- HTML ↔ Markdown conversion is explicitly lossy. Canonical Markdown itself is
  exact in Markdown mode.
- The aggregate SDK facade currently declares the aligned generic owning
  packages as peers. Bundlers remove unused families, but a plugin consumer
  must still satisfy that peer set; narrower domain SDK entries remain a future
  packaging decision.
- The Phase 32 plugin checker is a bounded static package-shape check, not a
  parser, behavioral test, malware scanner, signing service, or trust verdict.
  Its template targets the aligned 1.0 SDK; release qualification does not turn
  static inspection into a security certification.
- FileManager selects one existing asset. Upload, rename, delete,
  authentication, and a concrete SoFinder SDK remain host responsibilities.
- Accessibility and SEO providers cover only bounded source-inferable rules;
  they are not WCAG certification, assistive-technology testing, search-engine
  indexing, or ranking analysis.
- Split layout supports three finite two-pane pairs. Arbitrary docking,
  persistence, multi-writer editing, and framework-managed mounting remain
  deferred.
- Automated accessibility checks cover WCAG A/AA rules, semantics, accessible
  names, keyboard paths, status announcements, and iframe titles, but are not a
  substitute for manual assistive-technology testing. Sandboxed, host-supplied
  Preview document content is outside the parent-page axe traversal.
- Lifecycle timing uses a generous regression budget, not a cross-device
  performance guarantee. Snapshot history has linear memory cost.
- The public API report is a deterministic review gate, not behavioral proof.
  Its hashes intentionally change with public declaration signatures and may
  also require review after TypeScript declaration-emitter or formatting
  changes. Experimental entries do not receive the stable 1.x promise.
- Dedicated Firefox and Safari gates are not yet present. Chrome/Edge support
  follows the qualified Chromium platform; other standards-oriented browsers
  remain best effort until equivalent evidence exists.
- The immutable scoped `0.5.0` artifacts remain available from an incomplete
  publication attempt, but they are not the supported complete release set.
  npm rejected the former unscoped umbrella name `soeditor` as too similar to
  `jsoneditor`; `0.5.1` therefore uses the owner-approved scoped umbrella
  `@soeditor/editor`. Consumers should install and pin the aligned `0.5.1`
  package set.

## Lower-priority notes

Semantic HTML preservation is not byte-for-byte preservation. Framework
wrappers, SSR DOM emulation, collaboration, spreadsheet behavior, office-paste
parity, and arbitrary executable widgets remain post-0.7 candidates and are
not implied by this preview.

SoEditor 1.0.0 is published. The local environment had no signing key, so its
annotated `v1.0.0` tag is not cryptographically signed; the GitHub Release and
npm provenance identify the owner-authorized workflow and published commit.
