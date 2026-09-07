# @soeditor/file-manager

Replaceable file-selection capability and command-driven image/media
integration for SoEditor. Applications register a `FileManager` using
`fileManagerServiceToken`; `FileManagerPlugin` adds `image.browse`,
`media.browse`, and `link.file.browse` without coupling rich-text features to
a concrete picker. Every request declares its `image`, `media`, or `file` kind
and accepted MIME families, so one CMS asset manager can serve all three flows.
Image results may additionally provide `assetId`, `srcset`, and `sizes`.
SoEditor validates these values and serializes them as neutral HTML
`data-asset-id`, `srcset`, and `sizes` attributes; backend-specific classes are
never added. Hosts should provide `sizes` only when it matches their actual CMS
layout.

The package also exports the experimental `UploadService` and `UploadPlugin`
workflow for host-owned asynchronous image uploads. Progress and temporary
Blob previews remain per editor and never enter canonical HTML. See the
[upload integration guide](../../docs/uploads.md).

When `UploadPlugin` is installed, each attached UI shows upload tasks in its
status area: file name, native progress, failure reason, Cancel or Retry, and
Close after completion or cancellation. Rows keep keyboard focus during progress
updates. Closing feedback does not alter content. Failed tasks remain available
for retry; readonly editing disables retry. English and both Chinese locales are
supported. Image paste batches are validated before starting any task, so a size,
type, or concurrency rejection is reported without partially starting the batch.
