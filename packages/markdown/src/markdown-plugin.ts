import { Plugin } from '@soeditor/core';

/** Registers the canonical Markdown source-mode command. */
export class MarkdownPlugin extends Plugin {
    static readonly id = 'markdown';

    override init(): void {
        this.editor.commands.register({
            id: 'editor.markdown',
            canExecute: ({ editor }) =>
                editor.state.document.format === 'markdown' &&
                editor.state.mode !== 'markdown',
            execute: ({ editor }, ...args) => {
                if (args.length !== 0) {
                    throw new TypeError(
                        'Command "editor.markdown" does not accept arguments.',
                    );
                }
                editor.update(
                    (transaction) => transaction.setMode('markdown'),
                    { origin: 'command' },
                );
            },
            isActive: ({ editor }) => editor.state.mode === 'markdown',
        });
    }
}
