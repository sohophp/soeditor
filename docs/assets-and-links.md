# Images, files and internal links

These APIs are **Unreleased source changes**. Published 1.5.0 does not include the new `./browser`, `./ckfinder`, or `./links` entries. CoreRepo uses local pnpm patches while these changes are tried.

The default `image-actions` menu offers upload, file manager and URL insertion. The `link` dialog and Image properties' link URL share file selection and optional `/` internal-page search. Picking a target fills the dialog; Cancel leaves the document unchanged, Save uses editing commands and supports Undo/Redo. Resource-service uploads or deletions are independent and cannot be undone by cancelling the editor dialog.

The compatible `image-browse`, `image-upload` and `file-link` shortcuts remain available only when explicitly included in a toolbar.

The footer keeps one fixed-height line on wide and narrow screens, including during uploads. Long status text uses ellipsis with the full value on hover, while Cancel/Retry/Close stay visible. Multiple tasks scroll horizontally; focusing a button with Tab brings its task into view. Successful uploads disappear automatically without a Close button. Pending tasks retain Cancel, failures retain Retry, and cancelled tasks can be dismissed. Status actions do not change content or delete uploaded files. Hosts using the standard CMS stylesheet need no custom layout code.

```ts
import { createClassicEditor } from '@soeditor/editor/cms/optional';
import { cmsRuntimePreset } from '@soeditor/presets/cms-runtime';
import {
    FileManagerPlugin,
    UploadPlugin,
    fileManagerServiceToken,
    uploadServiceToken,
    linkTargetProviderServiceToken,
    createFileManagerLinkTargetProvider,
    createHttpLinkTargetSearch,
} from '@soeditor/file-manager';
import { createSoFinderBrowserAdapters } from '@soeditor/adapter-sofinder/browser';
import '@soeditor/editor/cms/styles.css';

const adapters = createSoFinderBrowserAdapters({
    baseUrl: '/my-site/sofinder',
    csrfToken: () => currentCsrfToken,
    language: 'en',
});
const editor = await createClassicEditor(textarea, {
    plugins: [...cmsRuntimePreset.plugins, FileManagerPlugin, UploadPlugin],
    toolbar: [...cmsRuntimePreset.toolbar],
});
editor.editor.services.register(fileManagerServiceToken, adapters.fileManager);
editor.editor.services.register(uploadServiceToken, adapters.upload);
editor.editor.services.register(
    linkTargetProviderServiceToken,
    createFileManagerLinkTargetProvider({
        fileManager: adapters.fileManager,
        searchInternal: createHttpLinkTargetSearch({
            endpoint: '/my-site/admin/pages/search',
        }),
    }),
);
```

The host supplies `textarea` and `currentCsrfToken`. Omit `searchInternal` to disable page search. With only a file-manager service, `FileManagerPlugin` supplies selection through `link.file.select` automatically. An explicitly registered link-target provider takes precedence, preserving existing host URL mapping and search behavior.

## Optional SoFinder browser adapter

`createSoFinderBrowserAdapters(options)` returns `{ fileManager, upload }`. SDK modules are loaded only when first used from `baseUrl/assets/sofinder-picker.js` and `baseUrl/assets/sofinder-sdk.js`; the picker uses `baseUrl/browser`, uploads use `baseUrl/api`.

| Option                           | Contract                                                                                                                                                                                |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `baseUrl`                        | Required HTTP(S) URL or site-relative path. Use a same-origin gateway for session cookies; cross-origin deployments must provide compatible authentication, CORS and SDK origin checks. |
| `csrfToken`                      | Required string or callback, read immediately before upload. Empty tokens reject uploads.                                                                                               |
| `language`                       | Optional picker language.                                                                                                                                                               |
| `imageResource` / `fileResource` | Default `Images` / `Files`, locked for each operation; server authorization remains mandatory.                                                                                          |
| `uploadPath`                     | Optional resource-relative directory, default empty.                                                                                                                                    |
| `loadModule(url)`                | Optional SDK module loader for bundlers, CSP or tests.                                                                                                                                  |

