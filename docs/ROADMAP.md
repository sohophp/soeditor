# SoEditor CMS WYSIWYG Roadmap

## Status

Implementation roadmap, reset on 2026-09-01 and completed through automated
qualification on 2026-09-01.

Phases 1–57 are implementation and release history. They remain useful evidence
but no longer define future product breadth. The active roadmap starts at Phase
58 and is governed by `AGENTS.md`, `docs/PRODUCT.md`, and
`docs/wysiwyg-editor.md`.

## Program objective

Produce one dependable, lightweight CMS HTML editor:

- as easy to embed and as responsive as a focused editor such as Jodit 4;
- as predictable in long-running CMS workflows as CKEditor 4;
- internally separated into model, view, conversion, commands, transactions and
  plugins using lessons from CKEditor 5;
- narrower than the historical SoEditor platform.

No active phase may add AI, collaboration, review workflows, Markdown, page
building, email authoring, or IDE-like developer tooling.

## Phase 58 — Product Surface and Dependency Reduction

### Status

COMPLETE.

### Goal

Make the default installation and bundle represent only the CMS WYSIWYG product.

### Required outcomes

- create a narrow supported CMS entry and browser global;
- map the runtime import graph and record raw, gzip and parsed module costs;
- remove Markdown, comments, revisions, Developer Visual, Preview, layouts,
  React, Vue and plugin tooling from the default entry and default preset;
- remove email-analysis, email-optimization, generic video/media and other
  nonessential controls from the default toolbar;
- keep HTML Source behind an explicit option and lazy boundary;
- classify every package as default CMS runtime, optional CMS integration,
  compatibility-only, development-only, or removal candidate;
- publish deprecation/migration guidance before breaking a released package;
- replace historical all-features global size as the primary performance metric
  with the actual CMS artifact.

### Definition of Done

- a clean Vite consumer importing the documented default API cannot resolve or
  bundle excluded product families;
- the CMS browser global contains no excluded feature strings or modules;
- default and Source-enabled bundles are measured independently;
- all P0 CMS acceptance journeys still pass;
- no public compatibility removal occurs without explicit SemVer handling.

## Phase 59 — Editing Stability Consolidation

### Status

COMPLETE.

### Goal

Consolidate duplicated Visual/WYSIWYG behavior around one production authoring
surface and eliminate fragile edge cases.

### Required outcomes

- audit selection capture/restoration across toolbar, menus and dialogs;
- normalize beforeinput, composition, deletion, Enter, Tab and clipboard paths;
- ensure every document mutation uses one command/transaction/history path;
- reduce whole-document reparsing and rerendering during ordinary input;
- preserve native browser spelling, selection and caret behavior where safe;
- verify multiple instances, readonly transitions, form reset, startup failure,
  destroy during async upload and repeated mount/unmount;
- remove obsolete Developer Visual code from the default product path and plan
  its compatibility lifecycle separately.

### Definition of Done

- no Critical or High issue in selection, input, IME, undo, clipboard, form or
  lifecycle scenarios;
- focused Chromium, Firefox and WebKit suites pass without engine-specific test
  weakening;
- ordinary typing does not serialize or replace the complete document unless a
  demonstrated operation requires it;
- transaction and DOM ownership are documented and tested.

## Phase 60 — CMS Feature Completion and Simplification

### Status

COMPLETE.

### Goal

Finish existing everyday features and remove duplicate, decorative or confusing
controls.

### Required outcomes

- complete image property UI for alt, caption, dimensions, ratio, alignment,
  replacement, responsive source and link behavior;
- audit link creation/edit/unlink, target/rel, anchors, files and internal
  targets as one coherent dialog workflow;
- audit tables from insertion through cell editing, headers, row/column changes,
  merge/split, properties, paste and keyboard navigation;
- simplify formatting groups, list/property menus and contextual controls;
- keep page break, special character, semantic style and configured CMS objects
  only when they have complete commands and direct UI proof;
- remove dead commands, duplicate buttons, demo-only options and unreachable
  configuration;
- make upload and file-manager integrations optional and provider-neutral.

### Definition of Done

