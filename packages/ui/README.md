# @soeditor/ui

Framework-independent DOM UI for SoEditor commands and contributions. It
provides configurable toolbars, accessible dialogs/notifications/status,
panels, balloons, theme variables, and host-scoped shortcuts. Toolbars support
responsive wrap/scroll, collapse, sticky positioning, and roving keyboard
focus. Plugins may register command-backed context-menu items and status
projections. UI instances are owned per editor and never mutate document state
outside commands.

Dialogs keep their title and action rows visible around a scrollable body. The
optional Classic editor enhances these dialogs with viewport-bounded title
dragging and a corner resize handle that also supports arrow keys.

Balloons keep one active context branch per editor; opening a nested balloon
retains its parent. `BalloonOptions.avoid` may return live rectangles for edited
cells or resize handles. Placement chooses a viewport-bounded candidate with
the least overlap, updating on scrolling, resizing, and keyboard/pointer release.
If the viewport has no free space, overlap may remain.

Toolbar menus use the browser popover top layer when available, keeping their
DOM ownership and selection handling while escaping clipping ancestors.
Positioning accounts for CSS zoom. Compact balloons allow their nested menus
to overflow; genuinely height-limited panels scroll internally.

`icons` supplies bounded per-instance plain-text replacements keyed by command
or extension icon ID. `themeVariables` and `setThemeVariables()` customize only
the host-scoped editor chrome and restore pre-existing inline values on destroy;
they are never serialized into editor content. See
[`docs/cms-plugin-ecosystem.md`](../../docs/cms-plugin-ecosystem.md).

The standard package root keeps the complete built-in translation baseline for
direct UI composition. The CMS editor uses `@soeditor/ui/cms` internally and
loads `@soeditor/ui/translations` only for a supported non-English locale, so
the default English startup path does not download the Chinese dictionaries.
Hosts composing UI through the narrow entry must pass every translation
resource they need; it never adds locale data implicitly.
