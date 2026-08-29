# Phase 4 Implementation Specification — Selection, History, Clipboard, and Editing Transactions

## Status

Active implementation specification for Phase 4 of `docs/ROADMAP.md`.

This document is subordinate to `AGENTS.md`, accepted ADRs, `docs/PRODUCT.md`,
`docs/architecture.md`, `docs/ROADMAP.md`, and
`docs/DEVELOPMENT-POLICY.md`.

## Goal

Make the controlled Phase 3 visual engine reliable enough to support feature
plugins by stabilizing selection behavior, transaction-backed history, keyboard
editing semantics, and clipboard boundaries.

## Existing constraints

- Core remains DOM-free and terminal destruction remains unchanged.
- HTML source remains canonical persistence data.
- The visual DOM remains a controlled projection, never authoritative.
- Unknown/custom HTML and meaningful attributes must not be silently lost.
- Preserved unsafe HTML must not execute in the editing surface.
- User-visible actions use commands where applicable and document changes use
  Core transactions.
- Browser undo and `document.execCommand()` are not authoritative systems.

## History architecture

Implement undo/redo as a plugin-backed capability over committed Core document
transactions.

Provide commands:

```text
editor.undo
editor.redo
```

The history plugin must:

- observe committed document changes;
- store canonical before/after source snapshots and structured selection
  snapshots where supplied by the engine;
- replay through new Core transactions;
- distinguish replay transactions through private, namespaced metadata;
- maintain deterministic undo and redo stacks;
- clear redo after a new non-replay edit;
- expose correct `canExecute()` state;
- clean up commands/listeners through plugin lifecycle;
- avoid browser-native undo state.

The current source-snapshot strategy is acceptable for Phase 4. Do not invent a
speculative persistent operation tree.

## Transaction grouping

Group consecutive compatible user edits when:

- their group type matches (for example typing or repeated deletion);
- the prior after-source is the next before-source;
- the prior after-selection matches the next before-selection;
- they occur inside a small documented time window.

Paragraph operations, paste, cut, formatting, external source replacement, and
selection-discontinuous edits must form separate history entries.

## Selection

Retain the Phase 3 DOM-independent block/UTF-16-offset selection model and
strengthen it for:

- forward and backward ranges;
- cross-paragraph deletion for supported content;
- selection restoration during undo/redo;
- clipboard extraction/insertion;
- safe rejection at opaque boundaries;
- caret restoration after split/merge/paste.

Do not move native `Selection` or `Range` objects into Core state or public
transaction metadata.

## Keyboard semantics

Add controlled handling for:

```text
Mod+Z       undo
Mod+Shift+Z redo
Ctrl+Y      redo where conventional
```

Continue using controlled `beforeinput` behavior for text, paragraph, and
delete operations. Prevent native history from competing with SoEditor history.

Advanced bidi, vertical caret movement, platform-specific word deletion, and
accessibility shortcuts beyond this phase remain deferred.

## Clipboard

Own copy, cut, and paste at the visual surface boundary.

### Copy

- export `text/plain` for supported selected text;
- export semantic `text/html` for supported selected structure;
- never synthesize executable DOM to produce clipboard data;
- reject selections that cannot be represented without crossing opaque data.

### Cut

- perform the same safe clipboard export;
- delete only after clipboard data was produced;
- commit deletion through a user transaction and history entry;
- never delete opaque/custom content implicitly.

### Paste

- prevent native DOM insertion;
- prefer `text/html` when present and otherwise use `text/plain`;
- parse HTML through `@soeditor/html`;
- normalize plain-text line endings and paragraphs;
- insert through the editing model and a Core transaction;
- preserve unknown/custom pasted HTML as inert opaque values;
- ensure scripts/event attributes are not executed in the editing surface;
- reject a paste that cannot preserve content safely.

Basic semantic normalization is required; a broad sanitizer or office-suite
paste cleaner is not.

## Paragraph and deletion edge cases

Cover:

- empty paragraphs;
- beginning/end of document;
- merging adjacent paragraphs;
- selections spanning multiple supported paragraphs;
- surrogate pairs;
- mark boundaries;
- paragraph attributes and opaque inline/block boundaries.

If an operation would silently discard meaningful unsupported attributes or
opaque nodes, reject or constrain it instead.

## Public API

Export only deliberate Phase 4 capabilities such as the history plugin and
history query interface if external consumers genuinely need them.

Keep history records, metadata keys, clipboard adapters, operation helpers, and
DOM mapping internal. Do not export browser clipboard objects as durable editor
state.

## Tests

Add unit tests for:

- history push/undo/redo;
- redo invalidation;
- transaction grouping and group breaks;
- selection restoration metadata;
- command `canExecute()`;
- plugin destruction cleanup;
- multi-paragraph/mark/Unicode deletion edges;
- copy fragment extraction;
- plain-text paste normalization;
- semantic HTML paste;
- unknown/custom/script/event-attribute preservation;
- opaque and attributed-paragraph deletion protection.

Add real Chromium tests for:

- Mod+Z / Mod+Shift+Z and Ctrl+Y;
- grouped typing undo;
- paragraph split/merge undo/redo;
- selection restoration after undo/redo;
- copy and cut MIME data;
- plain-text multiline paste;
- rich HTML paste;
- unsafe/unknown pasted markup remaining inert;
- opaque-boundary cut/delete rejection;
- lifecycle cleanup.

## Documentation and ADR

Update `docs/architecture.md` for implemented Phase 4 behavior. Create an ADR
for transaction-backed history/selection metadata and clipboard normalization
because they are long-lived cross-feature boundaries.

## Explicitly deferred

Do not implement:

- advanced table/widget selection;
- collaboration, comments, or track changes;
- Phase 5 rich-text feature plugins beyond existing strong/emphasis model
  support;
- toolbar or general UI;
- CodeMirror/source mode;
- diagnostics/formatter;
- preview;
- Markdown;
- general-purpose sanitizer;
- office-grade paste cleaning;
- source-preserving incremental serialization.

## Verification and review

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Also preserve packed consumer checks and real-browser tests. Perform the normal
adversarial review/fix/final-gate cycle, focusing on data loss, history
divergence, native undo competition, clipboard execution, opaque boundaries,
and lifecycle cleanup.

## Definition of Done

- undo/redo is deterministic and transaction-backed;
- compatible typing/deletion is grouped predictably;
- selection restoration is covered by tests;
- copy/cut/paste operate through controlled model boundaries;
- paste cannot bypass preservation or execution isolation;
- paragraph/delete edge cases are safe;
- Critical = 0 and High = 0;
- all verification passes.
