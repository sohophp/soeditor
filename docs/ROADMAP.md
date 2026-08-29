# SoEditor Development Roadmap

## Status

Complete through Phase 29. The verified 0.8.0 candidate is awaiting
owner-authorized publication. The evidence-derived 0.7–1.0 roadmap is approved
and Phase 30 is active.

This roadmap begins from the current repository state.

Phases 1–15 are complete.

The SoEditor 0.5 Developer Preview roadmap is complete. Phase 16 was authorized
after that checkpoint to prepare and stabilize the public 0.5.x release line.

The completed public target is **SoEditor 0.5 Developer Preview** and its
stabilized `0.5.1` release. The active development target is **SoEditor 0.9
Integration Release**.

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

---

# SoEditor 0.6 Roadmap — Developer Workflow

## Status

COMPLETE. The repository owner authorized implementation through the 0.6 to
1.0 development sequence on 2026-08-29. The 0.6 implementation and local
release candidate gates are complete; publication remains owner-controlled.

## Release theme

SoEditor 0.6 should deepen the existing developer-first editing workflow
without replacing the 0.5 document, transaction, history, or security
architecture. The release combines two product promises already anticipated by
the product definition:

```text
actionable HTML quality diagnostics
                 +
synchronized split editing and preview layouts
```

The sequence deliberately starts with independent diagnostic plugins, then
introduces persistent projections before adding layout UI. This keeps
feature-specific policy outside Core and proves synchronization behavior before
presentation depends on it.

## Approval and activation record

The repository owner approved this 0.6 scope as part of the continuing goal to
complete SoEditor 0.6 through 1.0. Activation consists of:

1. changing Phases 17–22 from `PROPOSED` to the appropriate active/pending
   statuses;
2. updating `docs/DEVELOPMENT-POLICY.md` so Phase 17 is the current phase and
   Phase 22 is the autonomous endpoint;
3. deriving `docs/prompts/017-accessibility-seo-diagnostics.md` from the
   approved roadmap, product definition, accepted ADRs, and actual APIs;
4. completing the normal implementation, adversarial review, Critical/High
   fix, and release-gate cycle before advancing to Phase 18.

This approval does not by itself authorize npm publication, tags, or GitHub
releases; those remain separately protected operations.

## Candidate prioritization

| Candidate                                | 0.6 decision | Reason                                                                                                                      |
| ---------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Accessibility diagnostics                | Include      | Extends the existing provider/Problems contracts and directly serves the developer-first product identity.                  |
| SEO diagnostics                          | Include      | Shares the source-oriented diagnostic path while remaining an independent plugin capability.                                |
| Split view                               | Include      | Completes the planned Visual/Source/Markdown/Preview workflow using the canonical document as the synchronization boundary. |
| Custom widgets and advanced tables       | Defer        | Require a larger editable-schema, selection, clipboard, and widget-lifecycle design.                                        |
| Collaboration, comments, track changes   | Defer        | Require an operation/annotation model beyond bounded source-snapshot history.                                               |
| AI and template-language execution       | Defer        | Introduce separate provider, trust, privacy, and execution decisions.                                                       |
| Incremental serialization                | Defer        | Is a foundational preservation/performance project and is not required for safe split projections.                          |
| Framework wrappers and 1.0 stabilization | Defer        | Follow evidence from a stronger framework-agnostic 0.6 API and real consumers.                                              |

## Release-wide constraints

- `@soeditor/core` remains DOM-free and does not acquire diagnostic, layout, or
  third-party analysis dependencies.
- Canonical source in `EditorDocument` remains the only cross-projection data
  authority.
- Split layouts have exactly one writable primary projection at a time.
  Secondary projections remain visible and synchronized but readonly; focus or
  an explicit command may transfer write authority.
- Invalid exact HTML source continues to lock the visual writer to its last
  valid model. A split layout must not normalize invalid source through another
  projection.
- Preview remains an empty-sandbox `srcdoc` boundary. Split view does not grant
  scripts, same-origin access, navigation, forms, or new execution capability.
- Accessibility and SEO diagnostics are bounded source-analysis aids, not
  claims of WCAG conformance, legal compliance, search ranking, or complete
  rendered-page analysis.
- Diagnostic providers remain plugins and publish only SoEditor-owned problem
  and source-range types.
- Unknown/custom HTML preservation and inert unsafe-content rendering remain
  unchanged.
- Normal editor actions remain commands and document mutations remain Core
  transactions.
