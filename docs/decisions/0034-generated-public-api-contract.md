# 0034 — Generated public API contract

## Status

Accepted.

## Context

SoEditor exposes 23 aligned packages, preset subpaths, CSS resources, a CLI,
and repeated umbrella/SDK exports. A prose-only classification describes API
families but cannot reliably detect an accidental symbol export, removal, or
declaration change before 1.0.

## Decision

Build declarations remain the release truth. A repository script loads every
manifest-declared TypeScript entry with the TypeScript checker and generates a
committed report containing:

- every exported symbol and whether it is a type, value, or both;
- an explicit stable, experimental, or deprecated classification;
- SHA-256 hashes of every exported declaration, entry declaration, and complete
  package declaration tree;
- declared CSS resources and CLI bins;
- the rule that undeclared subpaths and implementation modules are internal.

The check mode regenerates the report in memory and fails on any difference.
Stable is the default only after the changed report is explicitly reviewed;
the committed snapshot prevents an unreviewed new default-stable symbol from
passing CI. Structured editing/model/operation, node-view, visual-decoration,
and table/media extension surfaces retain their experimental classification.

This report complements rather than replaces packed type/runtime consumers and
behavioral tests. Framework and Node-only packages remain outside the browser
umbrella.

## Consequences

- public API drift is visible and deterministic;
- signature changes are caught even when export names do not change;
- repeated umbrella/SDK exports appear repeatedly because each public entry is
  independently consumable;
- formatting or declaration-emitter changes may require a reviewed hash update;
- experimental APIs remain callable but do not silently acquire the stable 1.x
  promise.
