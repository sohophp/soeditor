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
- Chromium CMS/WYSIWYG qualification passes;
- Chromium desktop/mobile CMS qualification passes locally; current Firefox and
  WebKit execution is blocked by host runtime libraries and requires the
  maintained CI image;
- real Safari and manual assistive-technology sign-off remain pending;
- no publication, tag or version move is authorized by the product reset.

## Current implementation facts

- `@soeditor/editor/cms` is the documented narrow ESM entry and
  `createClassicEditor()` defaults to WYSIWYG only;
- Source is an explicit ESM lazy import and the standalone global rejects Source
  configuration because CodeMirror is not bundled;
- the CMS preset and global exclude Markdown, Preview, comments, revisions,
  layouts, developer tools, email, generic media and video;
- released compatibility exports remain at the package root rather than being
  broken in a 1.1 candidate;
- the CMS global measures 482.60 kB raw / 143.89 kB gzip with 25.58 kB raw CSS;
- complete image properties, including a single-step undo, have direct browser
  coverage.
- the active Chromium product gate contains 81 CMS scenarios; the historical
  199-scenario suite remains available as `pnpm test:browser:compat` and is not
  a CMS release gate.

## Active work order

1. retain the frozen CMS artifact and interaction budgets;
2. obtain real Safari and manual keyboard/screen-reader qualification;
3. review compatibility-package deprecation for a future major version;
4. make a separate owner-reviewed publication decision.

See [PRODUCT.md](PRODUCT.md), [ROADMAP.md](ROADMAP.md),
[wysiwyg-editor.md](wysiwyg-editor.md), and [performance.md](performance.md).
