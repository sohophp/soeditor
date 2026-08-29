import type { CommandCollection } from '../commands/command-collection.js';
import {
    clearCommands,
    CommandRegistry,
} from '../commands/command-registry.js';
import { Config, type EditorConfig } from '../config/config.js';
import {
    EditorDestroyedError,
    EditorInitializationAbortedError,
    ReentrantDispatchError,
    UnsupportedDocumentFormatError,
} from '../errors/errors.js';
import type { CoreEventMap } from '../events/core-events.js';
import {
    clearEvents,
    createEditorEvents,
    emitInternally,
    emitSafely,
    EventBus,
    type EditorEvents,
} from '../events/event-bus.js';
import type { PluginCollection } from '../plugins/plugin-collection.js';
import {
    destroyPlugins,
    initializePlugins,
    PluginManager,
} from '../plugins/plugin-manager.js';
import type { PluginConstructor } from '../plugins/plugin.js';
import type { ServiceCollection } from '../services/service-collection.js';
import {
    clearServices,
    ServiceRegistry,
} from '../services/service-registry.js';
import {
    createEditorDocument,
    type DocumentFormat,
} from '../state/document.js';
import {
    createEditorState,
    type EditorMode,
    type EditorState,
} from '../state/editor-state.js';
import type { Operation } from '../transaction/operation.js';
import {
    commitTransaction,
    createTransaction,
    type Transaction,
    type TransactionOptions,
} from '../transaction/transaction.js';

/** Options used to construct an independent editor instance. */
export interface EditorCreateOptions {
    /** Initial canonical source in the selected document format. */
    readonly data?: string;
    /** Canonical document format. */
    readonly format?: DocumentFormat;
    /** Editing-policy state exposed to future user-facing editing surfaces. */
    readonly readonly?: boolean;
    /** Initial requested document projection. */
    readonly mode?: EditorMode;
    /** Root plugins whose transitive requirements should be loaded. */
    readonly plugins?: readonly PluginConstructor[];
    /** Immutable, JSON-like instance configuration. */
    readonly config?: EditorConfig;
}

type EditorLifecycle = 'initializing' | 'ready' | 'destroying' | 'destroyed';

/** Coordinates immutable state with transactions and per-instance capabilities. */
export class Editor {
    /** Commands available to consumers and plugins. */
    readonly commands: CommandCollection;
    /** Immutable instance configuration. */
    readonly config: Config;
    /** Subscription-only access to typed editor events. */
    readonly events: EditorEvents<CoreEventMap>;
    /** Loaded plugin lookup capabilities. */
    readonly plugins: PluginCollection;
    /** Cross-feature service capabilities. */
    readonly services: ServiceCollection;

    readonly #commandRegistry: CommandRegistry;
    readonly #destructionStarted: Promise<void>;
    readonly #eventBus: EventBus<CoreEventMap>;
    readonly #owner = Object.freeze({});
    readonly #pluginManager: PluginManager;
    readonly #serviceRegistry: ServiceRegistry;
    #destroyPromise: Promise<void> | undefined;
    #dispatching = false;
    #lifecycle: EditorLifecycle = 'initializing';
    #resolveDestructionStarted!: () => void;
    #state: EditorState;
    #stateVersion = 0;

