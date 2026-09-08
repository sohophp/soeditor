---
title: 'Imports and types'
description: 'Use @soeditor/editor/cms for ordinary CMS editing and /cms/optional for Source, preview or save adapters. Import /cms/styles.css separately.'
---

# Imports and types

Use `@soeditor/editor/cms` for ordinary CMS editing and `/cms/optional` for Source, preview or save adapters. Import `/cms/styles.css` separately.

```ts
import type {
    ClassicEditor,
    CreateClassicEditorOptions,
} from '@soeditor/editor/cms';
```

`@soeditor/file-manager` and `@soeditor/adapter-sofinder` are explicit asset integration entries. A file in a published package is not necessarily public API: do not deep-import src or internal dist files.

The published examples use the `soeditor-release` npm alias to pin the published package without monorepo source linking. Normal applications can use the original package name.

## External asset plugins in 1.2.1

Use `/cms/optional` when composing `@soeditor/presets` with separately imported asset plugins. The prebundled `/cms` entry and external UI plugins can otherwise create separate registry identities and fail with “UI registry storage is unavailable.” This integration uses the modular optional entry without enabling Source, preview or saving. Plain textarea, form and multi-instance examples keep `/cms`.

## Framework components and video

| Entry                    | Availability and purpose                                    |
| ------------------------ | ----------------------------------------------------------- |
| `@soeditor/editor/video` | Published; `createCmsVideoPlugin()` enables optional video. |
| `@soeditor/react/cms`    | Unreleased workspace component using `value/onChange`.      |
| `@soeditor/vue/cms`      | Unreleased workspace component supporting `v-model`.        |

[React guide](/en/guide/react) · [Vue guide](/en/guide/vue) · [Video guide](/en/guide/video). Local framework previews explicitly use workspace packages and stay outside the published examples.

## Next steps

[Examples](/en/examples/basic) · [Configuration](/en/api/configuration) · [Troubleshooting](/en/support/troubleshooting)
