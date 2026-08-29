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
active.

All 17 development package manifests are aligned at the `0.7.0` release
candidate. The published stable reference remains `0.5.1` until an explicitly
authorized npm publication and external registry/CDN verification complete.

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
- current global bundle guard: 1.29 MB raw / 415 kB gzip; measured 1,282.04 kB
  raw / 412.66 kB gzip after bounded tables and media. The full Playground
  chunk is guarded at 1.04 MB and measures 1,033.29 kB.
- current minimal Vite consumer: approximately 27.9 kB raw / 8.74 kB gzip.
- the Phase 21 narrow Core/SDK/minimal-preset packed consumer is approximately
  28.0 kB raw and proves unused Source, Markdown, Preview, split DOM, and CSS
  families are absent; all 109 Chromium scenarios pass.
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
- final adversarial review: Critical 0, High 0.

## Accepted Medium limitations

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

The candidate is not yet a public 0.7 release. npm publication, signed tag,
GitHub Release, and external npm/jsDelivr verification require explicit owner
authorization and must refer to the exact reviewed commit.
