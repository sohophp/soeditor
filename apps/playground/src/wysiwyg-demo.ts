import { createClassicEditor, type ClassicEditor } from '@soeditor/editor';
import {
    fileManagerServiceToken,
    uploadServiceToken,
    type FileManagerOpenOptions,
    type FileManagerResult,
    type UploadRequest,
} from '@soeditor/file-manager';
import '@soeditor/editor/styles.css';

const fixtureHtml = [
    '<h1>WYSIWYG direct qualification</h1>',
    '<p id="paragraph">Alpha <strong>bold</strong> omega.</p>',
    '<ul><li id="first-item">First item<ul><li id="nested-item">Nested item</li></ul></li><li>Last item</li></ul>',
    '<table><caption id="table-caption">Qualification table</caption><thead><tr><th id="cell-feature">Feature</th><th id="cell-status">Status</th></tr></thead><tbody><tr><td id="cell-selection">Selection</td><td id="cell-pending">Pending</td></tr><tr><td id="cell-editing">Editing</td><td id="cell-ready">Ready</td></tr></tbody></table>',
    '<p><a href="/documentation" title="Documentation">Documentation link</a></p>',
    '<p><img src="/demo-editor-cover.svg" alt="Qualification image" width="320" height="120"></p>',
    '<aside data-campaign="autumn">Semantic aside content</aside>',
    '<!--qualification-marker--><product-card data-id="49"></product-card>',
].join('');

const host = document.querySelector<HTMLTextAreaElement>('#wysiwyg-content');
if (host === null) throw new Error('Missing WYSIWYG qualification host.');

const instance = await createClassicEditor(host, {
    ariaLabel: 'WYSIWYG qualification editor',
    data: fixtureHtml,
    editingModes: ['wysiwyg', 'source'],
    initialEditingMode: 'wysiwyg',
    initialHeight: 520,
    maxHeight: 720,
    minHeight: 320,
    preview: {
        context: { fixtureName: 'Direct WYSIWYG preview' },
        styles: [
            'body{max-width:760px;margin:0 auto;padding:24px;font-family:system-ui,sans-serif}',
            'img{max-width:100%;height:auto} table{border-collapse:collapse;width:100%}',
            'th,td{border:1px solid #c8cad8;padding:8px}',
        ],
        template:
            '<!doctype html><html><head><meta charset="utf-8"><title>{{ fixtureName }}</title></head><body><header>{{ fixtureName }}</header><main>{{ content }}</main></body></html>',
        title: 'WYSIWYG qualification preview',
    },
});

instance.editor.services.register(fileManagerServiceToken, {
    open: async (
        options: FileManagerOpenOptions,
    ): Promise<FileManagerResult | null> => {
        if (options.kind === 'image') {
            return {
                alt: 'Managed qualification image',
                name: 'managed-qualification.svg',
                mime: 'image/svg+xml',
                url: '/demo-editor-cover.svg',
            };
        }
        if (options.kind === 'media') {
            return {
                name: 'qualification-video.mp4',
                mime: 'video/mp4',
                url: '/qualification-video.mp4',
            };
        }
        return {
            name: 'qualification.pdf',
            mime: 'application/pdf',
            url: '/qualification.pdf',
        };
    },
});

instance.editor.services.register(uploadServiceToken, {
    create: (request: UploadRequest) => ({
        cancel: () => undefined,
        result: Promise.resolve({
            alt: request.name,
            name: request.name,
            mime: request.type,
            url: `/uploads/${encodeURIComponent(request.name)}`,
        }),
        subscribe: (
            listener: (progress: { loaded: number; total?: number }) => void,
        ) => {
            listener({ loaded: request.size, total: request.size });
            return () => undefined;
        },
    }),
});

Reflect.set(
    globalThis,
    '__wysiwygFixture',
    Object.freeze({
        create: (host: HTMLElement): Promise<ClassicEditor> =>
            createClassicEditor(host, {
                data: '<p id="secondary">Secondary editor</p>',
                editingModes: ['wysiwyg'],
                initialEditingMode: 'wysiwyg',
            }),
        destroy: (): Promise<void> => instance.destroy(),
        editor: instance,
        getData: (): string => instance.getData(),
        setData: (data: string): void => instance.setData(data),
        setReadonly: (readonly: boolean): void =>
            instance.setReadonly(readonly),
        setWorkspaceView: (
            view: Parameters<ClassicEditor['setWorkspaceView']>[0],
        ): void => instance.setWorkspaceView(view),
    }),
);

document.body.dataset.ready = 'true';
