# SoEditor

Lightweight, stable HTML WYSIWYG editing for website CMS administration.

SoEditor is designed for article, page, product and other CMS content fields. It
combines a conventional authoring experience with semantic HTML preservation,
safe paste/media workflows, optional HTML Source control and framework-neutral
integration.

The active direction learns:

- lightweight delivery and practical density from Jodit 4;
- mature CMS behavior and stability from CKEditor 4;
- model/view, command, conversion and plugin separation from CKEditor 5.

It is not pursuing AI, collaboration, review workflows, Markdown, page building,
email design or IDE-like editor modes.

## Status

`@soeditor/*@1.0.0` is the published historical package set. The unpublished
local `1.1.0` candidate contains the completed CMS/WYSIWYG implementation.
Phase 58 is now reducing the default product surface and measuring a genuinely
CMS-focused artifact before another release decision.

The current all-features browser global is not the lightweight target. Optional
and historical product families are being removed from the default import path
with deliberate SemVer compatibility handling.

## Basic integration

```ts
import { createClassicEditor } from '@soeditor/editor';

const textarea = document.querySelector<HTMLTextAreaElement>('#content');
if (textarea === null) throw new Error('Missing #content textarea.');

const editor = await createClassicEditor(textarea, {
    locale: 'zh-CN',
    editingModes: ['wysiwyg', 'source'],
});

// The original textarea remains synchronized for native form submission.
// Later: await editor.destroy();
```

The target default is WYSIWYG-only. HTML Source remains an explicit lazy option.

## CMS product capabilities

- textarea/element mounting, form submit/reset, readonly and exact teardown;
- paragraphs, headings, semantic styles and common inline/block formatting;
- nested lists, links, anchors and file links;
- image upload/picker/URL and complete image properties;
- production HTML tables;
- Office/web/plain-text paste cleanup;
- unknown HTML, attributes, comments, custom elements and CMS marker
  preservation;
- inert handling of unsafe or unsupported visual content;
- configurable classic toolbar, responsive UI, localization, IME and keyboard
  operation;
- optional HTML Source, upload, file-manager and save integrations.

## Architecture

HTML is canonical. UI actions invoke commands, commands produce controlled
transactions, and the WYSIWYG DOM is an editing projection rather than
unrestricted persistence state. Core remains framework-independent.

See [product definition](docs/PRODUCT.md), [active roadmap](docs/ROADMAP.md),
[architecture](docs/architecture.md), [WYSIWYG specification](docs/wysiwyg-editor.md),
[performance policy](docs/performance.md), and the current
[package disposition](docs/package-disposition.md).

## Documentation

- [Getting started](docs/getting-started.md)
- [CMS integration](docs/cms-integration.md)
- [Classic UI](docs/classic-ui.md)
- [Configuration](docs/configuration.md)
- [Paste](docs/paste.md)
- [Uploads](docs/uploads.md)
- [Links and CMS objects](docs/links-and-cms-objects.md)
- [Tables and lists](docs/tables-and-lists.md)
- [CMS saving](docs/cms-saving.md)
- [CKEditor 4 migration](docs/ckeditor4-migration.md)
- [Security](docs/security.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Qualification](docs/qualification.md)
- [Deployment and operations](docs/deployment-operations.md)
- [0.9 to 1.0 migration](docs/migration-0.9-to-1.0.md)
- [API overview](docs/api-overview.md)

Historical Markdown, review, framework-adapter, Preview and developer-tool
documents describe published compatibility surfaces. They do not define the
active product roadmap.

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
