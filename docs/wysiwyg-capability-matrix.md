# CMS WYSIWYG capability matrix

This matrix covers only the active CMS HTML editor. Historical Preview,
Markdown, review, layout, Developer Visual, email and generic media/video
packages are compatibility surfaces and cannot qualify or block a CMS row.

`Verified` means the command, visible WYSIWYG result, canonical HTML and relevant
history/lifecycle behavior have automated evidence. Real Safari and manual
assistive-technology checks remain release sign-off items documented in
[status.md](status.md).

## Ownership

| Area                                                 | Owner                                              |
| ---------------------------------------------------- | -------------------------------------------------- |
| lifecycle, state, commands, transactions             | `@soeditor/core`                                   |
| HTML parse/serialize and preservation                | `@soeditor/html`                                   |
| native selection, input and WYSIWYG projection       | `@soeditor/wysiwyg`                                |
| formatting, links, images, tables and paste commands | focused `@soeditor/rich-text` plugins              |
| toolbar, menus, dialogs and localization             | `@soeditor/ui`                                     |
| CMS assembly                                         | `@soeditor/presets/cms` and `@soeditor/editor/cms` |
| optional Source                                      | `@soeditor/source`, loaded only when configured    |
| optional picker/upload                               | provider-neutral `@soeditor/file-manager` services |

Classic mounts these owners but does not independently mutate editor content.
One visible projection has write authority at a time.

## Default CMS surface

| Area        | Capability                                                  | State    | Primary evidence                                       |
| ----------- | ----------------------------------------------------------- | -------- | ------------------------------------------------------ |
| Integration | textarea/element mount, form submit/reset, destroy          | Verified | CMS and Classic browser lifecycle suites               |
| Integration | readonly, dirty state, Ajax save, repeated mount            | Verified | CMS integration and save-workflow suites               |
| Input       | caret, pointer selection, typing, replacement               | Verified | direct WYSIWYG pointer/keyboard corpus                 |
| Input       | Enter, Shift+Enter, Backspace, Delete, Tab                  | Verified | native input and list/table browser cases              |
| Input       | Chinese IME, emoji, combining text and RTL isolation        | Verified | composition and localization browser cases             |
| History     | grouped undo/redo with one dialog apply per step            | Verified | formatting, link, image, table and paste history cases |
| Formatting  | bold, italic, underline, strike, sub/superscript            | Verified | direct toolbar tests in body, lists and cells          |
| Formatting  | headings, paragraph, quote, pre/code, rule                  | Verified | direct block-command browser cases                     |
| Formatting  | color, background, font size, alignment, indent             | Verified | visible and canonical command assertions               |
| Formatting  | remove format and semantic CMS styles                       | Verified | split-wrapper and configured-style cases               |
| Lists       | ordered/unordered, nesting, exit, start and marker          | Verified | keyboard and properties cases                          |
| Links       | create/edit/unlink, target/rel, anchor, internal/file       | Verified | unified dialog and provider tests                      |
| Images      | URL, upload and configured picker                           | Verified | unified image-menu and provider tests                  |
| Images      | alt, title, caption, dimensions, ratio and alignment        | Verified | complete image-properties browser case                 |
| Images      | responsive srcset/sizes, classes and link wrapper           | Verified | visible/canonical apply plus one-step undo case        |
| Images      | paste/drop upload, retry, reject and cancellation           | Verified | WYSIWYG upload lifecycle cases                         |
| Tables      | insert, navigate, select, resize and properties             | Verified | direct table corpus                                    |
| Tables      | rows/columns, headers, merge/split, clear, caption          | Verified | contextual UI and one-step history cases               |
| Tables      | rich cell content and matrix/Office paste                   | Verified | native cell and paste cases                            |
| Paste       | web/plain/Office/Docs/LibreOffice cleanup                   | Verified | classified paste pipeline and browser fixtures         |
| HTML        | unknown elements, attributes, comments and CMS markers      | Verified | load/edit/save and Source round-trip cases             |
| Security    | inert script, event handler, unsafe URL and embed content   | Verified | authoring security corpus                              |
| UI          | responsive toolbar, overflow, sticky, maximize and resizing | Verified | desktop/mobile CMS suites                              |
| UI          | dialogs, context UI, focus return and error announcements   | Verified | keyboard, focus and accessibility cases                |
| UI          | English, Simplified/Traditional Chinese, custom locale, RTL | Verified | per-instance localization cases                        |

## Explicit optional surface

| Area   | Capability                                       | State    | Boundary                                          |
| ------ | ------------------------------------------------ | -------- | ------------------------------------------------- |
| Source | CodeMirror HTML editing and canonical round trip | Verified | ESM dynamic import after explicit configuration   |
| Source | format/minify/find/diagnostics                   | Verified | Source-only controls; absent from default toolbar |
| Picker | provider-neutral image/file selection            | Verified | explicit adapter/service configuration            |
| Upload | progress, abort, retry and teardown              | Verified | explicit upload service configuration             |

## Release blockers

- any Critical or High content-loss, security, selection, history, form or
  lifecycle defect;
- a visible default control without a complete command and browser workflow;
- an excluded compatibility product entering the CMS startup graph;
- a CMS bundle, interaction or retained-resource budget regression;
- claims of real Safari or assistive-technology completion without manual
  evidence.
