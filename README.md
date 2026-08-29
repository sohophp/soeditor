# SoEditor

Developer-first extensible content editor.

**Status: early development.** SoEditor is not production ready. The repository
contains the framework-agnostic Core, HTML document layer, controlled visual
editing engine, transaction history/clipboard boundaries, and Phase 5
command-driven rich-text feature plugins. Phase 6 adds exact CodeMirror-powered
HTML source editing and parser diagnostics. Phase 7 adds extensible HTML
problems and explicit Prettier formatting. Phase 8 adds a configurable,
framework-agnostic editor UI foundation.

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
- `@soeditor/html-tools` — UI-independent diagnostic providers/problems and
  explicit, guarded HTML formatting.
- `@soeditor/ui` — configurable command toolbar, menus, dialogs, balloons,
  notifications, shortcuts, status, and theme variables.
- `@soeditor/playground` — an integrated browser development and verification
  harness.

## Development

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```