- No React, Vue, Svelte, Angular, or application framework becomes an editor
  dependency.

---

# Phase 17 — Accessibility and SEO Diagnostics

## Status

COMPLETE.

## Goal

Add independent, source-oriented accessibility and SEO diagnostic plugins on
the existing `DiagnosticsService` extension point.

## Required outcomes

- implement bounded rule sets over public `@soeditor/html` trees without
  executing or injecting canonical HTML;
- keep accessibility and SEO providers independently installable and
  configurable;
- publish stable provider IDs, diagnostic codes, severities, messages, and
  accurate source ranges where the parser exposes them;
- distinguish fragment checks from complete-document checks and avoid warnings
  that require unavailable page/application context;
- support per-instance immutable rule configuration using existing editor
  configuration boundaries;
- document precisely what each rule can and cannot infer;
- add normal, malformed, unknown-element, namespaced, template, adversarial,
  concurrency, teardown, and Node/browser consumer tests.

## Explicitly deferred

- automatic fixes or source mutation;
- dynamic CSS/layout, color-contrast, focus-order, screen-reader, or
  script-rendered page analysis;
- claims of full WCAG, legal, Lighthouse, or search-engine compliance;
- remote crawling, network requests, analytics, or ranking estimates.

## Definition of Done

- providers compose with parser, structural, and third-party diagnostics in
  deterministic registration order;
- stale asynchronous results never replace current-document problems;
- rules do not execute preserved content or discard unknown HTML;
- public APIs expose no parse5 or other implementation types;
- Critical = 0, High = 0, and all repository verification passes.

---

# Phase 18 — Diagnostics Workflow and Problems UX

## Status

COMPLETE.

## Goal

Turn the expanded provider set into an efficient, accessible developer
workflow without coupling diagnostics to a particular editing surface.

## Required outcomes

- add explicit manual and opt-in debounced validation policies with cancellation
  or stale-result suppression;
- expose provider/severity filtering and stable problem counts through narrow
  services and generic UI contributions;
- enhance the Problems experience with accessible grouping, empty/loading/error
  states, keyboard navigation, and source reveal where a range exists;
- make provider failures observable while allowing independent providers to
  finish according to a documented isolation policy;
- keep validation read-only and prevent background work after destruction;
- demonstrate parser, structural, accessibility, SEO, and third-party
  diagnostics together in the Developer Playground.

## Explicitly deferred

- quick fixes, bulk source mutation, or formatter coupling;
- worker infrastructure without measured main-thread need;
- a general task scheduler in Core;
- diagnostics for Markdown, CSS, JavaScript, or remote pages.

## Definition of Done

- validation remains deterministic under rapid document changes, provider
  rejection, unregister, and editor destruction;
- the Problems workflow is usable by keyboard and passes automated WCAG A/AA
  regression checks;
- Core and generic UI remain unaware of HTML rule semantics;
- Critical = 0, High = 0, and all repository verification passes.

---

# Phase 19 — Persistent Projection Coordination

## Status

COMPLETED on 2026-08-30.

## Goal

Allow supported surfaces to remain mounted and visible outside their legacy
single-mode visibility policy while preserving one canonical source and one
writable projection.

## Required outcomes

- define a small framework-agnostic projection-activity contract outside Core
  for `visible`, `primary`, and `readonly` surface state;
- adapt Visual, HTML Source, Markdown, and Preview engines through narrow public
  options/services rather than private cross-package access;
- retain current single-mode behavior as the default and preserve existing
  public configuration compatibility;
- transfer primary write authority only through commands or documented focus
  activation, never through direct state mutation;
- synchronize canonical changes into every visible projection without feedback
  loops, duplicate history entries, selection corruption, or hidden network
  refreshes;
- specify behavior for invalid HTML, readonly editors, complete documents,
  Markdown format, destruction, duplicate attachment, and activation races;
- record the long-lived projection coordination decision in an ADR.

## Explicitly deferred

- layout DOM, splitters, pane persistence, or responsive design;
- simultaneous multi-writer editing;
- shared cross-surface selections or cursor mirroring;
- collaboration or operational transformation/CRDT infrastructure.

## Definition of Done

- existing single-mode consumers remain behaviorally compatible;
- exactly one attached projection can accept user mutations at a time;
- invalid exact source cannot be overwritten by a recovered visual model;
- all projection/lifecycle race tests pass with Critical = 0 and High = 0.

---

# Phase 20 — Accessible Split-View Layouts

