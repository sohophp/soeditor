# SoEditor Development Roadmap

## Status

Complete through Phase 16. A repository-owner decision is required before
adding a Post-0.5 phase.

This roadmap begins from the current repository state.

Phases 1–15 are complete.

The SoEditor 0.5 Developer Preview roadmap is complete. Phase 16 was authorized
after that checkpoint to prepare and stabilize the public 0.5.x release line.

The target of this roadmap is **SoEditor 0.5 Developer Preview**.

---

# General Roadmap Rules

Each phase has:

- a Goal;
- Required outcomes;
- Explicitly deferred work;
- Definition of Done.

Implementation details may change as the codebase develops.

The phase goal and product scope must not be changed without updating this roadmap deliberately.

A phase may be divided into internal implementation steps by Codex.

Those steps do not require user approval unless a stop condition from `docs/DEVELOPMENT-POLICY.md` is triggered.

---

# Phase 1 — Core Architecture

## Status

COMPLETE.

## Delivered

Core infrastructure including:

- Editor lifecycle;
- immutable state;
- transactions;
- commands;
- plugin manager;
- event system;
- services;
- configuration;
- public capability boundaries;
- destruction lifecycle guarantees;
- package/distribution foundations.

Phase 1 passed its GO/NO-GO gate.

Do not reopen Phase 1 architecture without a demonstrated requirement from later implementation.

---

# Phase 2 — HTML Document Layer

## Goal

Create the standards-oriented HTML infrastructure that future visual/source editing can depend on.

## Required outcomes

Implement `@soeditor/html`.

Provide:

- parse5-based internal parser;
- SoEditor-owned HtmlTree types;
- document parsing;
- fragment parsing;
- source locations;
- parser diagnostics;
- comments;
- doctypes;
- custom elements;
- custom attributes;
- SVG;
- MathML;
- template-element support;
- semantic serialization;
- parse → serialize → parse semantic round-trip tests.

parse5 types must not leak into public APIs.

## Existing implementation specification

The repository already contains:

```text
docs/prompts/002-html-document-layer.md
```

Use that document as the detailed Phase 2 specification.

## Explicitly deferred

Do not implement:

- visual editing;
- contenteditable engine;
- source editor;
- toolbar;
- Markdown;
- preview;
- general tree editing API.

## Definition of Done

- Critical review findings: 0
- High review findings: 0
- semantic preservation tests pass;
- malformed HTML behavior is tested;
- custom elements survive round trips;
- comments survive;
- SVG/MathML behavior is tested;
- source locations are usable;
- npm package public API is clean;
- lint/typecheck/test/build pass.

---

# Phase 3 — Minimal Visual Editing Engine

## Goal

Prove that SoEditor can visually edit structured HTML without reverting to uncontrolled DOM mutation.

## Required outcomes

Implement the first usable visual editing surface.

Initially support only a minimal document subset:

```text
paragraph
text
strong
emphasis
basic line/paragraph behavior
```

Establish:

- editing surface abstraction;
- contenteditable integration;
- DOM ↔ editing representation synchronization;
- mutation boundaries;
- input handling;
- controlled document updates;
- selection bridge foundation;
- HTML-layer integration.

The emphasis is correctness of architecture rather than feature count.

## Required scenarios

At minimum:

- type text;
- insert paragraph;
- backspace;
- delete;
- basic selection;
- basic bold/italic structure representation;
- load HTML;
- edit;
- serialize HTML.

## Explicitly deferred

Do not yet implement:

- complete toolbar;
- image;
- table;
- CodeMirror;
- Markdown;
- preview;
- command palette;
- complicated widgets.

## Definition of Done

- no uncontrolled authoritative DOM model;
- no deprecated `document.execCommand()` dependency;
- custom/unknown HTML is not silently destroyed;
- Visual → document → HTML works;
- basic selection survives normal editing;
- Critical = 0;
- High = 0;
- verification passes.

---

# Phase 4 — Selection, History, Clipboard, Editing Transactions

## Goal

Make the visual editing engine reliable enough for normal feature development.

## Required outcomes

Implement or stabilize:

- structured selection model;
- DOM selection bridge;
- transaction integration;
- undo;
- redo;
- transaction grouping;
- keyboard editing semantics;
- clipboard copy;
- clipboard paste;
- basic paste normalization;
- delete/backspace edge cases;
- paragraph splitting/merging.

History must be shared with editor state rather than delegated blindly to browser undo.

## Explicitly deferred

- advanced table selection;
- collaboration;
- comments;
- track changes.

## Definition of Done

- undo/redo deterministic;
- selection behavior covered by tests;
- paste cannot bypass core preservation/security boundaries;
- normal typing/history behavior is usable;
- Critical = 0;
- High = 0.

---

# Phase 5 — Core Rich-Text Feature Plugins

## Goal

Build common rich-text functionality through the plugin and command architecture.

## Required plugins/features

Implement:

```text
Paragraph
Heading
Bold
Italic
Underline
Strike
Link
Ordered List
Unordered List
Blockquote
Inline Code
Code Block
```

Then add:

