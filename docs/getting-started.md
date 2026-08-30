# Getting started

SoEditor is an ESM-first 1.0 candidate. It separates the canonical document
(`Editor`) from browser surfaces so a CMS can mount exactly the UI it needs.
The public registry reference remains 0.5.1 until an authorized candidate is
published.

## Install and create

```bash
pnpm add @soeditor/editor
```

```ts
import {
    SoEditor,
    createEditorUi,
    createVisualEditingEngine,
    minimalPreset,
} from '@soeditor/editor';
import '@soeditor/editor/styles.css';

const editor = await SoEditor.create({
    data: '<p>Hello <strong>SoEditor</strong>.</p>',
    format: minimalPreset.format,
    plugins: minimalPreset.plugins,
});

const visual = createVisualEditingEngine({
    editor,
    element: document.querySelector<HTMLElement>('#editor')!,
});
const ui = createEditorUi({
    editor,
    element: document.querySelector<HTMLElement>('#editor-ui')!,
    toolbar: minimalPreset.toolbar,
});
```

Read and replace canonical source through the editor, not through projected DOM:

```ts
const html = editor.getData();
editor.setData('<p>Loaded from the CMS.</p>');
editor.events.on('document:change', ({ current }) => {
    console.log(current.source);
});
```

## Teardown

Destroy explicitly when a page, tab, or CMS field unmounts:

```ts
ui.destroy();
visual.destroy();
await editor.destroy();
```

Editor destruction is terminal and also asks attached SoEditor surfaces to
clean up. Explicit surface teardown keeps application ownership obvious.

## Choose a configuration

- `minimalPreset`: paragraphs, bold/italic, history, and basic UI.
- `classicPreset`: common rich text, Source, diagnostics/formatting, and Preview.
- `developerPreset`: Classic plus quality diagnostics, projection/split
  infrastructure, Problems, Inspector, Outline, command palette, Find/Replace,
  and FileManager browsing.
- `markdownPreset`: canonical Markdown editing and isolated preview.

Presets supply format/plugins/toolbar only. Source, visual, Markdown, Preview,
and UI hosts remain explicit. Continue with the
[configuration guide](configuration.md) or run the Playground links for each
release configuration.

Continue with the task-oriented [API overview](api-overview.md),
[deployment and operations](deployment-operations.md), and the complete
[0.9-to-1.0 migration guide](migration-0.9-to-1.0.md). Public 0.5.1 consumers
must follow each versioned migration guide in order.
