# CMS capability matrix

## Status

This matrix is the maintained product-level inventory for the SoEditor 1.1 CMS
Classic Editor candidate. The detailed pre-implementation 1.0 measurements are
recorded in [`cms-baseline.md`](cms-baseline.md): 1.0 had bounded rich text,
tables/media, a FileManager picker, and developer-oriented UI, but not the
one-call Classic/form, Office cleanup, upload, localization, save, or CMS
ecosystem workflows below.

This table records the historical Phase 38–48 Classic candidate. It does not
grant completion status to the independent WYSIWYG product. WYSIWYG features
are requalified independently under [`wysiwyg-editor.md`](wysiwyg-editor.md)
and the Phase 49–56 roadmap; until then, historical `delivered` entries are
implementation baselines rather than WYSIWYG production claims.

| Capability                       | 1.1 candidate outcome                           | Owning phase | Qualification evidence                            |
| -------------------------------- | ----------------------------------------------- | ------------ | ------------------------------------------------- |
| One-call classic mount           | delivered in Phase 38                           | 38           | textarea and element browser consumers            |
| Native form submit/reset         | delivered in Phase 38                           | 38           | real form submission and restoration              |
| Placeholder and editor sizing    | delivered in Phase 38                           | 38           | visual, resize, and cleanup tests                 |
| Common semantic marks and blocks | delivered in Phase 39                           | 39           | unit and multi-selection browser tests            |
| Nested lists and indentation     | delivered in Phase 39                           | 39           | keyboard/history/clipboard tests                  |
| CMS semantic styles              | delivered in Phase 39                           | 39           | validated configuration and round trips           |
| External paste policy            | delivered in Phase 40                           | 40           | fixed multi-source fixture corpus                 |
| Word/Excel/Docs cleanup          | delivered in Phase 40                           | 40           | semantic output and loss records                  |
| Dropped/pasted files             | delivered in Phase 41                           | 41           | upload success/failure/cancel tests               |
| Host upload adapter              | delivered in Phase 41                           | 41           | packed third-party adapter consumer               |
| Image property editing           | delivered in Phase 41                           | 41           | insertion/update/replace browser flows            |
| Existing asset picker            | delivered in Phase 41                           | 41           | retained compatibility plus upload flow           |
| Complete link properties         | delivered in Phase 42                           | 42           | create/edit/remove and URL-policy tests           |
| CMS content objects              | delivered in Phase 42                           | 42           | packed third-party object consumer                |
| Table property and resize UX     | delivered in Phase 43                           | 43           | pointer/keyboard/property tests                   |
| Production nested-list UX        | delivered in Phase 43                           | 43           | real-browser CMS task scenarios                   |
| Responsive classic toolbar       | delivered in Phase 44                           | 44           | desktop/narrow/zoom browser tests                 |
| Contextual UI and context menu   | delivered in Phase 44                           | 44           | keyboard/pointer/focus tests                      |
| Maximize/resize/auto-grow        | delivered in Phase 44                           | 44           | exact host restoration and layout tests           |
| Element path and counts          | delivered in Phase 44                           | 44           | default classic status projection                 |
| Per-instance localization        | delivered in Phase 45                           | 45           | locale isolation and completeness checks          |
| Chinese IME qualification        | delivered in Phase 45                           | 45           | composition/history regression suite              |
| RTL and mobile interaction       | delivered in Phase 45                           | 45           | viewport/keyboard/touch evidence                  |
| CMS save adapter and dirty state | delivered in Phase 46                           | 46           | failure/retry/conflict consumers                  |
| Legacy and modern CMS examples   | delivered in Phase 46                           | 46           | packed form/Ajax/React/Vue consumers              |
| CMS plugin scaffolds             | delivered in Phase 47                           | 47           | generated packed extension families               |
| Theme and icon extension         | delivered in Phase 47                           | 47           | isolated third-party theme consumer               |
| Cross-browser CMS qualification  | Chromium qualified; Firefox/WebKit host-blocked | 48           | six Chromium runs plus documented launch evidence |

## Canonical CMS acceptance journey

Every release qualification must exercise one continuous scenario:

1. Replace a named textarea containing ordinary HTML, a custom element, and a
   CMS comment.
2. Enter Chinese and Latin text with composition, selections, and history.
3. Apply semantic styles and nested lists.
4. Paste representative Word content containing a heading, list, link, and
   table.
5. Upload or select an image, then edit its alternative text and caption.
6. Create and edit a link and table properties.
7. inspect and intentionally change the canonical source, then return Visual.
8. Submit through the original form or an explicit save adapter.
9. Prove unknown CMS source is retained and executable input did not run.
10. Destroy the editor and prove exact host, listener, task, and DOM cleanup.

## Product priority

- `P0`: classic mount, form lifecycle, stable input, common formatting, lists,
  links, images/uploads, tables, external paste, responsive toolbar, Source,
  history, preservation, and execution safety.
- `P1`: advanced Office cleanup, rich object properties, CMS styles,
  contextual UI, maximize/auto-grow, counts/save status, localization, RTL,
  and save adapters.
- `P2`: optional safe embeds, templates, broader locales, extension templates,
  and migration helpers.

## Near-term non-goals

Real-time collaboration, new review/Markdown breadth, a page builder,
spreadsheet formulas, arbitrary executable embeds, CKEditor plugin binary
compatibility, and a hosted marketplace do not belong to Phases 37–48.
