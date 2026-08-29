export {
    WorkspaceDestroyedError,
    WorkspaceIntegrationError,
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
    WorkspaceAttachmentRequirements,
    WorkspaceChange,
    WorkspaceDiagnostic,
    WorkspaceDiagnosticCode,
    WorkspaceEditorContext,
    WorkspaceRecoveryOptions,
    WorkspaceServiceRequirement,
    WorkspaceSnapshot,
    WorkspaceStatus,
    WorkspaceValue,
} from './types.js';
