# Phase 51 — WYSIWYG Rich Text, Lists, Links, and Toolbar State

## Status

Active after Phase 50 passed its WYSIWYG and repository gates.

## Goal

Provide one consistent daily-authoring command path across paragraphs, nested
list items, captions, and table cells.

## Required work

1. Qualify bold, italic, underline, strike, subscript, superscript, text color,
   background color, font size, and remove format in body, lists, and cells.
2. Qualify paragraph, headings, blockquote, pre/code, alignment, indentation,
   and horizontal rule behavior.
3. Complete ordered/unordered nested-list Enter, exit, merge, Tab/Shift+Tab,
   clipboard, start, and marker behavior.
4. Complete selected and collapsed link insertion, displayed text, click edit,
   unlink, target/rel, internal/file targets, and named anchors.
5. Prove mixed-selection active state, selection restoration, Source round-trip,
   history, readonly, and no formatting leakage.

## Definition of Done

- each formatting family has direct WYSIWYG UI evidence in paragraphs, nested
  list items, and table cells;
- links have direct creation, inspection, edit, unlink, provider, keyboard,
  security, and history evidence;
- no cell-only duplicate formatting toolbar or command path exists;
- lint, typecheck, unit, 173+ Chromium, docs, and build gates pass.

## Constraints

- Keep feature behavior command-driven and plugin-owned.
- Do not add direct formatting DOM mutations to Classic UI.
- Preserve semantic HTML and unknown content.