    private constructor(options: EditorCreateOptions) {
        const format = options.format ?? 'html';

        if (format !== 'html' && format !== 'markdown') {
            throw new UnsupportedDocumentFormatError(format);
        }

        this.#state = createEditorState({
            document: createEditorDocument(options.data ?? '', format),
            mode:
                options.mode ?? (format === 'markdown' ? 'markdown' : 'visual'),
            readonly: options.readonly ?? false,
            dirty: false,
        });
        this.#destructionStarted = new Promise<void>((resolve) => {
            this.#resolveDestructionStarted = resolve;
        });
        this.config = new Config(options.config);
        const assertAvailable = (): void => this.#assertNotDestroyed();
        this.#eventBus = new EventBus<CoreEventMap>(assertAvailable);
        this.#commandRegistry = new CommandRegistry(
            this,
            this.#eventBus,
            assertAvailable,
        );
        this.#serviceRegistry = new ServiceRegistry(assertAvailable);
        this.#pluginManager = new PluginManager(
            this,
            this.#eventBus,
            assertAvailable,
        );
        this.commands = this.#commandRegistry;
        this.events = createEditorEvents(this.#eventBus);
        this.services = this.#serviceRegistry;
        this.plugins = this.#pluginManager;
    }

    /** The current immutable state snapshot. */
    get state(): EditorState {
        return this.#state;
    }

    /** Creates and initializes an editor and all requested plugins. */
    static async create(options: EditorCreateOptions = {}): Promise<Editor> {
        const editor = new Editor(options);

        try {
            await initializePlugins(
                editor.#pluginManager,
                options.plugins ?? [],
                {
                    assertInitializing: () => editor.#assertInitializing(),
                    destructionStarted: editor.#destructionStarted,
                    getDestroyPromise: () => editor.#destroyPromise,
                },
            );
            editor.#transitionToReady();

            let readyEventError: unknown;
            let readyEventFailed = false;

            try {
                emitInternally(
                    editor.#eventBus,
                    'editor:ready',
                    Object.freeze({ editor }),
                );
            } catch (error: unknown) {
                readyEventFailed = true;
                readyEventError = error;
            }

            editor.#assertCreationCanReturn();

            if (readyEventFailed) {
                throw readyEventError;
            }

            return editor;
        } catch (error: unknown) {
            await editor.destroy();
            throw error;
        }
    }

    /** Creates a mutable transaction owned by the current editor state. */
    createTransaction(options: TransactionOptions = {}): Transaction {
        this.#assertAlive();
        return createTransaction(this.#owner, this.#stateVersion, options);
    }

    /**
     * Applies one owned, current, uncommitted transaction.
     *
     * Synchronous reentrant dispatch is rejected with
     * `ReentrantDispatchError` rather than queued.
     */
    dispatch(transaction: Transaction): void {
        this.#assertAlive();

        if (this.#dispatching) {
            throw new ReentrantDispatchError();
        }

        this.#dispatching = true;

        try {
            const operations = commitTransaction(
                transaction,
                this.#owner,
                this.#stateVersion,
            );
            this.#applyOperations(transaction, operations);
        } finally {
            this.#dispatching = false;
        }
    }

    /** Builds and dispatches one editor-owned transaction. */
    update(
        callback: (transaction: Transaction) => void,
        options: TransactionOptions = {},
    ): void {
        this.#assertAlive();
        const transaction = this.createTransaction(options);
        callback(transaction);
        this.dispatch(transaction);
    }

    /** Executes a registered command through this editor's command collection. */
    execute(commandId: string, ...args: readonly unknown[]): unknown {
        this.#assertAlive();
        return this.#commandRegistry.execute(commandId, ...args);
    }

    /** Returns canonical source, including after editor destruction. */
    getData(): string {
        return this.#state.document.source;
    }

    /**
     * Administratively replaces canonical source through a transaction.
     *
     * This remains allowed when `readonly` is true; future user-facing editing
     * surfaces must enforce readonly policy before creating user transactions.
     */
    setData(source: string): void {
        this.update((transaction) => transaction.replaceDocument(source), {
            origin: 'source',
        });
    }

    /** Marks the current state as saved without changing document revision. */
    markClean(): void {
        this.#assertAlive();

        if (!this.#state.dirty) {
            return;
        }

        const previous = this.#state;
        const current = createEditorState({ ...previous, dirty: false });
        this.#state = current;
        this.#stateVersion += 1;
        emitInternally(
            this.#eventBus,
            'state:change',
            Object.freeze({ previous, current }),
        );
    }

    /**
     * Destroys initialized plugins and clears all owned infrastructure.
     *
     * Calls made while destruction is pending return the same promise.
     */
    destroy(): Promise<void> {
        if (this.#destroyPromise !== undefined) {
            return this.#destroyPromise;
        }

        this.#lifecycle = 'destroying';
        let resolveDestroy!: () => void;
        let rejectDestroy!: (reason: unknown) => void;
        const destroyPromise = new Promise<void>((resolve, reject) => {
            resolveDestroy = resolve;
            rejectDestroy = reject;
        });
        this.#destroyPromise = destroyPromise;
        this.#resolveDestructionStarted();

        void this.#performDestroy().then(resolveDestroy, rejectDestroy);
        return destroyPromise;
    }

    #applyOperations(
        transaction: Transaction,
        operations: readonly Operation[],
    ): void {
        const previous = this.#state;
        let source = previous.document.source;
        let mode = previous.mode;

        for (const operation of operations) {
            switch (operation.type) {
                case 'replace-document':
                    source = operation.source;
                    break;
                case 'set-mode':
                    mode = operation.mode;
                    break;
                default:
                    assertNever(operation);
            }
        }

        const documentChanged = source !== previous.document.source;
        const modeChanged = mode !== previous.mode;

        if (!documentChanged && !modeChanged) {
            return;
        }

        const document = documentChanged
            ? createEditorDocument(
                  source,
                  previous.document.format,
                  previous.document.revision + 1,
                  previous.document.metadata,
              )
            : previous.document;
        const current = createEditorState({
            document,
            mode,
            readonly: previous.readonly,
            dirty: documentChanged ? true : previous.dirty,
        });

        if (documentChanged) {
            emitInternally(
                this.#eventBus,
                'document:beforeChange',
                Object.freeze({
                    previous: previous.document,
                    current: document,
                    transaction,
                }),
            );
        }

        this.#state = current;
        this.#stateVersion += 1;
        const notificationErrors: unknown[] = [];

        if (documentChanged) {
            attemptNotification(notificationErrors, () =>
                emitInternally(
                    this.#eventBus,
                    'document:change',
                    Object.freeze({
                        previous: previous.document,
                        current: document,
                        transaction,
                    }),
                ),
            );
        }

        if (modeChanged) {
            attemptNotification(notificationErrors, () =>
                emitInternally(
                    this.#eventBus,
                    'mode:change',
                    Object.freeze({
                        previous: previous.mode,
                        current: mode,
                        transaction,
                    }),
                ),
            );
        }

        attemptNotification(notificationErrors, () =>
            emitInternally(
                this.#eventBus,
                'state:change',
                Object.freeze({ previous, current, transaction }),
            ),
        );
        throwNotificationErrors(notificationErrors);
    }

    async #performDestroy(): Promise<void> {
        try {
            await destroyPlugins(this.#pluginManager);
        } finally {
            this.#lifecycle = 'destroyed';

            try {
                emitSafely(
                    this.#eventBus,
                    'editor:destroy',
                    Object.freeze({ editor: this }),
                );
            } finally {
                clearCommands(this.#commandRegistry);
                clearServices(this.#serviceRegistry);
                clearEvents(this.#eventBus);
            }
        }
    }

    #assertAlive(): void {
        if (
            this.#lifecycle === 'destroying' ||
            this.#lifecycle === 'destroyed'
        ) {
            throw new EditorDestroyedError();
        }
    }

    #assertInitializing(): void {
        if (this.#lifecycle !== 'initializing') {
            throw new EditorInitializationAbortedError();
        }
    }

    #transitionToReady(): void {
        this.#assertInitializing();
        this.#lifecycle = 'ready';
    }

    #assertCreationCanReturn(): void {
        if (this.#lifecycle !== 'ready') {
            throw new EditorInitializationAbortedError();
        }
    }

    #assertNotDestroyed(): void {
        if (
            this.#lifecycle === 'destroying' ||
            this.#lifecycle === 'destroyed'
        ) {
            throw new EditorDestroyedError();
        }
    }
}

function assertNever(operation: never): never {
    throw new Error(`Unsupported operation: ${JSON.stringify(operation)}.`);
}

function attemptNotification(errors: unknown[], notify: () => void): void {
    try {
        notify();
    } catch (error: unknown) {
        errors.push(error);
    }
}

function throwNotificationErrors(errors: readonly unknown[]): void {
    if (errors.length === 1) {
        throw errors[0];
    }

    if (errors.length > 1) {
        throw new AggregateError(
            errors,
            'Multiple editor state notifications failed.',
        );
    }
}
