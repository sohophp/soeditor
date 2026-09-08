---
title: 'Video and article preview example'
description: 'Try video editing, canonical HTML and independent article preview.'
---

# Video and article preview example

<EditorDemo example="video" />

## Try it

1. Inspect the initial card. The authoring surface does not fetch or play the WebM file.
2. Double-click the card or press Enter to change title and dimensions. “Edit video” can insert another video using `/demo-video.webm`.
3. Select “Read HTML” to inspect the video element. Source shows the same content, without card UI in saved data.
4. Select “Preview article”, then play the video in the popup. The sample has no audio track and is only for playback verification.
5. Close preview and select “Recreate demo” to exercise lifecycle cleanup.

## Download and complete code

[Download the published examples](/downloads/soeditor-examples-1.2.1.tar.gz), extract, run `pnpm install` and `pnpm dev`, then open `video.html`. The archive includes same-origin `public/demo-video.webm`. No article content is uploaded.

<<< ../../examples/video.ts

<details>
<summary>Shared lifecycle / 共享生命周期</summary>

<<< ../../examples/shared.ts

<<< ../../examples/runner.ts

<<< ../../examples/video.html

</details>

[Video integration guide](/en/guide/video)
