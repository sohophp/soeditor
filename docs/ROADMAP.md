# SoEditor Development Roadmap

## Status

Complete through Phase 48. SoEditor 1.0.0 is published and externally verified.
The aligned SoEditor 1.1.0 CMS Classic Editor candidate is prepared locally but
has not been published, tagged, or turned into a hosted release.

This roadmap begins from the current repository state.

Phases 1–15 are complete.

The SoEditor 0.5 Developer Preview roadmap is complete. Phase 16 was authorized
after that checkpoint to prepare and stabilize the public 0.5.x release line.

The completed stable target is **SoEditor 1.0.0**. The completed local
development target is **SoEditor 1.1 CMS Classic Editor Foundation**. The next
completed target is the **post-1.1 WYSIWYG completion program** in Phases 49–56.
The repository owner authorized completion of the full program on 2026-08-31.
Phase 56 records a conditional release decision: integration may continue, but
production publication remains blocked on Firefox and WebKit/Safari execution
in a compatible environment.

The WYSIWYG program is governed by `docs/wysiwyg-editor.md`. Existing
Developer Visual features and historical CMS qualification do not automatically
count as completed WYSIWYG features.

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
document.minify
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
SoEditor 0.6 through 1.0 and the Phase 22 evidence review. Phase 36 is complete.

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

COMPLETE.

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

## Delivered

- generated inventory for all 23 public packages, declared preset subpaths,
  CSS resources, and the plugin CLI, with 816 stable, 121 experimental, and no
  deprecated symbol entries across independently consumable roots;
- per-symbol signature, entry declaration, and complete package declaration-
  tree hashes with deterministic build-and-check commands in the normal gate;
- explicit 1.x SemVer, deprecation, Node/browser/framework, security, and
  maintenance policies while retaining undeclared subpaths as internal;
- unchanged packed 0.9 NodeNext/native ESM/Vite/React/Vue/plugin/CMS/browser
  consumers plus the complete release and 122-scenario Chromium gates;
- Critical 0 / High 0 adversarial review with unqualified browsers,
  experimental surfaces, and hash-toolchain sensitivity documented.

---

# Phase 35 — 1.0 Qualification and Documentation

## Status

COMPLETE.

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

## Delivered

- production qualification for public authoring, source, Markdown, Preview,
  CMS, widget, table/media, review, Workspace, React, and Vue paths;
- deterministic keyboard/focus, contrast, forced-colors, reduced-motion, CSP
  nonce, lifecycle, explicit-GC memory, and large-document evidence;
- security, operations, troubleshooting, qualification, API overview, and
  0.9-to-1.0 migration guides with a local-link documentation audit;
- full lint, strict typecheck, unit, performance, API, documentation, packed
  consumer, distribution, release, 126-test Chromium, license, security,
  npm dry-run, and registry preflight gates with Critical 0 / High 0.

---

# Phase 36 — SoEditor 1.0 Release Candidate and Hardening

## Status

COMPLETE.

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

## Delivered

- aligned root, 23 public packages, packed consumer fixtures, release scripts,
  documentation, and generated plugin template at `1.0.0` / SDK 1.x;
- template version 2 for new third-party plugins, with the checker enforcing a
  compatible 1.x SDK peer range;
- frozen-install, lint, strict typecheck, unit, API, documentation, performance,
  packed NodeNext/ESM/Vite/React/Vue/plugin/widget, distribution, release,
  build, and 126-test Chromium gates;
- MIT license, dependency audit, 23-package npm dry-run, and read-only registry
  availability checks with Critical 0 / High 0.

## Explicit non-goals for 1.0

- built-in real-time collaboration or CRDT/OT backend;
- track changes/suggestion mode;
- AI authoring, arbitrary remote widgets, hosted marketplace, or arbitrary
  docking;
- byte-for-byte HTML preservation or lossless HTML/Markdown conversion.

---

# SoEditor 1.1–1.3 CMS Classic Editor Roadmap

The CMS roadmap builds on the published 1.0 platform. It does not replace the
transaction, command, plugin, preservation, lifecycle, or security contracts.
Stable 1.0 APIs remain covered by the documented 1.x compatibility policy.

# Phase 37 — CMS Product Contract and Baseline

## Status

COMPLETE.

## Goal

Make classic CMS rich-text authoring the primary product path and establish
executable evidence for the gaps between the 1.0 platform and that product.

## Required outcomes

