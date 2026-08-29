# @soeditor/engine

This package provides SoEditor's controlled browser visual-editing engine.

```ts
import { Editor } from '@soeditor/core';
import {
    createVisualEditingEngine,
    HistoryPlugin,
    StructuredEditingPlugin,
} from '@soeditor/engine';

const editor = await Editor.create({
    data: '<p>Hello</p>',
    plugins: [HistoryPlugin, StructuredEditingPlugin],
});
const visual = createVisualEditingEngine({
    editor,
    element: document.querySelector('#editor')!,
});
```

The engine edits a bounded paragraph/list/mark/link subset. Unsupported HTML is
retained as inert opaque content rather than injected into the editing DOM. The
live DOM is a projection; user changes become Core transactions.

Add `HistoryPlugin` to enable transaction-backed `editor.undo` and
`editor.redo`. The Phase 4 surface also owns copy, cut, paste, and standard
undo/redo keyboard shortcuts.

`StructuredEditingPlugin` provides a per-editor registry for custom structured
block conversion. Phase 23 custom blocks are atomic or readonly and remain
inert; interactive node views are an optional, separate runtime contribution. Visual
transactions expose validated `EditingOperation` metadata through
`readEditingOperations()` for position-aware plugins.