## Status

COMPLETED on 2026-08-30.

## Goal

Provide framework-independent, command-driven split layouts for the supported
projection pairs.

## Required outcomes

- support `Visual | Source`, `Source | Preview`, and `Markdown | Preview`;
- provide horizontal/vertical orientation, bounded resizers, keyboard resizing,
  pane labels, focus management, collapse/restore, and responsive fallback;
- represent user-triggerable layout changes as commands shared by toolbar,
  shortcuts, palette, and host code;
- keep application ownership of surface hosts and Preview security
  configuration explicit;
- ensure the secondary pane is synchronized and readonly until authority is
  deliberately transferred for editable pairs;
- clean up only layout-owned DOM/listeners and make retained layout services
  terminal after destruction;
- add real-browser accessibility, rapid-switching, resize, readonly, invalid
  source, and repeated-lifecycle tests.

## Explicitly deferred

- arbitrary IDE-style docking or unbounded pane graphs;
- persisted workspace management across editor instances;
- more than two simultaneous projections;
- collaborative cursors or simultaneous editing.

## Definition of Done

- all three supported pairs pass end-to-end synchronization and lifecycle
  tests;
- split controls pass automated WCAG A/AA checks and documented keyboard paths;
- no layout action bypasses commands or changes canonical content directly;
- Critical = 0, High = 0, and all repository verification passes.

---

# Phase 21 — 0.6 SDK, Presets, Documentation, and Distribution

## Status

COMPLETE.

## Goal

Expose only the intentional 0.6 extension surface and prove that diagnostics
and split workflows remain configurable, tree-shakeable, and consumable.

## Required outcomes

- curate new diagnostic and projection/layout contracts through their owning
  package roots and `@soeditor/plugin-sdk` only where third-party authors need
  them;
- update Developer presets without making DOM hosts, layout attachment, or
  Preview policy implicit;
- update the umbrella, browser global, CSS, package exports, declarations,
  source maps, and bundle guards deliberately;
- add Playground demonstrations for manual/automatic quality diagnostics and
  all supported split pairs;
- document migration from 0.5, configuration, rule scope, split-view ownership,
  accessibility, security, teardown, npm, and CDN usage;
- test packed NodeNext/native ESM/Vite consumers and narrow imports so unused
  diagnostic/layout families tree-shake out.

## Explicitly deferred

- framework adapters;
- plugin scaffolding CLI;
- automatic mounting or global mutable registries;
- undocumented internal subpath exports.

## Definition of Done

- public API classification and package ownership are explicit;
- clean consumers exercise supported package roots with strict TypeScript;
- distribution budgets are measured and justified;
- Critical = 0, High = 0, and all repository verification passes.

---

# Phase 22 — SoEditor 0.6 Release Hardening

## Status

COMPLETE.

## Goal

Produce one coherent 0.6 Developer Preview candidate and verify upgrade,
browser, package, security, and operational behavior.

## Required outcomes

- align all public packages on one 0.6 release version under SemVer;
- publish a 0.5-to-0.6 migration guide and classify every public API change;
- run bundle, dependency, accessibility, performance, memory/leak, lifecycle,
  documentation, and API-surface reviews;
- test Classic, Developer, Markdown, CMS/SoFinder, diagnostics, and split-view
  routes in real Chromium;
- verify packed npm consumers, browser global/CSS/maps, CDN behavior, and the
  protected publication dry run;
- perform the normal adversarial review, fix all Critical/High findings, and
  record accepted Medium/Low limitations.

License, credentials, publication, tags, and releases remain explicit
repository-owner-controlled operations.

## Definition of Done

- the 0.6 candidate has Critical = 0 and High = 0;
- lint, strict typecheck, unit, packed-consumer, distribution, release,
  Chromium, security-audit, and build gates pass locally and in clean CI;
- migration, status, architecture, ADR, package, and operational documentation
  agree with the implementation;
- real registry/CDN publication is complete only after separately authorized
  protected publication and external verification.

---

# SoEditor 0.7–1.0 Roadmap — Extensible Production Editor

## Status

APPROVED from the repository owner's 2026-08-29 authorization to complete
SoEditor 0.6 through 1.0 and the Phase 22 evidence review. Phase 34 is active.

The sequence is justified in
`docs/research/editor-landscape-2026.md`. Each release must pass its own
adversarial and release gate before the next release begins.

## Cross-release rules

