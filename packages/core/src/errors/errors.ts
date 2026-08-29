/** Base error for failures reported by SoEditor core. */
export class SoEditorError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = new.target.name;
    }
}

/** Thrown when a mutating API is called after editor destruction. */
export class EditorDestroyedError extends SoEditorError {
    constructor() {
        super('The editor has been destroyed and can no longer be used.');
    }
}

/** Thrown when destruction aborts editor startup before creation completes. */
export class EditorInitializationAbortedError extends SoEditorError {
    constructor() {
        super(
            'Editor initialization was aborted because destruction began before startup completed.',
        );
    }
}

/** Thrown when a listener attempts to dispatch during another dispatch. */
export class ReentrantDispatchError extends SoEditorError {
    constructor() {
        super(
            'Cannot dispatch a transaction while another dispatch is active.',
        );
    }
}

/** Thrown when a transaction belongs to a different editor. */
export class TransactionOwnershipError extends SoEditorError {
    constructor() {
        super('The transaction was not created by this editor.');
    }
}

/** Thrown when a transaction has already been dispatched. */
export class TransactionAlreadyCommittedError extends SoEditorError {
    constructor() {
        super('The transaction has already been committed.');
    }
}

/** Thrown when editor state changed after a transaction was created. */
export class StaleTransactionError extends SoEditorError {
    constructor(baseVersion: number, currentVersion: number) {
        super(
            `Transaction base version ${baseVersion} does not match current editor version ${currentVersion}.`,
        );
    }
}

/** Thrown when configuration contains a value outside the plain-data contract. */
export class UnsupportedConfigValueError extends SoEditorError {
    constructor(path: string, kind: string) {
        super(
            `Configuration value at "${path}" has unsupported type "${kind}".`,
        );
    }
}

/** Thrown when configuration contains a cyclic array or object. */
export class CyclicConfigurationError extends SoEditorError {
    constructor(path: string) {
        super(`Configuration value at "${path}" contains a cycle.`);
    }
}

/** Thrown when Phase 1 is asked to create a non-HTML document. */
export class UnsupportedDocumentFormatError extends SoEditorError {
    constructor(format: string) {
        super(`Document format "${format}" is not supported in this release.`);
    }
}

/** Thrown when a command ID is not registered. */
export class CommandNotFoundError extends SoEditorError {
    constructor(id: string) {
        super(`Command "${id}" is not registered.`);
    }
}

/** Thrown when a command ID is registered more than once. */
export class CommandAlreadyRegisteredError extends SoEditorError {
    constructor(id: string) {
        super(`Command "${id}" is already registered.`);
    }
}

/** Thrown when a requested plugin is not loaded. */
export class PluginNotFoundError extends SoEditorError {
    constructor(id: string) {
        super(`Plugin "${id}" is not loaded.`);
    }
}

/** Thrown when different plugin constructors declare the same ID. */
export class PluginDuplicateIdError extends SoEditorError {
    constructor(id: string) {
        super(`Plugin ID "${id}" is declared by multiple plugin constructors.`);
    }
}

/** Thrown when plugin requirements contain a dependency cycle. */
export class PluginDependencyCycleError extends SoEditorError {
    readonly path: readonly string[];

    constructor(path: readonly string[]) {
        super(`Plugin dependency cycle detected: ${path.join(' -> ')}.`);
        this.path = Object.freeze([...path]);
    }
}

/** Thrown when a service ID is not registered. */
export class ServiceNotFoundError extends SoEditorError {
    constructor(id: string) {
        super(`Service "${id}" is not registered.`);
    }
}

/** Thrown when a service ID is registered more than once. */
export class ServiceAlreadyRegisteredError extends SoEditorError {
    constructor(id: string) {
        super(`Service "${id}" is already registered.`);
    }
}
