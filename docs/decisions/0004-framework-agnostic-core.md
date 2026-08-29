# ADR 0004: Framework-agnostic core

- Status: Accepted
- Date: 2026-08-29

## Decision

`@soeditor/core` contains no DOM, browser, application-framework, source-editor,
formatter, parser, file-manager, preview, or UI dependencies. Browser-specific
editing behavior belongs outside core, with `@soeditor/engine` reserved as the
future editing-engine boundary.
