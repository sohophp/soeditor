# SoEditor

Developer-first extensible content editor.

**Status: early development.** SoEditor is not production ready. Phase 1
establishes framework-agnostic state, transaction, command, plugin, event, and
service infrastructure; it does not include an editing UI.

```ts
import { Editor } from '@soeditor/core';

const editor = await Editor.create({
    data: '<p>Hello</p>',
});
```

## Workspace

- `@soeditor/core` — independent editor infrastructure with no DOM dependency.
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
