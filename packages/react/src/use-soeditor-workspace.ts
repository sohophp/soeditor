import type { Editor } from '@soeditor/core';
import {
    createEditorWorkspace,
    type EditorWorkspace,
    type WorkspaceAttachmentFactory,
    type WorkspaceChange,
    type WorkspaceEditorContext,
    type WorkspaceRecoveryOptions,
    type WorkspaceSnapshot,
    type WorkspaceStatus,
} from '@soeditor/workspace';
import { useEffect, useRef, useState } from 'react';

interface ReactWorkspaceCommonOptions {
    readonly attachments?: readonly WorkspaceAttachmentFactory[];
    readonly configurationKey?: unknown;
    readonly createEditor: (
        context: WorkspaceEditorContext,
    ) => PromiseLike<Editor> | Editor;
    readonly onError?: (error: unknown) => void;
    readonly onReady?: (workspace: EditorWorkspace) => void;
    readonly readonly?: boolean;
    readonly recovery?: WorkspaceRecoveryOptions;
    readonly throwOnError?: boolean;
}

export type ReactWorkspaceOptions = ReactWorkspaceCommonOptions &
    (
        | {
              readonly initialValue?: never;
              readonly onChange: (change: WorkspaceChange) => void;
              readonly value: string;
          }
        | {
              readonly initialValue: string;
              readonly onChange?: (change: WorkspaceChange) => void;
              readonly value?: never;
          }
    );

export type ReactWorkspaceStatus = 'idle' | WorkspaceStatus;

export interface ReactWorkspaceResult {
    readonly error: unknown;
    readonly snapshot: WorkspaceSnapshot | undefined;
    readonly status: ReactWorkspaceStatus;
    readonly workspace: EditorWorkspace | undefined;
}

const initialResult: ReactWorkspaceResult = Object.freeze({
    error: undefined,
    snapshot: undefined,
    status: 'idle',
    workspace: undefined,
});

/** Binds one SoEditor Workspace lifecycle to a React component lifecycle. */
export function useSoEditorWorkspace(
    options: ReactWorkspaceOptions,
): ReactWorkspaceResult {
    const latest = useRef(options);
    latest.current = options;
    const workspace = useRef<EditorWorkspace | undefined>(undefined);
    const lifecycle = useRef<Promise<void>>(Promise.resolve());
    const [result, setResult] = useState<ReactWorkspaceResult>(initialResult);

    useEffect(() => {
        let cancelled = false;
        let mounted: EditorWorkspace | undefined;
        let unsubscribe: (() => void) | undefined;
        const configuration = latest.current;
        const start = lifecycle.current.then(async () => {
            if (cancelled) return;
            try {
                const created = await createEditorWorkspace({
                    ...(configuration.attachments === undefined
                        ? {}
                        : { attachments: configuration.attachments }),
                    createEditor: configuration.createEditor,
                    ...(configuration.recovery === undefined
                        ? {}
                        : { recovery: configuration.recovery }),
                    value:
                        configuration.value === undefined
                            ? {
                                  initialValue: configuration.initialValue,
                                  kind: 'uncontrolled',
                                  ...(configuration.onChange === undefined
                                      ? {}
                                      : {
                                            onChange: (
                                                change: WorkspaceChange,
                                            ) =>
                                                latest.current.onChange?.(
                                                    change,
                                                ),
                                        }),
                              }
                            : {
                                  kind: 'controlled',
                                  onChange: (change: WorkspaceChange) =>
                                      latest.current.onChange?.(change),
                                  value: configuration.value,
                              },
                });
                if (cancelled) {
                    await created.destroy();
                    return;
                }
                mounted = created;
                workspace.current = created;
                unsubscribe = created.subscribe((snapshot) =>
                    setResultFromSnapshot(created, snapshot, setResult),
                );
                created.editor.setReadonly(latest.current.readonly ?? false);
                if (
                    latest.current.value !== undefined &&
                    latest.current.value !== created.snapshot.lastKnownSource
                ) {
                    created.setValue(latest.current.value);
                }
                setResultFromSnapshot(created, created.snapshot, setResult);
                latest.current.onReady?.(created);
            } catch (error: unknown) {
                if (cancelled) return;
                const reportedError = reportError(
                    latest.current.onError,
                    error,
                );
                setResult(
                    Object.freeze({
                        error: reportedError,
                        snapshot: undefined,
                        status: 'failed',
                        workspace: undefined,
                    }),
                );
            }
        });
        lifecycle.current = start.catch(() => undefined);
        return () => {
            cancelled = true;
            lifecycle.current = lifecycle.current
                .then(async () => {
                    unsubscribe?.();
                    if (workspace.current === mounted)
                        workspace.current = undefined;
                    await mounted?.destroy();
                })
                .catch((error: unknown) => {
                    reportError(latest.current.onError, error);
                });
        };
    }, [options.configurationKey]);

    useEffect(() => {
        if (options.value === undefined || workspace.current === undefined)
            return;
        workspace.current.setValue(options.value);
    }, [options.value]);

    useEffect(() => {
        const editor =
            workspace.current?.snapshot.status === 'ready'
                ? workspace.current.editor
                : undefined;
        editor?.setReadonly(options.readonly ?? false);
    }, [options.readonly, result.status]);

    if (options.throwOnError === true && result.error !== undefined) {
        throw result.error;
    }
    return result;
}

function reportError(
    listener: ((error: unknown) => void) | undefined,
    error: unknown,
): unknown {
    try {
        listener?.(error);
        return error;
    } catch (listenerError: unknown) {
        return new AggregateError(
            [error, listenerError],
            'React Workspace adapter error handling failed.',
        );
    }
}

function setResultFromSnapshot(
    workspace: EditorWorkspace,
    snapshot: WorkspaceSnapshot,
    setResult: (result: ReactWorkspaceResult) => void,
): void {
    setResult(
        Object.freeze({
            error: snapshot.error,
            snapshot,
            status: snapshot.status,
            workspace,
        }),
    );
}
