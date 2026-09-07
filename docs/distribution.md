# Distribution and integration

SoEditor is ESM-first. Ordinary CMS applications use `@soeditor/editor/cms`,
or `@soeditor/editor/cms/optional` when exposing Source, Preview or a save adapter.
Use `@soeditor/editor/cms/styles.css` for the CMS UI. Broad root exports and
other scoped packages remain available for existing modular integrations.

## Install

```bash
pnpm add @soeditor/editor
```

## Supported CMS integration

```ts
import { createClassicEditor } from '@soeditor/editor/cms/optional';
import '@soeditor/editor/cms/styles.css';

const textarea = document.querySelector<HTMLTextAreaElement>('#content');
if (textarea === null) throw new Error('Missing #content textarea.');
const classic = await createClassicEditor(textarea, {
    editingModes: ['wysiwyg', 'source'],
});
// Source is downloaded and mounted only when first requested.
await classic.setWorkspaceView('source');
await classic.destroy();
```

Ship all generated dynamic chunks and the Source recovery asset using the
consumer bundler's base URL. Normal Source, formatting and Preview have separate
first-use boundaries; the recovery copy is requested only after Source failure.
The old full stylesheet remains available for compatibility UI. Neither
optional Source nor Preview is supported by the standalone CMS browser global.

## Historical modular integration

The following lower-level example remains supported for explicit modular
consumers; it is not the recommended CMS startup path.

SoEditor does not create or mount a UI automatically. Create the document
instance, then attach the surfaces your application needs:

```ts
import {
    SoEditor,
    createEditorUi,
    createVisualEditingEngine,
    minimalPreset,
} from '@soeditor/editor';
import '@soeditor/editor/styles.css';

const editor = await SoEditor.create({
    data: '<p>Hello, SoEditor.</p>',
    format: minimalPreset.format,
    plugins: minimalPreset.plugins,
});

const visual = createVisualEditingEngine({
    editor,
    element: document.querySelector<HTMLElement>('#editing')!,
});
const ui = createEditorUi({
    editor,
    element: document.querySelector<HTMLElement>('#toolbar')!,
    toolbar: minimalPreset.toolbar,
});

// Application teardown:
ui.destroy();
visual.destroy();
await editor.destroy();
```

Every editor owns its state, commands, services, plugins, and contributions.
Applications must destroy attached surfaces before destroying the editor.

## Presets and modular imports

Presets are immutable configuration values, not pre-mounted editor classes.
`minimalPreset`, `classicPreset`, experimental `cmsPreset`, `developerPreset`, and `markdownPreset` are
available from `@soeditor/editor` and from the aggregate `@soeditor/presets`
package.
Narrow preset paths avoid evaluating unrelated preset families:

```ts
import { minimalPreset } from '@soeditor/presets/minimal';
import { Editor } from '@soeditor/core';
```

Use scoped packages when bundle ownership or API review matters more than the
umbrella-package convenience. Never import another package's `src` or private
`dist` files.

## Vite and TypeScript

The package publishes native ESM, strict declarations, declaration maps, and
JavaScript source maps. Vite needs no SoEditor-specific plugin. CSS is an
explicit import:

```ts
import { SoEditor, classicPreset } from '@soeditor/editor';
import '@soeditor/editor/styles.css';
```

The repository release gate installs packed tarballs into clean NodeNext,
native Node ESM, and Vite fixtures. A narrow Core/SDK/minimal-preset fixture
also rejects accidental Source, Markdown, Preview, layout DOM, or CSS families
and currently starts with 85.21 kB uncompressed JavaScript while remaining
below its 90 kB total-JavaScript guard.

Direct users of `@soeditor/layout` import its stylesheet explicitly:

```ts
import { createSplitViewLayout } from '@soeditor/layout';
import '@soeditor/layout/styles.css';
```

## Direct browser/CDN build

Published package files can be served by a CDN or copied to an application's
own static assets. Pin an exact package version in production:

```html
<link
    rel="stylesheet"
    href="https://cdn.jsdelivr.net/npm/@soeditor/editor@1.0.0/dist/soeditor.css"
/>
<script src="https://cdn.jsdelivr.net/npm/@soeditor/editor@1.0.0/dist/soeditor.global.js"></script>
<script>
    const host = document.querySelector('#content');
    const editor = await SoEditor.createClassicEditor(host, {
        data: '<p>Hello from a script tag.</p>',
    });
</script>
```

The script exposes one frozen `globalThis.SoEditor` namespace. It has no
mutable global plugin registry, does not discover remote plugins, and does not
automatically create editors. ESM and the scoped public package roots remain
the authoritative APIs. The CMS global is WYSIWYG-only and rejects Source,
Preview and save-adapter options; use `@soeditor/editor/cms/optional` when an ESM
application explicitly needs them.

The example is the externally verified 1.0.0 jsDelivr URL. Consumers must not
mix release lines and must follow the complete migration chain through
[`migration-0.9-to-1.0.md`](migration-0.9-to-1.0.md).
