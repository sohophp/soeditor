# CMS plugin and theme ecosystem

SoEditor CMS extensions are ordinary audited ESM packages. They import only
documented package roots, are selected by the application, and are instantiated
per editor. There is no runtime marketplace, remote plugin loader, global
registry, or trust-certification service.

## Public contribution boundaries

`@soeditor/plugin-sdk` is the curated third-party entry point. It exposes:

- semantic style definitions and `SemanticStylesPlugin`;
- command-backed toolbar, status, shortcut, context-menu, dialog, panel, and
  balloon UI contracts;
- `PastePipelinePlugin`, processor types, diagnostics, and the instance-scoped
  paste service token;
- host-owned upload service/task types and upload service tokens;
- link-target selection as the CMS content-picker boundary;
- isolated translation resources;
- configured atomic CMS object definitions and inert embed metadata providers;
- structured node-view contracts for advanced widgets.

Registrations reject duplicate IDs. A plugin retains every returned disposer
and releases it in `destroy()`; commands and owned services must likewise be
unregistered. Contributions must not reach into another plugin's private state.

## Themes, icons, and saved content

Chrome customization is passed to one `createClassicEditor()` or
`createEditorUi()` call:

```ts
const editor = await createClassicEditor(textarea, {
    icons: {
        'format.bold': 'B',
        'format.italic': 'I',
    },
    themeVariables: {
        accent: '#005ea8',
        controlSize: '2.75rem',
        focusRing: 'CanvasText',
        radius: '0.25rem',
    },
});
```

Icon values are bounded plain text and are assigned through `textContent`; HTML
is never parsed. Accessible names continue to come from labels/translations,
so an icon replacement must not be the only explanation of an action. Theme
tokens map to host-scoped `--soeditor-*` custom properties and are restored on
destroy. Each instance has its own resource maps, and forced-colors mode keeps
system-color focus/selection outlines.

Editor chrome and document content are separate. Theme variables, icons, and
UI translations never enter canonical HTML. Applications explicitly load
their own content stylesheet for authoring and site rendering; a chrome theme
must not assume those rules will be serialized or shipped to the published
page.

## Template families

`@soeditor/plugin-tools` template version 3 supports:

```bash
soeditor-plugin create ./extension \
  --name @example/extension \
  --id example.extension \
  --kind cms-widget # or paste, upload, theme, basic
```

The CMS widget example uses commands, configured object definitions, and a
context menu. Paste registers and disposes a bounded processor. Upload bridges
a host-provided `UploadService`; credentials, authorization, retry policy, URL
validation, and storage remain application/backend responsibilities. Theme
exports typed data that the application passes to an editor instance.

Generated packages use strict TypeScript, explicit exports, a compatible 1.x
SDK peer range, and `sideEffects: false`. `soeditor-plugin check --packed`
inspects package shape with lifecycle scripts disabled. Compatibility follows
SemVer for stable SDK contracts; APIs marked experimental may change in a minor
release with documentation and migration guidance.

## Security and accessibility ownership

Extensions are executable application dependencies and require the same review
as other frontend code. Never place secrets in a plugin bundle. Sanitize and
validate adapter results at the server boundary, keep unknown source preserved
but inert in visual/preview surfaces, and do not use remote imports, dynamic
evaluation, or DOM HTML injection sinks. Static checks reduce common mistakes
but cannot certify behavior.

Plugin authors own keyboard access, focus restoration, localized accessible
names, contrast, reduced-motion behavior, cleanup, and error observability for
their contributed UI. Applications should exercise each installed extension in
their browser, CSP, CMS permissions, and content-security test matrix.
