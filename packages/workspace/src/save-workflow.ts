import type { Editor } from '@soeditor/core';

export type EditorSaveReason = 'auto' | 'manual' | 'retry';

export interface EditorSaveRequest {
    readonly reportProgress: (progress: number) => void;
    readonly reason: EditorSaveReason;
    readonly revision: number;
    readonly revisionToken?: string;
    readonly signal: AbortSignal;
    readonly source: string;
}

export interface EditorSaveSuccess {
    readonly revisionToken?: string;
    readonly status: 'saved';
}

export interface EditorSaveConflict {
    readonly message?: string;
    readonly revisionToken?: string;
    readonly source?: string;
    readonly status: 'conflict';
}

export type EditorSaveResult = EditorSaveSuccess | EditorSaveConflict;

export interface EditorSaveAdapter {
    save(request: EditorSaveRequest): PromiseLike<EditorSaveResult>;
}

export interface EditorSaveState {
    readonly dirty: boolean;
    readonly error?: unknown;
    readonly lastResult?: EditorSaveResult;
    readonly progress?: number;
    readonly revisionToken?: string;
    readonly status:
        | 'conflict'
        | 'destroyed'
        | 'error'
        | 'idle'
        | 'saved'
        | 'saving'
        | 'scheduled';
}

export interface CreateEditorSaveWorkflowOptions {
    readonly adapter: EditorSaveAdapter;
    readonly autoSaveDelay?: number;
    readonly editor: Editor;
    readonly initialRevisionToken?: string;
    readonly onError?: (error: unknown) => void;
    readonly onStateChange?: (state: EditorSaveState) => void;
}

export interface EditorSaveWorkflow {
    readonly state: EditorSaveState;
    destroy(): void;
    retry(): Promise<EditorSaveResult>;
    save(reason?: EditorSaveReason): Promise<EditorSaveResult>;
    setRevisionToken(revisionToken: string | undefined): void;
}

/** Creates an abortable, non-overlapping save workflow for one editor. */
export function createEditorSaveWorkflow(
    options: CreateEditorSaveWorkflowOptions,
): EditorSaveWorkflow {
    validateOptions(options);
    const { adapter, editor } = options;
    const autoSaveDelay = options.autoSaveDelay;
    let revisionToken = options.initialRevisionToken;
    let status: EditorSaveState['status'] = 'idle';
    let error: unknown;
    let lastResult: EditorSaveResult | undefined;
    let progress: number | undefined;
    let destroyed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let active: Promise<EditorSaveResult> | undefined;
    let abortController: AbortController | undefined;

    const snapshot = (): EditorSaveState =>
        Object.freeze({
            dirty: editor.state.dirty,
            ...(error === undefined ? {} : { error }),
            ...(lastResult === undefined ? {} : { lastResult }),
            ...(progress === undefined ? {} : { progress }),
            ...(revisionToken === undefined ? {} : { revisionToken }),
            status,
        });
    const publish = (next: EditorSaveState['status']): void => {
        status = next;
        try {
            options.onStateChange?.(snapshot());
        } catch (callbackError: unknown) {
            options.onError?.(callbackError);
        }
    };
    const clearTimer = (): void => {
        if (timer === undefined) return;
        clearTimeout(timer);
        timer = undefined;
    };
    const schedule = (): void => {
        if (destroyed || autoSaveDelay === undefined) return;
        clearTimer();
        publish('scheduled');
        timer = setTimeout(() => {
            timer = undefined;
            void save('auto').catch((saveError: unknown) => {
                if (!destroyed) options.onError?.(saveError);
            });
        }, autoSaveDelay);
    };
    const disposeChange = editor.events.on('document:change', () => {
        if (active !== undefined) {
            publish('saving');
        } else if (autoSaveDelay === undefined) {
            publish('idle');
        } else {
            schedule();
        }
    });

    const save = (
        reason: EditorSaveReason = 'manual',
    ): Promise<EditorSaveResult> => {
        assertAlive();
        validateReason(reason);
        clearTimer();
        if (active !== undefined) return active;
        const document = editor.state.document;
        const requestToken = revisionToken;
        const controller = new AbortController();
        abortController = controller;
        error = undefined;
        lastResult = undefined;
        progress = 0;
        publish('saving');
        const operation = Promise.resolve()
            .then(() =>
                adapter.save(
                    Object.freeze({
                        ...(requestToken === undefined
                            ? {}
                            : { revisionToken: requestToken }),
                        reason,
                        reportProgress: (value: number) => {
                            if (destroyed || abortController !== controller)
                                return;
                            validateProgress(value);
                            progress = value;
                            publish('saving');
                        },
                        revision: document.revision,
                        signal: controller.signal,
                        source: document.source,
                    }),
                ),
            )
            .then((result) => {
                if (destroyed) throw abortedSaveError();
                validateResult(result);
                progress = 1;
                lastResult = Object.freeze({ ...result });
                if (result.revisionToken !== undefined) {
                    revisionToken = result.revisionToken;
                }
                if (result.status === 'conflict') {
                    publish('conflict');
                    return lastResult;
                }
                const current = editor.state.document;
                if (
                    current.revision === document.revision &&
                    current.source === document.source
                ) {
                    editor.markClean();
                    publish('saved');
                } else {
                    publish('idle');
                    schedule();
                }
                return lastResult;
            })
            .catch((saveError: unknown) => {
                if (destroyed) throw saveError;
                progress = undefined;
                error = saveError;
                publish('error');
                throw saveError;
            })
            .finally(() => {
                active = undefined;
                abortController = undefined;
            });
        active = operation;
        return operation;
    };

    const publicValue: EditorSaveWorkflow = Object.freeze({
        get state() {
            return snapshot();
        },
        destroy: () => {
            if (destroyed) return;
            destroyed = true;
            clearTimer();
            disposeChange();
            abortController?.abort();
            publish('destroyed');
        },
        retry: () => save('retry'),
        save,
        setRevisionToken: (value: string | undefined) => {
            assertAlive();
            validateRevisionToken(value);
            revisionToken = value;
            publish(status);
        },
    });
    return publicValue;

    function assertAlive(): void {
        if (destroyed) throw new Error('Editor save workflow is destroyed.');
    }
}

