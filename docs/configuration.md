# Configuration

## Classic CMS options

The normal CMS entry point keeps Core configuration separate from browser UI,
form, and persistence options:

```ts
const classic = await createClassicEditor(textarea, {
    ariaLabel: 'Article body',
    autoGrow: true,
    editingModes: ['wysiwyg', 'source'],
    initialEditingMode: 'wysiwyg',
    config: {
        cms: {
            paste: { policy: 'semantic' },
            specialCharacters: ['©', '®', '™', '€', '→', '✓'],
            styles: [
                {
                    attributes: [{ name: 'class', value: 'lead' }],
                    element: 'span',
                    id: 'lead',
                    label: 'Lead',
                    target: 'inline',
                },
            ],
        },
    },
    icons: { 'format.bold': 'B' },
    locale: 'zh-CN',
    minHeight: 240,
    save: {
        adapter: articleSaveAdapter,
        autoSaveDelay: 1500,
        leavePageProtection: true,
    },
    themeVariables: { accent: '#005ea8', focusRing: 'CanvasText' },
    toolbar: ['undo', 'redo', '|', 'heading', 'bold', 'italic', 'link'],
    unsupportedContentDisplay: 'detailed', // Developer Visual only
});
```

`editingModes` controls which authoring engines are mounted. Use
`['wysiwyg', 'source']` for a normal CMS editor, or
`['visual', 'source']` for the Developer Visual workflow. When both visual
engines are enabled, WYSIWYG remains the command-facing writer and the
coordinator enforces one active writer. `initialEditingMode` must be one of the
enabled modes. Developer Visual can show unsupported HTML using `detailed` or
`compact` presentation and exposes that choice in its toolbar. WYSIWYG never
shows source labels or `Edit HTML` controls for preserved nodes. Set
`cms.specialCharacters` to a custom list or `false` to disable its preset
palette.

`setWorkspaceView()` accepts explicit single- and multi-pane arrangements.
Normal WYSIWYG installations expose `wysiwyg`, `source`, `wysiwyg-source`,
`wysiwyg-preview`, `source-preview`, `wysiwyg-source-preview`, and `preview`.
The Classic toolbar presents these as one labeled selector rather than
ambiguous pane-count icons.

`icons`, translations, theme variables, toolbar layout, sizing, callbacks, and
save behavior are owned by that editor instance. Theme/icon data affects chrome
only and is never serialized. The save adapter receives exact canonical source
and a revision; backend authorization and conflict policy remain host-owned.
See [Classic UI](classic-ui.md), [CMS saving](cms-saving.md), and the
[CMS plugin/theme guide](cms-plugin-ecosystem.md).

## Core editor options

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
- HTML Source: `{ editor, element, ariaLabel?, cspNonce? }`.
- Markdown: `{ editor, element, ariaLabel?, cspNonce? }`.
- UI: `{ editor, element, toolbar?, theme?, themeVariables?, icons?, locale?, translations? }`.
- Preview: `{ editor, element, renderer?, configuration? }`.
- Developer tools: `{ editor, ui, visualElement }`.
- Split layout: `{ editor, element, hosts, initialPair, orientation?, ratio?,
responsiveBreakpoint? }`.

Only one service-owning surface of each kind may attach to an editor. Duplicate
attachment fails before taking over an existing host.

`cspNonce` forwards an application-generated response nonce to CodeMirror's
runtime style element. Omit it when the host CSP does not use style nonces; an
empty nonce is rejected.

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
