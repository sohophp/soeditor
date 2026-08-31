import { Plugin, type Editor } from '@soeditor/core';
import {
    projectionCoordinatorServiceToken,
    type EditableProjectionId,
} from '@soeditor/projections';

import { previewServiceToken } from './preview-service.js';

/** Registers command-driven Preview mode and explicit refresh. */
export class PreviewPlugin extends Plugin {
    static readonly id = 'preview';
    #returnMode: EditableProjectionId = 'visual';

    override init(): void {
        this.editor.commands.register({
            id: 'editor.preview',
            label: 'Open preview',
            canExecute: ({ editor }) =>
                !isPreviewVisible(editor) &&
                (editor.services.tryGet(previewServiceToken)?.canRender() ??
                    false),
            execute: ({ editor }, ...args) => {
                assertNoArguments('editor.preview', args);
                const coordinator = editor.services.tryGet(
                    projectionCoordinatorServiceToken,
                );
                this.#returnMode =
                    coordinator?.snapshot.primary ??
                    (editor.state.document.format === 'markdown'
                        ? 'markdown'
                        : editor.state.mode === 'source'
                          ? 'source'
                          : 'visual');
                if (coordinator?.isAttached('preview') === true) {
                    editor.execute('projection.show', 'preview');
                }
                editor.update((transaction) => transaction.setMode('preview'), {
                    origin: 'command',
                });
            },
            isActive: ({ editor }) => isPreviewVisible(editor),
        });
        this.editor.commands.register({
            id: 'editor.preview.close',
            label: 'Close preview',
            canExecute: ({ editor }) => isPreviewVisible(editor),
            execute: ({ editor }, ...args) => {
                assertNoArguments('editor.preview.close', args);
                const coordinator = editor.services.tryGet(
                    projectionCoordinatorServiceToken,
                );
                if (
                    coordinator?.isAttached('preview') === true &&
                    coordinator.get('preview').visible
                ) {
                    editor.execute('projection.hide', 'preview');
                }
                const returnMode =
                    coordinator?.snapshot.primary ?? this.#returnMode;
                editor.update(
                    (transaction) => transaction.setMode(returnMode),
                    { origin: 'command' },
                );
            },
        });
        this.editor.commands.register({
            id: 'preview.refresh',
            label: 'Refresh preview',
            canExecute: ({ editor }) =>
                editor.services.has(previewServiceToken),
            execute: ({ editor }, ...args) => {
                assertNoArguments('preview.refresh', args);
                editor.services.get(previewServiceToken).refresh();
            },
        });
    }
}

function isPreviewVisible(editor: Editor): boolean {
    const coordinator = editor.services.tryGet(
        projectionCoordinatorServiceToken,
    );
    return coordinator?.isAttached('preview') === true
        ? coordinator.get('preview').visible
        : editor.state.mode === 'preview';
}

function assertNoArguments(id: string, args: readonly unknown[]): void {
    if (args.length !== 0) {
        throw new TypeError(`Command "${id}" does not accept arguments.`);
    }
}
