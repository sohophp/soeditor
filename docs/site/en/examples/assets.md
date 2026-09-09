---
title: Mock upload and picker
description: Choose the sample image or select a local file for a mock upload. Enable failure and retry.
---

# Mock upload and picker

Choose the sample image or select a local file for a mock upload. Enable failure and retry.

<EditorDemo example="assets" />

## What to verify

Choose the sample image or select a local file for a mock upload. Enable failure and retry. Read HTML displays canonical content. Recreate demo destroys and remounts the instances. Upload and save send no editing content; mock uploads return the bundled image.

## Complete integration code

[Download all example sources](/downloads/soeditor-examples-1.4.0.tar.gz). Extract, run `pnpm install` and `pnpm dev`, then open `basic.html` or another example page.

The demo runs this exact code. Use a Vite TypeScript page with the same file structure; the alias pins the npm release.

```sh
pnpm add soeditor-release@npm:@soeditor/editor@1.4.0 @soeditor/file-manager@1.4.0 @soeditor/adapter-sofinder@1.4.0 @soeditor/presets@1.4.0
```

<<< ../../examples/assets.ts

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

<<< ../../examples/assets.html

<<< ../../examples/style.css

</details>

## Configuration and troubleshooting

Each instance receives locale at creation. Closing removes the iframe; starting again restores initial content. If styles or Source are missing, check that all build assets were deployed.

[API](/en/api/methods) · [Troubleshooting](/en/support/troubleshooting)

## Our best companion: SoFinder

[SoFinder](https://sofinder.sohophp.app/) is our recommended asset management companion. See the [integration guide and example](/en/guide/sofinder) for image, file and video URL workflows, and how the simulated picker differs from a real backend.
