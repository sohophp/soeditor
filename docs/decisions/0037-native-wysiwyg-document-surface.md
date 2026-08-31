# ADR 0037 — Independent native-DOM WYSIWYG engine

## Status

Accepted. This decision replaces the initial WYSIWYG adapter and establishes
the engine boundary started by ADR 0036. Feature completeness is governed by
`docs/wysiwyg-editor.md` and ADR 0038; the existence of this engine does not by
itself qualify every WYSIWYG feature.

## Context

The first WYSIWYG implementation delegated to the Developer Visual editing
engine. Its controlled editing model and structured node views are useful for
HTML inspection, but they made ordinary authoring elements into synthetic
blocks. Tables became atomic widgets with nested cell editors, images and
unknown nodes displayed source-like controls, and browser selection had to be
translated through a model that did not represent the full HTML tree.

That architecture caused observable authoring defects: a click in a table cell
could collapse to its beginning or another cell, drag selection competed with
cell activation, a selected text range could be lost when a toolbar gained
focus, and standard elements such as `aside` did not render with standard HTML
semantics. Fixing those symptoms inside individual node views could not provide
one coherent browser selection model.

The HTML formatting command was also exposed beside authoring commands even
though it formats the complete canonical source and is not a visual formatting
operation.

## Decision

- `@soeditor/wysiwyg` owns an independent editing engine. It must not construct
  or delegate to the Developer Visual editing engine, editing model, DOM
  projection, or structured node-view registry.
- The live WYSIWYG surface is one `contenteditable` HTML subtree constructed
  with DOM APIs from parsed canonical HTML. Standard safe HTML elements,
  including `table`, `td`, `th`, `img`, and `aside`, remain those actual
  elements. They are not replaced with nested editing hosts, source labels, or
  button-like wrappers.
- Browser `Selection` and `Range` are authoritative for WYSIWYG caret placement
  and text selection. A saved native range is restored after toolbar or dialog
  focus, so commands operate on the user's exact selection. Table selection
  metadata may inform table commands but must not replace or manufacture the
  text caret.
- Browser edits and command mutations serialize the safe authoring DOM back to
  canonical HTML and commit through Core transactions. The DOM is never allowed
  to mutate `EditorState` directly, and commands remain the reusable UI entry
  points.
- External canonical changes rebuild the authoring DOM with best-effort native
  selection restoration. A WYSIWYG transaction does not immediately rebuild
  its own DOM, because that would discard the browser's just-completed
  selection and composition state.
- Preservation and execution remain separate. Comments, custom elements,
  scripts, and executable embeds are retained as inert mapped tokens and
  restored during serialization. Unsafe attributes are withheld from the live
  DOM but retained for canonical round-tripping. They do not execute in the
  authoring surface.
- `Edit HTML`, source snippets, unsupported-node detail labels, and synthetic
  continuation buttons belong only to Developer Visual. They must never be
  emitted into the WYSIWYG content DOM.
- Image activation, table context, links, paste, and formatting use WYSIWYG
  services and commands. Double-clicking a rendered image requests its property
  UI; the image itself remains a normal `img` element.
- Developer Visual keeps its inspection-oriented controlled representation.
  Changes required only for CMS WYSIWYG authoring must not be added to that
  representation.
- `document.format` is a whole-document Source operation. It is available only
  while Source is the active editing projection and is presented as Source
  formatting, not WYSIWYG content formatting.

## Consequences

WYSIWYG tables and cells now share exactly the browser text behavior used by
paragraphs and other standard content, while structural changes remain command-
and transaction-driven. Standard HTML presentation is predictable, Developer
Visual and WYSIWYG can evolve independently, and content authors no longer see
developer inspection chrome. The cost is a dedicated DOM/canonical
serialization boundary and explicit inert preservation bookkeeping in the
WYSIWYG package.
