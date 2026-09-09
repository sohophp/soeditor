---
title: 'Video and article preview'
description: 'Default video tools, lazy loading, origin configuration and runnable examples.'
---

# Video and article preview

Since 1.4.0, Classic editors include the video button and inert video cards by default, including the React and Vue components. Dialogs and players load on first use. All examples here use published npm 1.4.0.

## Default behavior and opt-out

```ts
import { createClassicEditor } from '@soeditor/editor/cms';
import '@soeditor/editor/cms/styles.css';

const host = document.querySelector<HTMLTextAreaElement>('#content');
if (host === null) throw new Error('Missing textarea');
const editor = await createClassicEditor(host);
// Opt out: createClassicEditor(host, { video: false })
// Configure: createClassicEditor(host, { video: { youtube: false } })
```

Include `cmsVideo` when supplying your own `toolbar`; explicit toolbars are not extended automatically. The automatically installed plugin disables YouTube metadata queries by default.

## Minimal integration and article preview

The example uses the `soeditor-release` alias to pin the published editor. In your application, equivalent imports from the same version of `@soeditor/editor` work too.

```sh
pnpm add soeditor-release@npm:@soeditor/editor@1.4.0
```

<<< ../../examples/video.ts

The demo uses a short same-origin WebM file and needs no upload service. Enable `preview: true` through `/cms/optional`; “Preview article” opens a separate window. Your browser may require permission for this user-triggered popup.

## Edit and save

Enter a supported media URL or YouTube URL in the dialog, then configure title, poster, dimensions, aspect ratio and alignment. Double-click a selected video card or press Enter to edit it; Delete/Backspace removes it. A completed edit is undoable.

The editing surface displays inert cards and does not play stored video/iframes. `getData()` returns actual HTML, not card DOM. Article preview renders allowed video independently; player UI never replaces saved article data.

Configure policy through `video`. Existing explicit `createCmsVideoPlugin()` integrations remain supported and take precedence over automatic installation; use `/cms/optional` when composing external plugins.

## Origin policy

| Option                | Purpose                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `allowedMediaOrigins` | Additional HTTPS video/poster origins, without paths. Same-origin resources are always allowed.                                 |
| `youtube`             | Set to `false` to disable YouTube; the example explicitly enables it.                                                           |
| `youtubeMetadata`     | Set to `false` to disable automatic title/poster lookup. This site disables it to avoid implicit third-party metadata requests. |

For example, `createClassicEditor(host, { video: { allowedMediaOrigins: ['https://media.example.com'], youtube: false } })` permits your media CDN, not arbitrary embed providers. Metadata lookup contacts YouTube; never inject returned embed HTML into your page.

## Troubleshooting

- For a missing video button, check `video: false` and whether your explicit toolbar includes `cmsVideo`.
- Playback belongs to article preview or the frontend. Check URL, codec, response Content-Type, cross-origin policy and CSP if it fails; cards do not play video.
- External media and YouTube need appropriate `media-src`, `img-src` and `frame-src`; metadata queries also require `connect-src`.
- Upload and storage remain host responsibilities. The video button is not an upload backend. Preserving stored HTML never grants execution in the authoring surface.

[Run the video example](/en/examples/video)

## Our best companion: SoFinder

[SoFinder](https://sofinder.sohophp.app/) is our recommended asset management companion. See the [integration guide and example](/en/guide/sofinder) for image, file and video URL workflows, and how the simulated picker differs from a real backend.
