---
title: 'Upload images'
description: 'Connect upload tasks, cancellation, progress and failure handling through a host-owned adapter.'
---

# Upload images

Install the matching `@soeditor/file-manager@1.3.0` and register `uploadServiceToken` per instance. `create(request)` returns a task with result, cancel and subscribe.

Resolve result with a safe URL and image metadata, reject on failure, cancel the actual request in cancel, and report progress through subscribe.

Client defaults are 25 MB per file and four concurrent uploads. The server still owns authentication, type and size validation, and storage authorization. The demo never transmits the selected file; success returns a bundled image. [Run uploads](/en/examples/assets).

## Plugins and adapter

Use `/cms/optional` for external asset plugins in 1.3.0; see the [entry limitation](/en/api/imports#external-asset-plugins).

```sh
pnpm add @soeditor/file-manager@1.3.0 @soeditor/presets@1.3.0
```

Preserve the CMS plugins and explicitly add asset plugins before registering services. A service registration alone does not register the `image.upload` command.

<<< ../../examples/api.ts#asset-plugins

The [complete upload implementation](/en/examples/assets) includes tasks, cancellation, failure/retry and HTML output. Success inserts the asset URL; failure keeps existing content and permits retry.

## Common errors

For an unregistered command, check `UploadPlugin`. For a pending upload, check that `result` settles. Cancel requests and destroy the instance when leaving the page. The mock adapter is not production storage.

## Next steps

[Examples](/en/examples/basic) · [Configuration](/en/api/configuration) · [Troubleshooting](/en/support/troubleshooting)

## Our best companion: SoFinder

[SoFinder](https://sofinder.sohophp.app/) is our recommended asset management companion. See the [integration guide and example](/en/guide/sofinder) for image, file and video URL workflows, and how the simulated picker differs from a real backend.
