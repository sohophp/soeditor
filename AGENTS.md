# AGENTS.md

# SoEditor Repository Instructions

This repository contains **SoEditor**, a developer-first, HTML-first, extensible content editing platform written in TypeScript.

These instructions apply to the entire repository unless a more specific `AGENTS.md` exists in a subdirectory.

Treat these rules as persistent architectural constraints, not temporary task suggestions.

---

# 1. Product Direction

SoEditor is intended to become a modern extensible content editor combining:

- HTML-first content freedom
- plugin-based architecture
- command-driven behavior
- modern TypeScript APIs
- visual editing
- source editing
- Markdown editing
- HTML diagnostics
- formatting
- preview environments
- third-party extension support
- npm and CDN distribution

SoEditor is not intended to be a clone of CKEditor 4, CKEditor 5, TinyMCE, VSCode, or any other editor.

Architectural ideas may be studied, but implementation must remain independent.

---

# 2. Core Principles

The following principles are architectural constraints.

## HTML-first

HTML is a first-class content format.

Unknown or unsupported HTML must not be silently removed merely because SoEditor does not understand it visually.

Preservation and execution are different concerns.

Potentially unsafe HTML may be prevented from executing while still being preserved as source data where appropriate.

---

## Plugin-first

Editor features should normally be implemented as plugins.

Examples:

- bold
- italic
- heading
- links
- images
- tables
- source editing
- Markdown
- preview
- diagnostics
- formatting
- file managers

Do not add feature-specific behavior directly into the editor core unless it is genuinely infrastructure required by multiple independent features.

---

## Command-driven

User-triggerable editor behavior should normally be represented by commands.

Preferred flow:

```text
UI / Shortcut / Plugin
        ↓
     Command
        ↓
   Transaction
        ↓
   Editor State
```

Avoid:

```text
Toolbar button
        ↓
direct DOM/state mutation
```

Toolbar, menus, shortcuts, command palettes, and third-party plugins should be able to invoke the same command.

---

## Small Core

`@soeditor/core` must remain small and framework-independent.

Core responsibilities include infrastructure such as:

- Editor lifecycle
- EditorState
- EditorDocument
- Transactions
- Commands
- Plugins
- Events
- Services
- Configuration
- Errors

Core must not accumulate feature implementations.

---

# 3. Dependency Rules

`@soeditor/core` must not depend on:

- browser DOM APIs
- React
- Vue
- Svelte
- Angular
- CodeMirror
- Monaco
- Prettier
- Markdown parsers
- HTML formatting libraries
- file managers
- preview implementations
- UI component libraries

Core should be usable in Node.js and browser environments where practical.

---

# 4. UI Framework Policy

SoEditor core and primary editor architecture must remain framework-agnostic.

Do not introduce React, Vue, Svelte, Angular, or another application UI framework into the editor core.

Framework adapters may eventually exist as separate packages, for example:

```text
@soeditor/react
@soeditor/vue
```

but those packages must not become architectural dependencies of the editor itself.

---

# 5. State Rules

Editor state must not be freely mutable from arbitrary features.

State changes should flow through explicit APIs and transactions.

Prefer immutable editor state.

Do not expose internal mutable structures as public APIs.

Avoid global mutable state.

Each editor instance must have independent:

- state
- commands
- plugins
- services
- events
- configuration

---

# 6. Transaction Rules

Document-changing operations should be representable through transactions.

Do not allow plugins or UI components to bypass the transaction layer simply because direct mutation is easier.

When designing transaction APIs:

- start small
- implement only operations required by current behavior
- avoid speculative AST operation systems
- keep room for future selection/history integration

Do not build hypothetical abstractions without a demonstrated requirement.

---

# 7. Plugin Rules

Plugins must use explicit lifecycle APIs.

Expected lifecycle conceptually:

```text
construct
    ↓
init
    ↓
all plugins initialized
    ↓
ready
    ↓
editor running
    ↓
destroy
```

Plugin dependencies must be explicitly declared.

Plugin loading must detect:

- duplicate IDs
- dependency cycles
- missing/incompatible requirements where applicable

Plugins should communicate through stable editor APIs, commands, events, services, or documented extension points.

Avoid direct access to private implementation details of another plugin.

---

# 8. Service Rules

Cross-feature capabilities should use service abstractions instead of hard dependencies when appropriate.

Example:

```text
Image Plugin
     ↓
FileManager service
     ↑
SoFinder Adapter
```

The Image plugin must not need to know whether the implementation is:

- SoFinder
- CKFinder
- S3
- Cloudflare R2
- a CMS file manager
- another custom implementation

