# SoEditor development status

## Current development

The `1.0.0` release is published and externally verified.
The local `1.1.0` release is an unpublished candidate aligned across all 24
public packages. Phases 38–56 are complete and Phase 57 cross-browser
qualification is in progress. Publication remains an explicit repository-owner
operation and is currently NO-GO pending real Safari/manual
assistive-technology sign-off.
The authorized work is the Phase 49–57 WYSIWYG completion program. Its
contract is `docs/wysiwyg-editor.md`. Existing native WYSIWYG behavior and the
199 Chromium scenarios are a regression baseline, not a claim that every
author-facing WYSIWYG feature is verified. Developer Visual evidence cannot be
used as a substitute for WYSIWYG-specific UI evidence.
Phase 49 added a dedicated WYSIWYG fixture and four direct browser scenarios,
removed the Developer Visual host from WYSIWYG-only DOM assembly, and recorded
feature ownership and test gaps in the WYSIWYG capability matrix. At that
checkpoint the Chromium gate contained 162 scenarios.
Phase 50 adds direct real-pointer coverage at every fixture text boundary,
forward/reverse selection, cell replacement, keyboard extension, native
clipboard and paragraph editing, grouped typing history, Unicode/IME/RTL,
narrow zoom, multi-instance isolation, mutation repair, and invalid-source
recovery. The complete Chromium gate now contains 173 scenarios.
Phase 51 directly qualifies semantic marks, color, background, font size,
remove-format, block/list commands, selected and collapsed links, existing-link
editing/unlinking, and named anchors across paragraphs, nested lists, and table
cells. Phase 52 qualifies native structural table selection, one stable context
toolbar, properties, Tab navigation, merge/split/clear, rows, columns, and
one-step history without changing ordinary cell text behavior. The complete
Chromium gate at that checkpoint contains 181 scenarios. Phases 53–55 add
direct asset, upload, rich cell paste, video properties, seven-layout,
Source/Preview, counters, content-style, special-character and WCAG evidence.
Phase 56 established a 189-scenario Chromium gate; the current gate contains
199 scenarios. Phase 56 passed all
available local, Chromium, mobile, performance, API, consumer, distribution,
license and security gates and records the conditional decision in
`docs/wysiwyg-release-decision.md`.
Phase 57 runs the focused CMS and direct WYSIWYG suites in Firefox and WebKit.
On the matching official Playwright Noble image, all 66 applicable assertions
pass. Four cases are explicitly excluded because Playwright native clipboard
permissions and CDP IME injection are Chromium-only; equivalent cross-engine
composition and rich-paste behavior remains covered. A separate CI job now
installs and runs Firefox and WebKit. Both that job and the complete release
gate passed for commit `1fe622c8b17771daeabc256e0ea127e52d311c83` in GitHub
Actions run `33460058428`.
The additive, lazily loaded
`createClassicEditor()` API now mounts Workspace, UI, Visual, and Source on a
textarea or element, synchronizes native submit/reset behavior, supports
readonly, callbacks, bounded sizing/auto-grow, and restores caller-owned state
on startup failure or terminal destruction. The CMS preset avoids unrelated
developer tools. The CMS preset includes multi-block daily formatting,
superscript/subscript,
remove-format, alignment, indentation, horizontal rules, bounded nested lists,
list start/marker properties, and validated instance-scoped semantic styles.
It also routes external paste and drop through a bounded, instance-scoped
pipeline with deterministic Office, Google Docs, LibreOffice, web, plain-text,
and internal-clipboard policies. Fixed fixture, rejection, security, and
one-step history evidence is covered alongside host-owned upload tasks,
temporary preview cleanup, file paste/drop, retry/cancel, and complete image
properties. Complete link editing now applies deterministic URL/target/rel
policy and optional internal/file selection. Configured atomic CMS objects,
named anchors, page breaks, placeholders, special characters, and metadata-only
embeds remain command/transaction backed and inert. All 199 Chromium scenarios
plus API, performance, packed consumer,
distribution, release, license, and security gates pass.
The root Playground route now presents the complete CMS showcase directly,
including visible tool icons, contextual production-table controls, 12
interactive feature tours, and 12 capability summaries. The isolated native
WYSIWYG engine now measures 2.214 MB raw / 649.71 kB gzip with 29.11 kB
standalone CSS, against reviewed 2.25 MB / 665 kB / 31 kB release guards. The
guard still requires the table-widget selector. The largest lazily loaded
Playground chunk measures 1.062 MB against a reviewed 1.08 MB guard.

