# SoEditor CMS HTML WYSIWYG Specification

## Status

Normative product and qualification contract, updated on 2026-09-05 for
WYSIWYG + Source. Implementation status is tracked separately in the
[active plan](wysiwyg-source-plan.zh-CN.md).

## 1. Scope

SoEditor edits the HTML body of CMS-managed website content. The default
experience is a classic WYSIWYG editor mounted on a textarea or element.

It must feel like normal browser text editing while producing controlled,
semantically preserved HTML through commands and transactions.

The only active alternate editing mode is optional HTML Source. Markdown,
Developer Visual, Preview workspaces, comments, revisions, collaboration, AI,
email authoring, page building and spreadsheets are outside this specification.

## 2. Reference principles

- Learn compact loading, direct configuration and practical feature density from
  Jodit 4.
- Learn mature CMS interaction, dialogs, form behavior, paste, images, links and
  tables from CKEditor 4.
- Learn model/view separation, conversion, commands, plugins and testing
  discipline from CKEditor 5.

Reference behavior is evidence, not permission to copy source or import a broad
architecture that does not serve the CMS product.

### HTML element semantics

SoEditor treats preservation, visual editability and toolbar exposure as
separate policies. Current standard HTML elements and unknown CMS elements are
preserved when safe, but preservation does not automatically add a toolbar
command or allow executable behavior.

`code` is an inline semantic element for a code fragment or single line. The
dedicated inline Code control applies it as `<code>` without inventing a `pre`
ancestor, and it is not offered as a block-style choice. `pre` remains a
separate block choice that preserves whitespace. Authors who intentionally need
a multi-line code sample may compose
`<pre><code>...</code></pre>` in Source, but formatting never adds that structure
implicitly. HTML parsing and formatting follow element syntax and content
models rather than a legacy visual "block versus inline" tag list.

Inside `pre`, Enter and Shift+Enter insert literal newline text (`\n`) rather
than `br` elements. Elsewhere, serialized line breaks use the canonical
`<br />` spelling; both forms remain accepted when loading existing HTML. When
switching a block between `pre` and `p`/`div`, SoEditor converts these two
representations in both directions so the visible line breaks remain intact.
Legacy content with inline nodes directly under the editor root is preserved on
load; when an author chooses a block command, that selected inline run is
wrapped in the requested `p`, `div`, or other block so subsequent formatting
commands remain available.

Block commands also enforce the HTML content model: a phrasing-only target such
as `p`, `pre`, or a heading never receives nested flow content such as another
`p`, a list, or a table. Textual nested blocks are split into same-level target
blocks with their order, attributes, and PRE line breaks retained. Structural
content that cannot be converted without losing meaning remains unchanged.

## 3. Core authoring behavior

### Input and selection

- pointer placement, drag selection, Shift+Arrow, word and line navigation;
- forward and reverse selections across inline boundaries;
- native beforeinput, deletion, Enter and paragraph splitting;
- Chinese and other IME composition as coherent history operations;
- selection retention while using toolbar, menus, dialogs and context controls;
- stable editing inside paragraphs, headings, list items, captions and cells;
- no formatting-state leakage after collapsed or mixed selections.

### History and clipboard

- meaningful undo/redo grouping for typing, paste, drop and dialog changes;
- internal copy/paste preserves supported semantics;
- external rich paste is classified and cleaned by explicit policy;
- plain-text paste remains available;
- table matrix paste is bounded and uses the same security policy;
- pasted/dropped files use the configured upload adapter or fail visibly.

### Lifecycle

- textarea value and form submit/reset remain synchronized;
- readonly affects every author-facing mutation path;
- multiple instances are isolated;
- failed initialization restores caller-owned state;
- destroy cancels tasks, removes listeners/observers/UI and restores the host;
- no editor may resurrect after destruction begins.

## 4. Required default features

### Text and blocks

- paragraph and configured heading levels;
- bold, italic, underline, strike, subscript and superscript;
- remove format that actually removes the selected style;
- configured font family/size/color/background only when enabled;
- semantic highlighter output using `mark` with a bounded lower-line gradient;
- paragraph, generic CMS `div`, blockquote, pre/code, inline code, alignment and indentation;
- horizontal rule and configured page-break marker;
- semantic CMS style dropdown.