The full picker permits uploading a file before selecting its link. Direct image uploads use SDK chunking and rename-on-conflict. Picker cancellation returns null; upload cancellation rejects with `AbortError`. Errors never silently switch providers. Original returned URLs and available metadata are retained; no CMS URL rules are assumed.

## Optional CKFinder adapter

```ts
import { createCKFinderBrowserAdapters } from '@soeditor/file-manager/ckfinder';
const adapters = createCKFinderBrowserAdapters({
    scriptUrl: '/resources/ckfinder/ckfinder.js',
    connectorUrl:
        '/my-site/resources/ckfinder/core/connector/php/connector.php',
});
```

Register its services exactly as above. The lazy modal uses `Images` / `Files` by default; closing resolves to null. Uploads retain the same-origin QuickUpload connector and CKFinder double-submit CSRF cookie/form protocol. Optional `imageResource`, `fileResource`, `csrfCookieName` and `loadSdk()` customize the deployment. License, session, permissions and file restrictions remain server responsibilities. The host chooses one provider according to user preferences; save and reopen existing editor pages after switching.

## Internal-page search

`createHttpLinkTargetSearch({ endpoint, fetch? })` implements `searchInternal(query)`. Only slash-prefixed queries of at most 100 characters are requested; `//` is rejected. The same-origin GET includes `q`, same-origin credentials and `Accept: application/json`. Return:

```json
{ "targets": [{ "href": "/my-site/about", "title": "About us" }] }
```

At most 50 results are used. URLs must start with a single `/`, contain no control characters or backslashes, and be at most 2048 characters; nonempty titles are at most 512 characters and render as text. The endpoint must independently check login, current account status, site ownership and visibility. Return `Cache-Control: private, no-store`; prefer published public pages rather than private admin records.

A custom `searchInternal(query)` callback can return the same promise-based array. SoEditor owns debounce, stale-result suppression, Arrow/Enter/Escape interaction and dialog lifecycle; frontend validation never substitutes for authorization.

## Custom mapping and lower-level interfaces

`createFileManagerLinkTargetProvider({ fileManager, searchInternal?, resolveFile? })` preserves `file.url` as `href` and uses its name as title. Optional `resolveFile(file)` returns `{ href, title? }` or a Promise for host-owned download pages; the provider stays busy during both selection and asynchronous mapping.

`FileManagerPlugin` retains `image.browse`, `media.browse` and direct insertion through `link.file.browse`; `link.file.select` accepts no arguments and returns a target without changing the document. It obeys editable command and pending-selection constraints; results arriving after destruction are ignored.

Existing injected `SoFinderAdapter({ pick })`, `SoFinderUploadAdapter({ upload })`, `FileManager` and `UploadService` contracts remain supported. Custom dialogs may lazily import `resolveLinkTargetProvider(editor)` and `attachLinkTargetControls(options)` from `@soeditor/ui/links`; call the returned disposer when closing.

SoEditor owns editing, dialogs, history and generic SDK adapters. SoFinder owns storage, formats, upload limits, management and selection messages. The host owns session/site authorization, configuration and page data. Neither independent product imports CoreRepo classes or database rules. Local automated validation is recorded under Unreleased in the root changelog; it is not authenticated admin or Windows acceptance.

### Failed SoFinder module loading

The default browser loader keeps SDKs lazy and caches successful modules. After a failed import, the next user operation uses a fresh `soeditorRetry` query to avoid the browser module map retaining the failure. A bounded HTTP probe runs only after failure to distinguish 401 (sign in again), 403 (identity verification or permissions) and temporary resource failures; messages follow `language` (`en`, `zh-CN`, `zh-TW`). Save unsaved content before signing in again. The adapter does not refresh the editor or weaken server authorization. An injected `loadModule` retains responsibility for loading and retries.