function abortedSaveError(): Error {
    const error = new Error('Editor save was aborted.');
    error.name = 'AbortError';
    return error;
}

function validateOptions(options: CreateEditorSaveWorkflowOptions): void {
    if (typeof options !== 'object' || options === null) {
        throw new TypeError('Editor save workflow options must be an object.');
    }
    if (
        typeof options.adapter !== 'object' ||
        options.adapter === null ||
        typeof options.adapter.save !== 'function'
    ) {
        throw new TypeError('Editor save adapter must provide save().');
    }
    if (typeof options.editor !== 'object' || options.editor === null) {
        throw new TypeError('Editor save workflow requires an editor.');
    }
    if (
        options.autoSaveDelay !== undefined &&
        (!Number.isFinite(options.autoSaveDelay) ||
            options.autoSaveDelay < 100 ||
            options.autoSaveDelay > 60_000)
    ) {
        throw new TypeError(
            'Editor autoSaveDelay must be between 100 and 60000 milliseconds.',
        );
    }
    validateRevisionToken(options.initialRevisionToken);
    for (const callback of [options.onError, options.onStateChange]) {
        if (callback !== undefined && typeof callback !== 'function') {
            throw new TypeError(
                'Editor save workflow callbacks must be functions.',
            );
        }
    }
}

function validateReason(reason: EditorSaveReason): void {
    if (reason !== 'auto' && reason !== 'manual' && reason !== 'retry') {
        throw new TypeError('Editor save reason is invalid.');
    }
}

function validateRevisionToken(value: string | undefined): void {
    if (value !== undefined && typeof value !== 'string') {
        throw new TypeError('Editor revision token must be a string.');
    }
}

function validateProgress(value: number): void {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
        throw new TypeError('Editor save progress must be between 0 and 1.');
    }
}

function validateResult(result: EditorSaveResult): void {
    if (
        typeof result !== 'object' ||
        result === null ||
        (result.status !== 'saved' && result.status !== 'conflict')
    ) {
        throw new TypeError(
            'Editor save adapter must return a saved or conflict result.',
        );
    }
    validateRevisionToken(result.revisionToken);
    if (result.status === 'conflict') {
        if (result.message !== undefined && typeof result.message !== 'string')
            throw new TypeError(
                'Editor save conflict message must be a string.',
            );
        if (result.source !== undefined && typeof result.source !== 'string')
            throw new TypeError(
                'Editor save conflict source must be a string.',
            );
    }
}
