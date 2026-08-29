# Phase 19 — Persistent Projection Coordination

## Status

COMPLETED on 2026-08-30.

## Goal

Allow Visual, HTML Source, Markdown, and Preview surfaces to remain mounted and
synchronized outside the legacy single-mode visibility policy while preserving
one canonical document and at most one writable primary projection.

## Architecture boundary

Introduce a small DOM-free `@soeditor/projections` package. It owns a per-editor
coordinator plugin/service, projection activity values, attachment lifecycle,
and shared commands. It must not own surface DOM, layout DOM, parsing,
serialization, selections, or canonical content.

Core remains unchanged. Engines depend only on the public projection service
contract and continue to work without it using their existing single-mode
behavior.

## Required implementation

1. Define SoEditor-owned projection IDs and immutable activity state:
   `visible`, `primary`, and effective `readonly`.
2. Register attached projection adapters per editor, reject duplicate
   attachment, and make disposers idempotent. Retained services must become
   terminal after destruction.
3. Validate document-format compatibility: HTML supports Visual/Source,
   Markdown supports Markdown, and Preview may observe either. Preview is never
   a writable primary.
4. Expose command-driven primary transfer and visibility changes. Reject
   unknown, incompatible, hidden-primary, and no-writer states before mutation.
   A readonly editor keeps one logical primary but all effective activity is
   readonly.
5. Keep legacy mode behavior unchanged when no projection coordinator is
   installed. With coordination active, adapters determine host visibility and
   editability without private cross-package access.
6. Adapt Visual, Source, Markdown, and Preview engines. Every visible surface
   synchronizes from canonical source; only the primary editable projection may
   originate user document transactions.
7. Preserve the invalid exact-HTML rule: a parser-invalid Source primary may
   synchronize its exact canonical string, while Visual remains locked to its
   last valid model and cannot serialize recovery over it.
8. Handle focus activation only through a documented opt-in adapter behavior
   that executes the same primary-transfer command. Programmatic focus for
   reveal/search must not silently steal write authority.
9. Cover activation races, readonly, complete HTML documents, invalid HTML,
   Markdown, Preview, duplicate attachment, independent teardown, and repeated
   lifecycle behavior in unit and real Chromium tests.

## Explicitly deferred

- split layout DOM, resizers, pane labels, responsive behavior, and persistence;
- simultaneous multi-writer editing;
- shared selections, cursor mirroring, comments, or collaboration;
- arbitrary/custom projection graphs beyond the four current projection IDs;
- changing canonical format or implicit HTML/Markdown conversion.

## Definition of Done

- existing consumers without coordination remain behaviorally compatible;
- coordinated visible projections remain synchronized;
- exactly one compatible attached writer is primary and only it accepts user
  mutation (or none accepts mutation when the editor is readonly);
- invalid exact HTML cannot be overwritten by Visual recovery;
- lifecycle and race tests pass;
- ADR 0022 and current architecture documentation match implementation;
- Critical = 0, High = 0, and all repository verification passes.

## Completion record

Completed on 2026-08-30.

- Added DOM-free `@soeditor/projections` with immutable activity snapshots,
  command-driven visibility/authority transitions, typed failures, attachment
  rollback, deterministic notification, and terminal lifecycle behavior.
- Adapted Visual, HTML Source, Markdown, and sandboxed Preview while preserving
  the legacy single-mode path when the coordinator is absent.
- Added opt-in user focus/pointer authority transfer without allowing
  programmatic focus, search, or source reveal to steal the primary role.
- Preserved exact invalid HTML, last-valid locked Visual projection, shared
  history, readonly policy, and isolated Preview execution boundaries.
- Added public umbrella/plugin-SDK exports, 16-package tarball/distribution
  audits, a persistent Playground route, unit coverage, and six Chromium
  projection/lifecycle scenarios.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, release/license
  checks, and dependency audit gates passed.
- Read-only adversarial review: Critical = 0, High = 0.
