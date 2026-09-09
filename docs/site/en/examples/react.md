---
title: 'React form example'
description: 'Try binding, readonly, form submit/reset and Source.'
---

# React form example

<EditorDemo example="react" />

## Install and run

The `/cms` components were introduced in 1.3.0; these examples use 1.4.0. The existing `useSoEditorWorkspace` entry remains compatible.

```sh
pnpm add @soeditor/editor@1.4.0 @soeditor/react@1.4.0 react react-dom
```

Select “Start editing” to run the published packages. [Download complete example sources](/downloads/soeditor-examples-1.4.0.tar.gz), extract, run `pnpm install` and `pnpm dev`, then open `react.html`.

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
