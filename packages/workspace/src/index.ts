export {
    WorkspaceDestroyedError,
    WorkspaceNotReadyError,
    WorkspaceRecoveryLimitError,
    WorkspaceValuePolicyError,
} from './errors.js';
export { createEditorWorkspace } from './workspace.js';
export type {
    ControlledWorkspaceValue,
    CreateWorkspaceOptions,
    EditorWorkspace,
    UncontrolledWorkspaceValue,
    WorkspaceAttachment,
    WorkspaceAttachmentContext,
    WorkspaceAttachmentFactory,
    WorkspaceChange,
    WorkspaceEditorContext,
    WorkspaceRecoveryOptions,
    WorkspaceSnapshot,
    WorkspaceStatus,
    WorkspaceValue,
} from './types.js';
