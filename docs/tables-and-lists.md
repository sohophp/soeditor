# CMS tables and lists

The CMS preset keeps tables as atomic structured blocks and lists as controlled
paragraph metadata. Every accepted edit reaches canonical HTML through a
command and transaction; projected table DOM and browser list normalization are
never authoritative.

## Table properties

`TablePlugin` provides these bounded command families:

- `table.insert`, row/column insertion and removal, header toggle, merge,
  split, clear, and text replacement;
- `table.properties` for caption, accessible label, width, alignment, and
  responsive class tokens;
- `table.row.properties` for section, height, accessible label, and class
  tokens;
- `table.cell.properties` for header scope, horizontal/vertical alignment,
  accessible label, and class tokens;
- `table.column.resize` for 40–1200 pixel column widths.

Table, row, and cell presentation values serialize as bounded
`data-soeditor-*` attributes so they do not overwrite unrelated source styles
or classes. Captions and header scopes use native HTML. SoEditor-owned column
widths use a marked `colgroup`; foreign `colgroup` metadata is preserved and
column-changing commands refuse it rather than guessing.

The structured node view projects captions, sections, properties, and one
native range control per column. Range controls support pointer, touch, and
keyboard input and commit one command when their value changes. Readonly mode
disables every table control.

Clicking or focusing any cell immediately makes it a normal rich editing area.
The browser owns caret placement, double-click word selection, pointer-drag
selection, Shift+Arrow, Tab, Escape, and ordinary copy/cut/paste. Text,
semantic marks, safe links, and safe images are retained. Moving among cells
does not rebuild the table; all dirty cells commit together in one transaction
when focus leaves the table or a structural table command runs. The main
editor toolbar routes supported inline, link, image, and special-character
commands into the active cell.

One stable contextual balloon is anchored to the whole table, prefers the
space above it, and flips below when the upper viewport space is insufficient.
It contains only table, row, column, merge/split, clear, resize, and property
actions. It is not recreated while the caret moves between cells. Rectangular
cell selection is an explicit table operation (`Alt+Shift+Arrow`); normal
Shift+Arrow remains native text selection. Controlled paste is used only for
files, internal table matrices, Office HTML, tables, or executable markup that
requires sanitization.

## Matrix clipboard

Copy and cut emit semantic HTML, tab/newline plain text, and the versioned
SoEditor internal clipboard MIME value. Internal matrix paste retains cell
source fidelity. When a cell is in text-editing mode, native selected-text
copy/cut is left to the browser instead. External table/Excel-style paste first passes through the
instance PastePipeline and then through a cell allowlist that removes scripts,
event handlers, executable links, and unsupported markup while retaining safe
images and semantic inline content. A paste is
bounded to 100 rows, 100 columns, 1,000 cells, and 1,000,000 input characters
and creates one history step.

Malformed, nested, nonrectangular, oversized, or attributed ambiguous table
structures remain preserved but are shown inertly. Formula evaluation,
spreadsheet selection parity, and arbitrary nested-table editing are not
provided.

## Nested lists

Ordered/unordered lists retain bounded depth, start, and marker attributes.
Enter splits a nonempty item; Enter on an empty nested item outdents it, and on
an empty top-level item exits and splits the surrounding list. Backspace at a
list boundary merges a compatible previous item, outdents a nested start, or
exits the first top-level item. Tab/Shift+Tab, selection formatting, clipboard,
and undo/redo use the same model operations.

Unsupported list structures remain opaque rather than being silently flattened.
