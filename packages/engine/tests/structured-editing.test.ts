import { Editor, Plugin } from '@soeditor/core';
import {
    parseHtmlFragment,
    serializeHtmlFragment,
    type HtmlElement,
} from '@soeditor/html';

import { createPastedModel } from '../src/clipboard.js';
import {
    createEditingModel,
    serializeEditingModel,
    type EditingStructuredBlock,
} from '../src/model.js';
import {
    sealStructuredEditingRegistry,
    StructuredEditingContributionAlreadyRegisteredError,
    StructuredEditingContributionConflictError,
    StructuredEditingPlugin,
    StructuredEditingRegistrySealedError,
    structuredEditingRegistryToken,
    type StructuredBlockConversion,
} from '../src/structured-editing.js';

const productCardConversion: StructuredBlockConversion = {
    behavior: 'atomic',
    fromHtml: (node) => ({
        attributes: node.attributes,
        children: node.children,
    }),
    id: 'example.product-card',
    matches: (node) =>
        node.namespace === 'html' && node.tagName === 'product-card',
    toHtml: (block): HtmlElement =>
        Object.freeze({
            attributes: block.attributes,
            children: block.children,
            namespace: 'html',
            tagName: 'product-card',
            type: 'element',
        }),
    type: 'example.product-card',
};

class ProductCardPlugin extends Plugin {
    static readonly id = 'example-product-card';
    static readonly requires = [StructuredEditingPlugin];

    override init(): void {
        this.editor.services
            .get(structuredEditingRegistryToken)
            .registerBlock(productCardConversion);
    }
}

describe('structured editing contributions', () => {
    it('round-trips a third-party custom element as an immutable atomic block', async () => {
        const editor = await Editor.create({ plugins: [ProductCardPlugin] });
        const schema = sealStructuredEditingRegistry(
            editor.services.get(structuredEditingRegistryToken),
        );
        const source =
            '<product-card product-id="123"><template><p>Fallback</p></template></product-card>';
        const model = createEditingModel(
            parseHtmlFragment(source).document,
            schema,
        );
        const block = model.blocks[0];

        expect(block).toMatchObject({
            behavior: 'atomic',
            kind: 'structured-block',
            type: 'example.product-card',
        });
        expect(Object.isFrozen(block)).toBe(true);
        expect(
            Object.isFrozen((block as EditingStructuredBlock).attributes),
        ).toBe(true);
        expect(
            serializeHtmlFragment(serializeEditingModel(model, schema)),
        ).toBe(source);
        const pasted = createPastedModel(source, '', schema);
        expect(pasted.blocks[0]).toMatchObject({
            kind: 'structured-block',
            type: 'example.product-card',
        });
        expect(
            serializeHtmlFragment(serializeEditingModel(pasted, schema)),
        ).toBe(source);
        await editor.destroy();
    });

    it('rejects duplicate identities and ambiguous source ownership', async () => {
        const editor = await Editor.create({
            plugins: [StructuredEditingPlugin],
        });
        const registry = editor.services.get(structuredEditingRegistryToken);
        registry.registerBlock(productCardConversion);

        expect(() => registry.registerBlock(productCardConversion)).toThrow(
            StructuredEditingContributionAlreadyRegisteredError,
        );
        expect(() =>
            registry.registerBlock({
                ...productCardConversion,
                id: 'example.other',
            }),
        ).toThrow('node type');
        registry.registerBlock({
            ...productCardConversion,
            id: 'example.competing',
            type: 'example.competing',
        });
        const schema = sealStructuredEditingRegistry(registry);

        expect(() =>
            createEditingModel(
                parseHtmlFragment('<product-card></product-card>').document,
                schema,
            ),
        ).toThrow(StructuredEditingContributionConflictError);
        await editor.destroy();
    });

    it('keeps readonly structured content distinct from atomic and opaque blocks', async () => {
        const editor = await Editor.create({
            plugins: [StructuredEditingPlugin],
        });
        const registry = editor.services.get(structuredEditingRegistryToken);
        registry.registerBlock({
            ...productCardConversion,
            behavior: 'readonly',
            id: 'example.readonly-card',
            matches: (node) => node.tagName === 'readonly-card',
            toHtml: (block): HtmlElement => ({
                attributes: block.attributes,
                children: block.children,
                namespace: 'html',
                tagName: 'readonly-card',
                type: 'element',
            }),
            type: 'example.readonly-card',
        });
        const model = createEditingModel(
            parseHtmlFragment(
                '<readonly-card></readonly-card><unknown-card></unknown-card>',
            ).document,
            sealStructuredEditingRegistry(registry),
        );

        expect(model.blocks.map((block) => block.kind)).toEqual([
            'structured-block',
            'opaque-block',
        ]);
        expect(model.blocks[0]).toMatchObject({ behavior: 'readonly' });
        await editor.destroy();
    });

    it('does not allow custom conversions to replace built-in editable blocks', async () => {
        const editor = await Editor.create({
            plugins: [StructuredEditingPlugin],
        });
        const registry = editor.services.get(structuredEditingRegistryToken);
        registry.registerBlock({
            ...productCardConversion,
            id: 'example.paragraph',
            matches: (node) => node.tagName === 'p',
            type: 'example.paragraph',
        });

        expect(() =>
            createEditingModel(
                parseHtmlFragment('<p>Text</p>').document,
                sealStructuredEditingRegistry(registry),
            ),
        ).toThrow(StructuredEditingContributionConflictError);
        await editor.destroy();
    });

    it('seals one editor schema and keeps other editor registries independent', async () => {
        const first = await Editor.create({
            plugins: [StructuredEditingPlugin],
        });
        const second = await Editor.create({
            plugins: [StructuredEditingPlugin],
        });
        const firstRegistry = first.services.get(
            structuredEditingRegistryToken,
        );
        const secondRegistry = second.services.get(
            structuredEditingRegistryToken,
        );
        const dispose = firstRegistry.registerBlock(productCardConversion);
        sealStructuredEditingRegistry(firstRegistry);

        expect(() => dispose()).not.toThrow();
        expect(
            sealStructuredEditingRegistry(firstRegistry).conversions,
        ).toHaveLength(1);
        expect(() =>
            firstRegistry.registerBlock({
                ...productCardConversion,
                id: 'late',
                type: 'late',
            }),
        ).toThrow(StructuredEditingRegistrySealedError);
        expect(() =>
            secondRegistry.registerBlock(productCardConversion),
        ).not.toThrow();

        await first.destroy();
        expect(() =>
            firstRegistry.registerBlock({
                ...productCardConversion,
                id: 'destroyed',
                type: 'destroyed',
            }),
        ).toThrow('destroyed');
        await second.destroy();
    });
});
