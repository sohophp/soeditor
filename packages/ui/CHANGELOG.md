# @soeditor/ui

## Unreleased

## 1.1.0

### Patch Changes

- Remove overwritten fallback icon definitions without changing the effective icon set; omit Source controls, icons and labels only from the WYSIWYG-only global build.

- Reuse document counts while canonical HTML is unchanged, avoiding repeated
  full-document parsing on selection and command refreshes. Content changes
  still update counts synchronously, and destroy releases the instance cache.
- Keep dialog headers and actions visible around a scrollable body, including
  on short and narrow viewports.
- Complete Simplified and Traditional Chinese labels for the redesigned CMS
  table, row, cell-property, width, and cell-HTML controls.
- Rework the CMS link dialog around a focused URL workflow, collapsible advanced
  attributes, responsive scrolling, localized labels, keyboard submission, and
  a distinct destructive remove action while retaining relative URL support.
- Resolve and retain editing selections through composed Shadow DOM ranges on
  Firefox and WebKit, expose the retained selection text to command-backed
  dialogs, and make Unicode word counts deterministic across browser engines.

### Minor Changes

- Prepare the aligned SoEditor 1.1 CMS Classic Editor Foundation release line,
  including classic form integration, production rich-text and table workflows,
  paste/upload/content-object services, localization and accessibility, explicit
  saving, and the offline CMS plugin/theme ecosystem.

### Patch Changes

- Updated dependencies
    - @soeditor/core@1.1.0
