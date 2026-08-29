# Phase 5 Implementation Specification — Core Rich-Text Feature Plugins

## Status

Active implementation specification for Phase 5 of `docs/ROADMAP.md`.

This document is subordinate to repository policy, accepted ADRs, product,
architecture, roadmap, and the Phase 1–4 implementation.

## Goal

Build the first realistic article-editing feature set through plugins and
commands, using the controlled Phase 3/4 visual engine, selection, history, and
clipboard infrastructure.

## Required plugins and commands

Implement deliberate plugin classes for:

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
Image
Basic Table
```

Use stable namespace/action command IDs, including conceptually:

```text
paragraph.set
paragraph.heading
format.bold
format.italic
format.underline
format.strike
format.inlineCode
blockquote.toggle
codeBlock.toggle
list.ordered
list.unordered
link.set
link.remove
image.insert
table.insert
```

Exact argument types must be explicit, validated, and documented.

## Package boundary

Create a framework-neutral feature-plugin package rather than adding feature
classes to Core or the engine package. Individual plugin classes may share one
tree-shakeable package in Phase 5; package splitting may occur during later
distribution hardening if justified.

The feature package may depend on stable public capabilities from:

```text
@soeditor/core
@soeditor/engine
@soeditor/html (where semantic element construction is required)
```

It must not import engine internal modules or mutate Core/DOM state directly.

## Visual editing capability

Expose one narrow typed service token from `@soeditor/engine` for feature
plugins. It may provide generic controlled editing actions such as:

- toggle an inline semantic mark;
- query an inline mark;
- set/query selected block kind;
- toggle ordered/unordered list membership;
- set/remove link metadata;
- insert a semantic HTML fragment through the existing paste/model boundary.

The service must commit through the engine's existing Core transaction path,
attach selection/history metadata, preserve opaque content, and reject unsafe
selection boundaries. Do not expose mutable editing models or DOM objects.

Register the service per editor when a visual engine attaches. Remove it on
independent engine destruction; Core destruction continues to own terminal
registry cleanup.

## Editing representation extensions

Extend the controlled model only as demonstrated by required features.

Support editable text blocks for:

```text
p
h1–h6
blockquote (minimal text-block form)
pre (code block)
```

Support inline marks for:

```text
strong
em
u
s
code
a with preserved link attributes
```

Support ordered/unordered lists with editable list-item text while retaining
the existing block-index selection foundation. Lists with unsupported complex
structure or meaningful unsupported attributes may remain opaque rather than
being normalized destructively.

Image and table insertion may begin as inert structured widgets/placeholders,
but commands must insert correct semantic HTML, integrate with history, and
preserve attributes. Do not build advanced image editing or table selection.

## Command behavior

- Commands call the visual editing service; they never mutate DOM/source
  directly.
- `canExecute()` reflects whether the visual service and compatible selection
  are available.
- `isActive()` reflects current mark/block/list state where meaningful.
- Invalid arguments throw descriptive feature-owned errors before mutation.
- Formatting and structural actions form discrete history entries.
- Undo/redo restores the source and selection before/after every feature action.

## Link safety

Link source data is preservation data, not execution permission. The editing
projection must not expose unsafe link URLs as clickable execution paths.
Validate command argument shape, but do not silently delete existing unknown
link attributes. A later rendering/security policy may impose output rules.

## Image

`image.insert` accepts at minimum a required `src` and optional `alt`, width,
and height. Construct semantic HTML without string-injection bugs. The visual
surface renders an inert placeholder in this phase unless a safe richer
projection is implemented.

File-manager integration is deferred to Phase 12.

## Basic table

`table.insert` accepts bounded positive row/column counts and creates semantic
table structure. The initial visual representation may be inert; advanced cell
editing, table selection, row/column commands, and spreadsheet behavior are
deferred.

## Preservation

Actively protect:

- custom elements and comments around formatted content;
- custom attributes on supported blocks;
- attributed/complex inline elements that cannot be transformed safely;
- SVG/MathML/template/unsafe markup as opaque content;
- list structures outside the supported minimal shape.

Explicit user selection may remove supported selected content. No feature
command may silently normalize unrelated opaque content.

## Tests

Add unit and real-browser coverage for every command/plugin, including:

- registration, duplicate/plugin lifecycle behavior;
- argument validation;
- `canExecute()` and `isActive()`;
- toggle/apply/remove behavior;
- forward/backward selection;
- history undo/redo;
- paragraph/heading/block/list serialization;
- nested inline marks and links;
- custom HTML preservation adjacent to edits;
- image/table semantic insertion and validation;
- unsafe link/image strings remaining non-executable in visual projection;
- external package consumption through public exports.

## Documentation and ADR

Update architecture for the implemented feature/service/model boundaries. Add
an ADR for the feature-plugin-to-engine capability and minimal editable schema,
because it is a long-lived extension boundary.

## Explicitly deferred

Do not implement toolbar/UI, CodeMirror/source mode, formatting/diagnostics,
preview, Markdown, advanced widgets/tables, file manager, SoFinder, command
palette, or general plugin contribution manifests.

## Definition of Done

- a realistic article can be built with required commands;
- every feature is a plugin and every user action is a command;
- commands use selection/history and semantic HTML infrastructure;
- unsupported surrounding HTML remains preserved;
- image/table insertion is semantic and undoable;
- public package declarations are clean;
- Critical = 0 and High = 0;
- lint/typecheck/test/build, packed consumers, and browser tests pass.
