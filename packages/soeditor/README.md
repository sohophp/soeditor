# @soeditor/editor

Convenience npm and browser distribution for SoEditor. Modern applications
can mount the experimental CMS Classic Editor in one call or explicitly attach
only the editing/UI surfaces they need. Direct browser builds expose the same public API through
`globalThis.SoEditor` without a global plugin registry.

```ts
import { createClassicEditor } from '@soeditor/editor';
import '@soeditor/editor/styles.css';

const editor = await createClassicEditor(
    document.querySelector<HTMLTextAreaElement>('#content')!,
    {
        editingModes: ['wysiwyg', 'source'],
        initialEditingMode: 'wysiwyg',
        placeholder: 'Write article content',
        minHeight: 240,
        toolbarLayout: { collapsible: true, sticky: true },
    },
);
```

When the host is a named textarea, its value follows canonical HTML and is
updated before native form submission. Form reset restores the textarea's
default value through the editor transaction path. `destroy()` removes owned
surfaces and restores the original host visibility.
The classic chrome includes bounded manual height resizing, optional maximize,
responsive toolbar behavior, element path, text counts, dirty status, and
command-backed contextual actions. Call `editor.maximize(false)` or destroy the
editor to restore document overflow exactly.

An optional `save` configuration adds a command-backed Save/Retry control,
opaque revision tokens, progress/conflict state, opt-in bounded autosave, and
coordinated leave-page protection. The host-provided adapter remains
responsible for transport and backend policy. See
[`docs/cms-saving.md`](../../docs/cms-saving.md).
CMS plugins, instance-scoped themes, and plain-text icon replacement are
documented in
[`docs/cms-plugin-ecosystem.md`](../../docs/cms-plugin-ecosystem.md).

Lower-level assembly remains available:

```ts
import { SoEditor, minimalPreset } from '@soeditor/editor';
import '@soeditor/editor/styles.css';

const editor = await SoEditor.create({
    data: '<p>Hello</p>',
    format: minimalPreset.format,
    plugins: minimalPreset.plugins,
});
```

The repository distribution guide contains classic, visual-surface, and direct-browser
examples. The umbrella also exports the public comments and revisions
packages; applications still supply identity, permissions, persistence,
retention, and audit behavior. The 1.0 umbrella additionally exports the
framework-neutral Workspace lifecycle; React, Vue, and Node-only plugin tools
remain separate packages.