- Preserve unknown HTML independently from visual support and execution.
- Keep Core DOM-free, small, instance-scoped, transaction-authoritative, and
  framework-independent.
- New content behavior is plugin-contributed; UI invokes commands.
- Public editing types are SoEditor-owned and do not expose a third-party
  editor, parser, CRDT, or framework runtime.
- Do not promise lossless HTML/Markdown conversion or arbitrary executable
  previews.
- npm publication, tags, hosted releases, license changes, and external service
  credentials remain owner-controlled.

---

# Phase 23 — Extensible Structured Editing Foundation

## Status

COMPLETE.

## Goal

Replace the closed 0.6 visual schema with a bounded plugin contribution model
for structured HTML while preserving unknown and unsupported source.

## Required outcomes

- define immutable SoEditor-owned structured node, attribute, selection, and
  position types needed by demonstrated features;
- define deterministic feature-owned schema and source conversion
  contributions with duplicate/conflict validation;
- distinguish editable, atomic/readonly, and opaque-preserved content;
- add granular structured operations and position mappings needed by current
  editing, history, and future annotations without moving DOM into Core;
- retain exact Source replacement and last-valid Visual behavior;
- migrate existing visual/rich-text features without breaking public 0.6 data
  APIs or silently normalizing unknown HTML;
- document the architectural decision and prove semantic round trips,
  transaction/history behavior, malformed input, and lifecycle cleanup.

## Explicitly deferred

- public node-view DOM factories, advanced tables/media, comments, collaboration,
  and framework adapters;
- a universal HTML DTD or arbitrary CSS execution;
- speculative operations not required by migrated features.

## Definition of Done

- third-party schema/conversion contributions can represent a custom structured
  element using only public SoEditor types;
- existing supported content remains editable and unknown content remains
  preserved/inert;
- Critical = 0, High = 0, and all repository gates pass.

---

# Phase 24 — Node Views and Widget Runtime

## Status

COMPLETE.

## Goal

Let plugins render and interact with structured atomic blocks and bounded
nested editables without giving the editing DOM authority over canonical data.

## Required outcomes

- host-scoped framework-neutral node-view factories with explicit lifecycle;
- atomic block/inline selection, keyboard entry/exit, deletion, copy/paste, and
  drag/drop transaction rules;
- nested editable proof only where selection/history mapping is deterministic;
- command/service-based attribute editing and contextual UI integration;
- inert rendering and explicit security policy for unknown or unsafe markup;
- a reference custom-element widget preserving meaningful attributes/source.

## Explicitly deferred

- React/Vue node-view runtimes, arbitrary nested editors, remote component
  execution, and simultaneous writers.

## Definition of Done

- an external-style plugin can implement an accessible custom widget without
  private engine access;
- teardown, focus, readonly, history, clipboard, and source synchronization pass
  real-browser tests;
- Critical = 0, High = 0.

---

# Phase 25 — Production Tables and Media

## Status

COMPLETE.

## Goal

Use the 0.7 extension model for the first production-grade structured features.

## Required outcomes

- table row/cell/header structure, rectangular selections, row/column
  insertion/removal, merge/split rules, keyboard navigation, clipboard, and
  accessible semantics;
- figure/image/media widgets with captions, alt text, dimensions, and typed
  FileManager integration;
- preserve unsupported table/media attributes and children without executing
  unsafe content;
- command parity across toolbar, keyboard, palette, and third-party UI;
- large table and repeated widget lifecycle budgets.

## Explicitly deferred

- spreadsheet formulas, arbitrary embeds, uploads owned by Core, and office
  paste parity.

## Definition of Done

- tables and media prove the same public extension path available to third-party
  widgets;
- accessibility, source round trips, history, clipboard, readonly, and teardown
  pass Chromium;
- Critical = 0, High = 0.

---

# Phase 26 — SoEditor 0.7 SDK and Release Hardening

## Status

COMPLETE.

## Goal

Curate and verify the 0.7 structured-extension surface and migration.

## Required outcomes

- public API classification, plugin SDK contracts, examples, and packed
  third-party widget consumer;
- 0.6-to-0.7 migration, package/version alignment, bundle and dependency review;
- complete release, browser, accessibility, security, performance, and
  adversarial gates.

---

# Phase 27 — Mapped Annotations and Comments

## Status

COMPLETE.

## Goal

Prove operation-mapped document annotations through an accessible, host-stored
comments workflow.

## Required outcomes

