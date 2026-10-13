# @soeditor/adapter-sofinder

## [Unreleased]

- Retry failed native browser imports with a fresh module URL; diagnose HTTP 401/403 on failure with English, Simplified Chinese and Traditional Chinese messages. Successful loads remain cached and custom loaders retain their contract.

- Add optional `./browser` picker/upload adapters with lazy SDK loading, locked resources, CSRF, cancellation and original URL preservation.

## 1.5.0

Align the tested package set at 1.5.0. See the repository release notes for CMS editing fixes, additive paste APIs and lazy global companions.

## 1.1.0

### Minor Changes

- Prepare the aligned SoEditor 1.1 CMS Classic Editor Foundation release line,
  including classic form integration, production rich-text and table workflows,
  paste/upload/content-object services, localization and accessibility, explicit
  saving, and the offline CMS plugin/theme ecosystem.
- Add an injected, dependency-free SoFinder upload-task adapter alongside the
  picker adapter.

### Patch Changes

- Updated dependencies
    - @soeditor/file-manager@1.1.0
