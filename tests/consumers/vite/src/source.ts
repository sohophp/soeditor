import { createClassicEditor } from '@soeditor/editor/cms/optional';
import '@soeditor/editor/cms/styles.css';

const host = document.querySelector<HTMLTextAreaElement>('#content');
if (host === null) throw new Error('Missing Source textarea.');
const editor = await createClassicEditor(host, {
    editingModes: ['wysiwyg', 'source'],
    toolbar: ['bold', 'format', 'minify'],
});
Reflect.set(globalThis, '__packedSource', editor);
document.body.dataset.ready = 'true';