- align product, roadmap, status, development policy, architecture, and README
  language around the CMS-first direction;
- define the canonical CMS author journey and a maintained capability matrix;
- record baseline bundle, lifecycle, browser, input, and large-document
  evidence before new features change it;
- specify Phases 38–48 without weakening the frozen 1.0 API contract.

## Explicitly deferred

- feature implementation beyond baseline fixtures and specifications;
- publication or version changes.

## Definition of Done

- documentation checks pass with no conflicting active phase;
- the capability matrix maps every planned feature to an owning phase;
- Critical = 0 and High = 0 in the phase review.

---

# Phase 38 — Classic Editor and Form Integration

## Status

COMPLETE.

## Goal

Provide one application-facing API that mounts a complete classic editor on a
textarea or element and restores the host deterministically.

## Required outcomes

- an additive `@soeditor/editor` classic API over Workspace, UI, Visual, and
  Source without moving DOM ownership into Core;
- textarea initial-value, submit, reset, name/value, disabled/readonly, and
  destroy/restore behavior;
- element-hosted initial data, controlled application updates, focus, blur,
  change, ready, error, and terminal lifecycle behavior;
- placeholder, initial/minimum/maximum height, and bounded auto-grow;
- multi-instance, partial-startup failure, SSR-import, and repeated teardown
  tests.

## Explicitly deferred

- inline-on-focus editing, autosave, uploads, advanced formatting, and Office
  paste.

## Definition of Done

- a traditional form posts the latest canonical HTML with no server changes;
- destroying the editor restores the exact caller-owned host state;
- all repository gates pass with Critical = 0 and High = 0.

---

# Phase 39 — CMS Rich-Text Semantics and Styles

## Status

COMPLETE.

## Goal

Complete the ordinary semantic formatting and list behavior required by CMS
authors without making arbitrary DOM mutation authoritative.

## Required outcomes

- superscript, subscript, remove-format, horizontal-rule, alignment, indent,
  and outdent commands and plugins;
- nested lists, list indentation, ordered-list start/style, deterministic
  split/merge, and Tab/Shift+Tab behavior;
- validated instance-scoped semantic style definitions for inline, block, and
  supported structured targets;
- optional bounded color/font/size features that serialize through explicit
  policy rather than computed DOM state;
- mixed-state command queries, multi-block selection, history, clipboard, and
  IME-safe behavior.

## Explicitly deferred

- arbitrary CSS editing, browser-computed-style capture, and office-layout
  fidelity.

## Definition of Done

- the CMS preset exposes a complete daily-formatting toolbar;
- all edits are commands and transactions; unknown source remains preserved;
- all repository gates pass with Critical = 0 and High = 0.

---

# Phase 40 — External Paste and Drop Pipeline

## Status

COMPLETE.

## Goal

Turn untrusted external clipboard and drop input into deterministic, clean,
configurable CMS HTML while keeping loaded-source preservation separate.

## Required outcomes

- explicit internal, cross-editor, web, plain-text, Office, and file input
  classification;
- plugin-owned paste processors with preserve, semantic, and plain-text
  policies and bounded input/output sizes;
- representative Word, Excel, Google Docs, LibreOffice, browser, and malicious
  fixture corpora;
- semantic headings, marks, links, lists, tables, and optional style retention;
- one undoable transaction, observable rejection, and no executable paste or
  drop path.

## Explicitly deferred

- pixel-identical Office fidelity, formulas, macros, and arbitrary CSS.

## Definition of Done

- fixture output is deterministic and documented losses are explicit;
- internal clipboard fidelity is not degraded by external paste policy;
- all repository gates pass with Critical = 0 and High = 0.

---

# Phase 41 — Upload and Asset Workflow

## Status

COMPLETE.

## Goal

Add host-owned uploads to the existing replaceable FileManager selection
boundary and provide a complete image authoring workflow.

## Required outcomes

- typed UploadService/task tokens with progress, cancellation, validation,
  retry evidence, and terminal cleanup;
- file input, picker, drop, clipboard, Office-image, replace, and remove paths;
- temporary previews with deterministic Blob URL cleanup and transactional
  replacement by validated uploaded assets;
- image alt/title/dimensions/aspect/caption/alignment/responsive-class/link
  properties;
- authentication, storage, authorization, and server processing remain host
  responsibilities.

## Explicitly deferred

- a built-in server, DAM, image optimizer, or SoFinder hard dependency.

