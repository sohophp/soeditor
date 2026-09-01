import { createClassicEditor } from '@soeditor/editor/cms';
import '@soeditor/editor/styles.css';

const host = document.querySelector<HTMLTextAreaElement>('#content');
if (host === null) throw new Error('Missing CMS textarea.');

const editor = await createClassicEditor(host, {
    locale: 'zh-CN',
    placeholder: 'Write CMS content',
});
document.body.dataset.editorSource = editor.getData();
await editor.destroy();
