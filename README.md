# SoEditor

Developer-first extensible content editor.

**Status: early development.** SoEditor is not production ready. Phase 1
established framework-agnostic core infrastructure, and Phase 2 completed the
independent HTML document layer. There is no editing UI yet.

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
- `@soeditor/engine` — an intentionally empty future editing-engine boundary.
- `@soeditor/playground` — a minimal development harness for the core APIs.

## Development

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```
