---
title: 'Installation'
description: 'Install a fixed version, import the CMS entry and stylesheet, and mount after the host DOM exists.'
---

# Installation

Install a fixed version, import the CMS entry and stylesheet, and mount after the host DOM exists.

```sh
pnpm add @soeditor/editor@1.2.1
```

```html
<label for="content">Article content</label>
<textarea id="content" name="content"><p>Start writing</p></textarea>
```

```ts
import { createClassicEditor } from '@soeditor/editor/cms';
import '@soeditor/editor/cms/styles.css';
```

The checked function below mounts the editor. Call `await attach()` to get the instance. The default entry provides WYSIWYG; use the optional entry for Source or a save adapter.

## Checked code

<<< ../../examples/api.ts#installation

Checked against the published types; see [imports and types](/en/api/imports) for imports.

## Next steps

[Examples](/en/examples/basic) · [Configuration](/en/api/configuration) · [Troubleshooting](/en/support/troubleshooting)
