# Migrating from 0.5 to 0.6

SoEditor 0.6 keeps the 0.5 document, command, plugin, surface, and ESM model.
The main additions are configurable quality diagnostics, persistent projection
coordination, and application-attached split layouts. The package versions in
the development branch remain `0.5.1` until the coordinated Phase 22 release.

## Existing 0.5 integrations

An application that uses `minimalPreset` or `classicPreset` does not need to
adopt the new workflow. Existing single-surface behavior remains available when
`ProjectionCoordinatorPlugin` is absent. Continue to import public package
roots and destroy browser surfaces before the editor.

`developerPreset` now includes accessibility and SEO providers plus projection
and split-view infrastructure. This does not mount DOM, construct an engine, or
choose Preview policy. If a 0.5 application extended `developerPreset` with any
of these plugins, remove the duplicate additions:

```ts
AccessibilityDiagnosticsPlugin;
SeoDiagnosticsPlugin;
ProjectionCoordinatorPlugin;
SplitViewPlugin;
```

Duplicate plugin IDs are deliberately rejected.

## Diagnostics configuration

Manual validation remains the default. Invoke the shared command from any UI
or host integration:

```ts
await editor.execute('document.validate');
```

Automatic validation is an explicit, per-editor debounced policy:

```ts
const editor = await Editor.create({
    plugins: developerPreset.plugins,
    config: {
        htmlTools: {
            diagnostics: { validation: { mode: 'debounced', delay: 250 } },
            accessibility: {
                rules: {
                    'a11y.interactive-name': 'error',
                    'a11y.heading-order': false,
                },
            },
            seo: { rules: { 'seo.meta-description': 'hint' } },
        },
    },
});
```

Rule values are `false`, `error`, `warning`, `info`, or `hint`. Unknown rule
codes and malformed values fail editor initialization so misspelled policy is
not silently ignored. These source-only rules find a bounded set of detectable
relationships; they do not certify WCAG conformance, search ranking, dynamic
CSS/layout, script-rendered content, or assistive-technology behavior.

## Coordinated projections and split views

Create all projection engines and hosts explicitly. A coordinator keeps visible
projections synchronized while exactly one compatible editing projection is the
writer; Preview is always readonly. Then attach the layout:

```ts
import {
    createSplitViewLayout,
    Editor,
    developerPreset,
} from '@soeditor/editor';
import '@soeditor/editor/styles.css';

const editor = await Editor.create({
    data: '<p>Hello</p>',
    plugins: developerPreset.plugins,
});

// Create Visual, Source, and/or Preview engines with their explicit hosts first.
const layout = createSplitViewLayout({
    editor,
    element: document.querySelector<HTMLElement>('#split')!,
    hosts: {
        visual: document.querySelector<HTMLElement>('#visual')!,
        source: document.querySelector<HTMLElement>('#source')!,
    },
    initialPair: 'visual-source',
});
```

Supported pairs are `visual-source`, `source-preview`, and
`markdown-preview`. The separator supports Arrow keys, Home, and End; pane
controls support focus, collapse, and restore. Narrow containers change only
the effective orientation and restore the requested orientation when widened.

Invalid HTML remains canonical and Source-editable while Visual retains its
last valid model as a locked projection. Editor-level readonly makes every
editing projection readonly without changing the logical primary writer.
Preview remains a sandboxed iframe and its security configuration is still an
application decision.

The layout temporarily moves caller-owned hosts and restores their parents,
positions, visibility, attributes, and styles when destroyed. It does not own
or destroy projection engines. Teardown in this order:

```ts
layout.destroy();
preview.destroy();
source.destroy();
visual.destroy();
ui.destroy();
await editor.destroy();
```

Omit surfaces that were not created. Independent destroy methods are
idempotent, and editor destruction also requests attached SoEditor surfaces to
clean up.

## Imports and styles

The umbrella remains the convenient ESM entry:

```ts
import { Editor, developerPreset } from '@soeditor/editor';
import '@soeditor/editor/styles.css';
```

Size-sensitive applications can import owning packages and narrow presets:

```ts
import { Editor } from '@soeditor/core';
import { SplitViewPlugin } from '@soeditor/layout';
import '@soeditor/layout/styles.css';
import { minimalPreset } from '@soeditor/presets/minimal';
```

`@soeditor/plugin-sdk` is for extension-author contracts; it is not a second
umbrella. Import built-in diagnostic implementations from
`@soeditor/html-tools` and the DOM layout factory from `@soeditor/layout`.
Never import package `src` files or private `dist` subpaths.

The browser global remains an explicit, self-contained compatibility build.
Pin the exact aligned 0.6 version after Phase 22; do not mix 0.5 and 0.6 scoped
packages. Until then, the published supported reference is still `0.5.1`.

## Public API ownership

| Classification          | Owner                                 | 0.6 examples                                                                                                                                               |
| ----------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Application public      | owning package roots                  | Quality plugins/rule codes in `@soeditor/html-tools`; coordinator in `@soeditor/projections`; split service, errors, and DOM factory in `@soeditor/layout` |
| Extension-author public | `@soeditor/plugin-sdk` curated facade | Diagnostics provider/workflow types; projection adapters/snapshots; split adapters/snapshots; existing UI and FileManager contracts                        |
| Experimental            | documented feature limitations        | Bounded source-only quality rules, finite split-pair graph, responsive two-pane layout                                                                     |
| Internal                | not exported from package roots       | Registries, timers/generations, parser/editor-engine dependency types, layout DOM implementation and host anchors                                          |

Public package-root exports are supported according to the current 0.x SemVer
policy. “Experimental” describes feature breadth, not permission to import
private modules.
