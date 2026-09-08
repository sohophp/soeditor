---
title: 'Video and article preview'
description: 'Enable optional video, edit media and preview the article.'
---

# Video and article preview

Video is an explicit optional feature introduced in 1.2.0. This site pins published 1.3.0. Import `createCmsVideoPlugin()` from `@soeditor/editor/video`, add it to `plugins` and add `cmsVideo` to the toolbar. The default CMS editor does not enable video automatically.

## Minimal integration and article preview

The example uses the `soeditor-release` alias to pin the published editor. In your application, equivalent imports from the same version of `@soeditor/editor` work too.

```sh
pnpm add soeditor-release@npm:@soeditor/editor@1.3.0 @soeditor/presets@1.3.0
```

<<< ../../examples/video.ts

The demo uses a short same-origin WebM file and needs no upload service. Enable `preview: true` through `/cms/optional`; “Preview article” opens a separate window. Your browser may require permission for this user-triggered popup.

## Edit and save

Enter a supported media URL or YouTube URL in the dialog, then configure title, poster, dimensions, aspect ratio and alignment. Double-click a selected video card or press Enter to edit it; Delete/Backspace removes it. A completed edit is undoable.

The editing surface displays inert cards and does not play stored video/iframes. `getData()` returns actual HTML, not card DOM. Article preview renders allowed video independently; player UI never replaces saved article data.

An explicit `plugins` list replaces the default plugins. Keep `...cmsRuntimePreset.plugins` before appending the video plugin, as shown above.

## Origin policy

| Option                | Purpose                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `allowedMediaOrigins` | Additional HTTPS video/poster origins, without paths. Same-origin resources are always allowed.                                 |
| `youtube`             | Set to `false` to disable YouTube; the example explicitly enables it.                                                           |
| `youtubeMetadata`     | Set to `false` to disable automatic title/poster lookup. This site disables it to avoid implicit third-party metadata requests. |

For example, `createCmsVideoPlugin({ allowedMediaOrigins: ['https://media.example.com'], youtube: false })` permits your media CDN, not arbitrary embed providers. Metadata lookup contacts YouTube; never inject returned embed HTML into your page.

## Troubleshooting

- A missing video button usually means the plugin or `cmsVideo` toolbar item was omitted.
- Playback belongs to article preview or the frontend. Check URL, codec, response Content-Type, cross-origin policy and CSP if it fails; cards do not play video.
- External media and YouTube need appropriate `media-src`, `img-src` and `frame-src`; metadata queries also require `connect-src`.
- Upload and storage remain host responsibilities. The video button is not an upload backend. Preserving stored HTML never grants execution in the authoring surface.

[Run the video example](/en/examples/video)

## Our best companion: SoFinder

[SoFinder](https://sofinder.sohophp.app/) is our recommended asset management companion. See the [integration guide and example](/en/guide/sofinder) for image, file and video URL workflows, and how the simulated picker differs from a real backend.
