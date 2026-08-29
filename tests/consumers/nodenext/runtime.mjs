import {
    Editor,
    EditorDestroyedError,
    EditorInitializationAbortedError,
    Plugin,
} from '@soeditor/core';
import { parseHtmlFragment, serializeHtmlFragment } from '@soeditor/html';
import { createVisualEditingEngine, HistoryPlugin } from '@soeditor/engine';
import { BoldPlugin } from '@soeditor/rich-text';
import { SourceEditingPlugin } from '@soeditor/source';
import { DiagnosticsPlugin, HtmlFormattingPlugin } from '@soeditor/html-tools';
import { UiPlugin, uiRegistryServiceToken } from '@soeditor/ui';
import { PreviewPlugin } from '@soeditor/preview';
import {
    createMarkdownPreviewRenderer,
    markdownToHtml,
    MarkdownPlugin,
} from '@soeditor/markdown';
import {
    createDocumentOutline,
    DeveloperToolsPlugin,
} from '@soeditor/dev-tools';
import { SoFinderAdapter } from '@soeditor/adapter-sofinder';
import { normalizeFileManagerResult } from '@soeditor/file-manager';

class DestroyDuringInit extends Plugin {
    static id = 'destroy-during-init';

    init() {
        void this.editor.destroy();
    }
}

try {
    await Editor.create({ plugins: [DestroyDuringInit] });
    throw new Error('Destroyed startup unexpectedly returned an editor.');
} catch (error) {
    if (!(error instanceof EditorInitializationAbortedError)) {
        throw error;
    }
}

const editor = await Editor.create({
    data: '<p>Runtime</p>',
    plugins: [
        HistoryPlugin,
        BoldPlugin,
        SourceEditingPlugin,
        DiagnosticsPlugin,
        HtmlFormattingPlugin,
        UiPlugin,
        PreviewPlugin,
        DeveloperToolsPlugin,
    ],
});

if (editor.getData() !== '<p>Runtime</p>') {
    throw new Error('Packed editor returned unexpected document data.');
}

if (!editor.commands.has('format.bold')) {
    throw new Error('Packed rich-text plugin did not register its command.');
}

if (!editor.commands.has('editor.source')) {
    throw new Error('Packed source plugin did not register its command.');
}

if (
    !editor.commands.has('document.validate') ||
    !editor.commands.has('document.format')
) {
    throw new Error('Packed HTML tools did not register their commands.');
}

const selectedAsset = await new SoFinderAdapter({
    pick: async () => ({
        mimeType: 'image/png',
        url: '/runtime.png',
    }),
}).open({ kind: 'image', multiple: false });
if (
    selectedAsset?.mime !== 'image/png' ||
    normalizeFileManagerResult(selectedAsset)?.url !== '/runtime.png'
) {
    throw new Error(
        'Packed file-manager adapter failed its runtime smoke test.',
    );
}

if (editor.services.tryGet(uiRegistryServiceToken) === undefined) {
    throw new Error('Packed UI plugin did not register its service.');
}

if (!import.meta.resolve('@soeditor/ui/styles.css').endsWith('/styles.css')) {
    throw new Error('Packed UI stylesheet export could not be resolved.');
}

if (!editor.commands.has('editor.preview')) {
    throw new Error('Packed preview plugin did not register its command.');
}

if (
    !editor.commands.has('developer.find') ||
    createDocumentOutline('<h2>Runtime outline</h2>')[0]?.label !==
        'Runtime outline'
) {
    throw new Error(
        'Packed developer-tools package failed its runtime smoke test.',
    );
}

const markdownEditor = await Editor.create({
    data: '# Runtime',
    format: 'markdown',
    plugins: [MarkdownPlugin],
});
if (
    markdownEditor.state.mode !== 'markdown' ||
    !markdownToHtml(markdownEditor.getData()).includes('<h1>Runtime</h1>') ||
    !createMarkdownPreviewRenderer().supports('markdown')
) {
    throw new Error('Packed Markdown package failed its Node ESM smoke test.');
}
await markdownEditor.destroy();

editor.setData('<p>Changed</p>');
editor.execute('editor.undo');
if (editor.getData() !== '<p>Runtime</p>') {
    throw new Error('Packed history plugin failed undo.');
}

await editor.destroy();

const html = parseHtmlFragment(
    '<!--marker--><product-card data-id="123">Runtime</product-card>',
);
const serialized = serializeHtmlFragment(html.document);

if (typeof createVisualEditingEngine !== 'function') {
    throw new Error('Packed visual engine module could not load in Node ESM.');
}

if (
    !serialized.includes('<!--marker-->') ||
    !serialized.includes('<product-card data-id="123">Runtime</product-card>')
) {
    throw new Error('Packed HTML runtime failed semantic preservation.');
}

try {
    editor.commands.has('missing');
    throw new Error('Destroyed packed editor remained operational.');
} catch (error) {
    if (!(error instanceof EditorDestroyedError)) {
        throw error;
    }
}