```text
Image
Basic Table
```

only after basic text/block features are stable.

## Requirements

Features must:

- register commands;
- avoid adding feature methods directly to Editor;
- integrate with selection/history;
- serialize through HTML infrastructure;
- preserve unsupported HTML around them.

## Definition of Done

A realistic article can be created visually using common formatting.

Critical = 0.

High = 0.

---

# Phase 6 — Source Editing

## Goal

Make HTML source editing a first-class SoEditor mode.

## Preferred dependency

Use CodeMirror 6 unless an accepted ADR provides a compelling alternative.

## Required outcomes

Implement:

- source mode;
- CodeMirror integration;
- HTML syntax highlighting;
- source ↔ document synchronization;
- source diagnostics integration;
- mode switching;
- source error handling;
- preservation of user source on invalid/recoverable input;
- last-valid visual document behavior where appropriate.

## Important UX rule

Invalid source must not be silently rewritten merely because Visual mode cannot accept it.

The source editor must remain the authoritative view of what the user typed until a deliberate transformation occurs.

## Definition of Done

Users can:

```text
Visual → Source → edit → Visual
```

with predictable behavior and diagnostics.

Critical = 0.

High = 0.

---

# Phase 7 — HTML Diagnostics and Formatting

## Goal

Turn SoEditor source editing into a developer-oriented HTML environment.

## Required outcomes

Implement extensible diagnostic providers.

Initial diagnostics should include:

- parser diagnostics;
- malformed HTML issues;
- selected structural warnings.

Introduce HTML formatting.

Preferred formatter:

```text
Prettier
```

unless an accepted ADR changes the implementation.

Required commands include conceptually:

```text
document.validate
document.format
```

## Problems model

Provide infrastructure for:

```text
severity
message
code
source range
provider
```

UI may remain minimal until Phase 8.

## Definition of Done

Diagnostics can be produced independently of a specific UI.

Formatting operates through commands/services rather than direct UI logic.

Critical = 0.

High = 0.

---

# Phase 8 — Editor UI System

## Goal

Provide the reusable configurable UI foundation.

## Required outcomes

Implement:

- toolbar;
- toolbar groups/separators;
- buttons;
- dropdowns;
- menus where required;
- dialogs;
- floating/balloon UI where required;
- notifications;
- status region;
- keyboard shortcut registration;
- theme variables;
- light/dark support foundation.

UI must remain framework-agnostic.

Do not introduce React/Vue/Svelte as editor architecture dependencies.

## Toolbar configuration

Support a simple configuration conceptually similar to:

```ts
toolbar: [
    'undo',
    'redo',
    '|',
    'heading',
    '|',
    'bold',
    'italic',
    'link',
    '|',
    'image',
    'table',
    '|',
    'source',
    'preview',
];
```

## Definition of Done

A normal CMS integration can configure a functional toolbar without rebuilding SoEditor.

Critical = 0.

High = 0.

---

# Phase 9 — Preview Environment

## Goal

Provide isolated realistic content preview.

## Required outcomes

Implement:

- preview command/mode;
- sandboxed iframe;
- content CSS;
- preview CSS;
- preview template;
- preview context;
- safe lifecycle;
- refresh on content changes;
- clear execution/security policy.

Example target:

```ts
preview: {
    css: [
        '/site.css',
        '/article.css'
    ],

    template: `
        <!doctype html>
        <html>
        <body>
            <main>
                {{ content }}
            </main>
        </body>
        </html>
    `
}
```

The exact API should be defined through implementation and ADR.

## Definition of Done

Applications can preview editor content inside a real page-like template without leaking preview styles into the editor UI.

Critical = 0.

High = 0.

---

# Phase 10 — Markdown

## Goal

Make Markdown a first-class content workflow.

## Required outcomes

Choose a mature Markdown parser through an ADR.

Implement:

- Markdown document format;
- Markdown source editing;
- Markdown preview;
- Markdown ↔ structured representation bridge where practical;
- raw HTML passthrough;
- explicit lossiness rules.

Do not promise perfect HTML ↔ Markdown round-trip preservation.

## Definition of Done

A user can intentionally create/edit a Markdown document and preview it.

Critical = 0.

High = 0.

---

# Phase 11 — Developer Tools

## Goal

Make SoEditor clearly differentiated from ordinary rich-text editors.

## Required outcomes

Implement, as architecture allows:

- Problems panel;
- element path;
- status bar;
- command palette;
- HTML inspector;
- basic document outline;
- Find/Replace integration;
- navigation from diagnostics to Source mode.

Suggested command palette shortcut:

```text
Ctrl/Cmd + Shift + P
```

## Optional if inexpensive

- split Visual/Source view;
- Source/Preview split view.

Split view may be deferred if it requires destabilizing editing synchronization.

## Definition of Done

Developer workflows are meaningfully better than using a traditional WYSIWYG source textarea.

---

# Phase 12 — File Manager and SoFinder Integration

## Goal

Create a generic media/file-management integration boundary and prove it with SoFinder.

## Required outcomes

Define a generic FileManager service/capability.

Conceptually:

