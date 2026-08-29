# Phase 18 — Diagnostics Workflow and Problems UX

## Status

COMPLETE.

## Goal

Turn the source-diagnostics provider set into an observable, deterministic,
accessible workflow while keeping analysis policy out of Core and individual
editing surfaces.

## Required implementation

1. Preserve explicit `document.validate` and add an opt-in per-instance
   debounced validation policy. Manual validation remains the compatibility
   default.
2. Suppress stale publication under rapid source changes, provider registry
   changes, overlapping validation, and destruction. Clear every owned timer
   and subscription during teardown.
3. Run an immutable provider snapshot so one provider rejection or malformed
   result is recorded as an observable provider failure while independent
   providers still finish. Preserve provider registration order in successful
   Problems regardless of completion order.
4. Extend `DiagnosticsService` with immutable status, failure, filtered-result,
   count, and subscription capabilities. Keep the existing `problems`,
   `register`, and `validate` API behavior compatible where possible.
5. Validate filter and automatic-policy configuration actionably. Do not add a
   general scheduler, diagnostic semantics, or DOM types to Core.
6. Upgrade the generic Problems contribution with accessible loading, empty,
   partial-failure/error, grouped results, provider/severity filters, stable
   counts, source reveal, and keyboard navigation.
7. Demonstrate parser, structural, accessibility, SEO, and third-party
   diagnostics together in the Developer Playground.

## Test requirements

Cover manual/default and debounced policies, rapid changes, overlapping runs,
provider rejection and malformed output, unregister races, deterministic
ordering, filter/count correctness, listener and teardown behavior, keyboard
navigation, loading/empty/error states, source reveal, accessibility scans,
packed consumers, and real Chromium behavior.

## Explicitly deferred

- quick fixes, bulk mutation, or formatter coupling;
- worker infrastructure or a Core scheduler;
- diagnostics for Markdown, CSS, JavaScript, Preview, or remote pages;
- projection coordination and split-view layout work from Phases 19–20.

## Definition of Done

- rapid changes and failures cannot publish stale or partial-authority state;
- provider failures remain observable without blocking successful providers;
- the Problems workflow is keyboard accessible and passes existing automated
  WCAG A/AA regression gates;
- Core and generic UI have no HTML rule knowledge;
- Critical = 0, High = 0, and all repository verification passes.

## Completion record

Completed on 2026-08-30.

- Added manual/default and opt-in debounced validation policies with owned
  timer and document-subscription cleanup.
- Added concurrent ordered provider snapshots, stale publication suppression,
  isolated observable provider failures, filters, counts, and workflow
  subscriptions.
- Added grouped/filterable Problems UX with loading, empty, partial-failure,
  source reveal, counts, and arrow-key navigation.
- Demonstrated parser, structural, accessibility, SEO, and third-party
  providers together in the Developer Playground.
- Added unit, packed-consumer, Chromium workflow, keyboard, and automated WCAG
  A/AA coverage.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and dependency
  audit gates passed.
- Read-only adversarial and release-gate review: Critical = 0, High = 0.
- Accepted Low limitation: an open panel subscription is released immediately
  on replacement/plugin teardown, or lazily on the next diagnostics update
  after a user closes the generic panel directly.