- immutable annotation/range types mapped across supported transactions;
- explicit linked, unlinked, resolved, and deleted comment-thread states;
- typed author/permission/storage adapter boundaries with no backend in Core;
- inline and sidebar UI, keyboard navigation, commands, source-mode policy,
  widgets/tables, copy/paste, history, and teardown behavior;
- safe handling of ambiguous destructive Source edits.

## Explicitly deferred

- real-time synchronization, track changes, and a hosted comments service.

---

# Phase 28 — Revision History and Review Modes

## Status

COMPLETE.

## Goal

Add host-owned revisions, comparison, restoration, and review permissions
without turning snapshots into the live editing model.

## Required outcomes

- typed revision provider/storage interfaces and immutable metadata;
- current/draft/saved revision viewing, semantic comparison, and explicit
  transaction-based restore;
- edit, readonly, and comments-only policies enforced consistently by commands
  and surfaces;
- comments/annotations behavior across revision viewing and restore;
- CMS adapter example and bounded large-document comparison budgets.

## Explicitly deferred

- track changes/suggestions, branch merging, and real-time collaboration.

---

# Phase 29 — SoEditor 0.8 Review Workflow Release

## Status

COMPLETE.

## Goal

Harden the mapped-annotation and asynchronous review platform as 0.8.

## Required outcomes

- SDK/storage-adapter consumers, 0.7-to-0.8 migration, security/privacy review,
  accessibility and lifecycle verification;
- explicit data ownership/export/deletion semantics;
- aligned packages, release dry run, adversarial review, and owner-controlled
  publication boundary.

## Delivered

- public comments/revisions package roots and curated SDK/umbrella exports;
- immutable versioned review-data exports, explicit tombstone semantics,
  permission-checked permanent comment erasure, and optional host-confirmed
  revision erasure;
- packed 19-package storage-adapter consumers, migration/privacy/security
  guidance, lifecycle/accessibility regression, and latest-wins revision list
  consistency;
- aligned `0.8.0` artifacts, full release gates, npm dry run, unpublished
  registry preflight, and Critical 0 / High 0 adversarial review.

---

# Phase 30 — Framework-neutral Workspace and Recovery

## Status

COMPLETE.

## Goal

Make complete editor configurations mountable, recoverable, and observable
without hiding application ownership or adding a framework to editor packages.

## Required outcomes

- an application-layer workspace controller for explicit surface/layout/service
  creation and reverse-order teardown;
- controlled value/uncontrolled initial-value policies and loop prevention;
- opt-in bounded recovery using creator/destructor callbacks, last known
  canonical source, crash-rate limits, and observable terminal failure;
- no global registries, DOM discovery, or silent unsaved-data loss.

## Delivered

- a private Core-only `@soeditor/workspace` controller with explicit ordered
  attachment factories, partial-startup cleanup, reverse teardown, and abort
  signals;
- controlled and uncontrolled value policies, external feedback suppression,
  microtask owner notification, and latest-owner-value handling during
  recovery;
- opt-in source-preserving recovery with a bounded sliding crash window and
  observable ready/recovering/failed/destroyed snapshots;
- 10 focused unit tests, three Chromium workflows, axe coverage, an executable
  demo, synchronized documentation, and Critical 0 / High 0 review.

---

# Phase 31 — React and Vue Adapters

## Status

COMPLETE.

## Goal

Provide thin official framework adapters over the workspace controller.

## Required outcomes

- separate `@soeditor/react` and `@soeditor/vue` packages with peer framework
  dependencies only in their owning adapters;
- strict-mode/remount, prop updates, readonly, controlled/uncontrolled,
  suspense/error-boundary, teardown, and SSR-import safety tests;
- no framework components in Core, engine, feature, UI, or SDK packages.

## Delivered

- private `@soeditor/react` and `@soeditor/vue` packages with framework peers
  isolated to their owning adapters;
- controlled/uncontrolled inputs, readonly updates, React StrictMode
  serialization and Error Boundary propagation, and Vue Composition API
  lifecycle;
- Node SSR render tests, a real React/Vue Chromium lifecycle and axe workflow,
  executable demo, and Critical 0 / High 0 review.

## Explicitly deferred

- Angular/Svelte adapters until independent demand is demonstrated.

---

# Phase 32 — Plugin Tooling and Integration Diagnostics

## Status

COMPLETE.

## Goal

Reduce extension setup errors without introducing a hosted marketplace.

## Required outcomes

