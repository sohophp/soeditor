---
title: Native form
description: Edit content, submit to inspect the field, then reset to its default.
---

# Native form

Edit content, submit to inspect the field, then reset to its default.

<EditorDemo example="form" />

## What to verify

Edit content, submit to inspect the field, then reset to its default. Read HTML displays canonical content. Recreate demo destroys and remounts the instances. Upload and save send no editing content; mock uploads return the bundled image.

## Complete integration code

[Download all example sources](/downloads/soeditor-examples-1.3.0.tar.gz). Extract, run `pnpm install` and `pnpm dev`, then open `basic.html` or another example page.

The demo runs this exact code. Use a Vite TypeScript page with the same file structure; the alias pins the npm release.

```sh
pnpm add soeditor-release@npm:@soeditor/editor@1.3.0 @soeditor/file-manager@1.3.0 @soeditor/adapter-sofinder@1.3.0 @soeditor/presets@1.3.0
```

<<< ../../examples/form.ts

<details>
<summary>Shared context and lifecycle</summary>

<<< ../../examples/shared.ts

</details>

<details>
<summary>Page mounting and recreation</summary>

<<< ../../examples/runner.ts

</details>

<details>
<summary>HTML / CSS</summary>

<<< ../../examples/form.html

<<< ../../examples/style.css

</details>

## Configuration and troubleshooting

Each instance receives locale at creation. Closing removes the iframe; starting again restores initial content. If styles or Source are missing, check that all build assets were deployed.

[API](/en/api/methods) · [Troubleshooting](/en/support/troubleshooting)
