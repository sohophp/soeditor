# Phase 38 — Classic Editor and Form Integration

## Status

COMPLETE.

## Goal

Provide one additive application-facing API that mounts a complete classic
HTML editor on a textarea or element and restores the caller-owned host
deterministically.

## Existing constraints

- Core remains DOM-free and the existing 1.0 `Editor` API is unchanged.
- Workspace remains the lifecycle/recovery owner for an application assembly.
- Visual, Source, and UI retain their existing independent attachment and
  duplicate-service guarantees.
- the API is additive in `@soeditor/editor`; uncertain additions are classified
  experimental until the CMS release contract is qualified.
- loaded HTML, comments, custom elements, and unsafe source remain preserved;
  this phase does not add a content filter.

## Required implementation

1. Add `createClassicEditor(host, options)` for an attached textarea or ordinary
   HTMLElement in a live document.
2. Construct an owned shell, Visual host, Source host, and existing Editor UI
   through Workspace attachments using an HTML preset.
3. Derive initial source from explicit `data`, textarea value, or element
   `innerHTML` in that priority; do not mutate caller content.
4. Synchronize textarea value immediately on canonical document changes and
   before form submission. After a non-cancelled form reset, load the reset
   textarea value through a system/source transaction.
5. Preserve and restore host hidden state and every owned DOM insertion on
   success, failure, and idempotent asynchronous destruction.
6. Expose editor/workspace access, `getData`, `setData`, `setReadonly`, `focus`,
   and `destroy`, plus typed change/focus/blur/ready/error callbacks.
7. Support validated placeholder, aria label, theme, toolbar, CSP nonce,
   initial/minimum/maximum height, and bounded auto-grow options without global
   observers.
8. Add unit/real-browser tests for textarea submit/reset, element host, source
   switching, readonly, callbacks, multiple instances, initialization failure,
   SSR import, focus, dimensions, auto-grow, and repeated cleanup.
9. Add a Classic demo and documentation using only public package roots.

## Explicitly deferred

- inline-on-focus editing, autosave, content/paste policy, uploads, advanced
  formatting, Office paste, contextual toolbars, localization, and maximize;
- new framework components or a new runtime package.

## Definition of Done

- a named textarea posts the latest canonical HTML through its original form;
- reset and destroy restore deterministic caller-visible state;
- no leaked engine, UI, Workspace, observers, listeners, DOM, or Blob URLs;
- 1.0 stable API compatibility and all repository gates pass;
- Critical = 0 and High = 0.

## Delivered

- Added the experimental, lazily loaded `createClassicEditor()` umbrella API
  and a focused `cmsPreset` without moving browser ownership into Core.
- Implemented textarea and element initial data, native submit/reset syncing,
  callbacks, readonly updates, focus, placeholder, sizing, bounded auto-grow,
  deterministic startup rollback, and idempotent destruction.
- Added a public Classic demo and four real-browser scenarios covering form,
  Source, preservation, lifecycle, failure, and sizing behavior.
- Preserved the umbrella ESM release budget through a Classic dynamic chunk;
  all 130 Chromium scenarios and repository release/security gates pass.