- a versioned plugin-package scaffold/check command using public SDK templates;
- manifest, peer range, duplicate ID, contribution, tree-shaking, and packed
  consumer checks;
- workspace/runtime diagnostics for missing services, incompatible formats,
  unsafe Preview policy, and failed recovery;
- no remote code loading or mutable global plugin catalog.

## Delivered

- private Node-only `@soeditor/plugin-tools` with a versioned strict ESM 0.9
  SDK scaffold, CLI/API entry points, and no-overwrite creation;
- read-only manifest/source checks plus script-disabled packed inspection for
  peer range, exports, plugin identity, public-root imports, tree shaking, and
  required artifacts;
- an actual generated plugin build, tarball, clean NodeNext type consumer, and
  runtime lifecycle proof;
- immutable Workspace attachment requirements and bounded diagnostics for
  format, service, Preview isolation, recreation, and crash limits;
- focused unit/browser coverage, synchronized docs, ADR, and Critical 0 / High
  0 adversarial review.

---

# Phase 33 — SoEditor 0.9 Integration Release

## Status

COMPLETE.

## Goal

Harden workspace ownership, recovery, framework adapters, tooling, and
large-document behavior as the final pre-1.0 integration line.

## Required outcomes

- 0.8-to-0.9 migration and framework/CMS examples;
- measured input, projection, annotation, table, bundle, startup, teardown, and
  recovery budgets;
- dependency, API, accessibility, browser, SSR-import, security, and
  adversarial reviews;
- aligned package dry run and owner-controlled publication boundary.

## Delivered

- aligned 23-package `0.9.0` release candidate with public Workspace, React,
  Vue, and Node-only plugin-tooling package roots;
- packed NodeNext/native ESM/Vite/framework/CLI consumers, SSR-safe adapter
  imports, declaration maps, and explicit peer/dependency boundary audits;
- deterministic Node and real-Chromium large-document, projection, annotation,
  table, recovery, startup, teardown, and bundle regression budgets;
- synchronized migration, framework, CMS, performance, public API, release,
  architecture, and ADR documentation;
- full lint, strict typecheck, unit, consumer, distribution, release, 122-test
  Chromium, accessibility, license, security, npm dry-run, and registry
  preflight gates with Critical 0 / High 0.

---

# Phase 34 — 1.0 Public API Stabilization

## Status

ACTIVE.

## Goal

Classify, simplify, and freeze the evidence-backed public platform.

## Required outcomes

- inventory every package-root export as stable, experimental, deprecated, or
  internal and remove accidental surfaces through documented migrations;
- define compatibility, deprecation, browser/Node/framework support, security,
  and maintenance policies;
- freeze canonical lifecycle, transaction, command, plugin, service, schema,
  conversion, node-view, annotation, workspace, and adapter contracts;
- publish API reports and compile representative 0.9 integrations unchanged.

---

# Phase 35 — 1.0 Qualification and Documentation

## Status

PENDING.

## Goal

Qualify the stable API with production-scale evidence and complete learning
paths.

## Required outcomes

- end-to-end ordinary author, HTML developer, CMS, widget, table/media, review,
  React, and Vue scenarios;
- accessibility testing beyond automated axe where the environment permits,
  security threat review, failure recovery, memory/lifecycle, and large-document
  performance evidence;
- versioned guides, API reference, examples, migration chain from 0.5, and
  troubleshooting/operations documentation;
- no unsupported claim of WCAG certification, perfect preservation, or
  real-time collaboration.

---

# Phase 36 — SoEditor 1.0 Release Candidate and Hardening

## Status

PENDING.

## Goal

Produce one coherent 1.0 release candidate from the frozen APIs.

## Required outcomes

- aligned 1.0 package versions, changelog, licenses, export maps, declarations,
  maps, CSS, ESM/global builds, framework packages, and provenance metadata;
- clean frozen-install CI and packed NodeNext/ESM/Vite/React/Vue consumers;
- complete browser, accessibility, security, dependency, bundle, performance,
  lifecycle, documentation, and adversarial gates;
- Critical = 0 and High = 0; accepted Medium/Low limitations documented;
- npm publication, tags, hosted release, and external CDN verification remain
  explicit owner-authorized actions.

## Explicit non-goals for 1.0

- built-in real-time collaboration or CRDT/OT backend;
- track changes/suggestion mode;
- AI authoring, arbitrary remote widgets, hosted marketplace, or arbitrary
  docking;
- byte-for-byte HTML preservation or lossless HTML/Markdown conversion.
