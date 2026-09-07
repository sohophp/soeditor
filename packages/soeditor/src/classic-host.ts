import type { Editor } from '@soeditor/core';
import type { ClassicEditorChange } from './classic-editor.js';
import { ClassicEditorDestroyedError } from './classic-editor-errors.js';

interface ClassicAttachment {
    destroy(): void | PromiseLike<void>;
}

export interface ClassicHost {
    readonly editor: Editor;
    destroy(): Promise<void>;
}

interface ClassicHostOptions {
    readonly attachments: readonly ((
        editor: Editor,
    ) => ClassicAttachment | PromiseLike<ClassicAttachment>)[];
    readonly createEditor: () => Promise<Editor>;
    readonly isDestroyed: () => boolean;
    readonly onChange: (change: ClassicEditorChange) => void;
}

/** Owns only Classic mounting, document forwarding and reverse-order teardown. */
export async function createClassicHost(
    options: ClassicHostOptions,
): Promise<ClassicHost> {
    let editor: Editor | undefined;
    const attachments: ClassicAttachment[] = [];
    let disposeChange: (() => void) | undefined;
    let destroying: Promise<void> | undefined;
    const assertAlive = (): void => {
        if (options.isDestroyed()) throw new ClassicEditorDestroyedError();
    };
    const destroy = (): Promise<void> => {
        destroying ??= (async () => {
            disposeChange?.();
            disposeChange = undefined;
            const errors: unknown[] = [];
            for (const attachment of attachments.reverse()) {
                try {
                    await attachment.destroy();
                } catch (error: unknown) {
                    errors.push(error);
                }
            }
            attachments.length = 0;
            try {
                await editor?.destroy();
            } catch (error: unknown) {
                errors.push(error);
            }
            if (errors.length > 0)
                throw new AggregateError(
                    errors,
                    'Classic host cleanup failed.',
                );
        })();
        return destroying;
    };
    try {
        editor = await options.createEditor();
        assertAlive();
        disposeChange = editor.events.on(
            'document:change',
            ({ current, previous, transaction }) => {
                options.onChange(
                    Object.freeze({
                        origin: transaction.origin,
                        previousSource: previous.source,
                        source: current.source,
                    }),
                );
            },
        );
        for (const attach of options.attachments) {
            assertAlive();
            attachments.push(await attach(editor));
            assertAlive();
        }
        return Object.freeze({ editor, destroy });
    } catch (error: unknown) {
        try {
            await destroy();
        } catch (cleanupError: unknown) {
            throw new AggregateError(
                [error, cleanupError],
                'Classic host initialization and cleanup failed.',
            );
        }
        throw error;
    }
}