- every visible default control has one clear purpose, command and browser test;
- the capability matrix contains no default `In progress` item;
- cancel/failure paths preserve selection and content;
- each accepted dialog edit is one undo step;
- unknown CMS HTML survives every relevant round trip.

## Phase 61 — Classic CMS UX, Accessibility and Integration Polish

### Status

COMPLETE for implementation and automated qualification. Manual assistive
technology evidence remains a release sign-off item.

### Goal

Make common CMS tasks fast and unsurprising without adding new product families.

### Required outcomes

- refine toolbar grouping, overflow, sticky/collapse policy and touch targets;
- make link, image and table editing require fewer interactions;
- retain focus, announce errors, restore focus and avoid context UI obstruction;
- complete textarea, form submit/reset, Ajax save, readonly and dirty-state
  examples without requiring a framework adapter;
- verify localization, Chinese IME, RTL isolation, zoom, forced colors, reduced
  motion and screen-reader semantics;
- make advanced and rarely used controls opt-in rather than default clutter;
- provide a compact CMS configuration reference and CKEditor 4/Jodit migration
  examples.

### Definition of Done

- continuous author tasks pass on desktop and narrow/mobile viewports;
- keyboard-only operation reaches every default action;
- automated WCAG checks pass and manual assistive-technology results are
  recorded honestly;
- integration requires no knowledge of Workspace, projections or internal
  packages.

## Phase 62 — Lightweight Performance and Release Qualification

### Status

IMPLEMENTED. Chromium desktop/mobile gates and budgets are complete. Firefox
and WebKit require the maintained CI image because the current host lacks their
runtime libraries. Real Safari and manual assistive-technology sign-off remain
external qualification items and are not represented as completed here.

### Goal

Freeze a measured lightweight CMS release rather than an all-features platform
release.

### Required outcomes

- measure cold/warm startup, first editable time, input latency, selection,
  paste, dialog opening, table operations, Source lazy load, memory and teardown;
- test representative 10 KiB, 100 KiB and 500 KiB CMS HTML documents;
- eliminate duplicate parsing, redundant listeners, unnecessary observers,
  repeated toolbar state scans and avoidable complete-surface renders;
- establish separate budgets for default ESM, CMS browser global, optional
  Source chunk and CSS;
- prevent optional compatibility packages from entering default artifacts;
- run real Safari and manual keyboard/screen-reader qualification;
- update the release, support and migration documents to the reduced product.

### Frozen budgets

- CMS global: at most 500 kB raw and 150 kB gzip;
- CMS CSS: at most 27 kB raw;
- no default CMS bundle may grow from its measured baseline without explicit
  product review;
- no ordinary input operation may adopt a new full-document render path;
- repeated create/destroy must not show retained instance-owned listeners,
  observers, tasks or DOM;
- the historical 649.71 kB gzip all-features global is explicitly unacceptable
  as the future CMS product artifact.

### Definition of Done

- all lint, type, unit, browser, security, consumer, distribution and build gates
  pass;
- default and optional costs are published separately;
- Critical = 0 and High = 0;
- remaining browser or assistive-technology limitations are explicit;
- publication and versioning remain an owner decision.

## Package disposition policy

Phase 58 maintains one checked inventory with these categories:

| Category                 | Meaning                                                          |
| ------------------------ | ---------------------------------------------------------------- |
| Default CMS runtime      | Required to create and operate the normal WYSIWYG editor         |
| Optional CMS integration | Explicitly imported upload, picker, Source or host adapter       |
| Compatibility-only       | Previously public non-CMS feature; no active feature development |
| Development-only         | Tests, fixtures, migration verification and build tooling        |
| Removal candidate        | No required CMS use and no supported compatibility justification |

Deletion follows evidence and SemVer. Default-path removal does not wait for
physical package deletion.

The maintained inventory is [package-disposition.md](package-disposition.md).

## Permanent decision filter

Before scheduling any feature, answer all of these:

1. Is it required to edit website CMS HTML content?
2. Does it improve a demonstrated author or integrator task?
3. Can it remain outside Core and outside default startup when optional?
4. Does it preserve unknown HTML and the security boundary?
5. Is its bundle, latency, memory and maintenance cost measured?
6. Can the complete workflow be tested in real browsers?

If any answer is no, do not add it to the active roadmap.
