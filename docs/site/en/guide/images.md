---
title: 'Images'
description: 'Insert images and edit their URL, alternative text, dimensions and content attributes.'
---

# Images

Insert an image by URL, upload adapter or asset picker. Edit alternative text, dimensions and related properties in the dialog. Preserve meaningful descriptions when replacing an image.

Choose alt text for the image’s purpose. Decorative and informative images need different treatment. Use real resource dimensions when configuring size.

Upload progress and temporary previews are UI state and must not become persisted HTML. [Connect uploads](/en/guide/uploads).

## Minimal content and expected behavior

<<< ../../examples/api.ts#image

Pass an image URL already validated by the host. After editing image properties with contextual tools, `getData()` should contain the image URL, alternative text and content attributes.

## Common errors

For missing images, check the URL, access permissions and content security policy. Upload and asset selection require separate adapters; a toolbar button is not an upload backend.

## Next steps

[Examples](/en/examples/basic) · [Configuration](/en/api/configuration) · [Troubleshooting](/en/support/troubleshooting)