### Lists

- ordered and unordered lists;
- nesting/outdent with keyboard and toolbar;
- list exit behavior at empty items;
- ordered-list start and supported marker properties;
- paste, history and formatting inside list items.

### Links

- create from selected text or collapsed caret;
- edit an existing link without losing selection;
- URL, display text, title, target and normalized relationship values;
- `_blank` safety policy;
- unlink, named anchors, configured internal target picker and file picker;
- safe protocol validation and exact round trip of supported attributes.

### Images and assets

- insert by upload, replaceable asset picker or validated URL;
- progress, cancellation, retry, validation and temporary-preview cleanup;
- edit alternative text, title, caption, width/height, ratio, alignment and link;
- replace and delete without leaving broken wrappers;
- preserve configured responsive source information;
- make decorative versus informative alt policy explicit;
- keep storage and file-manager implementations outside editor feature code.

Since the owner-approved 1.4.0 release, focused video insertion is a default Classic control. Cards remain inert; dialogs and players load on demand. Use `video: false` to disable it, or configure its origin policy through `video`. Arbitrary embeds remain optional.

### Tables

- insert a bounded table and edit text normally in every cell;
- caption, header rows/columns, semantic sections and scope;
- add/delete rows and columns;
- merge/split and clear cells;
- table, row, column and cell properties;
- width, alignment, row height, cell alignment, rowspan and colspan;
- Tab/Shift+Tab navigation and explicit rectangular cell selection;
- contextual tools that do not replace native text selection;
- preserve unsupported structures rather than silently normalizing them.

### CMS objects

- configured placeholders, page breaks and atomic content objects may be shown
  inertly and edited only through validated properties;
- unknown elements remain preserved and visibly bounded when they cannot be
  edited safely;
- arbitrary executable embed authoring is not included.

## 5. Optional HTML Source

Source is a primary editing capability that hosts may opt to expose. Enabling
its control must not fetch its runtime during WYSIWYG initialization. First
activation of Source or a Source split view loads it; an initial Source view
loads it immediately. It provides syntax-aware HTML editing and search.
Formatting/minification and advanced diagnostics have separate demand boundaries;
opening Source alone must not load Prettier or developer tools.

A first load has visible, accessible pending, failure and retry behavior. Rapid
switches share an in-flight module load but preserve the latest requested view.
Destroy during loading must not attach UI or change data. Module code may be
cached across instances; editor state, history and cleanup remain per instance.

Both side-by-side and stacked WYSIWYG/Source views remain supported with resizing
and keyboard alternatives. They share canonical HTML and a single active writer.
Selection and optional scroll synchronization must not steal focus or create
feedback loops. Invalid Source drafts remain recoverable across failed switching,
save attempts and form submission; they must not be silently replaced by stale
WYSIWYG HTML. The host receives an explicit invalid-state result where submission
cannot safely proceed.

There is exactly one writer. Switching modes synchronizes canonical HTML. If
Source contains invalid input that cannot be projected safely, WYSIWYG retains
its last valid inert view and explains why it cannot become writable.

Source is not a reason to ship Developer Visual, Preview, Markdown,
command palettes or full developer tools in the CMS product.

## 6. HTML preservation and security

- Preserve meaningful unknown elements, attributes, classes, comments, custom
  elements, template content and CMS markers.
- Do not execute scripts, inline event handlers or unsafe embeds.
- Validate URL-bearing commands and returned picker/upload data.
- Keep external paste cleanup separate from loading stored CMS HTML.
- Use inert boundaries for unsupported or unsafe visual content.
- Never claim byte-for-byte preservation; require semantic preservation.

## 7. UI requirements

- one conventional configurable toolbar with clear groups and responsive
  overflow;
- no duplicate buttons for the same workflow unless evidence justifies them;
- command-backed active, mixed and disabled state;
- accessible menus, dialogs, notifications and contextual tools;
- dialogs read existing values, validate, cancel cleanly and restore focus;
- default controls prioritize frequent CMS work; rare controls are opt-in;
- content styles are isolated enough to remain predictable without preventing
  configured CMS presentation CSS;
