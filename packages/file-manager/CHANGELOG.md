# @soeditor/file-manager

## [Unreleased]

- Remove successful upload status rows automatically, including after retry and later UI refreshes; retain upload records and inserted images, with cancellation and failed-task retry unchanged.

- Ellipsize upload status text with its full value on hover, keep actions visible and scroll multiple tasks horizontally within the single-line footer; preserve keyboard dismissal and editor content.

- Add selection-only `link.file.select`, shared file/internal-page providers and the optional `./ckfinder` browser adapter; keep legacy browse commands and original URLs.

## 1.5.0

Align the tested package set at 1.5.0. See the repository release notes for CMS editing fixes, additive paste APIs and lazy global companions.

## 1.1.0

### Minor Changes

- Prepare the aligned SoEditor 1.1 CMS Classic Editor Foundation release line,
  including classic form integration, production rich-text and table workflows,
  paste/upload/content-object services, localization and accessibility, explicit
  saving, and the offline CMS plugin/theme ecosystem.

### Patch Changes

- Updated dependencies
    - @soeditor/core@1.1.0
    - @soeditor/engine@1.1.0
    - @soeditor/rich-text@1.1.0
    - @soeditor/ui@1.1.0
