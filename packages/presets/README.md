# @soeditor/presets

Immutable plugin and toolbar definitions for CMS and historical compatibility
configurations. `cmsPreset` is the supported authoring default used by
`createClassicEditor`; it contains normal CMS rich text, links, images, tables,
paste, upload and UI infrastructure without Source, Preview, diagnostics,
formatting, email, generic media/video, review or developer tools.

The CMS preset includes command-backed text color, background color and font
size controls. HTML Source is attached separately only when an editor instance
explicitly requests it. Classic, developer and Markdown presets remain
compatibility surfaces and do not define the active product roadmap.
