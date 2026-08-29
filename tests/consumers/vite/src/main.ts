import { SoEditor, minimalPreset } from 'soeditor';
import 'soeditor/styles.css';

const editor = await SoEditor.create({
    data: '<p>Vite consumer</p>',
    format: minimalPreset.format,
    plugins: minimalPreset.plugins,
});
document.body.dataset.editorSource = editor.getData();
await editor.destroy();