## Definition of Done

- success, cancellation, failure, retry, destroy, unsafe result, and concurrent
  upload scenarios pass in real browsers;
- all repository gates pass with Critical = 0 and High = 0.

---

# Phase 42 — Links and CMS Content Objects

## Status

COMPLETE.

## Goal

Make links and commonly inserted CMS objects editable rather than insertion-
only while keeping executable embeds behind explicit boundaries.

## Required outcomes

- create/edit/remove link UI for URL, title, target, rel, email, telephone,
  anchors, file selection, and host-provided internal-content selection;
- safe auto-link and protocol policy with deterministic rel handling;
- special characters, anchors, horizontal/page breaks, placeholders, and
  registered CMS structured objects;
- optional provider-based safe embed metadata without injecting provider HTML
  into the editor UI.

## Explicitly deferred

- arbitrary remote scripts, untrusted iframe execution, and universal embed
  support.

## Definition of Done

- every object is command/transaction backed and source preserving;
- link and embed security tests cover deceptive and executable URLs;
- all repository gates pass with Critical = 0 and High = 0.

---

# Phase 43 — Production Tables and Lists for CMS

## Status

COMPLETE.

## Goal

Extend the bounded 1.0 table/list foundation to common CMS authoring without
claiming spreadsheet behavior.

## Required outcomes

- table, row, column, and cell properties; caption and section controls;
- accessible column resize, table width, alignment, responsive classes, and
  keyboard navigation;
- Excel-style bounded matrix paste integrated with the external paste policy;
- complete nested-list keyboard, start, marker, split, merge, and clipboard
  behavior;
- explicit preservation or refusal for unsupported `colgroup`, nested, and
  attributed structures.

## Explicitly deferred

- formulas, arbitrary nested tables, spreadsheet selection parity, and layout
  engines.

## Definition of Done

- representative table/list CMS tasks work by pointer and keyboard;
- destructive ambiguity is refused without source loss;
- all repository gates pass with Critical = 0 and High = 0.

---

# Phase 44 — Classic UI Completion

## Status

COMPLETE.

## Goal

Deliver a responsive and accessible classic editor chrome suitable for daily
content production.

## Required outcomes

- icon buttons, labels/tooltips, grouped keyboard navigation, wrap/overflow,
  collapse, and sticky policies;
- contextual link/image/table balloons or toolbars and registered context-menu
  contributions;
- maximize, manual resize, bounded auto-grow, responsive layout, and exact
  restoration;
- element path, word/character count, dirty/save status, and clear async
  notifications;
- host-themed CSS variables without leaking editor chrome styles.

## Explicitly deferred

- arbitrary docking, application-framework-owned mounting, and a page builder.

## Definition of Done

- desktop, narrow viewport, zoom, forced-colors, keyboard, and lifecycle gates
  pass;
- all repository gates pass with Critical = 0 and High = 0.

---

# Phase 45 — Localization, IME, Mobile, and Accessibility

## Status

COMPLETE.

## Goal

Make the classic editor usable in multilingual CMS deployments, with Chinese
input and complete keyboard operation as release gates.

## Required outcomes

- per-instance lazy-capable translation resources with English, Simplified and
  Traditional Chinese baseline locales and RTL infrastructure;
- localized toolbar, dialogs, notifications, status, commands, and embedded
  accessibility help;
- composition-safe input/history for major CJK event sequences;
- touch selection, responsive/mobile keyboard behavior, and browser-specific
  failure coverage;
- toolbar groups, dialogs, menus, content objects, element path, and return-to-
  editing focus usable by keyboard and assistive technology.

## Explicitly deferred

- universal language coverage and unsupported claims of WCAG or assistive-
  technology certification.

## Definition of Done

- Chromium, Firefox, and WebKit automation plus documented manual IME and
  screen-reader checks pass where the environment permits;
- all repository gates pass with Critical = 0 and High = 0.

---

# Phase 46 — CMS Save and Integration Workflows

COMPLETE.

## Goal

Provide explicit host-owned saving and representative integration paths from
legacy forms through modern controlled applications.

## Required outcomes

- dirty-state and optional save-adapter contracts with manual save, bounded
  debounce, progress, failure, retry, revision token, and conflict reporting;
- opt-in leave-page protection without global hidden policy;
- vanilla form, Ajax, Node service, React, Vue, multi-instance, modal, and
  dynamic-field examples and packed consumers;
