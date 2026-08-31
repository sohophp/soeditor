# Phase 43 — Production Tables and Lists for CMS

## Status

COMPLETE.

## Goal

Extend the bounded table and nested-list model into a practical CMS authoring
workflow while retaining explicit refusal for ambiguous structures and making
no spreadsheet-parity claim.

## Required implementation

1. Inventory current table/list commands, model ownership, node views, paste,
   keyboard behavior, source round trips, and preservation gaps before changing
   the schema.
2. Add bounded command-backed table, row, column, and cell properties,
   including caption, header/section controls, alignment, width, responsive
   class, and accessible summaries where semantically appropriate.
3. Add accessible column resizing with keyboard and pointer paths. Resize state
   must serialize deterministically and must not make projected DOM the source
   of truth.
4. Integrate bounded Excel-style matrix paste with the Phase 40 paste pipeline,
   including rectangular replacement, explicit size limits, one-step history,
   and executable-content rejection.
5. Complete nested-list split, merge, Enter, Backspace/Delete, Tab/Shift+Tab,
   start, marker, selection, history, and semantic clipboard workflows.
6. Preserve or explicitly refuse unsupported `colgroup`, nested tables,
   attributed sections/cells, and structurally ambiguous edits without source
   loss.
7. Add focused unit tests, real-browser pointer/keyboard CMS journeys, packed
   public consumer coverage, API classification, architecture/user docs, and
   measured release evidence.

## Architectural boundaries

- Table and list features remain plugins over Visual service transactions.
- Core stays framework/DOM independent and UI never mutates canonical content.
- No formula engine, arbitrary nested-table editing, spreadsheet selection
  parity, computed-layout capture, or hidden source normalization.
- Loaded unknown/unsupported HTML remains preserved and inert; external paste
  cleanup remains a separate policy boundary.

## Definition of Done

- representative table/list CMS tasks work by pointer and keyboard;
- every accepted mutation is transaction/history backed and ambiguous edits
  fail without changing canonical source;
- strict type, unit, performance, API, docs, packed consumer, distribution,
  release, browser, license, and security gates pass;
- adversarial review reports Critical = 0 and High = 0.

## Delivered

- command-backed table, row, and cell properties with semantic captions,
  sections, alignment, width, responsive metadata, and accessibility labels;
- bounded keyboard-accessible column resizing serialized through an explicitly
  owned `colgroup`, while foreign column groups and ambiguous sections are
  preserved and refused;
- safe internal/external matrix clipboard handling through the shared paste
  pipeline with one-step history and executable-content rejection;
- top-level list exit, nested outdent, boundary merge, and split behavior;
- focused unit, performance, public API, packed consumer, documentation, and
  136-scenario Chromium evidence; the global build measures 1,402.87 kB raw /
  446.13 kB gzip;
- full release, MIT-license, and dependency-security gates with Critical 0 and
  High 0.
