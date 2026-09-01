# SoEditor CMS HTML WYSIWYG Specification

## Status

Normative product and qualification contract for Phases 58–62.

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
- blockquote, pre/code, inline code, alignment and indentation;
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

Generic video/media insertion is not a default control. A CMS may add a focused,
inert and security-reviewed media plugin explicitly.

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

Source mode is opt-in and lazy-loaded. When enabled it provides syntax-aware HTML
editing, search, formatting/minification only when configured, and clear invalid
source diagnostics.

There is exactly one writer. Switching modes synchronizes canonical HTML. If
Source contains invalid input that cannot be projected safely, WYSIWYG retains
its last valid inert view and explains why it cannot become writable.

Source is not a reason to ship Developer Visual, split panes, Preview, Markdown,
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
