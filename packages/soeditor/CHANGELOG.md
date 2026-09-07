# @soeditor/editor

## Unreleased

## 1.1.0

- Add the standalone `@soeditor/editor/content.css` frontend image alignment stylesheet.
- Count semantic text across block boundaries, exclude static hidden content and source indentation, and count Chinese/Japanese characters as individual word units.

- Hide paragraph controls when leaving the visible image/caption, including wide wrapper whitespace, retained button focus and mouse use on touch-capable devices.

- Show image/table paragraph buttons on hover without selecting content; hide immediately on pointer exit, preserve keyboard/touch access, and cancel stale lazy hover activation.

- Default image dragging to proportional resizing with blue handles, frame-coalesced preview, one undo step, and cancellation on Escape, lost capture, blur or readonly.
- Preserve an explicit image selection bookmark for contextual actions in WebKit.
- Add localized, keyboard-accessible insert-paragraph buttons before and after images and tables, outside captions and cell contents; preserve canonical HTML and focus the new paragraph.

### Patch Changes

- Honor native `cellpadding` and `cellspacing` in table projections while preserving explicit inline CSS and canonical attributes.

- Keep resize targeting on the active table across source/properties/history updates; cancel drags on Escape, lost capture, blur or projection replacement without creating an undo step. Show localized clamped dimensions while dragging and check logical limits before enabling cell splits.

- Navigate table tool groups with Left/Right arrows, preserving open-menu state and cell selection in LTR and RTL layouts.

- Explain disabled table merge/split actions using localized selection guidance instead of span implementation details.

- Keep table resize handles aligned with the scrolling visual pane in WYSIWYG/Source split layouts.

- Resolve overlapping row/column resize handles by drag direction, including after clearing cell height in WYSIWYG/Source split view.

- Open the merge menu by keyboard from either button and restore focus to its original trigger.

- Unify the merge icon and dropdown arrow visually; use light blue table selection feedback without heavy cell borders or overlapping text highlights.

- Restore direct selection merging and arbitrary header-cell toggling; constrain resize hit areas to visible span boundaries and localize delete actions.

- Use logical grid coordinates when recovering table selections and enable
  span-aware row/column actions and independent heading switches.

- Group table tools into column, row and merge/split dropdowns with header
  switches, directional merging, keyboard navigation, localized labels and
  viewport-aware positioning. Retain advanced actions under More table tools.

- Let native text clicks pass through border resize handles in unpadded tables.
- Align column resize guides with cell borders instead of offsetting them 4px
  to the left, including fullscreen Source split views.
- Show compact HTML tag labels as well as boundaries in the optional Classic
  `showBlocks` projection without writing editor state into canonical HTML.
- Add viewport-bounded title dragging and pointer or keyboard resizing to all
  dialogs in the optional Classic CMS build, and expose its complete styles
  through `@soeditor/editor/styles.css` while keeping the standalone global CSS
  stripped to the default CMS path.
- Redesign CMS table and cell editing with preset or unit-based widths,
  collapsible advanced properties, responsive dialogs, and a discoverable cell
  HTML editor that reads canonical content before applying changes.
- Preserve programmatically selected link ranges across Shadow DOM boundaries
  before opening the command-backed link editor.

### Minor Changes

- Prepare the aligned SoEditor 1.1 CMS Classic Editor Foundation release line,
  including classic form integration, production rich-text and table workflows,
  paste/upload/content-object services, localization and accessibility, explicit
  saving, and the offline CMS plugin/theme ecosystem.

### Patch Changes

- Updated dependencies
    - @soeditor/adapter-sofinder@1.1.0
    - @soeditor/comments@1.1.0
    - @soeditor/core@1.1.0
    - @soeditor/dev-tools@1.1.0
    - @soeditor/engine@1.1.0
    - @soeditor/file-manager@1.1.0
    - @soeditor/html@1.1.0
    - @soeditor/html-tools@1.1.0
    - @soeditor/layout@1.1.0
    - @soeditor/markdown@1.1.0
    - @soeditor/presets@1.1.0
    - @soeditor/preview@1.1.0
    - @soeditor/projections@1.1.0
    - @soeditor/revisions@1.1.0
    - @soeditor/rich-text@1.1.0
    - @soeditor/source@1.1.0
    - @soeditor/ui@1.1.0
    - @soeditor/workspace@1.1.0
