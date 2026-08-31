# WYSIWYG capability matrix

## Status

Completed P0 qualification matrix for the post-1.1 WYSIWYG completion program.
The normative behavior and completion rules are in
[`wysiwyg-editor.md`](wysiwyg-editor.md).

States describe WYSIWYG qualification, not whether some implementation code or
Developer Visual equivalent exists:

- `Not started`: no dedicated WYSIWYG qualification has begun;
- `In progress`: implementation or partial WYSIWYG evidence exists, but the
  complete contract is not proven;
- `Verified`: every applicable completion dimension is proven;
- `Blocked`: an external limitation prevents meaningful progress and is
  documented.

Phase 49 established the first direct fixture at
`apps/playground/wysiwyg.html` and its dedicated browser evidence in
`tests/browser/wysiwyg-editor.spec.ts`. A feature remains `In progress` until
the complete row contract, rather than only the fixture baseline, is proven.
Phase 57 repeats the direct corpus and focused CMS journeys in Firefox and
WebKit: all 66 applicable assertions pass in the supported Playwright Linux
image, with four Chromium-tool-specific clipboard/CDP cases explicitly excluded
and covered through equivalent cross-engine paths.

## Ownership map

This map identifies the authoritative behavior owner. `classic-editor.ts` may
mount surfaces and UI, but it is not the owner of editing semantics.

| Area                                                         | Authoritative owner                                                                            | Classic responsibility                         | Direct evidence / open gap                  |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------- |
| Native selection, input, DOM projection, safe preserved HTML | `@soeditor/wysiwyg` / `WysiwygEditingEngine`                                                   | Mount the configured surface                   | Direct Phase 49–50 corpus                   |
| Commands and document transactions                           | focused `@soeditor/rich-text` plugins plus `@soeditor/core` transaction/history infrastructure | Render registered toolbar/dialog contributions | Direct Phase 51–53 UI evidence              |
| Table semantics and mutations                                | `@soeditor/rich-text` table plugin; native cell selection bridge in `@soeditor/wysiwyg`        | Mount one shared contextual toolbar            | Direct Phase 52 table corpus                |
| Link and media semantics                                     | `@soeditor/rich-text` link/media/image/video plugins                                           | Compose dialogs and host-provided pickers      | Direct link/image/video evidence            |
| Paste policy and uploads                                     | engine paste service and file-manager/upload service contracts                                 | Surface diagnostics and host adapters          | Direct and Classic WYSIWYG Phase 53 corpus  |
| Source editing                                               | `@soeditor/source`                                                                             | Mount only when explicitly configured          | Direct format/minify/round-trip evidence    |
| Preview rendering and isolation                              | `@soeditor/preview`                                                                            | Supply host template/configuration             | Direct sandbox/template/security evidence   |
| Pane coordination and write authority                        | `@soeditor/projections`, `@soeditor/layout`, and `@soeditor/workspace`                         | Present allowed arrangements                   | Seven direct layouts verified               |
| Toolbar, balloons, dialogs, counters, localization           | `@soeditor/ui` and focused feature UI registrations                                            | Assemble the chosen preset                     | Direct Phase 55 plus Classic WYSIWYG matrix |
| Developer Visual structured projection                       | `@soeditor/engine` visual engine and structured node views                                     | Mount only for explicit `visual` configuration | Never qualifies a WYSIWYG row               |

