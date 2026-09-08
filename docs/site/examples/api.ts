import {
    createClassicEditor,
    type ClassicEditor,
    type CreateClassicEditorOptions,
} from 'soeditor-release/cms';
import { createClassicEditor as createOptionalEditor } from 'soeditor-release/cms/optional';
import {
    FileManagerPlugin,
    UploadPlugin,
    fileManagerServiceToken,
    type FileManager,
} from '@soeditor/file-manager';
import {
    SoFinderAdapter,
    type SoFinderPicker,
} from '@soeditor/adapter-sofinder';
import { cmsRuntimePreset } from '@soeditor/presets/cms-runtime';
import 'soeditor-release/cms/styles.css';

// #region installation
export async function attach() {
    const host = document.querySelector<HTMLTextAreaElement>('#content');
    if (!host) throw new Error('Missing #content textarea');
    return createClassicEditor(host, { locale: 'zh-CN', minHeight: 280 });
}
// #endregion installation

// #region lifecycle
export async function withHost(host: HTMLElement) {
    const editor = await createClassicEditor(host, { data: '<p>Hello</p>' });
    editor.setData('<p>Updated</p>');
    const html = editor.getData();
    editor.setReadonly(true);
    await editor.destroy(); // Before removing the host element.
    return html;
}
// #endregion lifecycle

// #region source
export async function source(host: HTMLElement) {
    const editor = await createOptionalEditor(host, {
        editingModes: ['wysiwyg', 'source'],
        initialEditingMode: 'wysiwyg',
    });
    // Call in response to an explicit user action.
    await editor.setWorkspaceView('source');
    return editor;
}
// #endregion source

// #region split
export async function split(editor: ClassicEditor) {
    await editor.setWorkspaceView('wysiwyg-source-horizontal');
    await editor.setWorkspaceView('wysiwyg-source-vertical');
    await editor.setWorkspaceView('wysiwyg');
}
// #endregion split

// #region configuration
export const configuration = {
    locale: 'zh-CN',
    ariaLabel: 'Article content',
    minHeight: 280,
    readonly: false,
    placeholder: 'Start writing…',
    toolbarLayout: { collapsible: true, overflow: 'wrap', sticky: true },
    onChange: ({ source }) => {
        console.info('Canonical HTML:', source);
    },
} satisfies CreateClassicEditorOptions;
// #endregion configuration

// #region commands
export async function undo(editor: ClassicEditor) {
    editor.focus();
    if (editor.editor.commands.canExecute('editor.undo')) {
        await editor.editor.execute('editor.undo');
    }
}
// #endregion commands

// #region picker
export function registerPicker(editor: ClassicEditor, picker: FileManager) {
    editor.editor.services.register(fileManagerServiceToken, picker);
}
// #endregion picker

// #region sofinder
export function registerSoFinder(editor: ClassicEditor, pick: SoFinderPicker) {
    editor.editor.services.register(
        fileManagerServiceToken,
        new SoFinderAdapter({ pick }),
    );
}
// #endregion sofinder

// #region formatting
export async function format(editor: ClassicEditor) {
    await editor.setWorkspaceView('source');
    await editor.editor.execute('document.format');
}
// #endregion formatting

// #region asset-plugins
export async function createAssetEditor(host: HTMLElement) {
    return createOptionalEditor(host, {
        plugins: [...cmsRuntimePreset.plugins, FileManagerPlugin, UploadPlugin],
    });
}
// #endregion asset-plugins

// #region content
export async function editArticle(host: HTMLElement) {
    return createClassicEditor(host, {
        data: '<h2>Article</h2><p class="intro">Select text to format it.</p><ul><li>First item</li></ul>',
    });
}
// #endregion content

// #region table
export async function editTable(host: HTMLElement) {
    return createClassicEditor(host, {
        data: '<table cellpadding="4"><caption>Products</caption><thead><tr><th scope="col">Name</th><th scope="col">Stock</th></tr></thead><tbody><tr><td>Example</td><td>12</td></tr></tbody></table>',
    });
}
// #endregion table

// #region image
export async function editImage(host: HTMLElement, trustedImageUrl: string) {
    const image = document.createElement('img');
    image.src = trustedImageUrl;
    image.alt = 'Product front view';
    return createClassicEditor(host, { data: `<p>${image.outerHTML}</p>` });
}
// #endregion image
