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

## Surface options

Surface configuration is deliberately separate from Core:

- Visual: `{ editor, element, ariaLabel? }`.
- HTML Source: `{ editor, element, ariaLabel? }`.
- Markdown: `{ editor, element, ariaLabel? }`.
- UI: `{ editor, element, toolbar?, theme? }`.
- Preview: `{ editor, element, renderer?, configuration? }`.
- Developer tools: `{ editor, ui, visualElement }`.

Only one service-owning surface of each kind may attach to an editor. Duplicate
attachment fails before taking over an existing host.

## Commands and events

Use `editor.execute(commandId, argument?)` from buttons, menus, shortcuts, and
host integrations. Inspect `editor.commands.ids()` for a frozen discoverable
snapshot. Important events include `document:change`, `state:change`,
`mode:change`, and `editor:destroy`; dispose subscriptions you create.
