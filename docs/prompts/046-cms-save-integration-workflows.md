# Phase 46 — CMS Save and Integration Workflows

## Status

COMPLETE.

## Goal

Provide explicit host-owned persistence and representative integration paths
from legacy HTML forms through modern controlled applications without turning
SoEditor into a CMS backend.

## Required implementation

1. Inventory current dirty state, form synchronization, callbacks, Workspace,
   React/Vue adapters, revisions, notifications, lifecycle, and public package
   boundaries before defining persistence ownership.
2. Add an optional typed save-adapter contract that receives exact canonical
   source, a revision token, reason, and abort signal and returns an explicit
   new revision token or conflict result.
3. Provide instance-scoped manual save, bounded debounced autosave, progress,
   success, failure, retry, and conflict state without hidden global policy or
   overlapping writes.
4. Ensure edits during an in-flight save remain dirty and stale responses can
   never mark newer source clean; abort owned work during destruction.
5. Add opt-in leave-page protection with coordinated multi-instance cleanup
   and no implicit global listener when the feature is disabled.
6. Cover native form, Ajax/fetch, Node service, React, Vue, multiple editors,
   modal mounting, and dynamic-field integration with executable or packed
   consumers as appropriate.
7. Publish a CKEditor 4 concept-to-SoEditor migration guide that explains
   configuration, commands, plugins, data flow, uploads, and save ownership
   without claiming API or plugin compatibility.
8. Add focused unit, browser, packed-consumer, API, documentation,
   performance, lifecycle, and adversarial evidence, then run every existing
   release and supply-chain gate.

## Architectural boundaries

- Hosts own transport, authentication, authorization, persistence, conflict
  policy, and backend validation; SoEditor owns only the optional client
  workflow controller.
- Saving consumes canonical source through public editor APIs and never reads
  projected DOM as authority.
- Autosave is explicit, bounded, abortable, instance scoped, and disabled by
  default.
- Core remains free of network, DOM, framework, and CMS backend dependencies.
- Revision tokens are opaque host data; no hosted CMS backend, permissions
  database, implicit autosave, or CKEditor compatibility layer is introduced.

## Definition of Done

- integration consumers submit and recover exact canonical source across
  success, failure, retry, newer-edit, abort, and conflict paths;
- manual save, optional autosave, dirty state, notifications, form lifecycle,
  leave protection, multi-instance ownership, and teardown are deterministic;
- strict type, unit, performance, API, docs, packed consumer, distribution,
  release, browser, license, and security gates pass;
- adversarial review reports Critical = 0 and High = 0.

## Delivered

- a public framework-neutral `EditorSaveWorkflow` with exact canonical source,
  Core revision, opaque host revision tokens, progress, manual/retry reasons,
  explicit saved/conflict results, and runtime validation;
- bounded opt-in debounced autosave, non-overlapping requests, stale-response
  clean-state protection, source preservation on failure/conflict, and
  abort-on-destroy even when an adapter later ignores its signal;
- optional Classic composition with the shared `editor.save` command,
  localized Save/Saving/Retry states, accessible notifications, and
  coordinated multi-instance leave-page protection;
- executable NodeNext and Vite packed saving consumers plus native form, Ajax,
  Node service, React, Vue, multi-instance, modal, and dynamic-field guidance;
- a CKEditor 4 concept migration map that makes the lack of API, plugin, skin,
  and global-registry compatibility explicit;
- 143 passing Chromium scenarios, four desktop/mobile CMS project runs, full
  strict/release/supply-chain gates, and a measured 1,429.13 kB raw / 454.24
  kB gzip global with 11.34 kB standalone CSS.
