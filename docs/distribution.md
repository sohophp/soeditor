# Distribution and integration

SoEditor is ESM-first. The `@soeditor/editor` package is the straightforward
application entry; the other scoped packages remain available for smaller or
more tightly controlled integrations.

## Install

```bash
pnpm add @soeditor/editor
```

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
and currently builds to about 28 kB uncompressed JavaScript.

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
    const editor = await SoEditor.create({
        data: '<p>Hello from a script tag.</p>',
        format: SoEditor.minimalPreset.format,
        plugins: SoEditor.minimalPreset.plugins,
    });
    // Attach visual/UI surfaces explicitly, as in the ESM example.
</script>
```

The script exposes one frozen `globalThis.SoEditor` namespace. It has no
mutable global plugin registry, does not discover remote plugins, and does not
automatically create editors. ESM and the scoped public package roots remain
the authoritative APIs. The self-contained global contains optional features,
so size-sensitive applications should use ESM.

The example is the externally verified 1.0.0 jsDelivr URL. Consumers must not
mix release lines and must follow the complete migration chain through
[`migration-0.9-to-1.0.md`](migration-0.9-to-1.0.md).
