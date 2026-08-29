import type { Editor, TransactionOrigin } from '@soeditor/core';

export interface WorkspaceAttachment {
    destroy(): PromiseLike<void> | void;
}

export interface WorkspaceAttachmentContext {
    readonly editor: Editor;
    readonly recovery: number;
    readonly signal: AbortSignal;
}

export interface WorkspaceAttachmentFactory {
    attach(
        context: WorkspaceAttachmentContext,
    ): PromiseLike<WorkspaceAttachment> | WorkspaceAttachment;
    readonly id: string;
}

export interface WorkspaceEditorContext {
    readonly recovery: number;
    readonly signal: AbortSignal;
    readonly source: string;
}

export interface WorkspaceChange {
    readonly origin: TransactionOrigin;
    readonly previousSource: string;
    readonly source: string;
}

export interface ControlledWorkspaceValue {
    readonly kind: 'controlled';
    readonly onChange: (change: WorkspaceChange) => void;
    readonly value: string;
}

export interface UncontrolledWorkspaceValue {
    readonly initialValue: string;
    readonly kind: 'uncontrolled';
    readonly onChange?: (change: WorkspaceChange) => void;
}

export type WorkspaceValue =
    ControlledWorkspaceValue | UncontrolledWorkspaceValue;

export interface WorkspaceRecoveryOptions {
    /** Maximum restarts accepted inside one sliding window. */
    readonly maxRestarts?: number;
    /** Clock override for deterministic hosts/tests. */
    readonly now?: () => number;
    /** Sliding crash-rate window in milliseconds. */
    readonly windowMs?: number;
}

export interface CreateWorkspaceOptions {
    readonly attachments?: readonly WorkspaceAttachmentFactory[];
    readonly createEditor: (
        context: WorkspaceEditorContext,
    ) => PromiseLike<Editor> | Editor;
    readonly recovery?: WorkspaceRecoveryOptions;
    readonly value: WorkspaceValue;
}

export type WorkspaceStatus = 'destroyed' | 'failed' | 'ready' | 'recovering';

export interface WorkspaceSnapshot {
    readonly error: unknown;
    readonly lastKnownSource: string;
    readonly recoveryCount: number;
    readonly revision: number;
    readonly status: WorkspaceStatus;
}

export interface EditorWorkspace {
    readonly editor: Editor;
    readonly snapshot: WorkspaceSnapshot;
    destroy(): Promise<void>;
    reportFailure(error: unknown): Promise<void>;
    setValue(source: string): void;
    subscribe(listener: (snapshot: WorkspaceSnapshot) => void): () => void;
}
