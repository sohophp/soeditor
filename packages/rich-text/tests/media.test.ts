import { Editor } from '@soeditor/core';
import {
    visualEditingServiceToken,
    type EditingStructuredBlock,
    type VisualEditingService,
} from '@soeditor/engine';
import { parseHtmlFragment, serializeHtmlFragment } from '@soeditor/html';
import { describe, expect, it, vi } from 'vitest';

import {
    isSafeMediaPreviewUrl,
    MediaPlugin,
    RichTextArgumentError,
} from '../src/index.js';

describe('structured media feature', () => {
    it('inserts a semantic figure through the visual editing service', async () => {
        const editor = await Editor.create({ plugins: [MediaPlugin] });
        const inserted: string[] = [];
        editor.services.register(
            visualEditingServiceToken,
            visualService(undefined, inserted),
        );

        editor.execute('media.insert', {
            src: '/photo.png',
            alt: 'A photo',
            caption: 'A caption',
            width: 640,
            height: 480,
        });

        expect(inserted).toEqual([
            '<figure data-soeditor-media="image"><img src="/photo.png" alt="A photo" width="640" height="480"><figcaption>A caption</figcaption></figure>',
        ]);
        expect(() => editor.execute('media.insert', { src: '' })).toThrow(
            RichTextArgumentError,
        );
        await editor.destroy();
    });

    it('updates controlled properties while retaining source attributes', async () => {
        const parsed = parseHtmlFragment(
            '<figure class="hero" data-cms="42"><img src="old.jpg" alt="Old" loading="eager" data-id="7"><figcaption class="credit">Old caption</figcaption></figure>',
        ).document.children[0];
        if (parsed?.type !== 'element') {
            throw new Error('A figure fixture is required.');
        }
        let block: EditingStructuredBlock = {
            attributes: parsed.attributes,
            behavior: 'atomic',
            children: parsed.children,
            kind: 'structured-block',
            type: 'soeditor.media',
        };
        const replace = vi.fn(
            (
                _type: string,
                content: Pick<
                    EditingStructuredBlock,
                    'attributes' | 'children'
                >,
            ) => {
                block = { ...block, ...content };
            },
        );
        const editor = await Editor.create({ plugins: [MediaPlugin] });
        editor.services.register(
            visualEditingServiceToken,
            visualService(() => block, [], replace),
        );

        editor.execute('media.update', {
            src: 'new.webp',
            alt: 'New',
            caption: 'New caption',
            width: 800,
        });
        expect(html(block)).toBe(
            '<figure class="hero" data-cms="42"><img src="new.webp" alt="New" loading="eager" data-id="7" width="800"><figcaption class="credit">New caption</figcaption></figure>',
        );
        editor.execute('media.update', { width: null });
        expect(html(block)).not.toContain('width=');
        expect(html(block)).toContain('src="new.webp"');
        editor.execute('media.caption.remove');
        expect(html(block)).not.toContain('figcaption');
        expect(html(block)).toContain('src="new.webp"');
        expect(replace).toHaveBeenCalledTimes(3);
        await editor.destroy();
    });

    it('preserves unsupported figures and blocks executable preview schemes', async () => {
        expect(isSafeMediaPreviewUrl('https://example.com/x.png')).toBe(true);
        expect(isSafeMediaPreviewUrl('/x.png')).toBe(true);
        expect(isSafeMediaPreviewUrl('data:image/png;base64,AA==')).toBe(true);
        expect(isSafeMediaPreviewUrl('javascript:alert(1)')).toBe(false);
        expect(isSafeMediaPreviewUrl('data:text/html;base64,AA==')).toBe(false);

        const parsed = parseHtmlFragment(
            '<figure><picture><img src="x.png"></picture><script>kept()</script></figure>',
        ).document.children[0];
        if (parsed?.type !== 'element') {
            throw new Error('A figure fixture is required.');
        }
        const block: EditingStructuredBlock = {
            attributes: parsed.attributes,
            behavior: 'atomic',
            children: parsed.children,
            kind: 'structured-block',
            type: 'soeditor.media',
        };
        const replace = vi.fn();
        const editor = await Editor.create({ plugins: [MediaPlugin] });
        editor.services.register(
            visualEditingServiceToken,
            visualService(block, [], replace),
        );
        expect(() => editor.execute('media.update', { alt: 'Nope' })).toThrow(
            'figure requires one image and an optional caption',
        );
        expect(replace).not.toHaveBeenCalled();
        expect(html(block)).toContain('<script>kept()</script>');
        await editor.destroy();
    });
});

function visualService(
    selected:
        | EditingStructuredBlock
        | undefined
        | (() => EditingStructuredBlock | undefined),
    inserted: string[],
    replace: VisualEditingService['replaceStructuredBlockContent'] = () =>
        undefined,
): VisualEditingService {
    const current = (): EditingStructuredBlock | undefined =>
        typeof selected === 'function' ? selected() : selected;
    return {
        canEdit: () => true,
        getSelection: () => undefined,
        getSelectedStructuredBlock: (type) => {
            const block = current();
            return type === undefined || block?.type === type
                ? block
                : undefined;
        },
        insertHtml: (source) => inserted.push(source),
        isBlockActive: () => false,
        isLinkActive: () => false,
        isListActive: () => false,
        isMarkActive: () => false,
        isStructuredBlockSelected: (type) => {
            const block = current();
            return (
                block !== undefined &&
                (type === undefined || block.type === type)
            );
        },
        replaceStructuredBlockContent: replace,
        setBlock: () => undefined,
        setLink: () => undefined,
        setSelection: () => false,
        setStructuredBlockAttributes: () => undefined,
        toggleList: () => undefined,
        toggleMark: () => undefined,
    };
}

function html(block: EditingStructuredBlock): string {
    return serializeHtmlFragment({
        children: [
            {
                attributes: block.attributes,
                children: block.children,
                namespace: 'html',
                tagName: 'figure',
                type: 'element',
            },
        ],
        type: 'document-fragment',
    });
}
