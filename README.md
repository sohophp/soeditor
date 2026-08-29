# SoEditor

Developer-first extensible content editor.

**Status: 0.8 Review Workflow release candidate.** SoEditor is suitable for
evaluation and integration development, but is not yet a stable 1.0 release.
The public registry reference remains 0.5.1 until authorized publication. The
repository contains the framework-agnostic Core, HTML document layer, controlled visual
editing engine, transaction history/clipboard boundaries, and Phase 5
command-driven rich-text feature plugins. Phase 6 adds exact CodeMirror-powered
HTML source editing and parser diagnostics. Phase 7 adds extensible HTML
problems and explicit Prettier formatting. Phase 8 adds a configurable,
framework-agnostic editor UI foundation. Phase 9 adds an isolated configurable
preview environment. Phase 10 adds canonical Markdown source editing, isolated
Markdown preview, raw HTML passthrough, and an explicitly lossy HTML bridge.
Phase 11 adds docked HTML Problems, element path/Inspector, heading Outline,
command palette, Find/Replace, and diagnostic-to-source navigation.
Phase 12 adds a replaceable FileManager capability, validated command-driven
image selection, and a dependency-free SoFinder picker adapter.
Phase 13 adds a public plugin-authoring facade, status contributions, immutable
minimal/classic/developer/Markdown presets, and external-package verification.
Phase 14 adds the `@soeditor/editor` ESM umbrella, narrow preset entries, a frozen
direct-browser global, standalone CSS/maps, and clean NodeNext/Vite/CDN
consumer verification.
Phases 17–21 add configurable accessibility/SEO diagnostics, observable
validation workflows, persistent single-writer projections, accessible split
layouts, and a curated SDK/preset/distribution surface. Phases 23–26 add
structured extension contracts, command-backed node views, bounded tables and
media, and a packed third-party widget release gate. Phase 27 adds host-owned,
operation-mapped comments and non-canonical visual decorations; Phase 28 adds
host-owned revision history, semantic comparison, restore, and review policies.
Phase 29 makes those packages public with explicit export/erasure governance
and a 19-package release gate. Phase 30 adds a private, framework-neutral
workspace controller for explicit application mounting, reverse teardown,
controlled/uncontrolled values, and bounded in-process recovery. Phases 31–32
add private React/Vue adapters, offline plugin tooling, and explicit Workspace
integration diagnostics for the pending 0.9 line.

```ts
import { SoEditor, minimalPreset } from '@soeditor/editor';

const editor = await SoEditor.create({
    data: '<p>Hello</p>',
    format: minimalPreset.format,
    plugins: minimalPreset.plugins,
});
```

## Workspace

- `@soeditor/core` — independent editor infrastructure with no DOM dependency.
- `@soeditor/comments` — host-owned mapped annotations, comment commands, and
  accessible review UI with explicit export and permanent erasure.
- `@soeditor/html` — HTML parsing, diagnostics, source locations, and semantic
  serialization with a SoEditor-owned public tree.
- `@soeditor/engine` — controlled contenteditable projection, transaction
  history, selection, clipboard handling, and the typed visual-feature service.
- `@soeditor/rich-text` — independent command plugins for common inline/block
  formatting, links, lists, structured tables, and safe figure/media widgets.
- `@soeditor/source` — CodeMirror 6 HTML source mode, exact Core
  synchronization, and parser diagnostic projection.
- `@soeditor/html-tools` — UI-independent diagnostic providers/problems and
  explicit, guarded HTML formatting.
- `@soeditor/ui` — configurable command toolbar, menus, dialogs, balloons,
  notifications, shortcuts, status, and theme variables.
- `@soeditor/preview` — command-driven sandboxed iframe preview with templates,
  context, CSS, a format renderer boundary, and a fixed execution policy.
- `@soeditor/markdown` — exact CodeMirror Markdown editing, CommonMark
  rendering, Preview integration, and explicit HTML conversion losses.
- `@soeditor/dev-tools` — HTML Problems, Inspector, Outline, command palette,
  Find/Replace, and source-location navigation.
- `@soeditor/file-manager` — generic file-selection contracts, boundary
  validation, and command-driven Image integration.
- `@soeditor/adapter-sofinder` — a narrow injected SoFinder picker adapter with
  no SoFinder dependency in Core or feature packages.
- `@soeditor/plugin-sdk` — stable package-root lifecycle and contribution
  contracts for third-party plugin authors, including structured widgets.
- `@soeditor/projections` — DOM-free persistent projection activity and writer
  coordination.
- `@soeditor/revisions` — host-owned revisions, bounded comparison, explicit
  restore, review policies, portable export, and optional permanent erasure.
- `@soeditor/layout` — application-attached accessible two-pane projection
  layouts.
- `@soeditor/presets` — immutable plugin and toolbar definitions for common
  editor configurations.
- `@soeditor/editor` — convenience ESM and direct-browser distribution over the public
  package roots.
- `@soeditor/workspace` — private Phase 30 application lifecycle and bounded
  recovery controller; public exposure is deferred to the 0.9 release gate.
- `@soeditor/react` / `@soeditor/vue` — private Phase 31 lifecycle adapters over
  Workspace; framework dependencies remain isolated to their owning package.
- `@soeditor/plugin-tools` — private Phase 32 offline plugin scaffold and
  package checker targeting the 0.9 SDK.
- `@soeditor/playground` — an integrated browser development and verification
  harness.

Start with [Getting started](docs/getting-started.md). See
[Configuration](docs/configuration.md), [Distribution](docs/distribution.md),
[Source editing](docs/source-editing.md), [Preview](docs/preview.md),
[CMS/SoFinder integration](docs/cms-integration.md), the
[Plugin Guide](docs/plugin-guide.md), [Release procedure](docs/releasing.md),
the [comments guide](docs/comments.md),
the [revisions guide](docs/revisions.md),
[review data governance](docs/review-data-governance.md),
[workspace lifecycle and recovery](docs/workspace.md),
[React and Vue adapters](docs/framework-adapters.md),
[plugin tooling and integration diagnostics](docs/plugin-tooling.md),
[public API policy](docs/public-api.md), and
[development status](docs/status.md).

## Development

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## License

[MIT](LICENSE)
