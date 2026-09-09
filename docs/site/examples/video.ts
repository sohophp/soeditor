import { createClassicEditor } from 'soeditor-release/cms/optional';
import { button, instance, options, type DemoContext } from './shared.js';

export async function mount(ctx: DemoContext) {
    const editor = await createClassicEditor(ctx.host, {
        ...options(ctx),
        video: { youtube: true, youtubeMetadata: false },
        editingModes: ['wysiwyg', 'source'],
        preview: true,
        toolbar: [
            'undo',
            'redo',
            '|',
            'bold',
            'italic',
            '|',
            'cmsVideo',
            'popupPreview',
        ],
        data: `${ctx.host.value}<p>Video</p><video src="/demo-video.webm" title="Local sample" controls preload="none" style="width:100%;aspect-ratio:16/9"></video>`,
    });
    button(ctx, '编辑视频', 'Edit video', async () => {
        await editor.editor.execute('cms.video.open');
    });
    button(ctx, '预览整篇文章', 'Preview article', () => {
        editor.openPreview();
    });
    button(ctx, '查看源码', 'HTML Source', () =>
        editor.setWorkspaceView('source'),
    );
    return instance(editor);
}
