import { Editor } from '@soeditor/core';
import { Plugin } from '@soeditor/plugin-sdk';
import { minimalPreset } from '@soeditor/presets/minimal';

class NarrowPlugin extends Plugin {
    static readonly id = 'consumer.narrow';
}

const editor = await Editor.create({
    data: '<p>Narrow consumer</p>',
    plugins: [...minimalPreset.plugins, NarrowPlugin],
});
document.body.dataset.editorSource = editor.getData();
await editor.destroy();
