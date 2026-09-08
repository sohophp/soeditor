---
title: 'React integration'
description: 'Bind CMS HTML, manage lifecycle and enable Source on demand.'
---

# React integration

::: warning Version availability
The framework `/cms` components are new workspace APIs and are not in the npm 1.2.1 adapters. Do not use these imports with the released 1.2.1 adapters. The existing `useSoEditorWorkspace` entry remains compatible.
:::

## Run locally

From the SoEditor repository root:

```sh
pnpm install
pnpm --filter @soeditor/editor... --filter @soeditor/react --filter @soeditor/vue build
DOCS_WORKSPACE_PREVIEW=1 pnpm docs:dev --host 0.0.0.0
```

Open the address printed in the terminal, visit this page and select “Start editing”. This mode uses workspace components and the workspace editor, is marked noindex and cannot pass the deployment gate. Standard builds still use published packages. The framework sources shown below live in the repository and are not part of the 1.2.1 released-example archive.

## Bind article HTML

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
            options={{ locale: 'zh-CN', ariaLabel: '文章正文' }}
            onError={console.error}
        />
    );
}
```

## Behavior contract

- React uses `value` / `onChange(html, change)`. Vue uses `v-model` and also emits `change(html, change)`. Echo edits into bound state. External value changes neither emit change again nor recreate the editor.
- Use `defaultValue` (`default-value` in Vue templates) without a bound value for uncontrolled editing. The initial bound/default HTML is the native form reset baseline for that mount.
- `name` participates in native submit and `FormData`; `readonly` is reactive. SSR renders escaped readonly textarea text and creates the editor only after client mount.
- Toolbar, locale, plugins, `options` and `createEditor` are construction settings. Change the component `key` for structural changes. Ordinary parent renders preserve selection and undo history.
- React provides `onReady` / `onFocus` / `onBlur` / `onError`; Vue emits `ready` / `focus` / `blur` / `error`. Ready receives the Classic instance for `focus()`, `getData()` and `setWorkspaceView()`.
- The component owns destruction. Do not call `destroy()` yourself. An instance that finishes initialization after unmount is cleaned up. Surface errors in the host and change `key` to retry creation.

## Source and loading

The default entry mounts CMS WYSIWYG. To enable Source, supply an explicit `createEditor` factory and `editingModes: ['wysiwyg', 'source']`. Source loads on first activation; formatting has its own demand boundary.

<<< ../../examples/frameworks/shared.ts

## Troubleshooting and versions

Import the CMS stylesheet if chrome is missing. A missing `/cms` export usually means the released 1.2.1 adapter was used instead of the workspace component. Never render editor HTML with `v-html` or `dangerouslySetInnerHTML`, or create an editor during render/setup.

Declared peer ranges are React 18.2–19 and Vue 3.5. This round uses React 19.2.8 and Vue 3.5.42 in automation. SSR support does not certify every Next/Nuxt version.

[Run the complete form example](/en/examples/react)
