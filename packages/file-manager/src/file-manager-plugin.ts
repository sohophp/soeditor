import { Plugin } from '@soeditor/core';
import { ImagePlugin, MediaPlugin } from '@soeditor/rich-text';
import {
    EditorUiDestroyedError,
    UiPlugin,
    uiRegistryServiceToken,
    type EditorUi,
    type ToolbarItemFactory,
} from '@soeditor/ui';

import {
    fileManagerServiceToken,
    type FileManagerOpenOptions,
} from './file-manager.js';
import { normalizeFileManagerResult } from './validation.js';

const imageRequest: FileManagerOpenOptions = Object.freeze({
    accept: Object.freeze(['image/*']),
    kind: 'image',
    multiple: false,
});

/** Connects a replaceable FileManager to image and structured-media commands. */
export class FileManagerPlugin extends Plugin {
    static readonly id = 'file-manager-image';
    static readonly requires = [ImagePlugin, MediaPlugin, UiPlugin];
    #destroyed = false;
    #disposeToolbar: (() => void)[] = [];
    #pending = false;

    override init(): void {
        this.registerBrowseCommand('image.browse', 'image.insert');
        this.registerBrowseCommand('media.browse', 'media.insert');
        const ui = this.editor.services.get(uiRegistryServiceToken);
        this.#disposeToolbar.push(
            ui.registerToolbarItem(
                'image-browse',
                createBrowseButton(
                    'Browse image',
                    'Insert image from file manager',
                    'image.browse',
                ),
            ),
            ui.registerToolbarItem(
                'media-browse',
                createBrowseButton(
                    'Browse media',
                    'Insert media figure from file manager',
                    'media.browse',
                ),
            ),
        );
    }

    override destroy(): void {
        this.#destroyed = true;
        for (const dispose of this.#disposeToolbar.reverse()) {
            dispose();
        }
        this.#disposeToolbar = [];
    }

    private registerBrowseCommand(
        browseCommand: 'image.browse' | 'media.browse',
        insertCommand: 'image.insert' | 'media.insert',
    ): void {
        this.editor.commands.register({
            id: browseCommand,
            label:
                insertCommand === 'media.insert'
                    ? 'Insert media from file manager'
                    : 'Insert image from file manager',
            canExecute: ({ editor }) =>
                !this.#pending &&
                editor.services.has(fileManagerServiceToken) &&
                editor.commands.canExecute(insertCommand),
            execute: async ({ editor }, ...args) => {
                if (args.length !== 0) {
                    throw new TypeError(
                        `Command "${browseCommand}" does not accept arguments.`,
                    );
                }
                this.#pending = true;
                try {
                    const selected = normalizeFileManagerResult(
                        await editor.services
                            .get(fileManagerServiceToken)
                            .open(imageRequest),
                    );
                    if (selected === null || this.#destroyed) {
                        return null;
                    }
                    editor.execute(insertCommand, {
                        src: selected.url,
                        alt: selected.alt ?? selected.name ?? '',
                        ...(selected.width === undefined
                            ? {}
                            : { width: selected.width }),
                        ...(selected.height === undefined
                            ? {}
                            : { height: selected.height }),
                    });
                    return selected;
                } finally {
                    this.#pending = false;
                }
            },
        });
    }
}

function createBrowseButton(
    text: string,
    title: string,
    command: 'image.browse' | 'media.browse',
): ToolbarItemFactory {
    return ({ document, editor, ui }) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'soeditor-ui__button';
        button.textContent = text;
        button.title = title;
        const click = (): void => {
            try {
                ui.restoreEditingSelection();
                const result = editor.execute(command);
                if (isPromiseLike(result)) {
                    void Promise.resolve(result).catch((error: unknown) => {
                        showError(ui, error);
                    });
                }
            } catch (error: unknown) {
                showError(ui, error);
            }
        };
        button.addEventListener('click', click);
        return {
            element: button,
            update: () => {
                button.disabled = !editor.commands.canExecute(command);
            },
            destroy: () => button.removeEventListener('click', click),
        };
    };
}

function showError(ui: EditorUi, error: unknown): void {
    try {
        ui.notifications.show({
            message: error instanceof Error ? error.message : String(error),
            severity: 'error',
        });
    } catch (notificationError: unknown) {
        if (!(notificationError instanceof EditorUiDestroyedError)) {
            throw notificationError;
        }
    }
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
    return (typeof value === 'object' && value !== null) ||
        typeof value === 'function'
        ? typeof Reflect.get(value, 'then') === 'function'
        : false;
}
