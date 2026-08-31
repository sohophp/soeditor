# @soeditor/file-manager

Replaceable file-selection capability and command-driven image/media
integration for SoEditor. Applications register a `FileManager` using
`fileManagerServiceToken`; `FileManagerPlugin` adds `image.browse`,
`media.browse`, and `link.file.browse` without coupling rich-text features to
a concrete picker. Every request declares its `image`, `media`, or `file` kind
and accepted MIME families, so one CMS asset manager can serve all three flows.

The package also exports the experimental `UploadService` and `UploadPlugin`
workflow for host-owned asynchronous image uploads. Progress and temporary
Blob previews remain per editor and never enter canonical HTML. See the
[upload integration guide](../../docs/uploads.md).
