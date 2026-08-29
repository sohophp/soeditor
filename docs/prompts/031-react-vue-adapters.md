# Phase 31 — React and Vue Adapters

## Status

COMPLETE.

## Goal

Provide thin official React and Vue bindings over the framework-neutral
Workspace without introducing either framework elsewhere.

## Required implementation

1. Separate private packages with React/Vue only as owning peer dependencies.
2. Controlled/uncontrolled value and readonly updates without routine remount.
3. React StrictMode-safe serialized cleanup, Error Boundary propagation, and
   explicit non-suspending behavior.
4. Vue mounted/unmounted lifecycle and ref/getter updates.
5. SSR import/render tests plus real-browser remount, update, accessibility,
   failure, and teardown coverage.

## Explicitly deferred

- Angular and Svelte adapters;
- framework dependencies in Core, engines, features, UI, SDK, or umbrella;
- public exports before the Phase 33 0.9 release gate.
