import type { Editor } from '@soeditor/core';
import {
    createEditorWorkspace,
    type EditorWorkspace,
    type WorkspaceAttachmentFactory,
    type WorkspaceChange,
    type WorkspaceDiagnostic,
    type WorkspaceEditorContext,
    type WorkspaceRecoveryOptions,
    type WorkspaceSnapshot,
    type WorkspaceStatus,
} from '@soeditor/workspace';
import {
    onMounted,
    onUnmounted,
    shallowReadonly,
    shallowRef,
    toValue,
    watch,
    type MaybeRefOrGetter,
    type ShallowRef,
} from 'vue';

interface VueWorkspaceCommonOptions {
    readonly attachments?: readonly WorkspaceAttachmentFactory[];
    readonly createEditor: (
        context: WorkspaceEditorContext,
    ) => PromiseLike<Editor> | Editor;
    readonly onError?: (error: unknown) => void;
    readonly onDiagnostic?: (diagnostic: WorkspaceDiagnostic) => void;
    readonly onReady?: (workspace: EditorWorkspace) => void;
    readonly readonly?: MaybeRefOrGetter<boolean>;
    readonly previewIsolation?: 'isolated' | 'trusted';
    readonly recovery?: WorkspaceRecoveryOptions;
}

export type VueWorkspaceOptions = VueWorkspaceCommonOptions &
    (
        | {
              readonly initialValue?: never;
              readonly onChange: (change: WorkspaceChange) => void;
              readonly value: MaybeRefOrGetter<string>;
          }
        | {
              readonly initialValue: string;
              readonly onChange?: (change: WorkspaceChange) => void;
              readonly value?: never;
          }
    );

export type VueWorkspaceStatus = 'idle' | WorkspaceStatus;

export interface VueWorkspaceResult {
    readonly error: Readonly<ShallowRef<unknown>>;
    readonly snapshot: Readonly<ShallowRef<WorkspaceSnapshot | undefined>>;
    readonly status: Readonly<ShallowRef<VueWorkspaceStatus>>;
    readonly workspace: Readonly<ShallowRef<EditorWorkspace | undefined>>;
}

/** Binds one SoEditor Workspace lifecycle to the current Vue component. */
export function useSoEditorWorkspace(
    options: VueWorkspaceOptions,
): VueWorkspaceResult {
    const workspace = shallowRef<EditorWorkspace>();
    const snapshot = shallowRef<WorkspaceSnapshot>();
    const status = shallowRef<VueWorkspaceStatus>('idle');
    const error = shallowRef<unknown>();
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const update = (next: WorkspaceSnapshot): void => {
        snapshot.value = next;
        status.value = next.status;
        error.value = next.error;
    };

    onMounted(async () => {
        try {
            const created = await createEditorWorkspace({
                ...(options.attachments === undefined
                    ? {}
                    : { attachments: options.attachments }),
                createEditor: options.createEditor,
                ...(options.onDiagnostic === undefined
                    ? {}
                    : { onDiagnostic: options.onDiagnostic }),
                ...(options.previewIsolation === undefined
                    ? {}
                    : { previewIsolation: options.previewIsolation }),
                ...(options.recovery === undefined
                    ? {}
                    : { recovery: options.recovery }),
                value:
                    options.value === undefined
                        ? {
                              initialValue: options.initialValue,
                              kind: 'uncontrolled',
                              ...(options.onChange === undefined
                                  ? {}
                                  : { onChange: options.onChange }),
                          }
                        : {
                              kind: 'controlled',
                              onChange: options.onChange,
                              value: toValue(options.value),
                          },
            });
            if (cancelled) {
                await created.destroy();
                return;
            }
            workspace.value = created;
            unsubscribe = created.subscribe(update);
            created.editor.setReadonly(toValue(options.readonly ?? false));
            if (options.value !== undefined) {
                created.setValue(toValue(options.value));
            }
            update(created.snapshot);
            options.onReady?.(created);
        } catch (caught: unknown) {
            if (cancelled) return;
            error.value = reportError(options.onError, caught);
            status.value = 'failed';
        }
    });

    if (options.value !== undefined) {
        watch(
            () => toValue(options.value),
            (value) => workspace.value?.setValue(value),
        );
    }
    watch(
        () => toValue(options.readonly ?? false),
        (value) => {
            if (workspace.value?.snapshot.status === 'ready') {
                workspace.value.editor.setReadonly(value);
            }
        },
    );

    onUnmounted(() => {
        cancelled = true;
        unsubscribe?.();
        const mounted = workspace.value;
        workspace.value = undefined;
        void mounted?.destroy().catch((caught: unknown) => {
            error.value = reportError(options.onError, caught);
        });
    });

    return Object.freeze({
        error: shallowReadonly(error),
        snapshot: shallowReadonly(snapshot),
        status: shallowReadonly(status),
        workspace: shallowReadonly(workspace),
    });
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
            'Vue Workspace adapter error handling failed.',
        );
    }
}
