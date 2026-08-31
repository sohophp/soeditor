# Phase 54 — WYSIWYG, Source, Preview, and HTML Preservation

Qualify the independent WYSIWYG surface beside direct source editing and an
isolated output preview.

## Contract

- Preserve comments, custom elements, CMS markers, unsupported HTML, and
  unsafe source without executing it in authoring.
- Render standard semantic elements normally and retain editable boundaries.
- Source is CodeMirror-backed, correctly sized, exact, diagnosable, formattable,
  minifiable, searchable, and synchronized with canonical HTML.
- Preview uses a sandboxed iframe with templates, content styles, client
  presets, and editor maximize rather than a duplicate fullscreen action.
- Support exactly the seven documented WYSIWYG/Source/Preview arrangements,
  with one writer and clear focus/mode state.
- Position synchronization is best-effort and optional; disabling it must not
  alter content or authoring behavior.

Arbitrary script execution and simultaneous writers are not authorized.
