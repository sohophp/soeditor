# Phase 25 — Production Tables and Media

## Status

COMPLETE.

## Goal

Prove the Phase 23–24 public extension path with production-grade table and
media features while preserving unsupported HTML and keeping Core small,
DOM-free, plugin-first, and transaction-authoritative.

## Sources of truth

- `AGENTS.md`
- `docs/PRODUCT.md`
- `docs/architecture.md`
- `docs/ROADMAP.md`
- `docs/DEVELOPMENT-POLICY.md`
- accepted ADRs, especially 0024 and 0025
- the completed Phase 23 structured schema and Phase 24 node-view runtime

## Required implementation

1. Define bounded table structure and operations for rows, cells, headers,
   rectangular selection, insertion/removal, merge/split, keyboard movement,
   semantic clipboard, and accessible presentation.
2. Add figure/image/media structured features with captions, alt text,
   dimensions, and typed FileManager integration through services rather than
   a concrete file-manager dependency.
3. Preserve unsupported table/media attributes and children without executing
   unsafe content or treating view DOM as canonical state.
4. Expose the same command behavior to toolbar, keyboard, command palette, and
   third-party UI consumers through public APIs.
5. Prove source round trips, readonly, history, clipboard, accessibility,
   teardown, large-table behavior, and repeated widget lifecycle in Chromium.

## Explicitly deferred

- spreadsheet formulas, office-paste parity, arbitrary remote embeds, and
  uploads owned by Core;
- a general nested-editable or inline-node-view runtime unless a Phase 25
  requirement demonstrates deterministic selection and ownership.

## Definition of Done

- tables and media use the same public extension path available to third-party
  widgets;
- all repository gates pass and the final adversarial review reports Critical
  0 and High 0;
- npm publication, tags, and hosted releases remain explicitly owner-controlled.
