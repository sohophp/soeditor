# SoEditor

Developer-first extensible content editor.

**Status: 1.0 stable; 1.1 CMS release candidate.** The aligned
`@soeditor/*@1.0.0` packages are published on npm, with `@soeditor/editor` as
the recommended application entry. The local aligned `1.1.0` candidate is not
published. It advances the CMS Classic Editor roadmap with a
directly embeddable, author-focused rich-text experience with form integration,
reliable paste, uploads, media, tables, localization, and accessible classic
UI. HTML Source, diagnostics, Markdown, review, and plugin APIs remain supported
capabilities rather than the default product focus. The repository contains
the framework-agnostic Core, HTML document layer, controlled visual
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
and a 19-package release gate. Phase 30 adds a framework-neutral
workspace controller for explicit application mounting, reverse teardown,
controlled/uncontrolled values, and bounded in-process recovery. Phases 31–33
add public React/Vue adapters, offline plugin tooling, explicit Workspace
integration diagnostics, measured performance gates, and a 23-package 0.9
release boundary. Phases 34–35 freeze the candidate public API, compatibility
policy, accessibility/security/performance evidence, and production guidance.

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
  notifications, responsive keyboard toolbar layout, command-backed context
  menus, status, and theme variables.
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
- `@soeditor/workspace` — public application lifecycle and bounded recovery
  controller with explicit per-instance integration diagnostics.
- `@soeditor/react` / `@soeditor/vue` — public lifecycle adapters over
  Workspace; framework dependencies remain isolated to their owning package.
- `@soeditor/plugin-tools` — public Node-only offline plugin scaffold and
  package checker targeting the 1.0 SDK.
- `@soeditor/playground` — an integrated browser development and verification
  harness.

Start with [Getting started](docs/getting-started.md). See
[Classic UI](docs/classic-ui.md),
[Localization, IME, mobile, and accessibility](docs/localization-accessibility.md),
[CMS saving and persistence](docs/cms-saving.md),
[CMS plugin and theme ecosystem](docs/cms-plugin-ecosystem.md),
[CKEditor 4 migration](docs/ckeditor4-migration.md),
[WYSIWYG HTML editor specification](docs/wysiwyg-editor.md),
[WYSIWYG capability matrix](docs/wysiwyg-capability-matrix.md),
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
[performance budgets](docs/performance.md),
[0.8-to-0.9 migration](docs/migration-0.8-to-0.9.md),
[0.9-to-1.0 migration](docs/migration-0.9-to-1.0.md),
[1.0-to-1.1 migration](docs/migration-1.0-to-1.1.md),
[public API policy](docs/public-api.md), the generated
[API report](docs/api-report.md), [API overview](docs/api-overview.md),
[security model](docs/security.md),
[deployment and operations](docs/deployment-operations.md),
[troubleshooting](docs/troubleshooting.md),
[qualification evidence](docs/qualification.md),
[support policy](docs/support-policy.md), and
[development status](docs/status.md). The active CMS scope and evidence map is
tracked in the [CMS capability matrix](docs/cms-capability-matrix.md) and
[CMS paste/drop policy](docs/paste.md) and
[host-owned uploads](docs/uploads.md), plus
[links and CMS content objects](docs/links-and-cms-objects.md) and
[production tables/lists](docs/tables-and-lists.md), plus the
[classic UI](docs/classic-ui.md).
The pre-implementation measurements are recorded in the
[CMS roadmap baseline](docs/cms-baseline.md).

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
