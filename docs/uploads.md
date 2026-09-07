# CMS uploads and image assets

SoEditor owns upload workflow state, while the application owns transport,
authentication, authorization, storage, and server-side processing. Register a
per-editor `UploadService` after creating the Classic editor:

```ts
import { uploadServiceToken } from '@soeditor/file-manager';

classic.editor.services.register(uploadServiceToken, {
    create(request) {
        const controller = new AbortController();
        const listeners = new Set();
        return {
            cancel: () => controller.abort(),
            result: uploadToCms(request.file, {
                signal: controller.signal,
                onProgress: (progress) =>
                    listeners.forEach((listener) => listener(progress)),
            }),
            subscribe(listener) {
                listeners.add(listener);
                return () => listeners.delete(listener);
            },
        };
    },
});
```

Per-instance `cms.upload.maxFileBytes` (default 25 MB) and
`cms.upload.maxConcurrent` (default 4, maximum 16) bound client work before the
adapter is called.

With `UploadPlugin`, the editor status area displays file names, progress and
failure reasons. Authors can cancel pending tasks, retry failed tasks, and close
completed or cancelled feedback. Rows retain focus while progress changes; retry
is disabled in readonly mode. Feedback and preview URLs are not saved as HTML.
Pasted image batches are preflighted together before starting any upload, so an
invalid type, excessive file size or concurrency limit produces visible paste
feedback without partially starting the batch.

The adapter must resolve to the same validated asset shape used by
`FileManager`: a safe `url` plus optional name, alt, MIME type, width, height,
and bounded metadata. A rejected promise records failure evidence and may be
retried; cancellation delegates to the host task.

File input, pasted images, and dropped images use this boundary. Existing
assets still use the independent `FileManager` picker. Unsupported files and
unsafe upload results are rejected without changing canonical HTML.

Temporary previews are Blob URLs exposed only by `UploadWorkflowService`
records. They are never written to document HTML and are revoked after
success, failure, cancellation, retry transition, or editor destruction.
Successful assets are inserted through `media.insert`, or replace a selected
figure through `media.update`, so accepted results remain transactional.

Structured images support alt text, title, width/height, aspect-ratio locking,
caption, alignment, bounded responsive classes, a safe link, source
replacement, and removal. The host must still validate files and results on
the server; client MIME checks are defense in depth, not authorization.
