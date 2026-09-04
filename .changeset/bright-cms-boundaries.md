---
'@soeditor/editor': minor
'@soeditor/presets': minor
'@soeditor/preview': minor
'@soeditor/source': minor
'@soeditor/ui': minor
---

Add bounded side-by-side and stacked WYSIWYG/Source views, debounced Source
formatting, passive selection synchronization, and isolated popup preview
templates while keeping Source, Preview, their styles, and host-owned file
management outside the default CMS runtime. Source, Preview, and save adapters
now use the explicit `@soeditor/editor/cms/optional` entry. Integrations that
need the bundled file-manager/upload commands can pass `cmsPreset` explicitly.
Historical Classic, Developer, and Markdown preset controls now register through
the explicit `@soeditor/ui/compatibility` entry, so those supported presets keep
their documented toolbar behavior without adding Preview, Media, or Markdown UI
to the default CMS bundle.
