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
- Register an atomic or readonly structured HTML block through
  `structuredEditingRegistryToken`. Require `StructuredEditingPlugin`, and keep
  conversion callbacks DOM-free and deterministic.
- Publish non-canonical, bounded model-range markers through
  `visualDecorationsServiceToken`. Decorations are presentation only; keep
  persisted annotation data in a feature or host service.

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

## Structured HTML blocks

The structured contribution boundary recognizes custom block elements without
making their source executable or exposing visual-engine internals. Phase 24
optionally attaches a host-scoped node view to a registered type; without that
factory the recognized block remains inert.

```ts
import type { HtmlElement } from '@soeditor/html';
import {
    Plugin,
    StructuredEditingPlugin,
    structuredEditingRegistryToken,
    visualEditingServiceToken,
    type StructuredBlockConversion,
    type StructuredNodeViewFactory,
} from '@soeditor/plugin-sdk';

const productCard: StructuredBlockConversion = {
    id: 'example.product-card',
    type: 'example.product-card',
    behavior: 'atomic',
    matches: (node) =>
        node.namespace === 'html' && node.tagName === 'product-card',
    fromHtml: (node) => ({
        attributes: node.attributes,
        children: node.children,
    }),
    toHtml: (block): HtmlElement => ({
        type: 'element',
        namespace: 'html',
        tagName: 'product-card',
        attributes: block.attributes,
        children: block.children,
    }),
};

const productCardView: StructuredNodeViewFactory = ({
    actions,
    document,
    node,
}) => {
    const element = document.createElement('article');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Rename product';
    const rename = () => {
        actions.select({ focus: false });
        actions.execute('example.product-card.rename', 'Renamed');
    };
    button.addEventListener('click', rename);
    element.append(`Product attributes: ${node.attributes.length}`, button);
    return {
        element,
        destroy: () => button.removeEventListener('click', rename),
    };
};

export class ProductCardPlugin extends Plugin {
    static readonly id = 'example.product-card-plugin';
    static readonly requires = [StructuredEditingPlugin];
    #dispose: (() => void)[] = [];

    override init(): void {
        const registry = this.editor.services.get(
            structuredEditingRegistryToken,
        );
        this.#dispose.push(registry.registerBlock(productCard));
        this.#dispose.push(
            registry.registerNodeView(productCard.type, productCardView),
        );
        this.editor.commands.register({
            id: 'example.product-card.rename',
            execute: ({ editor }, title) => {
                if (typeof title !== 'string' || title.length === 0) {
                    throw new TypeError('A non-empty title is required.');
                }
                const visual = editor.services.get(visualEditingServiceToken);
                const block = visual.getSelectedStructuredBlock(
                    productCard.type,
                );
                if (block === undefined) return;
                visual.replaceStructuredBlockContent(productCard.type, {
                    attributes: [
                        ...block.attributes.filter(
                            ({ name }) => name !== 'data-title',
                        ),
                        { name: 'data-title', value: title },
                    ],
                    children: block.children,
                });
            },
        });
    }

    override destroy(): void {
        for (const dispose of this.#dispose.reverse()) dispose();
    }
}
```

Contribution IDs and node types must be unique within one editor. The registry
is sealed when a Visual engine attaches, so register during plugin `init()`.
Two conversions that match the same source node are rejected, as is a custom
conversion that claims a built-in editable paragraph/list shape. Unknown nodes
that match no contribution continue to be preserved as opaque content.
Disposers remain safe during editor teardown; after sealing they do not mutate
the schema that a later reattachment would consume.

The engine owns the outer focus, selection, drag/drop, clipboard, readonly, and
teardown boundary. A node view may update its own presentation, but canonical
changes must execute a command that uses a public editing service. Do not place
raw preserved children into the live DOM, retain the mutable editor model, or
use node-view DOM mutations as data storage. Nested editable and inline node
views are not part of the current public contract.

Plugins that maintain position-based auxiliary data may inspect Visual-origin
transactions with `readEditingOperations(transaction)` and map their own
points with `mapEditingPoint()`. The reader returns `undefined` for exact Source
replacement and history replay transactions; those boundaries must be handled
as ambiguous source changes rather than guessed tree edits.

Host workflow plugins may change the general content-editing policy through
`editor.setReadonly()`. Visual, Source, Markdown, and projection coordination
observe that transition. Feature-specific permissions remain owned by the
feature: for example, comments accept a host `reviewPolicy` callback to
distinguish comments-only access from a fully readonly review.

Review integrations can import comments/revisions plugin factories, service
tokens, and adapter types from the 0.8 SDK. Storage remains host-owned. Treat
`delete` as a retained comment tombstone, gate `export`/`erase` independently,
and implement backend authorization and retention as described in
`review-data-governance.md`.

The private Phase 30 workspace layer is application infrastructure rather than
a plugin registry. Applications may attach plugin-provided surfaces and
services through explicit factories; each factory must return a complete
`destroy()` handle. Plugin packages must not discover a workspace globally or
depend on workspace controller internals.

React and Vue integration belongs in the private framework adapter packages.
Plugins continue to expose framework-neutral commands, services, and explicit
attachment handles; they must not import React/Vue or assume an adapter owns
their DOM host.

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
