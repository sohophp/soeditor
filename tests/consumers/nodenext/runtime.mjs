import {
    Editor,
    EditorDestroyedError,
    EditorInitializationAbortedError,
    Plugin,
} from '@soeditor/core';

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

try {
    editor.commands.has('missing');
    throw new Error('Destroyed packed editor remained operational.');
} catch (error) {
    if (!(error instanceof EditorDestroyedError)) {
        throw error;
    }
}
