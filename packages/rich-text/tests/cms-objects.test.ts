import { Editor } from '@soeditor/core';
import {
    visualEditingServiceToken,
    type EditingStructuredBlock,
    type VisualEditingService,
} from '@soeditor/engine';
import { describe, expect, it, vi } from 'vitest';

import {
    CmsObjectsPlugin,
    cmsEmbedProviderServiceToken,
    RichTextArgumentError,
} from '../src/index.js';

describe('CMS content objects', () => {
    it('registers configured object commands and preserves partial properties', async () => {
        const editor = await createEditor();
        const inserted: string[] = [];
        let selected: EditingStructuredBlock = {
            attributes: [
                { name: 'data-soeditor-object', value: 'promo' },
                { name: 'data-campaign', value: 'spring' },
                { name: 'data-theme', value: 'light' },
                { name: 'data-cms-id', value: '42' },
            ],
            behavior: 'atomic',
            children: [],
            kind: 'structured-block',
            type: 'soeditor.cms-object.promo',
        };
        const remove = vi.fn();
        editor.services.register(
            visualEditingServiceToken,
            service(
                inserted,
                () => selected,
                (attributes) => {
                    selected = { ...selected, attributes };
                },
                remove,
            ),
        );

        editor.execute('cmsObject.promo.insert', {
            campaign: 'summer & fall',
            theme: 'dark',
        });
        expect(inserted).toEqual([
            '<aside data-soeditor-object="promo" data-campaign="summer &amp; fall" data-theme="dark"></aside>',
        ]);

        editor.execute('cmsObject.promo.update', { campaign: 'autumn' });
        expect(selected.attributes).toEqual([
            { name: 'data-soeditor-object', value: 'promo' },
            { name: 'data-theme', value: 'light' },
            { name: 'data-cms-id', value: '42' },
            { name: 'data-campaign', value: 'autumn' },
        ]);
        editor.execute('cmsObject.promo.remove');
        expect(remove).toHaveBeenCalledWith('soeditor.cms-object.promo');
        expect(() =>
            editor.execute('cmsObject.promo.insert', { unknown: 'value' }),
        ).toThrow(RichTextArgumentError);
        await editor.destroy();
    });

    it('inserts bounded CMS primitives and inert embed metadata', async () => {
        const editor = await createEditor();
        const inserted: string[] = [];
        editor.services.register(
            visualEditingServiceToken,
            service(inserted, () => undefined),
        );
        editor.services.register(cmsEmbedProviderServiceToken, {
            resolve: vi.fn().mockResolvedValue({
                provider: 'video',
                title: 'Safe video',
                url: 'https://media.example.test/watch/42',
                thumbnailUrl: 'https://media.example.test/thumb/42.jpg',
                html: '<iframe src="javascript:alert(1)"></iframe>',
            }),
        });

        editor.execute('specialCharacter.insert', '©');
        editor.execute('anchor.insert', 'section-2');
        editor.execute('pageBreak.insert');
        editor.execute('placeholder.insert', 'customer.name');
        await editor.execute(
            'embed.insert',
            'https://media.example.test/watch/42',
        );

        expect(inserted).toEqual([
            '©',
            '<a id="section-2"></a>',
            '<hr data-page-break="true">',
            '<span data-soeditor-placeholder="customer.name">{{customer.name}}</span>',
            '<figure data-soeditor-embed="video" data-title="Safe video" data-url="https://media.example.test/watch/42" data-thumbnail-url="https://media.example.test/thumb/42.jpg"><a href="https://media.example.test/watch/42">Safe video</a><figcaption>video</figcaption></figure>',
        ]);
        expect(inserted.join('')).not.toContain('iframe');
        await expect(
            editor.execute('embed.insert', 'javascript:alert(1)'),
        ).rejects.toThrow(RichTextArgumentError);
        await editor.destroy();
    });

    it('rejects unsafe provider metadata without inserting content', async () => {
        const editor = await createEditor();
        const inserted: string[] = [];
        editor.services.register(
            visualEditingServiceToken,
            service(inserted, () => undefined),
        );
        editor.services.register(cmsEmbedProviderServiceToken, {
            resolve: () =>
                Promise.resolve({
                    provider: 'video',
                    title: 'Unsafe',
                    url: 'javascript:alert(1)',
                }),
        });

        await expect(
            editor.execute('embed.insert', 'https://example.test/video'),
        ).rejects.toThrow('unsafe metadata');
        expect(inserted).toEqual([]);
        await editor.destroy();
    });

    it('disables every CMS mutation when visual editing is readonly', async () => {
        const editor = await createEditor();
        editor.services.register(
            visualEditingServiceToken,
            service([], () => undefined, undefined, undefined, false),
        );
        editor.services.register(cmsEmbedProviderServiceToken, {
            resolve: async (url) => ({
                provider: 'video',
                title: 'Video',
                url,
            }),
        });

        for (const command of [
            'cmsObject.promo.insert',
            'specialCharacter.insert',
            'anchor.insert',
            'pageBreak.insert',
            'placeholder.insert',
            'embed.insert',
        ]) {
            expect(editor.commands.canExecute(command)).toBe(false);
        }
        await editor.destroy();
    });
});

async function createEditor(): Promise<Editor> {
    return Editor.create({
        config: {
            cms: {
                objects: [
                    {
                        element: 'aside',
                        id: 'promo',
                        label: 'Promotion',
                        properties: ['campaign', 'theme'],
                    },
                ],
            },
        },
        plugins: [CmsObjectsPlugin],
    });
}

function service(
    inserted: string[],
    selected: () => EditingStructuredBlock | undefined,
    setAttributes: (
        attributes: EditingStructuredBlock['attributes'],
    ) => void = () => undefined,
    remove: (type: string) => void = () => undefined,
    canEdit = true,
): VisualEditingService {
    return {
        canEdit: () => canEdit,
        getSelection: () => undefined,
        getSelectedStructuredBlock: (type) => {
            const block = selected();
            return block !== undefined &&
                (type === undefined || block.type === type)
                ? block
                : undefined;
        },
        insertHtml: (html) => inserted.push(html),
        isBlockActive: () => false,
        isLinkActive: () => false,
        isListActive: () => false,
        isMarkActive: () => false,
        isStructuredBlockSelected: (type) => {
            const block = selected();
            return (
                block !== undefined &&
                (type === undefined || block.type === type)
            );
        },
        removeSelectedStructuredBlock: remove,
        replaceStructuredBlockContent: () => undefined,
        setBlock: () => undefined,
        setLink: () => undefined,
        setSelection: () => false,
        setStructuredBlockAttributes: (_type, attributes) =>
            setAttributes(attributes),
        toggleList: () => undefined,
        toggleMark: () => undefined,
    };
}
