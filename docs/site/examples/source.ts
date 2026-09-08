import { createClassicEditor } from 'soeditor-release/cms/optional';
import { options, instance, button, type DemoContext } from './shared.js';
export async function mount(ctx: DemoContext) {
    const editor = await createClassicEditor(ctx.host, {
        ...options(ctx),
        editingModes: ['wysiwyg', 'source'],
        initialEditingMode: 'wysiwyg',
    });
    button(ctx, '可视化', 'WYSIWYG', () => editor.setWorkspaceView('wysiwyg'));
    button(ctx, 'HTML 源码', 'HTML Source', () =>
        editor.setWorkspaceView('source'),
    );
    button(ctx, '左右分屏', 'Side by side', () =>
        editor.setWorkspaceView('wysiwyg-source-horizontal'),
    );
    button(ctx, '上下分屏', 'Stacked', () =>
        editor.setWorkspaceView('wysiwyg-source-vertical'),
    );
    button(ctx, '格式化 HTML', 'Format HTML', async () => {
        await editor.setWorkspaceView('source');
        await editor.editor.execute('document.format');
    });
    return instance(editor);
}