- English, Simplified Chinese and Traditional Chinese resources remain complete
  and per-instance; custom localization and RTL are supported.

## 8. Performance requirements

- default initialization must not load Source, Markdown, Preview, comments,
  revisions, framework adapters or developer tools;
- ordinary typing must not rebuild or reparse the complete document;
- selection changes must not trigger unbounded document scans;
- menus and dialogs should initialize on demand where practical;
- large tables and paste input are bounded;
- every instance-owned observer, listener, timer and task is released;
- bundle, startup, input, paste, table and memory budgets are release gates, not
  documentation-only targets.

## 9. Feature acceptance rule

A feature is `Verified` only when direct WYSIWYG tests cover:

1. pointer and keyboard entry;
2. selected, collapsed and mixed state where applicable;
3. apply, edit, cancel, invalid input and remove;
4. visible DOM and canonical HTML;
5. undo/redo;
6. external setData and Source round trip when enabled;
7. readonly, multiple instances and teardown;
8. Chromium, Firefox and WebKit applicability;
9. accessibility semantics and focus restoration;
10. measured performance proportional to its risk.

Developer Visual, unit-only or demo-only evidence cannot qualify a WYSIWYG
feature.

## 10. Release blockers

- any Critical or High content-loss, security, selection, history, form or
  lifecycle defect;
- a visible default control without complete behavior;
- optional products entering the default import graph;
- unexplained bundle, startup, typing, paste or retained-memory regression;
- unsupported browser or accessibility claims presented as verified;
- incomplete image, link, list, table, paste or Source workflows.

### Table context menus (2026-09-05)

The contextual toolbar groups column, row, and merge/split operations into
compact dropdowns. Column and row menus include first-column/first-row header
switches, insertion on either side, deletion and structural selection. The
merge menu offers four directions and horizontal/vertical cell splitting;
More table tools retains captions, properties and cell HTML editing.
Menus support arrow keys, Home/End and Escape, and fit the available viewport.
Ordinary-cell splitting adds a grid track and spans neighboring cells, preserving
content and IDs. Merging requires complete rectangular cells in one section.
Row/column insertion and removal adjust intersecting spans. Removing the origin
row of a surviving merged cell moves its content and attributes into the first
remaining covered row. Column groups retain their attributes and widths.
The browser scenario inventory now contains 280 scenarios; prior dated test
counts remain historical evidence.

Initial dropdown verification: 46 rich-text unit tests, 116 product Chromium tests and
6 desktop/mobile CMS scenarios pass. The unpadded-cell caret regression and
row/column resize workflows pass together. Winstar's 7 integration scenarios
cover Traditional Chinese menus and canonical HTML submission.

The header-axis commands `table.header.firstRow` and `table.header.firstColumn`
accept an optional boolean (default `true`). Turning one axis off preserves the
other header axis at intersections and removes `scope` from resulting data cells.
Classic selection recovery uses logical grid coordinates, including existing
row/column spans, instead of physical child indices.

P0 follow-up verification: the complete `pnpm test` chain passes, including
117 product Chromium tests and 6 desktop/mobile CMS scenarios; rich-text has
50 passing unit tests. Typecheck, lint, the frozen performance and distribution
budgets, and Winstar's rebuilt assets with 7 integration scenarios also pass.
The CMS global measures 483.10 kB raw / 149.01 kB gzip. P1 split semantics,
operation explanations and column-width interaction refinements remain separate.

Table regression follow-up: the merge icon applies a complete selected rectangle
immediately, while the adjacent arrow opens merge/split choices. Both hit targets
share one compact visual control. Active cells and rectangular selections use a
light blue tint without heavy individual borders; structural selections suppress
the overlapping native text-selection highlight. More table tools
retains Toggle header cell for arbitrary `th`/`td` cells, including cells beyond
the first row or column. Resize targets follow visible borders around spans;
spanned column metadata can be resized without duplicating IDs. Delete row and
Delete column labels are translated in Simplified and Traditional Chinese.

