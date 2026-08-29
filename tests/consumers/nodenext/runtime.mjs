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

if (editor.services.tryGet(uiRegistryServiceToken) === undefined) {
    throw new Error('Packed UI plugin did not register its service.');
}

if (!import.meta.resolve('@soeditor/ui/styles.css').endsWith('/styles.css')) {
    throw new Error('Packed UI stylesheet export could not be resolved.');
}

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
