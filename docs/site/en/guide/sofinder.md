---
title: 'Connect SoFinder'
description: 'Install @soeditor/adapter-sofinder@1.2.1 and @soeditor/file-manager@1.2.1. Supply your existing host SoFinder selection callback to SoFinderAdapter.'
---

# Connect SoFinder

Install `@soeditor/adapter-sofinder@1.2.1` and `@soeditor/file-manager@1.2.1`. Supply your existing host SoFinder selection callback to `SoFinderAdapter`.

The bridge accepts FileManagerOpenOptions and returns a SoFinderSelection containing url, or null. The adapter maps and validates the result; it does not create a SoFinder backend or authenticate users.

The `pick` argument below is supplied by the host. The demo simulates it with a bundled asset; production should open the actual picker.

## Checked code

<<< ../../examples/api.ts#sofinder

Checked against the published types; see [imports and types](/en/api/imports) for imports.

## Create an instance with asset selection

<<< ../../examples/api.ts#asset-plugins

Then call `registerSoFinder` below. The host opens the real SoFinder picker and passes its result to the adapter. The demo's fixed-image callback does not deploy a SoFinder backend.

## Common errors

Return an empty result on cancellation rather than inserting an empty URL. The host and asset server own cross-origin access permissions.

## Next steps

[Examples](/en/examples/basic) · [Configuration](/en/api/configuration) · [Troubleshooting](/en/support/troubleshooting)
