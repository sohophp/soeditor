# Migrating from 1.1 to 1.2

The `1.2.0` release is additive and aligns all 24 public packages. Upgrade pinned
`@soeditor/*` dependencies together. Existing Classic WYSIWYG/Source integrations
continue to work; video remains an explicit optional plugin.

Import `createCmsVideoPlugin` from `@soeditor/editor/video`, include the plugin in
your existing plugin list, and add `cmsVideo` to the toolbar. See
[video configuration](configuration.md#optional-classic-video).
Native videos save as ordinary HTML video/track elements; approved YouTube videos
save as iframes. Editing cards, coordinates and recovery UI never enter saved HTML.
Existing stored unknown or executable markup stays preserved and inert.

YouTube metadata can fill untouched title and cover fields. The suggested ratio
is 9:16 for Shorts links and 16:9 for ordinary links, not the original dimensions;
manual choices are preserved. `youtubeMetadata: false` disables enrichment.
Native flags and subtitles are now under More settings.

Whole-article preview loads approved players on demand and reuses unchanged media
across text and template refreshes. Both preview surfaces include recovery controls.
The optional `@soeditor/preview/media` entry is for trusted plugin renderers only.

Toolbar tools remain icons by default. Optional drawers use an object with `id`,
`label` and `items`; see [toolbar configuration](configuration.md). Focus leaving
WYSIWYG now captures the current selection before pending selectionchange events,
so fast keyboard formatting cannot fall back to an earlier caret.

Source, formatter, video and dialog runtimes retain demand boundaries. No backend
migration is required. Validate existing upload/picker adapters and stored CMS HTML
in the host application's normal save-and-reopen flow before deployment.

## 1.2.1 patch

Use `1.2.1` for the default CMS ESM entry. It fixes a property-mangling error in the HTML tokenizer that could hang initialization in 1.2.0. All public packages remain aligned; there are no API changes.

## 1.3.0 framework components

Upgrade all packages together to `1.3.0`. The new `@soeditor/react/cms` and
`@soeditor/vue/cms` entries wrap ClassicEditor for CMS forms; existing root
Workspace hooks remain compatible. Import the CMS stylesheet explicitly and
use an optional editor factory when enabling Source. See [framework adapters](framework-adapters.md).
