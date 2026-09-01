# Getting started

SoEditor is an ESM-first CMS HTML WYSIWYG editor. The supported application
entry is `@soeditor/editor/cms`; it exposes the Classic Editor without exporting
historical Markdown, Preview, review, layout or developer-tool product families.

## Install

```bash
pnpm add @soeditor/editor
```

Import the editor and its stylesheet:

```ts
import { createClassicEditor } from '@soeditor/editor/cms';
import '@soeditor/editor/styles.css';

const textarea = document.querySelector<HTMLTextAreaElement>('#content');
if (textarea === null) throw new Error('Missing #content textarea.');

const editor = await createClassicEditor(textarea, {
    locale: 'zh-CN',
    placeholder: '请输入网页内容',
    minHeight: 240,
    toolbarLayout: {
        collapsible: true,
        overflow: 'wrap',
        sticky: true,
    },
    onChange: ({ source }) => {
        console.log('Canonical HTML changed', source);
    },
});
```

WYSIWYG is the only default editing mode. The original textarea remains the
successful form control: its value follows canonical HTML, is refreshed before
form submission and is restored through the editor on form reset.

## Optional HTML Source

Source is explicit and lazy in ESM applications:

```ts
const editor = await createClassicEditor(textarea, {
    editingModes: ['wysiwyg', 'source'],
    initialEditingMode: 'wysiwyg',
});
```

This configuration dynamically loads `@soeditor/source` and CodeMirror. The
standalone browser global intentionally supports WYSIWYG only so Source cost is
never hidden in the default CDN artifact.

## Read, write and save

Use the Classic handle rather than reading projected DOM:

```ts
const html = editor.getData();
editor.setData('<p>从 CMS 加载的内容。</p>');

await editor.execute('save'); // when a save adapter is configured
```

Normal form posts need no custom synchronization. For Ajax saving, configure a
host-owned adapter as described in [CMS saving](cms-saving.md).

## CMS semantic styles

Styles are instance configuration rather than global editor state:

```ts
const editor = await createClassicEditor(textarea, {
    config: {
        cms: {
            styles: [
                {
                    id: 'lead',
                    label: '导语',
                    target: 'inline',
                    element: 'span',
                    attributes: [{ name: 'class', value: 'cms-lead' }],
                },
                {
                    id: 'callout',
                    label: '提示框',
                    target: 'block',
                    element: 'blockquote',
                    attributes: [{ name: 'class', value: 'cms-callout' }],
                },
            ],
        },
    },
});
```

The CMS supplies matching content CSS. Definitions reject event handlers and
CSS outside the bounded style policy.

## Teardown

Destroy each editor when its CMS field or page unmounts:

```ts
await editor.destroy();
```

This removes owned DOM, listeners, observers and async work, restores the host
and releases document overflow changed by maximize mode.

Continue with [configuration](configuration.md),
[CMS integration](cms-integration.md), [classic UI](classic-ui.md),
[uploads](uploads.md), [paste](paste.md), and the
[CKEditor 4 migration guide](ckeditor4-migration.md).
