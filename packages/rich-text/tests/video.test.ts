import { Editor } from '@soeditor/core';
import {
    visualEditingServiceToken,
    type EditingStructuredBlock,
    type VisualEditingService,
} from '@soeditor/engine';
import { describe, expect, it, vi } from 'vitest';

import { VideoPlugin } from '../src/video.js';

describe('structured video feature', () => {
    it('inserts and updates a playable video with poster metadata', async () => {
        const editor = await Editor.create({ plugins: [VideoPlugin] });
        let block: EditingStructuredBlock = {
            attributes: [
                { name: 'src', value: '/movie.mp4' },
                { name: 'controls', value: '' },
            ],
            behavior: 'atomic',
            children: [],
            kind: 'structured-block',
            type: 'soeditor.video',
        };
        const insertHtml = vi.fn();
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
        const service: VisualEditingService = {
            canEdit: () => true,
            getSelectedStructuredBlock: () => block,
            getSelection: () => undefined,
            insertHtml,
            isBlockActive: () => false,
            isLinkActive: () => false,
            isListActive: () => false,
            isMarkActive: () => false,
            isStructuredBlockSelected: (type) => type === 'soeditor.video',
            replaceStructuredBlockContent: replace,
            setBlock: vi.fn(),
            setLink: vi.fn(),
            setSelection: () => false,
            setStructuredBlockAttributes: vi.fn(),
            toggleList: vi.fn(),
            toggleMark: vi.fn(),
        };
        editor.services.register(visualEditingServiceToken, service);

        editor.execute('video.insert', {
            poster: '/poster.jpg',
            src: '/next.mp4',
        });
        expect(insertHtml).toHaveBeenCalledWith(
            '<video src="/next.mp4" poster="/poster.jpg" controls=""></video>',
        );
        editor.execute('video.update', {
            height: 360,
            poster: '/cover.jpg',
            width: 640,
        });
        expect(block.attributes).toEqual(
            expect.arrayContaining([
                { name: 'poster', value: '/cover.jpg' },
                { name: 'width', value: '640' },
                { name: 'height', value: '360' },
            ]),
        );
        await editor.destroy();
    });
});
