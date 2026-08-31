# Phase 50 — WYSIWYG Selection, Input, Clipboard, and History

## Status

Active after Phase 49 passed its direct WYSIWYG and repository gates.

## Goal

Make ordinary native editing trustworthy at every supported text boundary
before expanding formatting and table structure features.

## Required work

1. Build a direct WYSIWYG selection corpus for paragraphs, nested list items,
   captions, and every table cell.
2. Exercise real pointer placement at start, middle, and end; forward and
   reverse drag; double-click; keyboard extension; and replacement typing.
3. Prove Enter, Shift+Enter, Backspace, Delete, copy, cut, paste, and undo/redo
   with visible and canonical assertions.
4. Preserve and restore the exact native range across toolbar and dialog focus
   without changing blocks or table cells.
5. Qualify IME, emoji, combining sequences, RTL, mobile viewport, zoom,
   readonly, multiple instances, mutation repair, and teardown.
6. Fix the WYSIWYG engine rather than adding table-cell-specific input or
   pointer interception.

## Explicitly deferred

- table row/column/header/merge/property breadth;
- new media and upload UI;
- formatting command breadth beyond what is required to prove range restore.

## Definition of Done

- no P0 caret, text selection, replacement, or focus restoration defect remains;
- real-input corpus passes in Chromium and is attempted in Firefox and WebKit;
- browser-engine launch limitations are recorded without weakening assertions;
- lint, typecheck, unit, dedicated WYSIWYG, full Chromium, docs, and build gates
  pass.

## Constraints

- Follow `docs/wysiwyg-editor.md` and ADR 0038.
- Keep native table-cell editing behavior identical to ordinary content.
- Do not solve failures with per-cell editors, pointer cancellation, forced
  caret placement, or duplicate formatting toolbars.
