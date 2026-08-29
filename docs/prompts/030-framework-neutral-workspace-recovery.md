# Phase 30 — Framework-neutral Workspace and Recovery

## Status

COMPLETE.

## Goal

Make complete editor configurations mountable, recoverable, and observable
without hiding application ownership or introducing a framework dependency.

## Required implementation

1. Add a private `@soeditor/workspace` application-layer package depending
   only on Core at runtime.
2. Accept an explicit Editor creator and uniquely identified ordered attachment
   factories; clean partial startup and destroy successful attachments in
   reverse order before the Editor.
3. Support an explicit controlled value with `setValue()` and required
   `onChange`, plus an uncontrolled `initialValue` with optional `onChange`.
   Prevent external-value feedback and synchronous reentrant dispatch.
4. Track the latest canonical source synchronously and provide opt-in recovery
   through explicit `reportFailure()`, creator/destructor callbacks, abort
   signals, a bounded sliding crash window, and observable ready/recovering/
   failed/destroyed snapshots.
5. Preserve the last known source on terminal failure. Never silently create a
   blank replacement editor, discover DOM, retain a global registry, or claim
   persistence/recovery beyond the current process.
6. Add unit and real-browser coverage for ordering, partial failures,
   controlled loops, unsaved-source recovery, crash-rate terminal behavior,
   concurrent destruction, accessibility, and DOM cleanup.

## Explicitly deferred

- React/Vue components and SSR behavior (Phase 31);
- remote persistence, offline storage, cross-tab recovery, collaboration, and
  automatic global error interception;
- public 0.9 SDK/umbrella exposure (Phase 33 release gate).

## Definition of Done

- strict unit/browser/lifecycle/accessibility gates pass;
- Critical = 0 and High = 0;
- architecture, ADR, guide, status, and Playground demo are synchronized.
