import { Editor } from '@soeditor/core';
import { visualEditingServiceToken } from '@soeditor/engine';
import { describe, expect, it } from 'vitest';

import {
    UploadPlugin,
    uploadServiceToken,
    uploadWorkflowServiceToken,
    type UploadProgress,
    type UploadRequest,
} from '../src/index.js';

describe('UploadPlugin', () => {
    it('publishes progress and inserts one validated uploaded image', async () => {
        const editor = await Editor.create({ plugins: [UploadPlugin] });
        const inserted: string[] = [];
        registerVisualService(editor, inserted);
        let request: UploadRequest | undefined;
        let progress: ((value: UploadProgress) => void) | undefined;
        editor.services.register(uploadServiceToken, {
            create: (value) => {
                request = value;
                return {
                    cancel: () => undefined,
                    result: Promise.resolve({
                        alt: 'Uploaded',
                        height: 200,
                        url: '/assets/photo.png',
                        width: 320,
                    }),
                    subscribe: (listener) => {
                        progress = listener;
                        return () => undefined;
                    },
                };
            },
        });
        const workflow = editor.services.get(uploadWorkflowServiceToken);
        const observed: number[] = [];
        workflow.subscribe((records) => {
            observed.push(records[0]?.loaded ?? -1);
        });

        const pending = editor.execute(
            'image.upload',
            uploadOptions('photo.png'),
        ) as Promise<unknown>;
        progress?.({ loaded: 2, total: 4 });
        await pending;

        expect(request).toMatchObject({
            attempt: 1,
            kind: 'image',
            name: 'photo.png',
            size: 4,
            type: 'image/png',
        });
        expect(observed).toContain(2);
        expect(workflow.list()[0]).toMatchObject({
            loaded: 4,
            status: 'succeeded',
            total: 4,
        });
        expect(workflow.list()[0]?.previewUrl).toBeUndefined();
        expect(inserted).toEqual([
            '<figure data-soeditor-media="image"><img src="/assets/photo.png" alt="Uploaded" width="320" height="200"></figure>',
        ]);
        await editor.destroy();
    });

    it('retains failure evidence and retries through a new host task', async () => {
        const editor = await Editor.create({ plugins: [UploadPlugin] });
        const inserted: string[] = [];
        registerVisualService(editor, inserted);
        let attempt = 0;
        editor.services.register(uploadServiceToken, {
            create: () => {
                attempt += 1;
                return {
                    cancel: () => undefined,
                    result:
                        attempt === 1
                            ? Promise.reject(new Error('network unavailable'))
                            : Promise.resolve({ url: '/retry.png' }),
                    subscribe: () => () => undefined,
                };
            },
        });
        const workflow = editor.services.get(uploadWorkflowServiceToken);

        await expect(
            workflow.start(uploadOptions('retry.png')),
        ).rejects.toThrow('network unavailable');
        expect(workflow.list()[0]).toMatchObject({
            attempt: 1,
            error: 'network unavailable',
            status: 'failed',
        });
        await workflow.retry('upload-1');
        expect(workflow.list()[0]).toMatchObject({
            attempt: 2,
            status: 'succeeded',
        });
        expect(inserted).toHaveLength(1);
        await editor.destroy();
    });

    it('cancels concurrent work and ignores late completion after destroy', async () => {
        const editor = await Editor.create({ plugins: [UploadPlugin] });
        const inserted: string[] = [];
        registerVisualService(editor, inserted);
        const resolvers: ((value: { readonly url: string }) => void)[] = [];
        const cancellations: string[] = [];
        editor.services.register(uploadServiceToken, {
            create: () => ({
                cancel: (reason) => cancellations.push(reason ?? ''),
                result: new Promise((resolve) => resolvers.push(resolve)),
                subscribe: () => () => undefined,
            }),
        });
        const workflow = editor.services.get(uploadWorkflowServiceToken);
        const first = workflow.start(uploadOptions('first.png'));
        const second = workflow.start(uploadOptions('second.png'));
        expect(workflow.list()).toHaveLength(2);
        expect(workflow.cancel('upload-1')).toBe(true);
        await editor.destroy();
        expect(cancellations).toEqual([
            'Cancelled by user.',
            'Editor destroyed.',
        ]);
        resolvers[0]?.({ url: '/late-first.png' });
        resolvers[1]?.({ url: '/late-second.png' });
        await Promise.all([first, second]);
        expect(inserted).toEqual([]);
    });

    it('rejects unsupported input and unsafe adapter results', async () => {
        const editor = await Editor.create({ plugins: [UploadPlugin] });
        registerVisualService(editor, []);
        editor.services.register(uploadServiceToken, {
            create: () => ({
                cancel: () => undefined,
                result: Promise.resolve({ url: 'javascript:alert(1)' }),
                subscribe: () => () => undefined,
            }),
        });
        const workflow = editor.services.get(uploadWorkflowServiceToken);
        expect(() =>
            workflow.start({
                file: new Blob(['x'], { type: 'text/plain' }),
                name: 'x.txt',
            }),
        ).toThrow('Unsupported image upload type');
        await expect(
            workflow.start(uploadOptions('unsafe.png')),
        ).rejects.toThrow('forbidden scheme');
        expect(workflow.list()[0]?.status).toBe('failed');
        await editor.destroy();
    });
});

function uploadOptions(name: string) {
    return {
        file: new Blob(['data'], { type: 'image/png' }),
        name,
        type: 'image/png',
    };
}

function registerVisualService(editor: Editor, inserted: string[]): void {
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
        setLink: () => undefined,
        setSelection: () => false,
        setStructuredBlockAttributes: () => undefined,
        toggleList: () => undefined,
        toggleMark: () => undefined,
    });
}