- CKEditor 4 concept-to-SoEditor migration guidance without API or plugin
  compatibility claims.

## Explicitly deferred

- a hosted CMS backend, permissions database, or implicit autosave.

## Definition of Done

- integration consumers submit and recover exact canonical source across
  success and failure paths;
- all repository gates pass with Critical = 0 and High = 0.

---

# Phase 47 — CMS Plugin and Theme Ecosystem

COMPLETE.

## Goal

Make the CMS-specific extension surface documented, testable, and distributable
without remote execution or a hosted marketplace.

## Required outcomes

- public contributions for styles, context menus, contextual UI, paste
  processors, upload adapters, content pickers, translations, and CMS objects;
- versioned scaffold templates and checks for the supported contribution types;
- theme variables, icon replacement, content-style separation, high-contrast,
  and host isolation examples;
- packed third-party CMS widget, paste, upload, and theme consumers.

## Explicitly deferred

- remote plugin loading, trust certification, or a hosted marketplace.

## Definition of Done

- third-party fixtures use only documented public roots and survive packing;
- all repository gates pass with Critical = 0 and High = 0.

---

# Phase 48 — CMS Production Qualification and Release

COMPLETE.

## Goal

Qualify and prepare one coherent SoEditor CMS release line from the completed
classic authoring workflow.

## Required outcomes

- end-to-end load, CJK input, Office paste, lists, upload, links, tables,
  Source, history, form/save, and destroy scenarios;
- Chromium, Firefox, WebKit, narrow/mobile, accessibility, security, CSP,
  lifecycle, memory, large-document, paste, upload, bundle, and API evidence;
- complete CMS configuration, integration, migration, troubleshooting,
  security, operations, and plugin documentation;
- aligned versions, packed consumers, licenses, declarations, maps, CSS,
  ESM/global builds, dry run, and adversarial review.

## Explicitly deferred

- publication, tags, and hosted releases without explicit owner authorization;
- collaboration, track changes, a page builder, arbitrary execution, and
  spreadsheet parity.

## Definition of Done

- every planned CMS capability is proven by direct executable evidence;
- Critical = 0 and High = 0; accepted limitations are documented;
- every repository verification and release-preparation gate passes.

---

# Post-1.1 WYSIWYG Completion Program

This program requalifies the current independent native-DOM WYSIWYG baseline as
one coherent author-facing HTML editor. It does not reopen Developer Visual and
does not migrate WYSIWYG behavior back into it.

Every phase follows the feature-completeness definition in
`docs/wysiwyg-editor.md`. A direct command test, a changed Source string, or an
existing Developer Visual test is not sufficient evidence.

# Phase 49 — WYSIWYG Boundary Audit and Dedicated Harness

## Status

COMPLETE.

## Goal

Remove remaining behavioral ownership ambiguity and establish WYSIWYG-only
evidence before adding more features.

## Required outcomes

- inventory every WYSIWYG behavior currently owned by `classic-editor.ts`,
  Developer Visual, rich-text plugins, and `@soeditor/wysiwyg`;
- move WYSIWYG-specific state and behavior behind WYSIWYG services or focused
  plugins while leaving application assembly in Classic;
- complete and maintain the dedicated WYSIWYG capability matrix using its four
  defined states and direct evidence links;
- create WYSIWYG-only browser fixtures for paragraphs, nested lists, tables,
  links, images, unknown HTML, Source synchronization, and readonly mode;
- remove invented phase numbers and ambiguous `Visual` wording from active
  documentation and UI labels;
- ensure application configuration chooses `wysiwyg` and `visual` explicitly.

## Explicitly deferred

- new formatting, table, media, paste, or email breadth.

## Definition of Done

- no WYSIWYG engine path constructs or delegates to Developer Visual;
- no old Developer Visual test is cited as sole WYSIWYG evidence;
- every current WYSIWYG capability has an owner, state, and test gap;
- lint, typecheck, unit, browser, docs, and build gates pass.

# Phase 50 — Selection, Input, Clipboard, and History Correctness

## Status

COMPLETE.

## Goal

Make ordinary browser editing behavior trustworthy before feature expansion.

## Required outcomes

- exact caret placement at every text boundary in body, list item, caption, and
  each table cell;
- forward/reverse pointer drag selection, double-click word selection,
  Shift+Arrow and platform selection behavior;
