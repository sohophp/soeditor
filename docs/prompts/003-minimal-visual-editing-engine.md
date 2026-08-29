# Phase 3 Implementation Specification — Minimal Visual Editing Engine

## Status

Active implementation specification for Phase 3 of `docs/ROADMAP.md`.

This document is subordinate to `AGENTS.md`, accepted ADRs, `docs/PRODUCT.md`,
`docs/architecture.md`, `docs/ROADMAP.md`, and
`docs/DEVELOPMENT-POLICY.md`.

## Goal

Implement the first browser editing surface in `@soeditor/engine` and prove
that structured HTML can be edited without making the live DOM authoritative.

The supported editable subset is deliberately small:

```text
paragraph
text
strong
emphasis
```

Unknown or unsupported HTML must remain preserved as structured data.

## Existing constraints

- `@soeditor/core` remains DOM-free and framework-independent.
- HTML source remains the canonical persistence representation.
- `@soeditor/html` remains the parser/serializer boundary; parse5 types do not
  enter engine public APIs.
- User changes flow through Core transactions.
- The engine must not use `document.execCommand()`.
- Parsing/preservation is not permission to execute source HTML.
- Phase 1 destruction remains terminal.

## Package responsibility

Implement the browser-dependent engine in `@soeditor/engine`.

The package may depend on:

```text
@soeditor/core
@soeditor/html
```

Core must not depend on the engine or browser APIs.

## Public API

Expose a small deliberate API centered on a visual editing engine and its
selection snapshot. A normal consumer must be able to:

1. create an `Editor`;
2. attach a visual engine to an `HTMLElement`;
3. read or set the engine selection where representable;
4. destroy the engine independently and idempotently.

Do not expose internal editing nodes, DOM maps, renderers, input handlers, or
mutable implementation state from the package root.

## Controlled editing representation

Maintain a SoEditor-owned short-lived editing representation derived from the
`@soeditor/html` fragment tree.

It must:

- represent paragraphs as editable blocks;
- represent text with active `strong`/`em` marks;
- retain unsupported nodes as opaque immutable HTML-tree values;
- retain comments and custom attributes;
- serialize back through `@soeditor/html`;
- avoid stable UUID infrastructure in this phase.

DOM nodes are a projection and selection bridge only. Browser mutations must
not become the source of truth.

## Safe visual projection

Render supported nodes using explicit DOM construction.

Unsupported nodes must use inert, non-editable placeholders associated with
their preserved structured values. Do not inject preserved scripts, event
handlers, embeds, or arbitrary unknown markup into the editing surface.

The placeholder may show a concise element/comment label. Its purpose is data
preservation and visible boundary behavior, not rich widget support.

## Input boundary

Use `beforeinput` as the primary controlled input boundary.

Handle at minimum:

```text
insertText
insertParagraph
deleteContentBackward
deleteContentForward
formatBold
formatItalic
```

For handled operations:

1. prevent the browser's default DOM mutation;
2. read selection through the selection bridge;
3. apply an editing-model operation;
4. serialize the next model;
5. dispatch a Core transaction with `origin: 'user'`;
6. update the DOM projection and restore selection.

Unsupported mutating input types must not be allowed to silently mutate the
authoritative projection. Prevent them unless an explicitly safe native path
is established.

## Required editing behavior

Support:

- inserting text at a collapsed caret;
- replacing a basic text selection;
- splitting a paragraph;
- merging adjacent editable paragraphs with Backspace/Delete;
- deleting backward/forward within text;
- preserving mark structure while typing;
- toggling strong/emphasis over a basic selection;
- loading canonical HTML and projecting it;
- synchronizing external Core document changes back into the engine;
- serializing visual edits to canonical HTML.

Selection across unsupported opaque content may be rejected or constrained in
this phase, but must never delete that content accidentally.

## Selection bridge foundation

Define a structured, DOM-independent selection snapshot using paragraph/model
positions rather than exposing native `Selection` or `Range` as public state.

The bridge must:

- map supported DOM positions into model positions;
- map model positions back into a DOM range;
- preserve a normal caret after controlled rerendering;
- represent anchor/focus direction where practical;
- fail safely when the browser selection is outside the owned surface.

Advanced affinity, bidi, vertical movement, and table/widget selection are
deferred.

## Synchronization and lifecycle

- Subscribe to Core document changes and rebuild the projection for external
  source updates.
- Avoid a parse feedback loop for the engine's own known transaction when a
  validated next model is already available.
- Engine destruction removes listeners, clears owned DOM, disables further
  engine operations, and is idempotent.
- Destroying the engine does not destroy the Core editor.
- Destroying Core must leave the engine unable to commit later user changes.

## Readonly

Honor `editor.state.readonly` for user-facing input. A readonly surface may
display content and selection but must not dispatch user editing changes.

Administrative `editor.setData()` behavior remains unchanged.

## Errors

Use descriptive engine-owned errors for invalid lifecycle use or selection
requests where a typed error materially improves the API.

Do not silently swallow parse, synchronization, or transaction failures.

## Tests

Add pure unit tests for model conversion and operations, including:

- paragraph/text conversion;
- nested strong/emphasis marks;
- text insertion and selection replacement;
- paragraph split/merge;
- backspace/delete edges;
- mark toggling;
- comments and custom/unknown element preservation;
- script/event-handler preservation without projection execution;
- malformed-but-recovered HTML;
- model semantic round trips;
- lifecycle misuse and readonly behavior where separable from the browser.

Add real-browser tests for:

- loading HTML into a contenteditable surface;
- typing text;
- Enter paragraph splitting;
- Backspace and Delete;
- a basic range selection;
- strong/emphasis representation;
- external `setData()` synchronization;
- unknown/custom element preservation;
- selection restoration;
- destroy cleanup.

Browser tests must not rely exclusively on jsdom.

## Playground

Update the existing playground only enough to demonstrate the minimal visual
surface and canonical source/state. Do not build the Phase 8 toolbar.

## Documentation and ADR

Update `docs/architecture.md` to describe the implemented engine only.

Create an ADR for the controlled editing representation, inert unknown-node
projection, and `beforeinput` transaction boundary because these are long-lived
architectural decisions.

## Explicitly deferred

Do not implement:

- history/undo/redo;
- clipboard handling or paste normalization;
- advanced selection;
- complete keyboard semantics;
- headings, lists, links, underline, strike, images, or tables;
- feature plugins or toolbar UI;
- CodeMirror/source mode;
- diagnostics UI or formatting;
- preview;
- Markdown;
- command palette;
- general HtmlTree mutation API.

## Verification

Run at minimum:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Also run:

- packed NodeNext/Node ESM consumer checks already in the repository;
- the real-browser editing suite.

## Adversarial review

After normal verification, perform the development-policy review with special
attention to:

- DOM becoming authoritative through an unhandled mutation path;
- loss of unsupported/custom HTML;
- execution of preserved unsafe markup;
- selection corruption after rerender;
- edits crossing opaque boundaries;
- lifecycle callbacks after destruction;
- accidental browser or parse5 types in public declarations.

Fix all Critical and High findings, then perform one focused final gate.

## Definition of Done

- typing, paragraph insertion, Backspace, Delete, and basic selection work in a
  real browser;
- strong/emphasis structure is represented and preserved;
- visual edits update canonical HTML through Core transactions;
- unknown/custom HTML is not silently destroyed or executed;
- the DOM is not the authoritative document model;
- no `document.execCommand()` dependency exists;
- public declarations are deliberate and clean;
- Critical = 0 and High = 0;
- all required verification passes.
