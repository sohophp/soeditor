# ADR 0036 — Separate Developer Visual and WYSIWYG projections

## Status

Accepted. This decision extends ADR 0022. The normative author-facing contract
and qualification rules are maintained in `docs/wysiwyg-editor.md` and ADR 0038.

## Context

The existing `visual` projection has accumulated two different product jobs:
developer-oriented inspection of preserved HTML and CMS-style rich-text
authoring. Those jobs have different rendering, editing, toolbar, paste,
table, media, and safety requirements. Continuing to add WYSIWYG behavior to
Developer Visual would make both experiences harder to use and harder to
extend.

The product also needs to display Developer Visual, WYSIWYG, Source, and
Preview together without allowing concurrent edits to race against the
canonical HTML document.

## Decision

- `visual` means the developer-oriented HTML projection. It prioritizes
  semantic preservation, unsupported-element visibility, diagnostics, and
  precise developer control.
- `wysiwyg` is a separate HTML editing projection and package. It owns the
  CMS/content-authoring experience, including content styles, paste choices,
  contextual table/media tools, and familiar rich-text interactions.
- `source` remains the first-class code editing projection and `preview`
  remains an isolated, non-editable rendering projection.
- All four projections read one canonical `EditorDocument.source`. Exactly one
  compatible editing projection is primary and writable at a time; every
  other visible projection is synchronized and readonly.
- Focus may request authority through `projection.activate`; it must not mutate
  document state or write authority directly.
- HTML keeps `visual` as the Core/coordinator default for compatibility.
  Product presets such as Classic explicitly activate `wysiwyg`.
- Projection coordination remains DOM-free. Four-pane layout, selection
  mapping, surface rendering, and UI state belong outside Core.

## Migration boundary

Move CMS-style table dialogs and contextual controls, content-style presets,
image/video property panels, named-anchor presentation, paste-choice UI, and
content-authoring affordances from Developer Visual/Classic glue into the
WYSIWYG package or focused plugins. Keep HTML preservation, unsupported-node
representation, diagnostics hooks, canonical transactions, and developer
navigation reusable by Developer Visual.

Selection synchronization is best-effort navigation, not a shared DOM
selection. Mapping failures must not block typing or cause scroll loops.

## Consequences

The two visual products can evolve independently and remain tree-shakeable.
Four visible panes do not imply four writers. Existing integrations that use
`visual` continue to work, while Classic must deliberately opt into WYSIWYG.
The temporary cost is an explicit migration layer until CMS behaviors have
moved out of Classic and the existing visual engine.
