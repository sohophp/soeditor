# @soeditor/ui

Framework-independent DOM UI for SoEditor commands and contributions. It
provides configurable toolbars, accessible dialogs/notifications/status,
panels, balloons, theme variables, and host-scoped shortcuts. Toolbars support
responsive wrap/scroll, collapse, sticky positioning, and roving keyboard
focus. Plugins may register command-backed context-menu items and status
projections. UI instances are owned per editor and never mutate document state
outside commands.

`icons` supplies bounded per-instance plain-text replacements keyed by command
or extension icon ID. `themeVariables` and `setThemeVariables()` customize only
the host-scoped editor chrome and restore pre-existing inline values on destroy;
they are never serialized into editor content. See
[`docs/cms-plugin-ecosystem.md`](../../docs/cms-plugin-ecosystem.md).