Prefer typed service tokens when practical.

---

# 9. HTML Preservation

SoEditor must distinguish between:

```text
unknown
invalid
unsafe
unsupported visually
```

These are not equivalent.

An unknown custom element such as:

```html
<product-card product-id="123"></product-card>
```

must not automatically be deleted.

A feature may provide a richer visual representation later through a plugin.

Do not silently normalize away meaningful attributes, custom elements, comments, or CMS markers unless an explicitly documented normalization policy requires it.

SoEditor does not need to guarantee byte-for-byte HTML preservation.

The intended goal is semantic preservation.

---

# 10. Security

HTML preservation does not mean arbitrary HTML execution.

Treat these as separate concerns:

```text
preservation
rendering
execution
```

Potentially dangerous content such as scripts, event-handler attributes, unsafe URLs, or executable embeds must not be allowed to execute simply because the source is preserved.

Preview and rendered environments must eventually have explicit security boundaries.

Do not weaken browser security controls for convenience.

---

# 11. Source Editing

Source editing is a first-class feature, not a fallback textarea.

When source editing is implemented, use a mature code editor engine rather than rebuilding syntax editing infrastructure.

Current preferred direction:

```text
CodeMirror 6
```

Do not add CodeMirror until the milestone explicitly requires source editing.

---

# 12. Visual Editing

Do not build the architecture around deprecated `document.execCommand()` behavior.

Do not make raw DOM mutation the authoritative document model.

Visual editing will eventually require an intermediate editing representation and controlled synchronization.

Do not prematurely implement the complete visual editing engine during unrelated milestones.

---

# 13. Markdown

Markdown is intended to become a first-class document format.

Do not treat Markdown merely as an HTML export utility.

When implemented, use a mature parser.

Do not implement a custom Markdown parser unless there is a compelling documented architectural reason.

HTML ↔ Markdown is not required to be perfectly lossless.

Raw HTML passthrough may be used where appropriate.

---

# 14. Preview

Preview is intended to support:

- custom CSS
- content CSS
- preview templates
- CMS-like page rendering

Preview content must eventually be isolated from the editor UI.

Preferred architecture:

```text
Document
    ↓
Preview Renderer
    ↓
Template
    ↓
sandboxed iframe
```

Do not inject arbitrary preview HTML/CSS directly into the main editor UI DOM.

---

# 15. Public API Discipline

Explicitly distinguish:

```text
public
internal
experimental
```

Only intentionally supported API should be exported from package roots.

Do not use broad barrel exports that accidentally expose internal modules.

Avoid:

```ts
export * from './everything';
```

when it would expose implementation details.

Public APIs should have stable TypeScript types and appropriate TSDoc.

---

# 16. TypeScript Rules

Use strict TypeScript.

Avoid `any`.

Prefer:

```ts
unknown
```

and explicit narrowing.

Do not weaken TypeScript compiler settings to make an implementation compile.

Do not introduce unchecked type assertions as a substitute for proper design.

Use generics when they provide actual type safety, not merely abstraction.

---

# 17. Code Quality

Prefer:

- small focused modules
- explicit dependencies
- composition
- immutable state
- clear ownership
- predictable lifecycles
- simple APIs
- deterministic behavior

Avoid:

- God objects
- global registries
- hidden singleton state
- circular dependencies
- clever metaprogramming
- premature abstraction
- deep inheritance hierarchies

Optimize architecture for long-term maintainability rather than minimizing lines of code.

---

# 18. Runtime Dependencies

Do not add a new runtime dependency without a clear need for the current milestone.

Before adding one:

1. verify that existing dependencies or platform APIs cannot reasonably provide the capability;
2. prefer focused, maintained packages;
3. avoid large framework dependencies for small functionality;
4. consider bundle-size impact;
5. document why it is required.

Do not introduce speculative dependencies for future milestones.

Development dependencies may be added when necessary for testing, linting, building, or repository tooling.

---

# 19. Scope Discipline

Every implementation task should follow the currently assigned milestone or prompt.

If a task explicitly defers a feature, do not implement it.

Do not expand scope because another feature appears easy to add.

For example, if the current phase is Core Architecture, do not add:

- toolbar UI
- image editing
- source editing
- Markdown
- preview
- formatting

unless explicitly requested.

A smaller correct architecture is preferred to a larger partially-designed implementation.

---

# 20. Architecture Decisions

Important architectural decisions should be documented under:

```text
docs/decisions/
```

Use ADR-style documents.

Example:

```text
0001-html-first-document-model.md
0002-command-driven-actions.md
0003-plugin-first-features.md
0004-framework-agnostic-core.md
```