- Enter, Shift+Enter, Backspace, Delete, replacement, copy, cut, and paste;
- toolbar/dialog selection bookmarks that never jump to another block or cell;
- Chinese IME, emoji, combining characters, RTL, mobile viewport and zoom;
- predictable undo/redo grouping and selection restoration;
- mutation repair, readonly, multi-instance, teardown, and error recovery.

## Explicitly deferred

- broad table structure tools and new media UI.

## Definition of Done

- the dedicated selection corpus passes in Chromium, Firefox, and WebKit where
  the environment can launch them;
- failures are reproduced from real user input, never hidden by synthetic range
  setup alone;
- no P0 selection defect remains open.

# Phase 51 — Text, Blocks, Lists, Links, and Toolbar State

## Status

COMPLETE.

## Goal

Complete daily rich-text authoring consistently across paragraphs, nested list
items, captions, and table cells.

## Required outcomes

- all P0 inline marks, color, background color, font size, and remove format;
- headings, paragraph, blockquote, pre/code, alignment, indentation, and rule;
- complete ordered/unordered nested-list keyboard and clipboard behavior;
- link creation from selected text, collapsed insertion, click-to-edit,
  unlinking, target/rel policy, internal targets, files, and named anchors;
- mixed-selection toolbar state and no formatting-state leakage;
- one command path for body, list, and cell content without cell-only duplicate
  formatting tools.

## Explicitly deferred

- table structure completion and advanced media.

## Definition of Done

- every formatting command passes paragraph, nested-list-item, and table-cell
  UI scenarios plus Source round-trip and undo/redo;
- link boundary, keyboard, security, and existing-link editing scenarios pass.

# Phase 52 — Production WYSIWYG Tables

## Status

COMPLETE.

## Goal

Rebuild and qualify table authoring as ordinary rich content plus explicit
table structure controls, using CKEditor 5 interaction behavior as the primary
reference.

## Required outcomes

- unrestricted normal caret and text selection inside every cell;
- one stable contextual toolbar anchored above the selected table with viewport
  fallback and no content-DOM controls;
- distinct native text selection and explicit rectangular cell selection;
- block and inline rich content, links, lists, and images inside cells;
- insert/delete rows and columns, headers, merge/split, clear, caption, table,
  row, cell and column properties;
- visible and canonical table width, column width, alignment, row height, cell
  alignment, semantic sections, scope, rowspan and colspan;
- Tab navigation, clipboard matrix behavior, Office tables and one-step history;
- property dialogs that read current values, apply visibly, cancel cleanly, and
  preserve the active table/cell;
- unsupported table structures preserved without silent normalization.

## Explicitly deferred

- formulas, sorting, filtering, spreadsheet fill handles, charts, and arbitrary
  nested tables unless separately approved.

## Definition of Done

- every table requirement in `docs/wysiwyg-editor.md` has a real UI test;
- no Critical/High table usability defect remains;
- table behavior passes desktop engines, mobile viewport, keyboard, zoom,
  accessibility, Source synchronization, Preview, and lifecycle gates.

# Phase 53 — Images, Files, Media, Upload, and Paste

## Status

COMPLETE.

## Goal

Provide a complete CMS asset and external-content workflow without coupling the
editor to a backend.

## Required outcomes

- one image dropdown with computer upload, file manager, and URL paths;
- host upload adapter, progress, cancellation, retry, validation, temporary
  preview cleanup, and save boundary;
- double-click image properties, replacement, dimensions, ratio, caption,
  alignment, responsive sources, links, and alt requirements;
- file-link manager and provider-neutral service contracts;
- visible editable video/media boundary with separate playback policy;
- internal/web/plain/Office/Google Docs/LibreOffice paste classification;
- semantic, keep-formatting, and plain-text policies with optional cleanup
  prompt, image policy, cleanup report, and one-step undo;
- complete rich and matrix paste inside table cells.

## Explicitly deferred

- a bundled storage backend, proprietary file manager, video transcoding, and
  arbitrary executable embeds.

## Definition of Done

- packed third-party upload and file-manager consumers pass;
- paste fixture corpus, security, cancellation, offline, Source round-trip and
  browser interaction gates pass.

# Phase 54 — HTML Preservation, Source, Preview, and Mode Layouts

## Status

COMPLETE.

## Goal

Make WYSIWYG coexist predictably with direct HTML control and isolated output
preview.

## Required outcomes

- explicit policy and safe presentation for comments, custom elements, CMS
  markers, scripts, iframe/embed, templates, invalid and unsupported HTML;
