# Source editing

HTML Source is a first-class CodeMirror 6 projection over exact canonical HTML.
CodeMirror types do not cross the public SoEditor API.

```ts
import { createSourceEditingEngine } from 'soeditor';

const source = createSourceEditingEngine({
    editor,
    element: document.querySelector<HTMLElement>('#source')!,
    ariaLabel: 'Article HTML source',
});

editor.execute('editor.source');
editor.execute('editor.visual');
```

Source edits update Core transactions and share history with visual editing.
Parser diagnostics are projected in CodeMirror. While source is malformed, its
exact text remains canonical and the visual projection keeps the last valid
model instead of silently repairing or deleting content.

Complete HTML documents are preserved in Source but are not projected into the
current fragment-oriented visual engine. Unknown elements, comments, CMS
markers, and unsafe source remain data; the visual and preview boundaries must
not execute them.

Developer tools expose Find/Replace and source-range navigation through
SoEditor-owned services and commands. Destroy the source engine during host
teardown or let terminal editor destruction clean it up.
