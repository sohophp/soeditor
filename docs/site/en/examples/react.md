---
title: 'React form example'
description: 'Try binding, readonly, form submit/reset and Source.'
---

# React form example

<EditorDemo example="react" />

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

## Try it

1. Edit the article and watch bound HTML update below it.
2. Select “Replace HTML” to apply external state, then toggle readonly to stop editing.
3. “Submit form” reads canonical textarea HTML. “Reset form” restores the initial value for the current mount.
4. “HTML Source” loads Source on demand. “Recreate demo” mounts a new instance with the current value. Closing the demo removes the entire iframe.

## Complete example source

<<< ../../examples/frameworks/react.ts

<<< ../../examples/frameworks/shared.ts

<<< ../../examples/react.html

[Integration guide](/en/guide/react)
