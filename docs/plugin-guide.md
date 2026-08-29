# SoEditor Plugin Guide

SoEditor plugins are per-editor classes with explicit lifecycle hooks. Import
authoring contracts from `@soeditor/plugin-sdk`; import feature plugins from
their owning package only when declaring a concrete dependency.

The SDK is a curated facade, not a second runtime. Plugin packages should
declare compatible aligned `@soeditor/*` peer dependencies and test against packed
public package roots under strict NodeNext resolution.

```ts
import { Plugin, UiPlugin, uiRegistryServiceToken } from '@soeditor/plugin-sdk';

export class WordCountPlugin extends Plugin {
    static readonly id = 'example.word-count';
    static readonly requires = [UiPlugin];
    #dispose: (() => void) | undefined;

    override init(): void {
        this.#dispose = this.editor.services
            .get(uiRegistryServiceToken)
            .registerStatusItem(
                'example.word-count',
                ({ document, editor }) => {
                    const element = document.createElement('span');
                    return {
                        element,
                        update: () => {
                            element.textContent = `${editor.getData().length} characters`;
                        },
                    };
                },
            );
    }

    override destroy(): void {
        this.#dispose?.();
        this.#dispose = undefined;
    }
}
```

## Lifecycle and ownership

Plugins are constructed, initialized, made ready, and destroyed in dependency
order. Give every plugin a globally stable ID and list infrastructure or feature
requirements in `requires`. Store and invoke contribution disposers during
`destroy()`. Do not await the owning editor's `destroy()` promise from a destroy
hook.

Each editor owns independent commands, services, events, plugins, and UI
contributions. Never use a global mutable registry. User-triggered document
changes belong in commands and controlled transactions; toolbar, shortcut, and
palette actions invoke those same commands.

## Supported contributions

- Register commands through `editor.commands`.
- Register typed capabilities with `createServiceToken()` and
  `editor.services`.
- Subscribe to public lifecycle/state events through `editor.events`.
- Register toolbar factories, status factories, and host-scoped shortcuts via
  `uiRegistryServiceToken`.
- Register HTML diagnostic providers via `diagnosticsServiceToken`.
- Observe or adapt projection activity via
  `projectionCoordinatorServiceToken` and `ProjectionAdapter`.
- Implement an alternate split host adapter through `splitViewServiceToken`
  and `SplitViewAdapter`.
- Supply a replaceable asset picker via `fileManagerServiceToken`.

Register UI factories during plugin initialization, before calling
`createEditorUi()`. An attached UI snapshots its mounted contributions; dispose
and reattach it when intentionally changing the contribution set at runtime.

Toolbar factories may construct menus using ordinary accessible DOM. A separate
declarative menu/formatter manifest is intentionally absent until multiple
features demonstrate a stable common contract.

The SDK intentionally exposes generic provider, workflow, service, adapter,
snapshot, pair, orientation, and attachment contracts. Import built-in
accessibility/SEO plugins and rule codes from `@soeditor/html-tools`; import the
browser DOM split factory and its errors from `@soeditor/layout`. Registry
implementations, layout DOM internals, and third-party parser/editor types are
not extension APIs.

## Compatibility rules

- Import package roots only; internal subpaths are unsupported.
- Do not access another plugin's private fields or a concrete registry.
- Core is DOM-free. DOM contributions require `UiPlugin` and execute once per
  attached UI.
- HTML-only plugins must reject or disable incompatible document formats rather
  than converting source implicitly.
- Preserve unknown HTML source independently from rendering/execution policy.
- Treat values from adapters and host services as untrusted at their documented
  boundary.
- Public APIs use strict TypeScript and SoEditor-owned types; third-party AST or
  editor-engine types must not leak through plugin APIs.

## Presets

`@soeditor/presets` exports `minimalPreset`, `classicPreset`,
`developerPreset`, and `markdownPreset`. Pass `format` and `plugins` into
`Editor.create()`, and pass `toolbar` into `createEditorUi()`.

Size-sensitive packages may import `@soeditor/presets/minimal`, `/classic`,
`/developer`, or `/markdown` instead of evaluating the aggregate preset entry.

```ts
import { Editor } from '@soeditor/core';
import { developerPreset, extendPreset } from '@soeditor/presets';

const preset = extendPreset(developerPreset, {
    plugins: [WordCountPlugin],
});

const editor = await Editor.create({
    format: preset.format,
    plugins: preset.plugins,
});
```

Presets are immutable configuration data. Applications still attach editing
surfaces and provide Preview security configuration and FileManager services
explicitly. `extendPreset()` returns a new frozen definition and rejects
duplicate plugin IDs.
