import { Editor, Plugin } from '@soeditor/core';
import { createVisualEditingEngine, HistoryPlugin } from '@soeditor/engine';
import {
    BlockquotePlugin,
    BoldPlugin,
    CodeBlockPlugin,
    HeadingPlugin,
    ImagePlugin,
    InlineCodePlugin,
    ItalicPlugin,
    LinkPlugin,
    OrderedListPlugin,
    ParagraphPlugin,
    StrikePlugin,
    TablePlugin,
    UnderlinePlugin,
    UnorderedListPlugin,
} from '@soeditor/rich-text';

class DemoPlugin extends Plugin {
    static readonly id = 'demo';

    override init(): void {
        this.editor.commands.register({
            id: 'demo.uppercase',
            execute: ({ editor }) => {
                editor.update(
                    (transaction) => {
                        transaction.replaceDocument(
                            editor.getData().toUpperCase(),
                        );
                    },
                    { origin: 'command' },
                );
            },
        });
    }
}

const stateOutput = document.querySelector<HTMLElement>('#state');
const sourceOutput = document.querySelector<HTMLElement>('#source');
const editingHost = document.querySelector<HTMLElement>('#editor');

if (stateOutput === null || sourceOutput === null || editingHost === null) {
    throw new Error('Playground output or editing host was not found.');
}

const editor = await Editor.create({
    data: '<p>Hello <strong>SoEditor</strong></p><product-card data-id="123"></product-card><!--CMS:block-->',
    plugins: [
        DemoPlugin,
        HistoryPlugin,
        ParagraphPlugin,
        HeadingPlugin,
        BoldPlugin,
        ItalicPlugin,
        UnderlinePlugin,
        StrikePlugin,
        LinkPlugin,
        OrderedListPlugin,
        UnorderedListPlugin,
        BlockquotePlugin,
        InlineCodePlugin,
        CodeBlockPlugin,
        ImagePlugin,
        TablePlugin,
    ],
    readonly: new URLSearchParams(window.location.search).has('readonly'),
});
const visualEngine = createVisualEditingEngine({
    editor,
    element: editingHost,
});
(window as Window & { __soeditor?: unknown }).__soeditor = Object.freeze({
    createVisualEditingEngine,
    editor,
    visualEngine,
});

const render = (): void => {
    stateOutput.textContent = JSON.stringify(editor.state, null, 4);
    sourceOutput.textContent = editor.getData();
};

const bind = (id: string, callback: () => void): void => {
    const button = document.querySelector<HTMLButtonElement>(`#${id}`);

    if (button === null) {
        throw new Error(`Playground button "${id}" was not found.`);
    }

    button.addEventListener('click', callback);
};

editor.events.on('state:change', render);
bind('hello', () => editor.setData('<p>Hello</p>'));
bind('world', () => editor.setData('<p>World</p>'));
bind('mode', () => {
    editor.update(
        (transaction) => {
            transaction.setMode(
                editor.state.mode === 'source' ? 'visual' : 'source',
            );
        },
        { origin: 'user' },
    );
});
bind('clean', () => editor.markClean());
bind('uppercase', () => {
    editor.execute('demo.uppercase');
});
bind('unsafe', () => {
    editor.setData(
        '<p>Safe text</p><img src="invalid:" onerror="window.__soeditorExecuted = true"><script>window.__soeditorExecuted = true</script>',
    );
});
bind('document', () => {
    editor.setData(
        '<!doctype html><html><head><title>Document</title></head><body><p>Preserved</p></body></html>',
    );
});
bind('inline-opaque', () => {
    editor.setData('<p>A<product-card data-id="1"></product-card>B</p>');
});
bind('destroy-engine', () => visualEngine.destroy());
bind('destroy-editor', () => {
    void editor.destroy();
});
render();
