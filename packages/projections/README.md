# @soeditor/projections

DOM-free coordination for persistent SoEditor Visual, HTML Source, Markdown,
and Preview projections. Canonical content remains owned by Core; this package
only coordinates visibility, one logical primary writer, effective readonly
state, attachment lifecycle, and shared commands.

Installing `ProjectionCoordinatorPlugin` enables coordinated engines. Existing
engines retain their legacy single-mode behavior when this plugin is absent.

Commands:

- `projection.activate(id)` transfers primary write authority to one visible,
  attached, format-compatible editable projection;
- `projection.show(id)` keeps an attached projection visible;
- `projection.hide(id)` hides a non-primary attached projection.

Preview is always readonly and cannot become primary. An editor-level readonly
policy keeps the logical primary but makes every activity effectively readonly.
