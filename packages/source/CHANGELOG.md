# @soeditor/source

## Unreleased

- Localize Source search, replace, diagnostics, autocomplete labels and color selection for Simplified and Traditional Chinese without adding UI dictionaries to WYSIWYG startup.

### Patch Changes

- Keep configured Undo, Redo and Reset edits controls visible in Classic Source mode.

- Default to a readable light theme and provide an immediate in-surface dark-theme selector, including matching completion popups and focus cues. Theme changes preserve content, selection and shared undo history.
- Cache diagnostics by exact source and debounce lint markers by 300 ms; explicit diagnostic requests still validate the current draft synchronously.

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
    - @soeditor/html@1.1.0
    - @soeditor/projections@1.1.0
