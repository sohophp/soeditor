import { Plugin } from '@soeditor/core';

/** Registers command-driven transitions between visual and source modes. */
export class SourceEditingPlugin extends Plugin {
    static readonly id = 'source-editing';

    override init(): void {
        this.#registerModeCommand('editor.source', 'source');
        this.#registerModeCommand('editor.visual', 'visual');
    }

    #registerModeCommand(
        id: 'editor.source' | 'editor.visual',
        mode: 'source' | 'visual',
    ): void {
        this.editor.commands.register({
            id,
            canExecute: ({ editor }) =>
                editor.state.document.format === 'html' &&
                editor.state.mode !== mode,
            execute: ({ editor }, ...args) => {
                if (args.length !== 0) {
                    throw new TypeError(
                        `Command "${id}" does not accept arguments.`,
                    );
                }
                editor.update((transaction) => transaction.setMode(mode), {
                    origin: 'command',
                });
            },
            isActive: ({ editor }) => editor.state.mode === mode,
        });
    }
}
