import { Plugin } from '@soeditor/core';
import { ImagePlugin } from '@soeditor/rich-text';
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

/** Connects a replaceable FileManager to the existing Image command. */
export class FileManagerPlugin extends Plugin {
    static readonly id = 'file-manager-image';
    static readonly requires = [ImagePlugin, UiPlugin];
    #destroyed = false;
    #disposeToolbar: (() => void) | undefined;
    #pending = false;

    override init(): void {
        this.editor.commands.register({
            id: 'image.browse',
            label: 'Insert image from file manager',
            canExecute: ({ editor }) =>
                !this.#pending &&
                editor.services.has(fileManagerServiceToken) &&
                editor.commands.canExecute('image.insert'),
            execute: async ({ editor }, ...args) => {
                if (args.length !== 0) {
                    throw new TypeError(
                        'Command "image.browse" does not accept arguments.',
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
                    editor.execute('image.insert', {
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
        this.#disposeToolbar = this.editor.services
            .get(uiRegistryServiceToken)
            .registerToolbarItem('image-browse', createBrowseButton());
    }

    override destroy(): void {
        this.#destroyed = true;
        this.#disposeToolbar?.();
        this.#disposeToolbar = undefined;
    }
}

function createBrowseButton(): ToolbarItemFactory {
    return ({ document, editor, ui }) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'soeditor-ui__button';
        button.textContent = 'Browse image';
        button.title = 'Insert image from file manager';
        const click = (): void => {
            try {
                ui.restoreEditingSelection();
                const result = editor.execute('image.browse');
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
                button.disabled = !editor.commands.canExecute('image.browse');
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
