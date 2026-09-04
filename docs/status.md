# SoEditor development status

## Current direction

On 2026-09-01 the active product was reset to one lightweight, stable CMS HTML
WYSIWYG editor. Phases 58-61 are implemented. Phase 62 automated release
qualification is implemented; real Safari and manual assistive-technology
sign-off remain external release checks.

The prior roadmap through Phase 57 produced a broad editor platform. That work
is retained as implementation and compatibility evidence, but Markdown,
comments, revisions, Preview, Developer Visual, multi-pane layouts, framework
adapters and plugin tooling are no longer active product directions.

## Current release state

- `@soeditor/*@1.0.0` is the published historical stable package set.
- the local aligned `1.1.0` release candidate is unpublished;
- Chromium CMS/WYSIWYG qualification passes, including the complete 226-scenario
  compatibility matrix;
- Chromium desktop/mobile CMS qualification passes locally; current Firefox and
  WebKit execution is blocked by host runtime libraries, while the current
  candidate passes 96/96 applicable runs in the maintained Playwright image;
- real Safari and manual assistive-technology sign-off remain pending;
- no publication, tag or version move is authorized by the product reset.

## Current implementation facts

- `@soeditor/editor/cms` is the documented narrow ESM entry and
  `createClassicEditor()` defaults to WYSIWYG only;
- Source, Preview and save adapters require the explicit
  `@soeditor/editor/cms/optional` entry; `/cms` and the standalone global reject
  those options;
- the CMS preset and global exclude Markdown, Preview, comments, revisions,
  layouts, developer tools, email, generic media and video;
- released compatibility exports remain at the package root rather than being
  broken in a 1.1 candidate;
- the CMS global measures 485.98 kB raw / 149.45 kB gzip with 26.34 kB raw CSS;
- a packed `/cms` Vite consumer starts at 461.27 kB raw / 149.99 kB gzip, while
  the narrow Core/SDK/minimal-preset consumer starts at 85.21 kB;
- complete image properties, including a single-step undo, have direct browser
  coverage.
- the active Chromium product gate contains 108 CMS scenarios; the historical
  226-scenario compatibility suite also passes and remains available as
  `pnpm test:browser:compat`, but is not the focused CMS release gate.

## Active work order

1. retain the frozen CMS artifact and interaction budgets;
2. validate the packed candidate in representative host CMS forms;
3. obtain real Safari and manual keyboard/screen-reader qualification;
4. review compatibility-package deprecation for a future major version;
5. make a separate owner-reviewed publication decision.

See [PRODUCT.md](PRODUCT.md), [ROADMAP.md](ROADMAP.md),
[wysiwyg-editor.md](wysiwyg-editor.md), and [performance.md](performance.md).
