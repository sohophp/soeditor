import { SoEditor, minimalPreset } from '@soeditor/editor';
import '@soeditor/editor/styles.css';

const editor = await SoEditor.create({
    data: '<p>Vite consumer</p>',
    format: minimalPreset.format,
    plugins: minimalPreset.plugins,
});
document.body.dataset.editorSource = editor.getData();
await editor.destroy();