| Area       | Capability                               | State       | Current baseline and required proof                                                         |
| ---------- | ---------------------------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| Boundary   | Independent WYSIWYG engine               | Verified    | Owned by `@soeditor/wysiwyg`; direct fixture mounts the native surface                      |
| Boundary   | No Developer Visual DOM/model delegation | Verified    | Import/runtime audit plus direct fixture proves no Developer Visual surface is mounted      |
| Boundary   | Explicit application mode selection      | Verified    | Direct fixture configures only `wysiwyg` and `source` and proves seven allowed views        |
| Selection  | Caret at every text boundary             | Verified    | Direct real-pointer corpus covers body, nested lists, caption, and every fixture cell       |
| Selection  | Pointer drag selection                   | Verified    | Forward/reverse real-pointer selection passes in ordinary content and table cells           |
| Selection  | Double/triple-click selection            | Verified    | Native word/block selection and image/video activation have direct pointer evidence         |
| Selection  | Toolbar/dialog range restoration         | Verified    | Direct cell formatting, color, link and properties scenarios restore the native range       |
| Input      | Basic typing and replacement             | Verified    | Real keyboard insertion and pointer-selected replacement pass in body and cells             |
| Input      | Enter and Shift+Enter                    | Verified    | Direct WYSIWYG paragraph split and soft-break scenarios pass                                |
| Input      | Backspace and Delete                     | Verified    | Direct WYSIWYG paragraph merge scenarios pass in both directions                            |
| Input      | Chinese IME                              | Verified    | Direct composition plus Classic multi-instance composition history evidence                 |
| Input      | Emoji/combining/RTL                      | Verified    | Direct input preserves grapheme sequences and RTL direction                                 |
| History    | Undo/redo grouping                       | Verified    | Typing, paragraph, formatting, table, paste and structure histories have direct gates       |
| Clipboard  | Copy and cut                             | Verified    | Native WYSIWYG selection copy/cut/paste passes direct body and cell scenarios               |
| Clipboard  | Internal/cross-editor paste              | Verified    | Versioned internal MIME and external semantic paths pass WYSIWYG browser scenarios          |
| Formatting | Bold/italic/underline/strike             | Verified    | One direct UI path passes in paragraphs, nested list items, and table cells                 |
| Formatting | Subscript/superscript                    | Verified    | One direct UI path passes in paragraphs, nested list items, and table cells                 |
| Formatting | Text/background color                    | Verified    | Selection restoration and visible/canonical application pass in all three contexts          |
| Formatting | Font size                                | Verified    | Preset selection and visible/canonical application pass in all three contexts               |
| Formatting | Remove format                            | Verified    | Selected formatting is split cleanly without retaining empty wrappers                       |
| Blocks     | Paragraph/headings/blockquote            | Verified    | Direct WYSIWYG block commands update visible and canonical structures                       |
| Blocks     | Pre/code/rule/alignment/indent           | Verified    | Direct UI and Classic WYSIWYG multi-block command scenarios pass                            |
| Lists      | Ordered/unordered lists                  | Verified    | Direct and Classic WYSIWYG nested-list command scenarios pass                               |
| Lists      | Enter/exit/merge                         | Verified    | Native paragraph/list boundary and Classic list split/exit scenarios pass                   |
| Lists      | Tab/Shift+Tab nesting                    | Verified    | Direct nested-list keyboard behavior preserves canonical list structure                     |
| Lists      | Start and marker type                    | Verified    | Classic WYSIWYG properties apply visible and canonical start/type values                    |
| Links      | Selected-text insertion                  | Verified    | Direct dialog prefills displayed text and applies URL/title/target/rel policy               |
| Links      | Collapsed insertion                      | Verified    | Direct dialog inserts supplied displayed text at the active caret                           |
| Links      | Click/edit/unlink                        | Verified    | Direct link balloon edits the existing URL and removes the link                             |
| Links      | Target/rel/internal/file                 | Verified    | Dialog policy and replaceable target/file providers have WYSIWYG UI evidence                |
| Links      | Named anchors                            | Verified    | Direct caret insertion uses the unified icon/command path without developer chrome          |
| Tables     | Native caret in every cell               | Verified    | Every character boundary in all direct-fixture cells passes real pointer input              |
| Tables     | Normal text drag selection in cells      | Verified    | Forward and reverse native text drag remains distinct from table commands                   |
| Tables     | Rectangular cell selection               | Verified    | Explicit Shift-click range is projection-only and leaves ordinary text drag untouched       |
| Tables     | Stable single contextual toolbar         | Verified    | Direct UI proves one viewport-positioned toolbar through navigation and mutations           |
| Tables     | Rich block/inline cell content           | Verified    | Formatting, links, images, lists and mixed rich paste use the ordinary WYSIWYG path         |
| Tables     | Row/column insert/delete                 | Verified    | Direct contextual UI and one-step history scenarios pass                                    |
| Tables     | Header/merge/split/clear                 | Verified    | Direct structural range UI scenarios pass                                                   |
| Tables     | Caption and table properties             | Verified    | Dialog reads existing caption and applies visible width/alignment/caption                   |
| Tables     | Table and column width                   | Verified    | Context control applies projected pixel width while canonical data attributes persist       |
| Tables     | Row and cell properties                  | Verified    | Sections, height, classes, alignment, scope, and visible projection pass                    |
| Tables     | Tab navigation                           | Verified    | Tab and Shift+Tab move the native caret between adjacent cells                              |
| Tables     | Matrix copy/paste                        | Verified    | Table browser corpus covers semantic copy/cut/paste and direct rich-cell paste              |
| Tables     | Office table paste                       | Verified    | Classified sanitized table input and one-step history are browser-qualified                 |
| Tables     | Unsupported table preservation           | Verified    | Unsupported source remains canonical and inert under readonly/security gates                |
| Images     | Upload/file manager/URL menu             | Verified    | Direct fixture exercises the unified three-entry image menu                                 |
| Images     | Paste/drop image policy                  | Verified    | Automatic upload, paste, drop, reject, retry and cancellation WYSIWYG gates pass            |
| Images     | Double-click properties                  | Verified    | Direct image properties update visible/canonical data and restore selection                 |
| Images     | Alt/caption/size/alignment/link          | In progress | Data commands exist; complete direct UI proof missing                                       |
| Files      | File link manager                        | Verified    | Replaceable file-manager and file-link selection pass WYSIWYG UI scenarios                  |
| Media      | Video editing/playback boundary          | Verified    | Direct video selection pauses playback and double-click opens transaction-backed properties |
| Media      | iframe/embed policy                      | Verified    | Authoring preservation and sandboxed Preview execution boundaries are security-tested       |
| Paste      | Web/plain/Office/Docs/LibreOffice        | Verified    | Classification, configured automatic policies and fixture cleaning pass                     |
| Paste      | Cleanup strategies and report            | Verified    | Three policies, diagnostics, manual cleanup command and one-step undo are tested            |
| HTML       | Standard semantic element rendering      | Verified    | Direct fixture renders aside and ordinary semantic structures as native HTML                |
| HTML       | Comment/custom/CMS marker preservation   | Verified    | Direct Source/Preview round-trip retains inert markers without Edit HTML controls           |
| HTML       | Script/event/unsafe URL non-execution    | Verified    | Authoring and sandboxed Preview security corpora prevent execution                          |
| Source     | CodeMirror editing                       | Verified    | Direct Source activation, sizing, authority and canonical round-trip pass                   |
| Source     | Format/minify/find/diagnostics           | Verified    | Source-only UI plus whole-document and safety scenarios pass                                |
| Preview    | Sandboxed rendering                      | Verified    | Direct custom template/styles, client control, isolation and maximize pass                  |
| Layout     | Seven explicit arrangements              | Verified    | Direct UI proves exact panes, writer target and pane counts for all seven layouts           |
| Layout     | Optional synchronized position           | Not started | Must be measured and safely disableable                                                     |
| Styles     | Browser-default isolated preset          | Verified    | Direct neutral preset and host-isolation browser scenarios pass                             |
| Styles     | Article/email/custom presets             | Verified    | Configured switches and Preview template/style paths pass                                   |
| UI         | Main toolbar and active state            | Verified    | Command, active/disabled, responsive overflow and keyboard inventory pass                   |
| UI         | Context balloons/dialogs                 | Verified    | Links, tables, image/video dialogs, focus return and viewport gates pass                    |
| UI         | Words/chars/source chars/path            | Verified    | Unicode visible/source counters and mode status have direct evidence                        |
| UI         | Localization/RTL/mobile/a11y             | Verified    | Locale isolation, RTL/mobile/zoom and direct WCAG A/AA automation pass                      |
| Special    | Character preset picker                  | Verified    | Bounded default/custom picker is directly tested and can be configured false                |
| Special    | Email authoring/optimization             | Not started | Separate P1/P2 design and client simulation plan required                                   |

## Update rule

Every state change must link to:

1. the owning plugin/service and command contract;
2. at least one direct real-UI browser scenario;
3. canonical HTML and visible WYSIWYG assertions;
4. applicable history, Source round-trip, readonly, lifecycle, accessibility,
   security and browser evidence;
5. any accepted limitation.

A row may move to `Verified` only when no required evidence is represented by a
Developer Visual-only test.
