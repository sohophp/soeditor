# @soeditor/editor

Lightweight CMS HTML WYSIWYG distribution for SoEditor. Modern applications
mount the Classic Editor through the narrow `/cms` entry. The direct browser
build exposes the WYSIWYG-only CMS API through `globalThis.SoEditor`.

```ts
import { createClassicEditor } from '@soeditor/editor/cms';
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

Historical lower-level assembly remains available from the compatibility root:

```ts
import { SoEditor, minimalPreset } from '@soeditor/editor';
import '@soeditor/editor/styles.css';

const editor = await SoEditor.create({
    data: '<p>Hello</p>',
    format: minimalPreset.format,
    plugins: minimalPreset.plugins,
});
```

The package root retains released 1.0 compatibility exports. They are excluded
from the `/cms` entry and standalone CMS global and receive compatibility fixes,
not active product development.
