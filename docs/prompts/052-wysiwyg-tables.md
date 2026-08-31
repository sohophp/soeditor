# Phase 52 — Production WYSIWYG Tables

Implement and qualify tables inside the independent native WYSIWYG surface.

## Contract

- Ordinary clicks, caret placement, pointer text selection, rich formatting,
  links, images, and clipboard behavior inside a cell remain ordinary browser
  editing behavior.
- Explicit rectangular cell selection is separate from native text selection.
- A single contextual table toolbar is anchored above the table with viewport
  fallback; no cell-only duplicate rich-text toolbar is allowed.
- All structural and property changes execute commands, create one history
  step, update canonical HTML, and visibly update the projection.
- Qualify rows, columns, headers, merge, split, clear, caption, widths,
  alignment, row and cell properties, Tab navigation, Source round-trip,
  readonly, responsive layout, and lifecycle behavior.

Do not add spreadsheet-only behavior or make direct content-DOM mutation the
authoritative state.
