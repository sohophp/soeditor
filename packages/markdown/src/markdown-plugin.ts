import { Plugin, type Editor } from '@soeditor/core';
import { projectionCoordinatorServiceToken } from '@soeditor/projections';

/** Registers the canonical Markdown source-mode command. */
export class MarkdownPlugin extends Plugin {
    static readonly id = 'markdown';

    override init(): void {
        this.editor.commands.register({
            id: 'editor.markdown',
            label: 'Switch to Markdown editing',
            canExecute: ({ editor }) =>
                editor.state.document.format === 'markdown' &&
                canActivateMarkdown(editor),
            execute: ({ editor }, ...args) => {
                if (args.length !== 0) {
                    throw new TypeError(
                        'Command "editor.markdown" does not accept arguments.',
                    );
                }
                const coordinator = editor.services.tryGet(
                    projectionCoordinatorServiceToken,
                );
                if (coordinator !== undefined) {
                    if (!coordinator.get('markdown').visible) {
                        editor.execute('projection.show', 'markdown');
                    }
                    editor.execute('projection.activate', 'markdown');
                } else {
                    editor.update(
                        (transaction) => transaction.setMode('markdown'),
                        { origin: 'command' },
                    );
                }
            },
            isActive: ({ editor }) => isMarkdownActive(editor),
        });
    }
}

function canActivateMarkdown(editor: Editor): boolean {
    const coordinator = editor.services.tryGet(
        projectionCoordinatorServiceToken,
    );
    return coordinator === undefined
        ? editor.state.mode !== 'markdown'
        : coordinator.isAttached('markdown') &&
              !coordinator.get('markdown').primary;
}

function isMarkdownActive(editor: Editor): boolean {
    const coordinator = editor.services.tryGet(
        projectionCoordinatorServiceToken,
    );
    return coordinator === undefined
        ? editor.state.mode === 'markdown'
        : coordinator.isAttached('markdown') &&
              coordinator.get('markdown').primary;
}
