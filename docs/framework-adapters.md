# React and Vue adapters

## CMS components (current integration)

Use `SoEditor` from `@soeditor/react/cms` or `@soeditor/vue/cms` for an
article/page/product HTML field. These independent entries mount the Classic
CMS editor on a native textarea. Install `@soeditor/editor` alongside the adapter
and import `@soeditor/editor/cms/styles.css` once in the application. The editor
peer is optional only for users of the existing Workspace entry; CMS consumers
must install it. No framework is added to the default editor graph.

```tsx
'use client';

import { useState } from 'react';
import { SoEditor } from '@soeditor/react/cms';
import '@soeditor/editor/cms/styles.css';

export function ArticleField() {
    const [html, setHtml] = useState('<p>Article</p>');
    return (
        <SoEditor
            name="body"
            value={html}
            onChange={setHtml}
            onError={console.error}
            options={{ locale: 'zh-CN', ariaLabel: '文章正文' }}
        />
    );
}
```

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { SoEditor } from '@soeditor/vue/cms';
import '@soeditor/editor/cms/styles.css';

const html = ref('<p>Article</p>');
</script>

<template>
    <SoEditor
        v-model="html"
        name="body"
        :options="{ locale: 'zh-CN', ariaLabel: '文章正文' }"
        @error="console.error"
    />
</template>
```

React uses `value` / `onChange(html, change)`; Vue uses `modelValue` /
`update:modelValue` (`v-model`) and also emits `change(html, change)`. Echo edited
HTML into the bound value. Prop updates apply only when different from current
HTML and do not emit change callbacks or rebuild the instance. Omitting the bound
value and supplying `defaultValue` enables uncontrolled editing. The initial
bound/default value remains the native form reset baseline for that mount.
Use `name` to include the synchronized textarea in native form submission and
`FormData`; reset also updates the bound HTML. Do not put `value` on the underlying
textarea or render editor HTML with `dangerouslySetInnerHTML` / `v-html`.

Both components support reactive `readonly`, `name`, and `id`. React `className`
and Vue fallthrough attributes apply to the outer wrapper. `options` and
`createEditor` are construction settings: use the framework's `key` to remount
when changing toolbar, locale, plugins, or the factory. This preserves selection
and undo history during ordinary parent renders. `options` excludes data,
readonly, and callbacks managed by component props/events.

React exposes `onReady`, `onError`, `onFocus`, and `onBlur`; Vue emits `ready`,
`error`, `focus`, and `blur`. Ready/focus/blur receive the Classic editor instance.
Use the ready instance for `focus()`, `getData()`, `setWorkspaceView()`, and other
Classic APIs. Vue template refs also expose `getEditor()` (undefined before ready
and after unmount). Instance lifetime belongs to the component: do not call
`destroy()` directly. Handle errors in the host UI; change `key` to retry a failed
mount. Unmount suppresses late change/focus/ready callbacks and destroys an
instance even if its asynchronous creation finishes after unmount. React effect
cleanup and replacement startup are serialized for StrictMode.

SSR only renders escaped, readonly textarea text; no editor runtime is imported until
client mount. The React CMS distribution preserves its `use client` directive.
This is an SSR rendering guarantee, not certification of every Next/Nuxt release.

### Optional Source

The default factory uses `@soeditor/editor/cms`. To enable Source, supply an
explicit factory that imports the optional CMS entry on mount:

```ts
import type { CreateClassicEditorOptions } from '@soeditor/editor/cms';

const createEditor = async (
    host: HTMLElement,
    options: CreateClassicEditorOptions,
) => {
    const cms = await import('@soeditor/editor/cms/optional');
    return cms.createClassicEditor(host, options);
};
```

Pass `createEditor={createEditor}` and
`options={{ editingModes: ['wysiwyg', 'source'] }}` in React, or
`:create-editor="createEditor"` and
`:options="{ editingModes: ['wysiwyg', 'source'] }"` in Vue. Source remains loaded
on first activation, including a requested split view; an initial Source view
loads it immediately. Formatting retains its own demand boundary.

The executable CMS integration is `/framework-cms.html`; `?source` enables the
Source scenario, while `?delay` holds completion until “Finish initialization”.
See [framework verification](framework-cms-evidence.zh-CN.md) for measured results.

## Existing Workspace adapters

SoEditor 0.9 provides public `@soeditor/react` and `@soeditor/vue` packages over
the framework-neutral Workspace controller. They do not move React or Vue into
Core, engines, features, UI, SDK, or the umbrella package.

Both composables/hooks accept the same explicit Editor creator, ordered
attachments, controlled `value` or uncontrolled `initialValue`, recovery
policy, and runtime readonly policy. DOM elements remain application-owned and
are normally captured by refs inside attachment closures.

Both adapters also forward Workspace `previewIsolation` and `onDiagnostic`.
Use them when an attachment declares an isolated Preview or service/format
requirements; diagnostics remain scoped to that component's Workspace.
React 18.2–19 and Vue 3.5 are the declared 0.9 peer ranges; the release suite
uses React 19 and Vue 3.5.

## React

`useSoEditorWorkspace()` mounts in an Effect and serializes cleanup before a
replacement mount. This is required because React StrictMode deliberately runs
an extra setup/cleanup cycle in development. Value and readonly changes update
the existing Workspace; a structural change requires a deliberate new
`configurationKey`. `throwOnError` rethrows an asynchronous mount failure on
render so the nearest Error Boundary can handle it.

The hook can render under Suspense, but does not suspend editor creation: DOM
refs must commit before attachment. Its initial/SSR status is `idle`.

## Vue

`useSoEditorWorkspace()` must be called synchronously from `setup()`. It creates
the Workspace only in `onMounted()` and destroys it in `onUnmounted()`. A
controlled value and readonly policy may be a ref, computed getter, or literal.
Initialization and cleanup failures are exposed through the returned `error`
ref and optional `onError` callback.

Neither adapter accesses DOM at module evaluation or during server rendering.
Node SSR tests prove that rendering does not call the Editor creator.

The executable comparison is `/framework-adapters.html`.
