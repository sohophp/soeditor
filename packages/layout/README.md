# @soeditor/layout

Accessible, command-driven two-pane layouts for SoEditor projection hosts.
Applications continue to create and own Visual, Source, Markdown, and Preview
engines explicitly; this package coordinates only layout state and DOM.

Phase 20 supports `visual-source`, `source-preview`, and `markdown-preview`.

```ts
import {
    createSplitViewLayout,
    Editor,
    ProjectionCoordinatorPlugin,
    SplitViewPlugin,
} from '@soeditor/editor';
import '@soeditor/editor/styles.css';

const editor = await Editor.create({
    data: '<p>Hello</p>',
    plugins: [ProjectionCoordinatorPlugin, SplitViewPlugin],
});

const layout = createSplitViewLayout({
    editor,
    element: document.querySelector('#split-view')!,
    hosts: {
        source: document.querySelector('#source')!,
        visual: document.querySelector('#visual')!,
    },
    initialPair: 'visual-source',
});

// Restores every host to its original DOM position.
layout.destroy();
```

Applications must attach the corresponding projection engines before opening a
pair. Layout actions are available through the shared command registry, including
`layout.split.open`, `layout.split.resize`, `layout.split.collapse`, and
`layout.split.focus`.
