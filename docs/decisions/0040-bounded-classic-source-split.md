# ADR 0040: Bounded Classic WYSIWYG and Source split

## Status

Accepted on 2026-09-02 by direct product-owner request.

## Context

ADR 0039 reduced the active product to a CMS WYSIWYG editor with optional lazy
Source mode and excluded the earlier generic split-layout platform. CMS authors
still need to compare and edit canonical HTML while retaining visual context.
Switching the complete surface between WYSIWYG and Source makes that focused
task unnecessarily difficult.

## Decision

When Source is explicitly enabled, Classic supports exactly two additional
workspace views:

- `wysiwyg-source-horizontal` for left/right panes;
- `wysiwyg-source-vertical` for top/bottom panes.

Both views keep the existing projection synchronization and one writable
primary projection. A visible separator adjusts the first-pane ratio from 20%
through 80% by pointer drag or keyboard. The separator exposes standard ARIA
separator orientation and value attributes. Each editor instance owns its
ratio, listeners and cleanup.

This is an optional Source-path capability. It does not add Preview, Markdown,
Developer Visual, arbitrary pane combinations, docking or `@soeditor/layout`
to the default CMS runtime.

## Consequences

- WYSIWYG-only instances still mount no Source engine or separator DOM. The
  shared Classic controller and stylesheet gain the small bounded split
  controller and styles; their measured release sizes must remain visible in
  normal bundle reporting.
- Source-enabled Classic loads the existing Source modules and adds only its
  small built-in two-pane DOM and interaction code.
- Public `ClassicWorkspaceView` gains two additive string values.
- ADR 0039 remains authoritative except for its blanket exclusion of all split
  layouts, which this decision narrows to permit this bounded Source workflow.
