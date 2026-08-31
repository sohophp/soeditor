# Phase 39 — CMS Rich-Text Semantics and Styles

## Status

COMPLETE.

## Goal

Complete the daily semantic formatting, nested-list, and instance-scoped style
capabilities expected from a CMS editor while keeping the controlled editing
model and transactions authoritative.

## Existing constraints

- Core remains DOM-free; browser selection and rendering stay in Engine.
- Loaded unknown, attributed, or unsupported source is preserved and inert.
- Commands are the only user-facing mutation path and emit editing operations.
- Existing 1.0 public APIs remain compatible; new surfaces are experimental.

## Required implementation

1. Add superscript, subscript, remove-format, horizontal-rule, alignment,
   indent, and outdent commands through focused plugins.
2. Support multi-block inline formatting and deterministic mixed-state queries.
3. Represent nested ordered/unordered lists, bounded depth, list start/marker
   policy, split/merge, Tab/Shift+Tab, clipboard, and history in the model.
4. Add validated per-instance semantic style definitions for inline and block
   targets, with structured targets routed through their existing public
   attribute service.
5. Keep optional color/font/size values allowlisted and serialized from
   explicit model data rather than browser-computed styles.
6. Extend the CMS toolbar and add unit and browser evidence for selection,
   history, clipboard, IME, preservation, and keyboard behavior.

## Explicitly deferred

- arbitrary CSS editing, computed-style capture, office-layout fidelity, and
  production table property UI;
- changing unsupported source merely to make it visually editable.

## Definition of Done

- ordinary CMS formatting is available from the default CMS preset;
- nested lists and styles round-trip deterministically through source;
- all changes remain command/transaction backed and unknown HTML is retained;
- all repository gates pass with Critical = 0 and High = 0.

## Delivered

- Added command plugins and default CMS toolbar entries for superscript,
  subscript, remove-format, horizontal rules, alignment, and indentation.
- Extended the controlled model for cross-block marks, bounded block format,
  nested lists, list start/marker attributes, and safe inline element marks.
- Added Tab/Shift+Tab list behavior, normalized nested-list clipboard output,
  history evidence, and deterministic semantic serialization.
- Added validated per-instance inline, block, and structured semantic styles;
  optional color/background/font/size declarations use an explicit allowlist.
- All 131 Chromium scenarios and repository API, consumer, distribution,
  release, performance, license, and security gates pass.
