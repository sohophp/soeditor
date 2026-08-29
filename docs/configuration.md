# Configuration

## Editor options

`SoEditor.create()` accepts one instance-scoped object:

```ts
const editor = await SoEditor.create({
    data: '<p>Initial canonical source.</p>',
    format: 'html', // 'html' | 'markdown'
    mode: 'visual',
    readonly: false,
    plugins: classicPreset.plugins,
    config: {
        cms: { contentType: 'article' },
    },
});
```

`config` is defensively cloned immutable JSON-like application/plugin data.
Features read owned values through `editor.config.get('cms.contentType')`.
DOM nodes, functions, class instances, accessors, and cyclic values are not
configuration data.

State is immutable. Use commands for user actions and transactions (`update`,
`setData`) for application changes. `readonly` is an editing policy consumed by
surfaces and commands; it does not turn the Editor object into a passive data
container.

## Presets

Presets are frozen values. Extend without mutation:

```ts
import { developerPreset, extendPreset } from '@soeditor/presets';

const cmsPreset = extendPreset(developerPreset, {
    plugins: [CmsMetadataPlugin],
    toolbar: [...developerPreset.toolbar, '|', 'cms-metadata'],
});
```

Duplicate plugin IDs are rejected. Applications remain responsible for
registering concrete capabilities such as a `FileManager` and for attaching
surface hosts.

The Developer preset includes the bounded accessibility/SEO providers and the
projection/split services. It still does not construct engines, discover DOM
hosts, attach a split layout, or select Preview security policy.

## Diagnostics

Validation is manual unless a per-editor debounced policy is configured:

```ts
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
}
```

Use `editor.execute('document.validate')` for manual validation. Supported rule
settings are `false`, `error`, `warning`, `info`, and `hint`; malformed or
unknown settings fail initialization. Diagnostics inspect canonical source and
cannot prove WCAG conformance, search ranking, CSS/layout behavior, or dynamic
script output.

## Surface options

Surface configuration is deliberately separate from Core:

- Visual: `{ editor, element, ariaLabel? }`.
- HTML Source: `{ editor, element, ariaLabel? }`.
- Markdown: `{ editor, element, ariaLabel? }`.
- UI: `{ editor, element, toolbar?, theme? }`.
- Preview: `{ editor, element, renderer?, configuration? }`.
- Developer tools: `{ editor, ui, visualElement }`.
- Split layout: `{ editor, element, hosts, initialPair, orientation?, ratio?,
responsiveBreakpoint? }`.

Only one service-owning surface of each kind may attach to an editor. Duplicate
attachment fails before taking over an existing host.

Split layout pairs are `visual-source`, `source-preview`, and
`markdown-preview`. Projection engines remain application-owned. Destroy the
layout before destroying those engines so hosts are restored to their original
DOM positions. Invalid HTML stays Source-owned and locks Visual at its last
valid model; Preview and every non-primary editing projection are readonly.

## Commands and events

Use `editor.execute(commandId, argument?)` from buttons, menus, shortcuts, and
host integrations. Inspect `editor.commands.ids()` for a frozen discoverable
snapshot. Important events include `document:change`, `state:change`,
`mode:change`, and `editor:destroy`; dispose subscriptions you create.
