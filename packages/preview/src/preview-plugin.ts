import { Plugin } from '@soeditor/core';

import { previewServiceToken } from './preview-service.js';

/** Registers command-driven Preview mode and explicit refresh. */
export class PreviewPlugin extends Plugin {
    static readonly id = 'preview';
    #returnMode: 'source' | 'visual' = 'visual';

    override init(): void {
        this.editor.commands.register({
            id: 'editor.preview',
            canExecute: ({ editor }) =>
                editor.state.mode !== 'preview' &&
                editor.services.has(previewServiceToken),
            execute: ({ editor }, ...args) => {
                assertNoArguments('editor.preview', args);
                this.#returnMode =
                    editor.state.mode === 'source' ? 'source' : 'visual';
                editor.update((transaction) => transaction.setMode('preview'), {
                    origin: 'command',
                });
            },
            isActive: ({ editor }) => editor.state.mode === 'preview',
        });
        this.editor.commands.register({
            id: 'editor.preview.close',
            canExecute: ({ editor }) => editor.state.mode === 'preview',
            execute: ({ editor }, ...args) => {
                assertNoArguments('editor.preview.close', args);
                editor.update(
                    (transaction) => transaction.setMode(this.#returnMode),
                    { origin: 'command' },
                );
            },
        });
        this.editor.commands.register({
            id: 'preview.refresh',
            canExecute: ({ editor }) =>
                editor.services.has(previewServiceToken),
            execute: ({ editor }, ...args) => {
                assertNoArguments('preview.refresh', args);
                editor.services.get(previewServiceToken).refresh();
            },
        });
    }
}

function assertNoArguments(id: string, args: readonly unknown[]): void {
    if (args.length !== 0) {
        throw new TypeError(`Command "${id}" does not accept arguments.`);
    }
}
