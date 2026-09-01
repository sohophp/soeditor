# SoEditor development status

## Current direction

On 2026-09-01 the active product was reset to one lightweight, stable CMS HTML
WYSIWYG editor. Phase 58, default product-surface and dependency reduction, is
in progress.

The prior roadmap through Phase 57 produced a broad editor platform. That work
is retained as implementation and compatibility evidence, but Markdown,
comments, revisions, Preview, Developer Visual, multi-pane layouts, framework
adapters and plugin tooling are no longer active product directions.

## Current release state

- `@soeditor/*@1.0.0` is the published historical stable package set.
- the local aligned `1.1.0` candidate is unpublished;
- Chromium CMS/WYSIWYG qualification passes;
- applicable Firefox and WebKit automation passes in the maintained CI image;
- real Safari and manual assistive-technology sign-off remain pending;
- no publication, tag or version move is authorized by the product reset.

## Current implementation facts

- `createClassicEditor()` provides textarea/element mounting, form
  synchronization, WYSIWYG, optional modes, UI, uploads, paste, tables, images,
  links, localization, save workflow and teardown.
- the current default preset still imports nonessential email, media, Preview,
  diagnostics and projection capabilities;
- the umbrella package still re-exports multiple compatibility product families;
- the historical global measures 2.214 MB raw / 649.71 kB gzip with 29.11 kB
  raw CSS;
- the WYSIWYG capability matrix still records incomplete direct UI proof for
  the complete image-properties workflow.

These are Phase 58 inputs, not accepted final product boundaries.

## Active work order

1. narrow the default package and preset;
2. measure the actual CMS artifact and dependency graph;
3. consolidate editing stability and remove default Developer Visual ownership;
4. complete and simplify images, links, tables, paste and classic UI;
5. qualify accessibility, performance, browsers and real CMS integration;
6. make a separate owner-reviewed release decision.

See [PRODUCT.md](PRODUCT.md), [ROADMAP.md](ROADMAP.md),
[wysiwyg-editor.md](wysiwyg-editor.md), and [performance.md](performance.md).
