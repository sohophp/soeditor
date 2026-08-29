# Phase 27 — Mapped Annotations and Comments

## Status

COMPLETE.

## Goal

Prove operation-mapped document annotations through an accessible,
command-driven, host-stored comments workflow without making comments part of
canonical HTML or adding feature behavior to Core.

## Required implementation

1. Add bounded immutable visual-decoration infrastructure in the engine. It
   accepts editing-model ranges, remains non-canonical, supports dynamic
   per-owner replacement, and never exposes projection DOM internals.
2. Add `@soeditor/comments` with immutable range/thread/message snapshots and
   explicit `linked`, `unlinked`, `resolved`, and `deleted` states.
3. Define typed host author, permission, ID, and atomic storage adapters. Keep
   all network/database/backend behavior outside SoEditor packages and
   serialize writes deterministically.
4. Map linked/resolved ranges through validated Visual operations. Convert
   collapsed removed ranges and document changes without precise operations
   (including destructive Source edits and history replay) to explicit
   unlinked states; never guess a new range.
5. Add commands for create, reply, resolve/reopen, delete, open, previous, and
   next. Comments remain separate from HTML clipboard content and content
   history; table/widget selection may target the whole structured block.
6. Add a toolbar entry, accessible docked thread list/composer, keyboard
   navigation, safe plain-text rendering, readonly/permission enforcement, and
   complete lifecycle cleanup.
7. Test mapping, validation, adapter failures/races, source/history policy,
   paragraph and structured ranges, clipboard behavior, accessibility, and
   repeated teardown. Keep all existing gates green.

## Explicitly deferred

- real-time synchronization or conflict resolution;
- track changes, suggestions, and revision comparison;
- comments inside table cells or nested widget editables;
- a hosted comments backend or user directory.

## Definition of Done

- Core remains unchanged and DOM-free;
- annotations are non-canonical and map deterministically or unlink safely;
- a host-owned in-memory adapter example passes real Chromium workflows;
- Critical = 0 and High = 0 after the full relevant gate.
