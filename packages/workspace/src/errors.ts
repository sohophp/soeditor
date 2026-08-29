export class WorkspaceDestroyedError extends Error {
    constructor() {
        super('The SoEditor workspace has been destroyed.');
        this.name = 'WorkspaceDestroyedError';
    }
}

export class WorkspaceNotReadyError extends Error {
    constructor(status: string) {
        super(`The SoEditor workspace is not ready (status: ${status}).`);
        this.name = 'WorkspaceNotReadyError';
    }
}

export class WorkspaceRecoveryLimitError extends Error {
    override readonly cause: unknown;

    constructor(cause: unknown) {
        super('The SoEditor workspace recovery limit was reached.');
        this.name = 'WorkspaceRecoveryLimitError';
        this.cause = cause;
    }
}

export class WorkspaceValuePolicyError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'WorkspaceValuePolicyError';
    }
}

export class WorkspaceIntegrationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'WorkspaceIntegrationError';
    }
}