Do not silently reverse an accepted architectural decision.

If implementation evidence suggests an accepted decision is wrong:

1. document the conflict;
2. explain alternatives and tradeoffs;
3. propose a new ADR or superseding decision;
4. avoid large architectural rewrites unless the task explicitly authorizes them.

---

# 21. Documentation

Keep architectural documentation synchronized with major implementation decisions.

Primary documentation locations:

```text
README.md
AGENTS.md
docs/architecture.md
docs/decisions/
docs/prompts/
```

`AGENTS.md` contains long-lived repository rules.

`docs/architecture.md` describes the current system architecture.

`docs/decisions/` explains why significant architectural choices were made.

`docs/prompts/` stores milestone implementation instructions.

Do not duplicate large amounts of documentation unnecessarily.

---

# 22. Tests

Core infrastructure must be thoroughly tested.

Tests should focus on behavior and architectural guarantees.

Important categories include:

- lifecycle
- state transitions
- transactions
- command execution
- plugin dependencies
- dependency cycles
- event ordering
- service registration
- destruction and cleanup
- error propagation

Do not write meaningless tests solely to increase coverage percentages.

Do not remove or weaken valid tests simply to make a change pass.

---

# 23. Verification

Before completing an implementation task, run all repository verification commands relevant to the project.

Expected commands will generally include:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

If any command fails because of the implementation:

fix it before reporting completion.

Do not leave known compilation or test failures unless the external environment makes them impossible to resolve.

When an environmental limitation prevents verification, report it explicitly.

---

# 24. Error Handling

Errors should be:

- typed where useful
- descriptive
- actionable
- searchable

Prefer:

```text
Command "image.insert" is not registered.
```

instead of:

```text
Command failed.
```

Do not silently swallow exceptions.

Cleanup operations may isolate failures so remaining cleanup can continue, but errors must remain observable.

---

# 25. Backward Compatibility

Once a public API has been released, assume users may depend on it.

Do not make unnecessary breaking API changes.

Before stable 1.0 releases, APIs may evolve, but changes should still be deliberate and documented.

Use SemVer principles.

---

# 26. Distribution Direction

SoEditor is intended to support:

```text
npm
ES modules
tree shaking
TypeScript declarations
CDN builds
```

Do not design public APIs that only work through bundlers.

Do not design public APIs that only work through browser globals.

Both modern module usage and eventual CDN usage should remain possible.

---

# 27. File Manager Integration

SoEditor must not depend directly on SoFinder.

Future integration should be adapter/service based.

Preferred relationship:

```text
SoEditor
    ↓
FileManager interface
    ↑
SoFinder adapter
```

This allows other file managers to be substituted.

---

# 28. Forbidden Architectural Shortcuts

Unless a task explicitly changes these rules, do not:

- add React/Vue/Svelte to core;
- use `document.execCommand()` as the core editing mechanism;
- mutate EditorState directly;
- allow UI code to bypass commands for editor actions;
- let plugins depend on private internals;
- silently delete unknown HTML;
- treat unsafe HTML preservation as permission to execute it;
- add large runtime dependencies without justification;
- create global mutable editor registries;
- expose internal modules accidentally;
- weaken TypeScript strictness;
- use `any` to bypass architectural typing problems;
- copy code from CKEditor, VSCode, TinyMCE, or other editors;
- implement explicitly deferred features.

---

# 29. Decision Priority

When several implementations are possible, prioritize in this order:

1. correctness
2. clear architecture
3. stable extension points
4. maintainability
5. testability
6. small core
7. performance appropriate to current requirements
8. implementation convenience

Avoid optimizing hypothetical performance bottlenecks before measuring them.

---

# 30. Working Method

Before making significant changes:

1. inspect the current repository;
2. read this `AGENTS.md`;
3. read the current milestone prompt;
4. inspect relevant architecture and ADR documents;
5. understand existing tests;
6. implement only the requested scope.

After implementation:

1. review the diff;
2. remove accidental scope expansion;
3. run lint;
4. run typecheck;
5. run tests;
6. run build;
7. report architectural risks honestly.

---

# 31. Current Architectural Identity

The intended long-term identity of SoEditor is:

```text
Visual Content Editor
        +
HTML Developer Tool
        +
Source Editor
        +
Markdown Editor
        +
Content Preview Environment
        +
Plugin Platform
```

The project should remain useful both to ordinary CMS users and to developers who need direct control over their content.

When an implementation choice conflicts with that identity, favor preserving extensibility, content freedom, and developer control.