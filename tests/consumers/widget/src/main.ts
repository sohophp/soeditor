import { Editor } from '@soeditor/core';
import { createVisualEditingEngine } from '@soeditor/engine';
import {
    Plugin,
    StructuredEditingPlugin,
    structuredEditingRegistryToken,
    visualEditingServiceToken,
    type StructuredBlockConversion,
    type StructuredNodeViewFactory,
} from '@soeditor/plugin-sdk';

const productCardType = 'consumer.product-card';

const productCardConversion: StructuredBlockConversion = {
    behavior: 'atomic',
    fromHtml: (node) => ({
        attributes: node.attributes,
        children: node.children,
    }),
    id: productCardType,
    matches: (node) =>
        node.namespace === 'html' && node.tagName === 'product-card',
    toHtml: (block) => ({
        attributes: block.attributes,
        children: block.children,
        namespace: 'html',
        tagName: 'product-card',
        type: 'element',
    }),
    type: productCardType,
};

const productCardView: StructuredNodeViewFactory = (context) => {
    const article = context.document.createElement('article');
    const title = context.document.createElement('strong');
    const button = context.document.createElement('button');
    button.type = 'button';
    button.textContent = 'Rename product';
    article.append(title, button);
    const render = (node: typeof context.node): void => {
        title.textContent =
            node.attributes.find(({ name }) => name === 'data-title')?.value ??
            'Untitled';
        button.disabled = context.readonly;
    };
    const rename = (): void => {
        context.actions.select({ focus: false });
        context.actions.execute('consumer.product-card.rename', 'Renamed');
    };
    button.addEventListener('click', rename);
    render(context.node);
    return {
        destroy: () => button.removeEventListener('click', rename),
        element: article,
        update: ({ node, readonly }) => {
            render(node);
            button.disabled = readonly;
        },
    };
};

class ProductCardPlugin extends Plugin {
    static readonly id = 'consumer.product-card-plugin';
    static readonly requires = [StructuredEditingPlugin];
    #dispose: (() => void)[] = [];

    override init(): void {
        const registry = this.editor.services.get(
            structuredEditingRegistryToken,
        );
        this.#dispose.push(registry.registerBlock(productCardConversion));
        this.#dispose.push(
            registry.registerNodeView(productCardType, productCardView),
        );
        this.editor.commands.register({
            id: 'consumer.product-card.rename',
            label: 'Rename product card',
            canExecute: ({ editor }) => {
                const service = editor.services.tryGet(
                    visualEditingServiceToken,
                );
                return (
                    service?.canEdit() === true &&
                    service.isStructuredBlockSelected(productCardType)
                );
            },
            execute: ({ editor }, title) => {
                if (typeof title !== 'string' || title.length === 0) {
                    throw new TypeError(
                        'A non-empty product title is required.',
                    );
                }
                const service = editor.services.get(visualEditingServiceToken);
                const block =
                    service.getSelectedStructuredBlock(productCardType);
                if (block === undefined) {
                    throw new Error('A product card must be selected.');
                }
                service.replaceStructuredBlockContent(productCardType, {
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
        this.#dispose = [];
    }
}

const host = document.querySelector<HTMLElement>('#editor');
const source = document.querySelector<HTMLOutputElement>('#source');
if (host === null || source === null) {
    throw new Error('Packed widget hosts are missing.');
}

const editor = await Editor.create({
    data: '<p>Before</p><product-card data-id="123" data-title="Original"><script>window.__packedWidgetExecuted=true</script></product-card>',
    plugins: [ProductCardPlugin],
});
const visual = createVisualEditingEngine({ editor, element: host });
const renderSource = (): void => {
    source.value = editor.getData();
    document.body.dataset.source = editor.getData();
};
const disposeChange = editor.events.on('document:change', renderSource);
renderSource();

Reflect.set(
    globalThis,
    '__packedWidget',
    Object.freeze({
        destroy: async (): Promise<number> => {
            disposeChange();
            visual.destroy();
            await editor.destroy();
            return host.childNodes.length;
        },
    }),
);
document.body.dataset.ready = 'true';
