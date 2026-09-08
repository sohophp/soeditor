---
title: 'Asset picker'
description: 'Register a host-owned asset picker and insert selected resources through public commands.'
---

# Asset picker

Implement `FileManager.open(options)`. Return one asset with a safe URL, or null when cancelled. The CMS host owns the picker; it is not part of editor Core.

Register it per instance using `fileManagerServiceToken`. Start selection through the image picker control or `media.browse`; commands insert accepted results.

Uploading and choosing an existing asset are independent capabilities and can use separate services.

## Checked code

<<< ../../examples/api.ts#picker

Checked against the published types; see [imports and types](/en/api/imports) for imports.

## Enable asset commands

<<< ../../examples/api.ts#asset-plugins

Add `FileManagerPlugin` during creation before registering the service below. Return `null` on cancellation; existing content should remain unchanged.

## Common errors

`media.browse` is unavailable if only the service is registered. Return an accessible asset URL, not a local filesystem path from the host machine.

## Next steps

[Examples](/en/examples/basic) · [Configuration](/en/api/configuration) · [Troubleshooting](/en/support/troubleshooting)

## Our best companion: SoFinder

[SoFinder](https://sofinder.sohophp.app/) is our recommended asset management companion. See the [integration guide and example](/en/guide/sofinder) for image, file and video URL workflows, and how the simulated picker differs from a real backend.