- editable boundaries before and after preserved content;
- standard elements such as `aside` render with standard semantics;
- CodeMirror Source with formatting, minification, find/replace, diagnostics,
  correct height and exact canonical synchronization;
- sandboxed Preview with templates, content CSS, web/email clients and maximize;
- all seven WYSIWYG/Source/Preview layouts and clear writer activation icons;
- optional measured best-effort scroll/element synchronization that can be
  disabled without affecting authoring.

## Explicitly deferred

- arbitrary script execution, cross-pane simultaneous writers, and guaranteed
  character-perfect scroll mapping.

## Definition of Done

- all layouts pass writer authority, focus, responsive, resize and teardown;
- preservation and execution security corpora pass without data loss;
- Source-only tools never appear as WYSIWYG formatting actions.

# Phase 55 — WYSIWYG UI/UX, Accessibility, Localization, and Configuration

## Status

COMPLETE.

## Goal

Turn the completed editing capabilities into a coherent configurable product.

## Required outcomes

- consistent icon system, command labels, tooltips, active/disabled state and
  toolbar grouping;
- responsive overflow, keyboard roving focus, contextual placement, dialogs,
  notifications, focus return and touch targets;
- browser-default, article, email, and custom isolated content styles;
- configurable plugins, toolbar, modes, paste, media, table and safety policy
  without rebuilding the editor;
- words, visible characters, source characters, element path and save state;
- English, Simplified Chinese, Traditional Chinese and RTL isolation;
- special-character presets that can be disabled;
- WCAG A/AA automation plus documented keyboard and assistive-tech checks.

## Explicitly deferred

- universal locale coverage and unsupported certification claims.

## Definition of Done

- every visible control is functional, keyboard reachable, localized, and tied
  to a verified command;
- desktop, narrow, mobile, zoom, forced-colors, reduced-motion and lifecycle
  gates pass.

# Phase 56 — WYSIWYG Qualification, Demonstration, and Release Decision

## Status

COMPLETE — the remaining cross-browser release work is tracked in Phase 57.

## Goal

Prove one coherent production WYSIWYG editor and present only verified behavior
in the public demonstration.

## Required outcomes

- a continuous author journey covering input, selection, formatting, lists,
  links, tables, images, upload, paste, Source, Preview, history, save and
  teardown;
- a truthful capability matrix linked to executable evidence;
- root demonstration scenarios for every verified P0 feature;
- Chromium, Firefox, WebKit, mobile viewport, IME, RTL, accessibility, security,
  performance, memory, bundle, API, packed consumer and distribution evidence;
- updated integration, migration, configuration, troubleshooting and security
  documentation;
- explicit go/no-go review with Critical = 0 and High = 0.

## Explicitly deferred

- publication, tags or hosted release without owner authorization;
- collaboration, track changes, spreadsheet parity, page building, arbitrary
  execution and advanced email-client certification.

## Definition of Done

- all P0 WYSIWYG items are `Verified` with direct UI evidence;
- accepted P1/P2 limitations are listed without “complete” wording;
- all repository and release-preparation gates pass;
- the owner receives a release decision, not an automatic publication.

# Phase 57 — Cross-browser WYSIWYG Qualification

## Status

IN PROGRESS — Firefox and WebKit automation passes locally and in GitHub CI;
real Safari/manual assistive-technology sign-off remains pending.

## Goal

Close the browser-engine qualification gap without weakening product assertions
or treating host launch failures as passing evidence.

## Required outcomes

- run the direct WYSIWYG and focused CMS journeys on Firefox and WebKit in a
  maintained compatible environment;
- normalize Shadow DOM selection capture, restoration, link editing, paragraph
  boundary deletion, word counting, and synthetic paste behavior only where
  executable cross-engine evidence demonstrates a difference;
- add an independent Firefox/WebKit CI gate using the repository Node version;
- record browser-tool-specific exclusions explicitly and retain equivalent
  cross-engine composition and paste coverage;
- keep Safari hardware, screen-reader, switch-control, and voice-control claims
  outside automation evidence until manually executed.

## Definition of Done

- every applicable Firefox/WebKit CMS and direct WYSIWYG assertion passes;
- Chromium regression, lint, type, API, package, security, and build gates pass;
- the cross-browser workflow passes on the reviewed commit;
- publication remains an explicit owner decision after residual manual checks.
