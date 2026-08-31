# Phase 48 — CMS Production Qualification and Release

## Status

COMPLETE.

## Goal

Qualify and prepare one coherent SoEditor CMS Classic Editor release line from
the capabilities completed in Phases 37–47, without publishing, tagging, or
creating hosted releases.

## Required implementation

1. Inventory every CMS capability, public/experimental API, package, browser
   matrix, consumer, performance budget, security boundary, known limitation,
   and release artifact from Phases 37–47.
2. Add one continuous acceptance journey covering textarea load, unknown CMS
   source, Chinese/Latin composition, semantic styles, nested lists, Office
   paste, upload/asset selection, links, tables, Source editing, history,
   explicit save/form submission, security preservation, and exact destroy.
3. Qualify Chromium desktop/mobile and attempt Firefox/WebKit desktop/mobile;
   distinguish product failures from missing host browser libraries with
   reproducible evidence and no weakened assertions.
4. Run accessibility, forced-colors, RTL, CSP, unsafe HTML/URL, paste/upload
   limits, lifecycle, multi-instance, memory, large-document, bundle, and API
   compatibility checks across the supported CMS path.
5. Complete and cross-link CMS configuration, form/save integration,
   migration, plugin/theme, troubleshooting, security, deployment, operations,
   compatibility, and support documentation.
6. Verify aligned manifests, public declarations/maps/CSS, ESM and browser
   global builds, tree shaking, packed NodeNext/Vite/framework/widget/plugin
   consumers, licenses, dependency audit, and dry-run release artifacts.
7. Perform a final adversarial review, resolve every Critical/High finding, and
   record accepted Medium/Low limitations with owners and mitigations.
8. Produce release-preparation evidence only. Publication, Git tags, registry
   writes, and hosted releases require explicit repository-owner authorization.

## Architectural boundaries

- Qualification composes the existing command/transaction/plugin/service
  architecture; it does not add a parallel editor or CMS-specific Core path.
- Unknown source remains preserved while unsafe execution stays isolated.
- Backend authorization, durable persistence, preview deployment, plugin trust,
  and operational monitoring remain explicit host responsibilities.
- No framework dependency, remote plugin execution, collaboration system, page
  builder, spreadsheet parity, or speculative feature breadth is introduced.

## Definition of Done

- the continuous CMS acceptance journey and all supported environment matrices
  pass or have a reproducible external-environment limitation;
- documentation and the capability/evidence matrix match executable behavior;
- strict type, unit, performance, API, docs, packed consumer, distribution,
  release, browser, license, and security gates pass;
- release preparation reports Critical = 0 and High = 0 and performs no
  unauthorized publication.

## Completion evidence

- 146 Chromium scenarios and six focused Chromium desktop/mobile CMS runs pass,
  including the continuous authoring, submission, security, and teardown path.
- Firefox and WebKit projects were attempted without weakened assertions but
  cannot create a page on this host because required native runtime libraries
  are absent; the exact library gaps are recorded in qualification and support
  documentation.
- lint, strict typecheck, unit, performance, API, documentation, packed
  consumer, distribution, release, browser, build, license, registry
  availability, and dependency-audit gates pass.
- all 23 public packages are aligned at unpublished `1.1.0`; dry-run release
  preparation performs no registry write. Final review reports Critical 0 and
  High 0.
