---
title: 'SoFinder: SoEditor’s best companion'
description: 'Pair SoEditor with SoFinder for images, videos and files, with official links, picker integration code and a simulated example.'
---

# SoFinder: SoEditor’s best companion

We recommend [SoFinder](https://sofinder.sohophp.app/) as SoEditor’s best asset management companion: **SoEditor edits HTML content; SoFinder manages and selects assets**. Together in your CMS, they let authors choose images, insert file links and use video URLs with the optional video plugin.

[Visit SoFinder](https://sofinder.sohophp.app/) · [Official editor integration documentation](https://sofinder.sohophp.app/editor-integrations) · [Try the asset picker example](/en/examples/assets)

## How they work together

| CMS task                   | Responsibilities                                                                                                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Article and product images | SoFinder manages and selects images; SoEditor inserts them and edits alternative text and layout.                                                                                |
| Attachments and downloads  | SoFinder returns a file URL; SoEditor inserts a link through its file selection command.                                                                                         |
| Video assets               | Get a video URL from SoFinder and enter it in the [video dialog](/en/guide/video). Enable the video plugin separately; this example does not add a picker button to that dialog. |
| Uploads and storage        | Your SoFinder deployment owns uploads, access permissions and storage. Direct editor uploads still need a separate upload adapter.                                               |

SoFinder is optional and connects through a separate package. The default editor does not load its management interface or server SDK.

## Install and create the editor

Configure your own server and resources following the [SoFinder documentation](https://sofinder.sohophp.app/), then install the editor adapter:

```sh
pnpm add @soeditor/editor@1.2.1 @soeditor/presets@1.2.1 @soeditor/adapter-sofinder@1.2.1 @soeditor/file-manager@1.2.1
```

Place these functions in your project’s `api.ts`. Import `createClassicEditor as createOptionalEditor` from `@soeditor/editor/cms/optional`, `cmsRuntimePreset` from `@soeditor/presets/cms-runtime`, and `FileManagerPlugin`, `UploadPlugin`, `fileManagerServiceToken` from `@soeditor/file-manager`. Import `SoFinderAdapter` and the `SoFinderPicker` type from `@soeditor/adapter-sofinder`, the `ClassicEditor` type from `@soeditor/editor/cms`, and load `@soeditor/editor/cms/styles.css`.

<<< ../../examples/api.ts#asset-plugins

An explicit `plugins` list replaces the defaults, so retain `cmsRuntimePreset.plugins`. Register the picker service:

<<< ../../examples/api.ts#sofinder

## Connect the real SoFinder picker

Replace these deployment paths and the `Images` / `Files` resource names with your own routes and configured resources. The official documentation site is not your asset backend. `./api` refers to the local module containing the two functions above.

```js
// Use the picker module served by your own SoFinder installation.
import { openPicker } from '/sofinder/assets/sofinder-picker.js';
import { createAssetEditor, registerSoFinder } from './api';

const host = document.querySelector('#content');
if (!host) throw new Error('Missing #content textarea');
const editor = await createAssetEditor(host);
registerSoFinder(editor, async ({ kind }) => {
    try {
        const entry = await openPicker({
            baseUrl: '/sofinder/browser',
            kind: kind === 'image' ? 'image' : 'file',
            resource: kind === 'image' ? 'Images' : 'Files',
        });
        return {
            url: entry.url,
            name: entry.name,
            ...(entry.mimeType ? { mimeType: entry.mimeType } : {}),
            ...(entry.assetId ? { assetId: entry.assetId } : {}),
            ...(entry.alt != null ? { alt: entry.alt } : {}),
            ...(entry.width != null ? { width: entry.width } : {}),
            ...(entry.height != null ? { height: entry.height } : {}),
        };
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
            return null;
        }
        throw error;
    }
});
```

The official `openPicker` validates window messages. Convert its window-close `AbortError` to `null` and propagate other errors. Non-image dimensions may be `null`; omit them before returning a selection to the adapter. This bridge maps `media` requests to file selection; the host must still apply the requested file-type constraints.

## React, Vue and the live example

The [React](/en/guide/react) and [Vue](/en/guide/vue) CMS components can call the same `registerSoFinder` in `onReady` / `@ready`. Configure the plugins above through the optional entry when creating the instance. The component guides explain their current release status.

[Run asset selection and mock upload](/en/examples/assets): this example uses `SoFinderAdapter` with a fixed image callback, without a live SoFinder backend. Replace `pick` to connect your own library. Your host owns authentication, resource access and upload configuration.
