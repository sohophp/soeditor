# Package disposition inventory

## Status

Completed Phase 58 inventory. Classification describes the enforced product
boundary, not an immediate deletion or compatibility promise.

## Default CMS runtime

| Package               | Target role                                                    | Phase 58 action                                                       |
| --------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------- |
| `@soeditor/core`      | lifecycle, state, commands, transactions, plugins and services | retain and keep DOM-free                                              |
| `@soeditor/html`      | semantic HTML parsing and serialization                        | retain; measure parser cost                                           |
| `@soeditor/engine`    | shared controlled editing infrastructure                       | retain only production WYSIWYG ownership; isolate historical Visual   |
| `@soeditor/wysiwyg`   | native CMS authoring surface                                   | retain and consolidate with engine ownership                          |
| `@soeditor/rich-text` | CMS feature commands and transforms                            | retain; split or eliminate non-CMS email/video/media defaults         |
| `@soeditor/ui`        | classic toolbar, menus, dialogs and status                     | retain; remove non-CMS default controls and measure state-update cost |
| `@soeditor/presets`   | supported CMS feature/toolbar selection                        | narrow `cmsPreset`; compatibility presets use explicit entries        |
| `@soeditor/editor`    | documented integration entry and CMS browser global            | replace broad re-exports with narrow CMS entries under SemVer policy  |

## Optional CMS integrations

| Package                      | Target role                                                           | Loading rule                                                                            |
| ---------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `@soeditor/source`           | optional HTML Source mode                                             | dynamic import only when configured or activated                                        |
| `@soeditor/file-manager`     | upload and picker service contracts                                   | explicit integration or narrow lazy path                                                |
| `@soeditor/adapter-sofinder` | SoFinder picker adapter                                               | explicit host import; never a Core dependency                                           |
| `@soeditor/workspace`        | save/lifecycle helpers still needed by current Classic implementation | split essential host behavior from recovery/platform breadth before deciding final tier |
| `@soeditor/html-tools`       | optional diagnostics and HTML formatting                              | remove from default; Prettier must not enter normal WYSIWYG startup                     |

## Compatibility-only

| Package                 | Historical capability                            | Policy                                                                                                       |
| ----------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `@soeditor/comments`    | mapped comments                                  | security/critical compatibility fixes only                                                                   |
| `@soeditor/revisions`   | revision and review policies                     | security/critical compatibility fixes only                                                                   |
| `@soeditor/markdown`    | Markdown editing/conversion                      | security/critical compatibility fixes only                                                                   |
| `@soeditor/preview`     | sandboxed Preview                                | security/critical compatibility fixes only                                                                   |
| `@soeditor/dev-tools`   | Problems, Inspector, Outline and command palette | security/critical compatibility fixes only                                                                   |
| `@soeditor/layout`      | split projection layouts                         | security/critical compatibility fixes only                                                                   |
| `@soeditor/react`       | React Workspace adapter                          | compatibility fixes only; not required for CMS integration                                                   |
| `@soeditor/vue`         | Vue Workspace adapter                            | compatibility fixes only; not required for CMS integration                                                   |
| `@soeditor/plugin-sdk`  | broad historical extension facade                | preserve released API while defining a smaller CMS extension surface                                         |
| `@soeditor/projections` | multi-projection coordination                    | retain temporarily for Source compatibility; remove from default public concepts after WYSIWYG consolidation |

## Development-only

| Package/application      | Role                                                              |
| ------------------------ | ----------------------------------------------------------------- |
| `@soeditor/plugin-tools` | historical scaffold/check compatibility and migration tests       |
| `@soeditor/playground`   | development fixtures, browser qualification and visual inspection |

## In-package removal or split candidates

- `EmailContentPlugin`, email analysis/optimization commands and email Preview
  templates;
- generic `MediaPlugin` and `VideoPlugin` from the default preset and toolbar;
- Developer Visual creation and unsupported-content display options from the
  documented Classic CMS path;
- Preview and multi-pane arrangements from `createClassicEditor()` defaults;
- broad `export *` statements in `@soeditor/editor`;
- eager `SourceEditingPlugin`, CodeMirror and Prettier dependencies in any
  default CMS graph;
- demo-only commands, capability summaries and UI controls that do not belong to
  real CMS authoring.

## Required evidence before deletion

For each candidate record:

1. public exports and released-package consumers;
2. default and optional import graphs;
3. raw/gzip/CSS impact;
4. CMS browser tests affected;
5. migration/deprecation requirement;
6. focused and full verification results.

Removing a feature from `cmsPreset` and the CMS browser global is the first
objective. Physical deletion may follow in a later breaking release.
