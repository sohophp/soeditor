import { createClassicEditor } from 'soeditor-release/cms/optional';
import { cmsRuntimePreset } from '@soeditor/presets/cms-runtime';
import { FileManagerPlugin, UploadPlugin } from '@soeditor/file-manager';
import {
    fileManagerServiceToken,
    uploadServiceToken,
} from '@soeditor/file-manager';
import { SoFinderAdapter } from '@soeditor/adapter-sofinder';
import {
    options,
    instance,
    button,
    delay,
    label,
    type DemoContext,
} from './shared.js';
export async function mount(ctx: DemoContext) {
    const editor = await createClassicEditor(ctx.host, {
        ...options(ctx),
        plugins: [...cmsRuntimePreset.plugins, FileManagerPlugin, UploadPlugin],
    });
    let failNext = false;
    const asset = {
        url: new URL('/sample-image.svg', location.origin).href,
        name: 'Sample',
        alt: label(ctx, '蓝色山峦', 'Blue hills'),
        mime: 'image/svg+xml',
    };
    editor.editor.services.register(
        fileManagerServiceToken,
        new SoFinderAdapter({
            // Replace this callback with the host's actual SoFinder picker.
            pick: async () => ({ ...asset, mimeType: asset.mime }),
        }),
    );
    editor.editor.services.register(uploadServiceToken, {
        create() {
            const controller = new AbortController();
            return {
                cancel: () => controller.abort(),
                subscribe: () => () => undefined,
                result: delay(controller.signal).then(() => {
                    if (failNext) {
                        failNext = false;
                        throw new Error(
                            label(
                                ctx,
                                '模拟上传失败，请重试',
                                'Mock upload failed. Retry.',
                            ),
                        );
                    }
                    return asset;
                }),
            };
        },
    });
    button(ctx, '选择示例图片', 'Choose sample image', async () => {
        editor.focus();
        await editor.editor.execute('media.browse');
    });
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.setAttribute(
        'aria-label',
        label(ctx, '模拟上传图片', 'Mock image upload'),
    );
    input.addEventListener(
        'change',
        () => {
            const file = input.files?.[0];
            if (!file) return;
            editor.focus();
            void Promise.resolve(
                editor.editor.execute('image.upload', {
                    file,
                    name: file.name,
                    type: file.type,
                }),
            )
                .then(() => {
                    ctx.status.textContent = label(
                        ctx,
                        '模拟上传完成，使用内置图片',
                        'Mock upload complete; using the bundled image',
                    );
                })
                .catch((error: unknown) => {
                    ctx.status.textContent =
                        error instanceof Error
                            ? error.message
                            : 'Upload failed';
                });
            input.value = '';
        },
        { signal: ctx.signal },
    );
    ctx.controls.append(input);
    button(ctx, '下次上传失败', 'Fail next upload', () => {
        failNext = true;
        ctx.status.textContent = label(
            ctx,
            '下次上传将模拟失败',
            'The next upload will fail',
        );
    });
    return instance(editor);
}
