import {
    Editor,
    EditorDestroyedError,
    EditorInitializationAbortedError,
    Plugin,
} from '@soeditor/core';
import { parseHtmlFragment, serializeHtmlFragment } from '@soeditor/html';

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

const editor = await Editor.create({ data: '<p>Runtime</p>' });

if (editor.getData() !== '<p>Runtime</p>') {
    throw new Error('Packed editor returned unexpected document data.');
}

await editor.destroy();

const html = parseHtmlFragment(
    '<!--marker--><product-card data-id="123">Runtime</product-card>',
);
const serialized = serializeHtmlFragment(html.document);

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
