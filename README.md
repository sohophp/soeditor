# SoEditor

Developer-first extensible content editor.

**Status: early development.** SoEditor is not production ready. The repository
contains the framework-agnostic Core, HTML document layer, and Phase 3 minimal
controlled visual-editing engine. The configurable product UI is not built yet.

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
- `@soeditor/engine` — controlled contenteditable projection for the initial
  paragraph/text/strong/emphasis editing subset.
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
