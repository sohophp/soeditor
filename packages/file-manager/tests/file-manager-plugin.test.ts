import { Editor } from '@soeditor/core';
import { visualEditingServiceToken } from '@soeditor/engine';
import { describe, expect, it } from 'vitest';

import {
    FileManagerPlugin,
    fileManagerServiceToken,
    type FileManagerOpenOptions,
} from '../src/index.js';

describe('FileManagerPlugin', () => {
    it('uses a custom manager and delegates insertion to ImagePlugin', async () => {
        const editor = await Editor.create({ plugins: [FileManagerPlugin] });
        const inserted: string[] = [];
        let request: FileManagerOpenOptions | undefined;
        registerVisualService(editor, inserted);
        editor.services.register(fileManagerServiceToken, {
            open: (options) => {
                request = options;
                return Promise.resolve({
                    url: '/custom.png',
                    name: 'Custom image',
                    width: 320,
                    height: 200,
                });
            },
        });

        await editor.execute('image.browse');

        expect(request).toEqual({
            accept: ['image/*'],
            kind: 'image',
            multiple: false,
        });
        expect(Object.isFrozen(request)).toBe(true);
        expect(Object.isFrozen(request?.accept)).toBe(true);
        expect(inserted).toEqual([
            '<img src="/custom.png" alt="Custom image" width="320" height="200">',
        ]);
        await editor.destroy();
    });

    it('can delegate the same picker result to structured media', async () => {
        const editor = await Editor.create({ plugins: [FileManagerPlugin] });
        const inserted: string[] = [];
        registerVisualService(editor, inserted);
        editor.services.register(fileManagerServiceToken, {
            open: () =>
                Promise.resolve({
                    alt: 'Hero',
                    height: 675,
                    name: 'hero.jpg',
                    url: '/hero.jpg',
                    width: 1200,
                }),
        });

        await editor.execute('media.browse');

        expect(inserted).toEqual([
            '<figure data-soeditor-media="image"><img src="/hero.jpg" alt="Hero" width="1200" height="675"></figure>',
        ]);
        await editor.destroy();
    });

    it('uses the same manager boundary for existing file links', async () => {
        const editor = await Editor.create({ plugins: [FileManagerPlugin] });
        const links: unknown[] = [];
        let request: FileManagerOpenOptions | undefined;
        registerVisualService(editor, [], links);
        editor.services.register(fileManagerServiceToken, {
            open: (options) => {
                request = options;
                return Promise.resolve({
                    mime: 'application/pdf',
                    name: 'Product guide',
                    url: '/assets/product-guide.pdf',
                });
            },
        });

        await editor.execute('link.file.browse');

        expect(request).toEqual({ kind: 'file', multiple: false });
        expect(links).toEqual([
            { href: '/assets/product-guide.pdf', title: 'Product guide' },
        ]);
        await editor.destroy();
    });

    it('treats cancellation as a no-op and rejects unsafe results', async () => {
        const editor = await Editor.create({ plugins: [FileManagerPlugin] });
        const inserted: string[] = [];
        registerVisualService(editor, inserted);
        editor.services.register(fileManagerServiceToken, {
            open: () => Promise.resolve(null),
        });
        await editor.execute('image.browse');
        expect(inserted).toEqual([]);

        editor.services.unregister(fileManagerServiceToken);
        editor.services.register(fileManagerServiceToken, {
            open: () => Promise.resolve({ url: 'javascript:alert(1)' }),
        });
        await expect(editor.execute('image.browse')).rejects.toThrow(
            'forbidden scheme',
        );
        expect(inserted).toEqual([]);
        await editor.destroy();
    });

    it('serializes picker requests and ignores a result after destruction', async () => {
        const editor = await Editor.create({ plugins: [FileManagerPlugin] });
        const inserted: string[] = [];
        registerVisualService(editor, inserted);
        let resolveSelection:
            ((value: { readonly url: string }) => void) | undefined;
        let opens = 0;
        editor.services.register(fileManagerServiceToken, {
            open: () => {
                opens += 1;
                return new Promise((resolve) => {
                    resolveSelection = resolve;
                });
            },
        });

        const pending = editor.execute('image.browse');
        expect(editor.commands.canExecute('image.browse')).toBe(false);
        expect(editor.execute('image.browse')).toBeUndefined();
        expect(opens).toBe(1);
        await editor.destroy();
        resolveSelection?.({ url: '/late.png' });
        await pending;
        expect(inserted).toEqual([]);
    });

    it('is unavailable without a manager or editable visual service', async () => {
        const editor = await Editor.create({ plugins: [FileManagerPlugin] });
        expect(editor.commands.canExecute('image.browse')).toBe(false);
        editor.services.register(fileManagerServiceToken, {
            open: () => Promise.resolve({ url: '/x.png' }),
        });
        expect(editor.commands.canExecute('image.browse')).toBe(false);
        await editor.destroy();
    });
});

function registerVisualService(
    editor: Editor,
    inserted: string[],
    links: unknown[] = [],
): void {
    editor.services.register(visualEditingServiceToken, {
        canEdit: () => true,
        getSelection: () => undefined,
        getSelectedStructuredBlock: () => undefined,
        insertHtml: (html) => inserted.push(html),
        isBlockActive: () => false,
        isLinkActive: () => false,
        isListActive: () => false,
        isMarkActive: () => false,
        isStructuredBlockSelected: () => false,
        replaceStructuredBlockContent: () => undefined,
        setBlock: () => undefined,
        setLink: (link) => links.push(link),
        setSelection: () => false,
        setStructuredBlockAttributes: () => undefined,
        toggleList: () => undefined,
        toggleMark: () => undefined,
    });
}
