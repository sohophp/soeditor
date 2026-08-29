# @soeditor/file-manager

Replaceable file-selection capability and command-driven image/media
integration for SoEditor. Applications register a `FileManager` using
`fileManagerServiceToken`; `FileManagerPlugin` adds `image.browse` and
`media.browse` without coupling either rich-text feature to a concrete picker.
