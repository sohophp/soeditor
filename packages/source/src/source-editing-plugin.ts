import { Plugin, type Editor } from '@soeditor/core';
import { projectionCoordinatorServiceToken } from '@soeditor/projections';

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
            label:
                mode === 'source'
                    ? 'Switch to HTML source'
                    : 'Switch to visual editing',
            canExecute: ({ editor }) =>
                editor.state.document.format === 'html' &&
                canActivateProjection(editor, mode),
            execute: ({ editor }, ...args) => {
                if (args.length !== 0) {
                    throw new TypeError(
                        `Command "${id}" does not accept arguments.`,
                    );
                }
                const coordinator = editor.services.tryGet(
                    projectionCoordinatorServiceToken,
                );
                if (coordinator !== undefined) {
                    if (!coordinator.get(mode).visible) {
                        editor.execute('projection.show', mode);
                    }
                    editor.execute('projection.activate', mode);
                } else {
                    editor.update((transaction) => transaction.setMode(mode), {
                        origin: 'command',
                    });
                }
            },
            isActive: ({ editor }) => isProjectionActive(editor, mode),
        });
    }
}

function isProjectionActive(
    editor: Editor,
    mode: 'source' | 'visual',
): boolean {
    const coordinator = editor.services.tryGet(
        projectionCoordinatorServiceToken,
    );
    return coordinator === undefined
        ? editor.state.mode === mode
        : coordinator.isAttached(mode) && coordinator.get(mode).primary;
}

function canActivateProjection(
    editor: Editor,
    mode: 'source' | 'visual',
): boolean {
    const coordinator = editor.services.tryGet(
        projectionCoordinatorServiceToken,
    );
    return coordinator === undefined
        ? editor.state.mode !== mode
        : coordinator.isAttached(mode) && !coordinator.get(mode).primary;
}
