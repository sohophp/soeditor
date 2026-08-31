# Phase 37 — CMS Product Contract and Baseline

## Status

COMPLETE.

## Delivered

- synchronized the product, roadmap, development policy, status,
  architecture, and README around CMS-first classic authoring;
- added the Phase 38–48 roadmap, canonical CMS acceptance journey, maintained
  capability matrix, and explicit P0/P1/P2 and non-goal boundaries;
- recorded the 23-package, 816-stable/121-experimental API, artifact-size, and
  deterministic integration-performance baseline;
- made the Playground readiness boundary explicit and repeated the two
  previously timing-sensitive browser scenarios three times under concurrency;
- lint, formatting, documentation, strict type, unit, performance, API,
  consumer, distribution, release, and isolated browser regression gates pass.

## Goal

Make classic CMS rich-text authoring the primary SoEditor product path and
establish the specifications and baseline evidence needed to implement it
without weakening the published 1.0 contract.

## Existing constraints

- `AGENTS.md` remains authoritative: HTML-first, plugin-first, command-driven,
  small Core, explicit transactions, and preservation separated from
  execution.
- ADRs 0001–0035 remain accepted. This phase does not silently reverse them.
- all 816 stable 1.0 symbol entries remain covered by the 1.x SemVer policy;
  new uncertain surfaces start experimental or internal.
- the current worktree includes owner changes recording the completed 1.0
  publication and must be preserved.

## Required implementation

1. Align `PRODUCT.md`, `ROADMAP.md`, `status.md`, `DEVELOPMENT-POLICY.md`,
   architecture, README, and release-state wording.
2. Add a maintained CMS capability matrix with 1.0 baseline, owning phase, and
   required evidence for every Phase 38–48 capability.
3. Record the canonical end-to-end CMS acceptance journey and P0/P1/P2 scope.
4. Create detailed phase specifications before each later implementation.
5. Capture current relevant bundle, performance, lifecycle, browser, API, and
   release evidence without changing product behavior.
6. Run documentation, API, type, unit, consumer, distribution, release,
   browser, build, license, and security gates relevant to the baseline.
7. Perform an adversarial review for API breakage, preservation conflicts,
   hidden execution, core growth, framework coupling, and unsupported claims.

## Explicitly deferred

- the Classic Editor mounting API, textarea/form behavior, rich-text model
  expansion, external paste, uploads, UI redesign, and later CMS capabilities;
- version changes, npm publication, tags, or hosted releases.

## Definition of Done

- every source of truth identifies Phase 37 and the CMS-first direction;
- the capability matrix and Phases 37–48 roadmap are internally consistent;
- current 1.0 behavior and stable API evidence remain unchanged;
- every relevant gate passes;
- final review reports Critical 0 and High 0.
