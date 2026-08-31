# API overview

Use the narrowest documented package root that owns the capability. The
generated [`api-report.md`](api-report.md) is the symbol-level inventory; this
page is the task-oriented map.

## Core and document

| Package             | Primary public role                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------- |
| `@soeditor/core`    | Editor lifecycle, immutable state, transactions, commands, plugins, events, services, errors |
| `@soeditor/html`    | SoEditor-owned HTML tree, parse/serialize, diagnostics, source ranges                        |
| `@soeditor/editor`  | Framework-neutral convenience umbrella and direct-browser build                              |
| `@soeditor/presets` | Immutable minimal, classic, CMS, developer, and Markdown configurations                      |

Canonical application flow is `command → transaction → state`. Read source
with `editor.getData()`, replace it with `setData()`, and destroy the instance
terminally with `await editor.destroy()`.

## Editing and projections

| Package                 | Primary public role                                                     |
| ----------------------- | ----------------------------------------------------------------------- |
| `@soeditor/engine`      | Visual engine, history, structured editing, visual services/decorations |
| `@soeditor/rich-text`   | Formatting, links, CMS objects, image/table/media feature plugins       |
| `@soeditor/source`      | Exact CodeMirror HTML Source surface                                    |
| `@soeditor/markdown`    | Canonical Markdown surface, rendering, explicit conversion              |
| `@soeditor/preview`     | Sandboxed, fixed-policy iframe projection                               |
| `@soeditor/projections` | Single-writer visibility/activity coordination                          |
| `@soeditor/layout`      | Application-attached accessible two-pane layouts                        |

Structured model/operation, node-view/conversion, visual-decoration, and
table/media/CMS-object extension surfaces remain experimental. Link-target and
embed-metadata providers are host-owned service boundaries; they do not grant
remote markup execution. Exact classifications are recorded per entry in the
API report.

## UI, diagnostics, and assets

| Package                      | Primary public role                                                         |
| ---------------------------- | --------------------------------------------------------------------------- |
| `@soeditor/ui`               | Toolbar, status, panels, dialogs, notifications, balloons, shortcuts, theme |
| `@soeditor/html-tools`       | Diagnostics workflow, accessibility/SEO source rules, explicit formatting   |
| `@soeditor/dev-tools`        | Problems, Inspector, Outline, command palette, Find/Replace                 |
| `@soeditor/file-manager`     | Replaceable asset selection contract and validation                         |
| `@soeditor/adapter-sofinder` | Injected SoFinder picker translation                                        |

## Review and application integration

| Package               | Primary public role                                                              |
| --------------------- | -------------------------------------------------------------------------------- |
| `@soeditor/comments`  | Host-owned mapped annotations and comment UI/service                             |
| `@soeditor/revisions` | Host-owned snapshots, comparison, restore, review policy                         |
| `@soeditor/workspace` | Application lifecycle, controlled values, recovery, and host-owned save workflow |
| `@soeditor/react`     | React lifecycle hook over Workspace                                              |
| `@soeditor/vue`       | Vue Composition API hook over Workspace                                          |

React/Vue packages remain outside the umbrella so framework runtimes never
enter framework-neutral consumers.
Save workflow types are experimental in Phase 46. They preserve host ownership
of transport and conflicts while preventing a stale response from marking
newer canonical source clean.

## Extension authoring

| Package                  | Primary public role                                  |
| ------------------------ | ---------------------------------------------------- |
| `@soeditor/plugin-sdk`   | Curated framework-neutral extension contracts        |
| `@soeditor/plugin-tools` | Node-only offline scaffold and package-shape checker |

Plugins declare dependencies explicitly, register commands/services/
contributions during lifecycle, return/dispose owned resources, and never reach
private registries or mutate state/DOM as canonical data.

## Classification and support

Read [`public-api.md`](public-api.md) for architectural classification and
[`support-policy.md`](support-policy.md) for SemVer, deprecation, runtime,
security, and maintenance rules. Undeclared subpaths are internal. Repeated
umbrella/SDK symbols are independently audited because each root is a consumer
contract.
