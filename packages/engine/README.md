# @soeditor/engine

This package provides SoEditor's controlled browser visual-editing engine.

```ts
import { Editor } from '@soeditor/core';
import { createVisualEditingEngine, HistoryPlugin } from '@soeditor/engine';

const editor = await Editor.create({
    data: '<p>Hello</p>',
    plugins: [HistoryPlugin],
});
const visual = createVisualEditingEngine({
    editor,
    element: document.querySelector('#editor')!,
});
```

The Phase 3 engine edits paragraphs, text, strong, and emphasis. Unsupported HTML
is retained as inert opaque content rather than injected into the editing DOM.
The live DOM is a projection; user changes become Core transactions.

Add `HistoryPlugin` to enable transaction-backed `editor.undo` and
`editor.redo`. The Phase 4 surface also owns copy, cut, paste, and standard
undo/redo keyboard shortcuts.