```ts
interface FileManager {
    open(options: FileManagerOpenOptions): Promise<FileManagerResult | null>;
}
```

Build image/media features against this capability.

Provide a SoFinder adapter without making SoFinder a core dependency.

Likely package:

```text
@soeditor/adapter-sofinder
```

## Definition of Done

The Image feature can use either:

- SoFinder;
- a simple custom FileManager implementation;

without changing the Image plugin.

Critical = 0.

High = 0.

---

# Phase 13 — Plugin SDK, Contribution Model, and Presets

## Goal

Make third-party extension development practical.

## Required outcomes

Stabilize public plugin extension points.

Where justified, support declarative contributions such as:

```text
commands
toolbar
menus
shortcuts
diagnostics
formatters
status bar
```

Provide presets:

```text
classic
minimal
developer
markdown
```

Document plugin compatibility rules.

If valuable, provide plugin scaffolding:

```bash
npm create soeditor-plugin
```

but do not let scaffolding delay API stabilization.

## Definition of Done

An external package can add a meaningful feature without importing internal SoEditor modules.

Critical = 0.

High = 0.

---

# Phase 14 — Distribution and Integration Hardening

## Status

COMPLETE.

## Goal

Prepare SoEditor for practical external consumption.

## Required outcomes

Harden:

- npm package exports;
- ESM;
- tree shaking;
- TypeScript declarations;
- browser bundlers;
- Vite consumption;
- NodeNext TypeScript consumption where applicable;
- CDN/browser bundle;
- CSS distribution;
- source maps.

Provide straightforward npm usage.

Example:

```ts
import { SoEditor } from '@soeditor/editor';
```

Provide browser/CDN usage where practical.

Do not make browser global APIs the architectural source of truth.

## Optional

Add lightweight React/Vue wrappers only if the core public API is stable enough and implementation cost is low.

These wrappers are not required for 0.5.

## Definition of Done

A clean external project can install and run SoEditor through documented public APIs without importing repository internals.

---

# Phase 15 — SoEditor 0.5 Release Hardening

## Status

COMPLETE.

## Goal

Produce a coherent Developer Preview rather than a collection of individually working packages.

## Required outcomes

Perform:

- cross-package integration testing;
- real browser testing;
- accessibility checks for editor UI;
- bundle-size review;
- performance profiling;
- memory/leak review;
- lifecycle stress tests;
- documentation review;
- API-surface review;
- package-consumer tests;
- CDN smoke test;
- example CMS integration;
- SoFinder integration example.

Create or update:

- main README;
- getting started guide;
- configuration guide;
- plugin guide;
- source-editing guide;
- preview guide;
- migration/status notes.

## Playground

The playground should demonstrate at least:

```text
Classic editor
Developer editor
Source mode
HTML diagnostics
Preview
Markdown
Image/FileManager
SoFinder adapter
```

## Release gate

0.5 release requires:

```text
Critical = 0
High = 0
```

Known Medium issues must be documented and judged acceptable for a Developer Preview.

---

# Phase 16 — 0.5.x Publication and Stabilization

## Status

COMPLETE.

## Delivered

- 15 aligned MIT-licensed ESM packages published at version `0.5.1` under the
  `@soeditor/*` scope;
- owner-approved umbrella package `@soeditor/editor` published with npm and
  jsDelivr consumer verification;
- protected manual publication, clean CI, packed-manifest, security, bundle,
  accessibility, lifecycle, and post-publication quality gates;
- documented 0.5.x release, recovery, deprecation, and maintenance procedures.

## Goal

Turn the verified local Developer Preview into a reproducible public 0.5.x
release line and strengthen the operational quality gates around it.

## Required outcomes

- complete npm repository/homepage/bugs/engine/publication metadata;
- add CI for clean installation and the full release gate;
- add an explicit, manually authorized npm publication workflow;
- verify packed manifests and a publication dry run;
- audit production dependencies against the canonical npm advisory endpoint;
- strengthen bundle, accessibility, performance, and lifecycle regression
  evidence where gaps remain;
- document release, rollback/deprecation, and 0.5.x maintenance procedures;
- verify the real npm and CDN artifacts after publication.

License selection and npm authentication remain repository-owner decisions.
No agent may invent a license, publish with unknown authority, or expose a
credential.

## Definition of Done

- all local and CI release checks pass with Critical = 0 and High = 0;
- a repository-owner-selected license is present;
- `@soeditor/editor` and its scoped supporting packages are published from the
  verified commit;
- clean npm and direct-CDN consumers pass against the registry artifacts;
- remaining Medium/Low risks are documented for the 0.5.x line.

---

# Post-0.5 Candidate Work

These features are outside the autonomous 0.5 roadmap.

Do not begin them automatically.

Possible future work includes:

- split-view refinements;
- custom visual components/widgets;
- accessibility diagnostics;
- SEO diagnostics;
- advanced tables;
- collaboration;
- comments;
- track changes;
- AI integrations;
- template-language extensions;
- source-preserving incremental serialization;
- framework-specific wrappers;
- 1.0 API stabilization.

They require a new roadmap decision.