Phase 43 adds command-backed table, row, cell, and bounded column properties,
semantic captions and sections, accessible column resizing, owned column-width
serialization, safe matrix paste through the shared paste policy, and complete
list exit/outdent boundary behavior. Unsupported foreign column groups and
ambiguous attributed sections are preserved and explicitly refused rather than
normalized away.

Phase 44 completes the responsive classic chrome with wrap/scroll, sticky and
collapse toolbar policies, roving keyboard focus, registered command-backed
context menus, element path and text counts, bounded pointer/keyboard resizing,
and coordinated maximize restoration. Desktop, narrow, 150% zoom,
forced-colors, mouse, Shift+F10, focus, and teardown evidence is included.
Phase 45 delivers per-instance English, Simplified Chinese, Traditional Chinese,
and custom RTL resources; localized dynamic chrome and embedded keyboard help;
44px mobile controls; isolated content direction; and composition-session
history boundaries. Chromium desktop/mobile qualification passes. The Rocky
Linux development host still cannot launch Firefox/WebKit, while Phase 57 now
passes their applicable automation in the supported Playwright Linux image.

Phase 46 delivers a framework-neutral save workflow with exact
canonical-source requests, opaque revision tokens, progress, manual save,
bounded debounced autosave, non-overlapping writes, failure/retry, explicit
conflicts, stale-response protection, and abort-on-destroy. Classic composes it
with a command-backed localized Save/Retry control and coordinated opt-in
multi-instance leave-page protection. Packed and framework integration
qualification passes through the packed NodeNext and Vite consumers.

Phase 47 qualifies CMS styles, contextual UI, paste, upload, content-picker,
translation, and atomic-object contracts through the curated plugin SDK.
Template version 3 generates focused CMS widget, paste, upload, and theme
packages offline; packed checks cover each family and report common remote-code
and unsafe-DOM sinks without executing source. Per-instance plain-text icons and
host-scoped chrome variables remain separate from canonical content and restore
caller styling on teardown.
All 144 Chromium scenarios, four desktop/mobile CMS project runs, generated
family builds and packed checks, NodeNext/Vite/widget consumers, distribution,
release, license, and dependency audits pass. Phase 47 adversarial review found
Critical 0 and High 0. Firefox/WebKit execution remains limited by the
documented host runtime-library gap rather than a product test failure.

Phase 48 adds a single continuous acceptance journey spanning textarea load,
unknown CMS source, Chinese composition, styles/lists, Office paste, upload,
links, tables, history, Source, native submission, inert dangerous source, and
exact teardown. It passes on Chromium desktop and mobile alongside the two
focused locale/interaction scenarios (six runs total). The full Firefox/WebKit
matrix was attempted: both fail before page creation because this host lacks
their required system runtime libraries; no product assertion ran or was
weakened.

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
- The plugin checker is a bounded static package-shape check, not a parser,
  behavioral test, malware scanner, signing service, or trust verdict. Template
  version 3 targets the compatible 1.x SDK range; release qualification does
  not turn static inspection into a security certification.
- FileManager selects an existing asset and the Upload workflow coordinates a
  host implementation. Rename, delete, authentication, durable storage, media
  processing, and a concrete SoFinder SDK remain host responsibilities.
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
- Firefox and WebKit projects pass all 66 applicable direct WYSIWYG and focused
  CMS assertions in the supported Playwright Linux image. The Rocky Linux host
  still lacks their launch libraries, which is an environment limitation rather
  than product evidence. Chrome/Edge support follows the qualified Chromium
  platform; Safari support still requires real-platform manual evidence.
- The immutable scoped `0.5.0` artifacts remain available from an incomplete
  publication attempt, but they are not the supported complete release set.
  npm rejected the former unscoped umbrella name `soeditor` as too similar to
  `jsoneditor`; `0.5.1` therefore uses the owner-approved scoped umbrella
  `@soeditor/editor`. Consumers should install and pin the aligned `0.5.1`
  package set.

## Lower-priority notes

Semantic HTML preservation is not byte-for-byte preservation. SSR DOM
emulation, collaboration, spreadsheet behavior, complete Office application
parity, and arbitrary executable widgets remain outside this candidate and are
not implied by bounded CMS paste support.

SoEditor 1.0.0 is published. The local 1.1.0 CMS candidate has not been
published, tagged, or turned into a hosted release. The local environment had
no signing key, so the 1.0.0
annotated `v1.0.0` tag is not cryptographically signed; the GitHub Release and
npm provenance identify the owner-authorized workflow and published commit.
