# Phase 15 Implementation Specification — SoEditor 0.5 Release Hardening

## Status

Completed implementation record for Phase 15 of `docs/ROADMAP.md`.

## Goal

Turn the completed feature packages into one coherent, honestly documented
SoEditor 0.5 Developer Preview with reproducible release evidence.

## Release identity and public surface

Align publishable package versions at `0.5.0`. Keep ESM package roots and the
Phase 14 umbrella/global facade authoritative; do not redesign public APIs.
Audit manifests, export maps, declaration/source maps, packed consumers, and
the absence of private source-path exports.

## Integration and browser evidence

Add focused real-browser release tests for:

- classic, developer, Markdown, CMS, and SoFinder playground routes;
- one end-to-end CMS marker/image/preview workflow;
- accessible names, landmarks, focusable controls, toolbar/status semantics,
  source/Markdown labels, and preview title;
- repeated editor/surface creation and destruction without owned DOM residue;
- a generous lifecycle performance budget that detects catastrophic
  regressions without acting as a microbenchmark.

Retain existing package, security, lifecycle, and Chromium suites as the main
cross-package regression evidence.

## Playground and examples

Make the playground visibly link to Classic, Developer, Markdown, and CMS +
SoFinder configurations. Continue using injected FileManager/SoFinder
boundaries; do not add a SoFinder SDK assumption. The executable CMS route and
a documented host example must preserve custom elements/comments while keeping
surface attachment and teardown explicit.

## Release audits

Add deterministic release checks for aligned versions, explicit package
exports, bundle budgets, source maps, and expected standalone CSS/global
artifacts. Record measured bundle sizes and known Medium/Low limitations in a
release-status document.

## Documentation

Review and connect the main README, getting started, configuration, plugin,
source editing, preview, distribution, CMS/SoFinder integration, and
migration/status guides. Documentation must describe current 0.5 APIs and
explicit limitations, not speculative future APIs.

## Explicitly deferred

Do not add collaboration, framework wrappers, a real SoFinder dependency,
uploads, SSR DOM emulation, advanced tables/widgets, accessibility/SEO
diagnostic providers, publication credentials, or post-0.5 candidates.

## Definition of Done

- all roadmap Phase 15 demonstrations and documents are present;
- lint, typecheck, unit, packed consumer, distribution/release audit, complete
  Chromium suite, and build pass;
- release review has Critical = 0 and High = 0;
- remaining Medium/Low risks are documented and accepted for Developer Preview.
