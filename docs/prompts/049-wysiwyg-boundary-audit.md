# Phase 49 — WYSIWYG Boundary Audit and Dedicated Harness

## Status

Active. Authorized by the repository owner on 2026-08-31 as the first phase of
the complete Phase 49–56 WYSIWYG program.

## Goal

Make WYSIWYG a separately owned, separately configured, and directly tested
HTML editing product before further feature work. Developer Visual behavior or
tests cannot qualify WYSIWYG behavior.

## Required work

1. Record the owner and direct evidence state of every current WYSIWYG behavior
   in `docs/wysiwyg-capability-matrix.md`.
2. Confirm the WYSIWYG engine never constructs or delegates to Developer
   Visual. Shared framework-neutral editing contracts remain allowed.
3. Move WYSIWYG-specific behavior and mutable interaction state out of Classic
   assembly where practical; Classic may mount UI and wire public services.
4. Add a WYSIWYG-only Playground entry and browser suite. The baseline must
   directly cover paragraphs, nested lists, tables, links, images, preserved
   unknown HTML, Source synchronization, readonly, and teardown.
5. Use `WYSIWYG` and `Developer Visual` consistently in active UI and docs.
6. Keep `wysiwyg` and `visual` as explicit, independent application
   configuration values.

## Direct evidence rule

A capability is not verified by a command-only test, a Source string assertion,
or a Developer Visual scenario. Evidence must exercise the WYSIWYG surface and
assert both the visible editing result and canonical HTML where applicable.

## Explicitly deferred

- selection/input repairs owned by Phase 50;
- new inline formatting, list, or link behavior owned by Phase 51;
- production table repairs owned by Phase 52;
- upload, media, and paste expansion owned by Phase 53;
- Source/Preview/layout work owned by Phase 54;
- final UI, accessibility, configuration, and release qualification work.

## Definition of Done

- no WYSIWYG engine path constructs or delegates to Developer Visual;
- every current WYSIWYG capability has an owner, state, and direct test gap;
- a WYSIWYG-only fixture and browser suite run without enabling Developer
  Visual;
- no Developer Visual test is the sole cited evidence for WYSIWYG;
- documentation audit, lint, typecheck, unit, browser, and build checks pass.

## Constraints

- Follow ADR 0038 and `docs/wysiwyg-editor.md`.
- Preserve HTML-first, command-driven, plugin-first, small-core boundaries.
- Do not copy implementation code from CKEditor, TinyMCE, Jodit, or another
  editor. Their public behavior may be used as comparison evidence only.
- Do not broaden Phase 49 into deferred feature repair.
