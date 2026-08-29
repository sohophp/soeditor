# @soeditor/markdown

Canonical Markdown editing and projection for SoEditor.

```ts
import { Editor } from '@soeditor/core';
import {
    createMarkdownEditingEngine,
    createMarkdownPreviewRenderer,
    MarkdownPlugin,
} from '@soeditor/markdown';
import { createPreviewEngine, PreviewPlugin } from '@soeditor/preview';

const editor = await Editor.create({
    data: '# Hello',
    format: 'markdown',
    plugins: [MarkdownPlugin, PreviewPlugin],
});

createMarkdownEditingEngine({ editor, element: markdownHost });
createPreviewEngine({
    editor,
    element: previewHost,
    renderer: createMarkdownPreviewRenderer(),
});
```

Markdown is canonical and is never silently converted to HTML. Raw HTML is
preserved by the default renderer, but that rendered result is not sanitized;
use the sandboxed `@soeditor/preview` engine as the execution boundary.

`htmlToMarkdown()` is an intentional conversion API. Its result includes loss
notices because comments, document chrome, ordinary attributes, and unsupported
structures may be lost or normalized. Parser recovery from invalid HTML is also
reported.
