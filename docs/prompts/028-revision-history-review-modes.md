# Phase 28 — Revision History and Review Modes

## Status

COMPLETE.

## Goal

Add host-owned draft/saved revisions, bounded semantic comparison, explicit
transaction restoration, and consistent edit/comments-only/readonly policy
without making historical snapshots the live document model.

## Required implementation

1. Add a private development `@soeditor/revisions` package with immutable
   metadata/snapshot types and typed provider/storage boundaries.
2. Keep revision identity, authorization, timestamps, databases, retention,
   and networking host-owned. Validate every adapter result and bound lists,
   source size, comparison output, and rendered source previews.
3. View current, draft, and saved revisions without replacing canonical editor
   content. Compare HTML through source-location-free SoEditor HTML trees and
   canonical Markdown by exact lines.
4. Restore only through an explicit Core transaction carrying searchable
   revision metadata. Reject cross-format restore and leave restored content
   dirty for an explicit host save.
5. Add edit, comments-only, and readonly policies. A general Core readonly
   transition must propagate to every Visual/Source/Markdown projection;
   comments-only permits review through an explicit comments policy hook.
6. Keep current comments untouched while merely viewing a revision. A restore
   is an ambiguous full-document replacement, so linked comments unlink rather
   than guessing positions.
7. Add accessible command-driven UI, a CMS-style in-memory adapter example,
   strict unit/browser tests, large-comparison bounds, failure/race handling,
   lifecycle cleanup, and all repository gates.

## Explicitly deferred

- track changes, suggestions, acceptance/rejection, or branch merging;
- real-time collaboration and conflict resolution;
- a hosted revision database, authentication, retention scheduler, or audit
  service;
- side-by-side WYSIWYG historical rendering or arbitrary executable revision
  previews.

## Definition of Done

- historical viewing never mutates canonical content;
- restore is explicit, transaction-backed, format-safe, and testable;
- all editing surfaces enforce runtime review policy consistently;
- comment viewing/restore behavior is deterministic;
- Critical = 0 and High = 0 after the full relevant gate.