Regression verification: the full `pnpm test` chain passes, including 117 product
Chromium and 6 desktop/mobile CMS scenarios. The expanded table regression checks
actual width/height changes, direct and directional merges, header conversion,
undo and canonical HTML. Winstar rebuild and all 7 integration scenarios pass.
The CMS global remains within its frozen budget at 483.62 kB raw / 149.12 kB gzip.

Table interaction polish: ArrowDown opens the merge menu from either part of the
combined control; Escape returns focus to the part that opened it. Table highlights
remain while using menus and clear when clicking back into ordinary body content.

Resize crossings: when row and column handles overlap, the initial drag direction
chooses the operation. This prevents a horizontal drag from writing row height
after clearing a cell height in split view. A click at the crossing without a
drag does not modify the table. The regression covers both directions, actual
column width and one-step undo while Source remains visible.

Split-view scrolling: the table overlay uses the scroll offset of its actual
containing block and listens to the outer visual pane's scroll events. This
keeps visible resize borders aligned after entering split view, scrolling and
resizing the window. Browser regressions drag both columns and rows while the
Source pane remains open, including a scrolled fullscreen layout.

Disabled merge and split controls provide localized guidance based on whether
one cell, multiple cells, or an incompatible neighboring cell is selected.

Left/Right arrows move between the four table tool groups. An open menu switches
to the adjacent menu while preserving the cell selection; closed menus only move
focus. Navigation follows the toolbar's LTR/RTL direction.

Table P0/P1 follow-up: resize recovery tracks the active table by its unique ID
or document position instead of selecting the first table. If table count changes,
an ID-less table is recovered only when its text identifies one remaining table;
otherwise its tools close. Resize sessions cancel on Escape, lost pointer capture,
window blur or projection replacement. A click or a drag returned to its initial
dimension leaves content and history unchanged. A completed drag creates one
undo step. Handles remain available while Source has focus in a split view.

Drag feedback displays localized column width or row height in pixels, including
a limit indicator. The guide and committed dimension share the same bounds:
40–1200 px per logical column and 24–1000 px per row.
`table.cell.canSplit(range, direction)` accepts `all` (default), `rows`, or
`columns` and returns whether the selected table cell can split under the actual
grid limits without changing content or history. Menus use this query to disable
unavailable splits and explain when table limits prevent them.

Continuous browser coverage combines multiple tables, cell properties, split
Source formatting, resize cancellation, external content replacement and
undo/redo, and verifies that the other table and canonical HTML remain intact.

P0/P1 verification (2026-09-05): lint, typecheck, the full test chain and build
pass, including 119 product Chromium and 6 desktop/mobile CMS scenarios. The
canonical table performance probe measures 45.08 ms; the CMS global measures
485.81 kB raw / 149.70 kB gzip within unchanged budgets. Browser coverage here
is Chromium automation, not manual Safari or assistive-technology certification.
The linked Winstar production build and all 7 integration scenarios also pass,
including Traditional Chinese resize feedback and cancellation.

Table spacing: native `cellpadding` and `cellspacing` attributes render in the
visual pane, including Source split view and zero values. Default editing styles
apply only when the corresponding attribute is absent; explicit inline CSS
continues to override presentational attributes.

### Image resizing and block paragraphs (2026-09-05)

Image dragging locks the displayed aspect ratio by default. The image properties
checkbox can explicitly disable the lock; Shift temporarily constrains an unlocked
image. Arrow keys resize by one pixel, or ten with Shift. Blue square handles,
a blue outline, an opaque preview and a dimension label provide drag feedback.
Preview updates are coalesced per animation frame; releasing the pointer creates
one HTML transaction. Escape, pointer cancellation, lost capture, blur, readonly
and content replacement cancel an active drag without saving the preview.

Selected images and tables expose localized buttons on their top and bottom
edges to insert a paragraph before or after the block. The buttons are keyboard
reachable and return the caret to the new paragraph. Image captions and links,
inline-image paragraph contents and table cells are preserved. These controls
live outside editable HTML and never appear in `getData()` or Source.

The WYSIWYG-only commands `block.paragraph.before` and `block.paragraph.after`
take no arguments and require a selected image or table and editable content.
They are registered for the WYSIWYG engine lifetime and use its transaction path.
