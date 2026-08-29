# SoEditor development status

## Current development

The approved SoEditor 0.6 Developer Workflow roadmap is complete through Phase 22. Visual, HTML Source, Markdown, and Preview can remain synchronized under
one write authority and appear in accessible Visual | Source, Source | Preview,
or Markdown | Preview layouts. The Developer preset now selects bounded
accessibility/SEO diagnostics and projection/split infrastructure without
owning engines or DOM. The local `0.6.0` release candidate is complete and
awaiting an explicitly authorized publication.

The evidence-derived 0.7–1.0 roadmap is now approved. Phase 23 — Extensible
Structured Editing Foundation — is complete. It provides an editor-owned
structured-block conversion registry, atomic/readonly custom blocks, opaque
fallback, validated transaction operation metadata, and immutable position
mapping. Public and SDK packed consumers plus 96 Chromium scenarios pass; the
final Phase 23 adversarial review found Critical 0 and High 0. Phase 24 — Node
Views and Widget Runtime — is active.

All 17 development package manifests are aligned at the `0.6.0` release
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
- current global bundle guard: 1.25 MB raw / 410 kB gzip; measured approximately
  1.198 MB raw / 390 kB gzip.
- current minimal Vite consumer: approximately 27.9 kB raw / 8.74 kB gzip.
- the Phase 21 narrow Core/SDK/minimal-preset packed consumer is approximately
  28.0 kB raw and proves unused Source, Markdown, Preview, split DOM, and CSS
  families are absent; all 95 Chromium scenarios pass.
- the Phase 22 frozen candidate aligns all 17 packages at 0.6.0, passes strict
  typecheck, unit/consumer/distribution/release/Chromium/build/license/security
  gates, completes a 17-package npm dry run, and confirms read-only that every
  0.6.0 package version is unpublished.
- final adversarial review: Critical 0, High 0.

## Accepted Medium limitations

- The self-contained global and full Developer Playground are large because
  CodeMirror, Prettier, Markdown, and developer tools are bundled together.
  ESM/narrow preset imports are recommended for production-size evaluation.
- Visual editing intentionally supports a bounded schema. Unknown HTML is
  preserved as opaque content; complete documents remain Source-oriented.
  Phase 23 structured contributions are block-only and inert. Interactive
  node views, atomic selection/deletion, drag/drop, and nested editables belong
  to Phase 24.
- HTML ↔ Markdown conversion is explicitly lossy. Canonical Markdown itself is
  exact in Markdown mode.
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
wrappers, SSR DOM emulation, collaboration, and advanced widgets/tables remain
post-0.6 candidates and are not implied by this preview.

The candidate is not yet a public 0.6 release. npm publication, signed tag,
GitHub Release, and external npm/jsDelivr verification require explicit owner
authorization and must refer to the exact reviewed commit.
