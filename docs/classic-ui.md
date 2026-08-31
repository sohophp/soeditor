# Classic editor UI

The CMS Classic Editor mounts responsive chrome around configurable WYSIWYG,
Developer Visual, and Source surfaces. The normal CMS setup enables WYSIWYG
and Source only; Developer Visual is opt-in. The UI is instance scoped and all
content-changing controls execute editor commands.

## Toolbar layout

```ts
const editor = await createClassicEditor(textarea, {
    toolbarLayout: {
        collapsible: true,
        overflow: 'wrap', // or 'scroll'
        sticky: true,
    },
});
```

Toolbar controls use a roving tab stop. Tab enters the group; Arrow keys,
Home, and End move between available controls. A collapsible toolbar retains a
keyboard-accessible toggle, so collapsing never removes the only route back to
the commands. Labels, accessible names, and tooltips remain text based; host
CSS may supply icons without replacing those names.

## Editing view selector

When WYSIWYG, Source, and Preview are enabled, Classic exposes one labeled
`Editing view` selector with seven explicit arrangements:

1. WYSIWYG
2. Source
3. WYSIWYG + Source
4. WYSIWYG + Preview
5. Source + Preview
6. WYSIWYG + Source + Preview
7. Preview

Selecting a one-pane view hides every other surface. Preview-only presentation
keeps the last editable projection as logical write authority while hiding it;
leaving Preview restores the selected editable projection. Combined views
still have exactly one writer, with the other panes synchronized and readonly.
Developer Visual installations receive the equivalent Developer Visual
combinations instead of WYSIWYG combinations.

## Contextual commands

Plugins register context-menu definitions through the per-editor UI registry:

```ts
editor.services
    .get(uiRegistryServiceToken)
    .registerContextMenuItem('cms.inspect-link', {
        label: 'Inspect link',
        command: 'cms.link.inspect',
        when: ({ target }) => target.closest('a') !== null,
    });
```

The definition supplies no DOM mutation callback. The UI checks command
availability, restores the controlled selection, and executes the command.
Pointer context menu and Shift+F10 use the same contribution list; Escape
closes the menu and returns focus to editing.

## Size and maximize

Classic editors are manually resizable by default. The resize separator works
with pointer input and Arrow Up/Down; Shift changes the keyboard step. Existing
`minHeight` and `maxHeight` values bound both manual resize and auto-grow. Once
the author resizes manually, auto-grow stops overwriting that choice.

`editor.maximize()` fills the viewport and `editor.maximize(false)` restores
the normal layout. Maximize is opt-out with `maximizable: false`; manual resize
is opt-out with `resizable: false`. Document scrolling is restored to its exact
prior inline value on restore or destruction, including when multiple editor
instances overlap their maximize lifecycles.

## Status and theming

The classic status bar displays mode, Core dirty/save state, the selected
element path, and Unicode-aware character and locale-aware word counts.
Notifications remain in the existing polite live region.

All chrome selectors are rooted under `.soeditor-ui` or `.soeditor-classic`.
Hosts can override the documented `--soeditor-*` variables per instance;
chrome rules are not injected into editable content and one editor's theme does
not mutate another editor.

## Preservation and cleanup

Preserved custom elements, comments, and raw images expose an **Edit HTML**
action when Source is configured. The action uses `editor.source.find` to open
CodeMirror and prefill a stable tag, comment, or image-source search term; it
does not execute or rewrite the preserved node. Raw images receive the more
specific **Edit image HTML** label. Compact unsupported-content display hides
these secondary actions without changing source.

Responsive layout, counts, contextual menus, resize, and maximize do not write
canonical HTML. `destroy()` removes owned controls, overlays, listeners, resize
state, and surfaces before restoring the original textarea or element.
