import {
    SoEditor,
    createEditorSaveWorkflow,
    minimalPreset,
} from '@soeditor/editor';
import '@soeditor/editor/styles.css';

const editor = await SoEditor.create({
    data: '<p>Vite consumer</p>',
    format: minimalPreset.format,
    plugins: minimalPreset.plugins,
});
document.body.dataset.editorSource = editor.getData();
const saving = createEditorSaveWorkflow({
    adapter: {
        save: async ({ source }) => {
            document.body.dataset.savedSource = source;
            return { revisionToken: 'vite-v1', status: 'saved' };
        },
    },
    editor,
});
editor.setData('<p>Vite saved consumer</p>');
await saving.save();
saving.destroy();
await editor.destroy();
