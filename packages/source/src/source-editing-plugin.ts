import { Plugin, type Editor } from '@soeditor/core';
import { projectionCoordinatorServiceToken } from '@soeditor/projections';
import { sourceEditingServiceToken } from './source-editing-service.js';

/** Registers command-driven transitions between visual and source modes. */
export class SourceEditingPlugin extends Plugin {
    static readonly id = 'source-editing';

    override init(): void {
        this.#registerModeCommand('editor.source', 'source');
        this.#registerModeCommand('editor.visual', 'visual');
        this.editor.commands.register({
            id: 'editor.source.find',
            label: 'Find and replace in HTML source',
            canExecute: ({ editor }) =>
                editor.state.document.format === 'html' &&
                editor.services.has(sourceEditingServiceToken),
            execute: ({ editor }, ...args) => {
                if (
                    args.length > 1 ||
                    (args[0] !== undefined && typeof args[0] !== 'string')
                ) {
                    throw new TypeError(
                        'Command "editor.source.find" accepts one optional string.',
                    );
                }
                if (!isProjectionActive(editor, 'source')) {
                    editor.execute('editor.source');
                }
                editor.services
                    .get(sourceEditingServiceToken)
                    .openSearchPanel(args[0]);
            },
        });
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
                    const projection = resolveProjection(editor, mode);
                    if (!coordinator.get(projection).visible) {
                        editor.execute('projection.show', projection);
                    }
                    editor.execute('projection.activate', projection);
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
    const projection = resolveProjection(editor, mode);
    return coordinator === undefined
        ? editor.state.mode === mode
        : coordinator.isAttached(projection) &&
              coordinator.get(projection).primary;
}

function canActivateProjection(
    editor: Editor,
    mode: 'source' | 'visual',
): boolean {
    const coordinator = editor.services.tryGet(
        projectionCoordinatorServiceToken,
    );
    const projection = resolveProjection(editor, mode);
    return coordinator === undefined
        ? editor.state.mode !== mode
        : coordinator.isAttached(projection) &&
              !coordinator.get(projection).primary;
}

function resolveProjection(
    editor: Editor,
    mode: 'source' | 'visual',
): 'source' | 'visual' | 'wysiwyg' {
    if (mode === 'source') return 'source';
    const coordinator = editor.services.tryGet(
        projectionCoordinatorServiceToken,
    );
    return coordinator?.isAttached('wysiwyg') === true ? 'wysiwyg' : 'visual';
}
