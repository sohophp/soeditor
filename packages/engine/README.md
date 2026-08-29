# @soeditor/engine

This package provides SoEditor's controlled browser visual-editing engine.

```ts
import { Editor } from '@soeditor/core';
import { createVisualEditingEngine } from '@soeditor/engine';

const editor = await Editor.create({ data: '<p>Hello</p>' });
const visual = createVisualEditingEngine({
    editor,
    element: document.querySelector('#editor')!,
});
```

The Phase 3 engine edits paragraphs, text, strong, and emphasis. Unsupported HTML
is retained as inert opaque content rather than injected into the editing DOM.
The live DOM is a projection; user changes become Core transactions.
