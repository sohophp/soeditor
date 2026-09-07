# @soeditor/rich-text

## Unreleased

## 1.1.0

### Patch Changes

- Add the side-effect-free `table.cell.canSplit(range, direction)` capability query so contextual tools reflect the same grid and cell limits as split commands.

- Resize logical columns backed by spanned column metadata, preserving attributes and unique IDs; remove header scope when converting to data cells.

- Support row/column insertion and deletion across merged cells, preserve column
  metadata, migrate surviving rowspan content and keep intersecting header axes.

- Support horizontal and vertical splitting of ordinary table cells by adding
  a grid track, preserving neighboring content, unique IDs and column metadata.
- Merge complete rectangular selections containing existing spans while rejecting
  partial overlaps and selections across table sections.

### Minor Changes

- Prepare the aligned SoEditor 1.1 CMS Classic Editor Foundation release line,
  including classic form integration, production rich-text and table workflows,
  paste/upload/content-object services, localization and accessibility, explicit
  saving, and the offline CMS plugin/theme ecosystem.

### Patch Changes

- Updated dependencies
    - @soeditor/core@1.1.0
    - @soeditor/engine@1.1.0
    - @soeditor/html@1.1.0
