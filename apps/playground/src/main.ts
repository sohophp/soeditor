import { Editor, Plugin } from '@soeditor/core';

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

if (stateOutput === null) {
    throw new Error('Playground state output was not found.');
}

const editor = await Editor.create({
    data: '<p>Hello</p>',
    plugins: [DemoPlugin],
});

const render = (): void => {
    stateOutput.textContent = JSON.stringify(editor.state, null, 4);
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
render();
