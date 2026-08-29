# SoEditor

Developer-first extensible content editor.

**Status: early development.** SoEditor is not production ready. The repository
contains the framework-agnostic Core, HTML document layer, controlled visual
editing engine, transaction history/clipboard boundaries, and Phase 5
command-driven rich-text feature plugins. Phase 6 adds exact CodeMirror-powered
HTML source editing and parser diagnostics. The configurable product UI is not
built yet.

```ts
import { Editor } from '@soeditor/core';

const editor = await Editor.create({
    data: '<p>Hello</p>',
});
```

## Workspace

- `@soeditor/core` — independent editor infrastructure with no DOM dependency.
- `@soeditor/html` — HTML parsing, diagnostics, source locations, and semantic
  serialization with a SoEditor-owned public tree.
- `@soeditor/engine` — controlled contenteditable projection, transaction
  history, selection, clipboard handling, and the typed visual-feature service.
- `@soeditor/rich-text` — independent command plugins for common inline/block
  formatting, links, lists, images, and basic tables.
- `@soeditor/source` — CodeMirror 6 HTML source mode, exact Core
  synchronization, and parser diagnostic projection.
- `@soeditor/playground` — a development harness for Core and the minimal visual
  engine.

## Development

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```
