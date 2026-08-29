import {
    createServiceToken,
    Plugin,
    type DocumentFormat,
    type EditorMode,
} from '@soeditor/core';

/** Built-in projection identities coordinated in SoEditor 0.6. */
export type ProjectionId = 'visual' | 'source' | 'markdown' | 'preview';

/** Projection identities that may hold logical write authority. */
export type EditableProjectionId = Exclude<ProjectionId, 'preview'>;

/** Immutable effective activity delivered to one attached projection. */
export interface ProjectionActivity {
    readonly id: ProjectionId;
    readonly primary: boolean;
    readonly readonly: boolean;
    readonly visible: boolean;
}

/** Narrow lifecycle adapter implemented by a surface engine. */
export interface ProjectionAdapter {
    readonly id: ProjectionId;
    update(activity: ProjectionActivity): void;
}

/** Immutable observable coordinator state. */
export interface ProjectionSnapshot {
    readonly activities: readonly ProjectionActivity[];
    readonly primary: EditableProjectionId;
}

/** Per-editor projection attachment and observation capabilities. */
export interface ProjectionCoordinatorService {
    readonly snapshot: ProjectionSnapshot;
    attach(adapter: ProjectionAdapter): () => void;
    get(id: ProjectionId): ProjectionActivity;
    isAttached(id: ProjectionId): boolean;
    subscribe(listener: (snapshot: ProjectionSnapshot) => void): () => void;
}

/** Typed identity of the per-editor projection coordinator. */
export const projectionCoordinatorServiceToken =
    createServiceToken<ProjectionCoordinatorService>(
        'soeditor.projection-coordinator',
    );

export class ProjectionCoordinatorDestroyedError extends Error {
    constructor() {
        super('The projection coordinator has been destroyed.');
        this.name = 'ProjectionCoordinatorDestroyedError';
    }
}

export class ProjectionAlreadyAttachedError extends Error {
    constructor(id: ProjectionId) {
        super(`Projection "${id}" is already attached.`);
        this.name = 'ProjectionAlreadyAttachedError';
    }
}

export class ProjectionNotAttachedError extends Error {
    constructor(id: ProjectionId) {
        super(`Projection "${id}" is not attached.`);
        this.name = 'ProjectionNotAttachedError';
    }
}

export class IncompatibleProjectionError extends Error {
    constructor(id: ProjectionId, format: DocumentFormat) {
        super(`Projection "${id}" is incompatible with "${format}" documents.`);
        this.name = 'IncompatibleProjectionError';
    }
}

export class InvalidProjectionTransitionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InvalidProjectionTransitionError';
    }
}

const projectionIds: readonly ProjectionId[] = Object.freeze([
    'visual',
    'source',
    'markdown',
    'preview',
]);

/** Coordinates persistent projection activity without owning surface DOM. */
export class ProjectionCoordinatorPlugin extends Plugin {
    static readonly id = 'projection-coordinator';

    readonly #adapters = new Map<ProjectionId, ProjectionAdapter>();
    readonly #listeners = new Set<(snapshot: ProjectionSnapshot) => void>();
    readonly #visible = new Set<ProjectionId>();
    #destroyed = false;
    #disposeModeChange: (() => void) | undefined;
    #disposeStateChange: (() => void) | undefined;
    #primary: EditableProjectionId = 'visual';
    #synchronizingMode = false;

    override init(): void {
        const format = this.editor.state.document.format;
        this.#primary = defaultPrimary(format);
        const initialMode = this.editor.state.mode;
        if (initialMode === 'preview') {
            this.#visible.add(this.#primary);
            this.#visible.add('preview');
        } else if (isEditableForFormat(initialMode, format)) {
            this.#primary = initialMode;
            this.#visible.add(initialMode);
        } else {
            this.#visible.add(this.#primary);
        }

        const getSnapshot = (): ProjectionSnapshot => this.#snapshot();
        const service = Object.freeze<ProjectionCoordinatorService>({
            get snapshot() {
                return getSnapshot();
            },
            attach: (adapter) => this.#attach(adapter),
            get: (id) => this.#get(id),
            isAttached: (id) => this.#isAttached(id),
            subscribe: (listener) => this.#subscribe(listener),
        });
        this.editor.services.register(
            projectionCoordinatorServiceToken,
            service,
        );
        this.editor.commands.register({
            id: 'projection.activate',
            execute: (_context, ...args) =>
                this.#activate(
                    readProjectionArgument('projection.activate', args),
                ),
        });
        this.editor.commands.register({
            id: 'projection.show',
            execute: (_context, ...args) =>
                this.#setVisible(
                    readProjectionArgument('projection.show', args),
                    true,
                ),
        });
        this.editor.commands.register({
            id: 'projection.hide',
            execute: (_context, ...args) =>
                this.#setVisible(
                    readProjectionArgument('projection.hide', args),
                    false,
                ),
        });
        this.#disposeModeChange = this.editor.events.on(
            'mode:change',
            ({ current }) => this.#handleModeChange(current),
        );
        this.#disposeStateChange = this.editor.events.on(
            'state:change',
            ({ current, previous }) => {
                if (current.readonly !== previous.readonly) this.#notify();
            },
        );
    }

    override destroy(): void {
        this.#destroyed = true;
        this.#disposeModeChange?.();
        this.#disposeModeChange = undefined;
        this.#disposeStateChange?.();
        this.#disposeStateChange = undefined;
        this.#adapters.clear();
        this.#listeners.clear();
        this.#visible.clear();
    }

    #attach(adapter: ProjectionAdapter): () => void {
        this.#assertAlive();
        validateAdapter(adapter);
        const format = this.editor.state.document.format;
        if (!isCompatible(adapter.id, format)) {
            throw new IncompatibleProjectionError(adapter.id, format);
        }
        if (this.#adapters.has(adapter.id)) {
            throw new ProjectionAlreadyAttachedError(adapter.id);
        }
        this.#adapters.set(adapter.id, adapter);
        try {
            adapter.update(this.#activity(adapter.id));
        } catch (error: unknown) {
            this.#adapters.delete(adapter.id);
            throw error;
        }
        let active = true;
        return () => {
            if (!active || this.#destroyed) {
                active = false;
                return;
            }
            if (this.#adapters.get(adapter.id) === adapter) {
                this.#adapters.delete(adapter.id);
                this.#repairPrimaryAfterDetach(adapter.id);
                this.#notify();
            }
            active = false;
        };
    }

    #activate(id: ProjectionId): void {
        this.#assertAttached(id);
        if (!isEditableForFormat(id, this.editor.state.document.format)) {
            throw new InvalidProjectionTransitionError(
                `Projection "${id}" cannot become a writable primary.`,
            );
        }
        if (!this.#visible.has(id)) {
            throw new InvalidProjectionTransitionError(
                `Projection "${id}" must be visible before activation.`,
            );
        }
        this.#synchronizingMode = true;
        try {
            if (this.editor.state.mode !== id) {
                this.editor.update((transaction) => transaction.setMode(id), {
                    origin: 'command',
                });
            }
        } finally {
            this.#synchronizingMode = false;
            if (this.editor.state.mode === id) {
                this.#primary = id;
                this.#notify();
            }
        }
    }

    #setVisible(id: ProjectionId, visible: boolean): void {
        this.#assertAttached(id);
        if (!visible && id === this.#primary) {
            throw new InvalidProjectionTransitionError(
                `Primary projection "${id}" cannot be hidden.`,
            );
        }
        const changed = visible
            ? !this.#visible.has(id)
            : this.#visible.has(id);
        if (!changed) {
            return;
        }
        if (visible) {
            this.#visible.add(id);
        } else {
            this.#visible.delete(id);
        }
        this.#notify();
    }

    #handleModeChange(mode: EditorMode): void {
        if (this.#synchronizingMode) {
            return;
        }
        if (mode === 'preview') {
            if (this.#adapters.has('preview')) {
                this.#visible.add('preview');
                this.#notify();
            }
            return;
        }
        if (
            isEditableForFormat(mode, this.editor.state.document.format) &&
            this.#adapters.has(mode)
        ) {
            this.#visible.add(mode);
            this.#primary = mode;
            this.#notify();
        }
    }

    #repairPrimaryAfterDetach(detached: ProjectionId): void {
        if (detached !== this.#primary) {
            return;
        }
        const format = this.editor.state.document.format;
        const visible = projectionIds.find(
            (id): id is EditableProjectionId =>
                this.#adapters.has(id) &&
                this.#visible.has(id) &&
                isEditableForFormat(id, format),
        );
        const fallback =
            visible ??
            projectionIds.find(
                (id): id is EditableProjectionId =>
                    this.#adapters.has(id) && isEditableForFormat(id, format),
            );
        this.#primary = fallback ?? defaultPrimary(format);
        if (fallback !== undefined) {
            this.#visible.add(fallback);
        }
    }

    #get(id: ProjectionId): ProjectionActivity {
        this.#assertAlive();
        assertProjectionId(id);
        return this.#activity(id);
    }

    #isAttached(id: ProjectionId): boolean {
        this.#assertAlive();
        assertProjectionId(id);
        return this.#adapters.has(id);
    }

    #subscribe(listener: (snapshot: ProjectionSnapshot) => void): () => void {
        this.#assertAlive();
        if (typeof listener !== 'function') {
            throw new TypeError('A projection listener must be a function.');
        }
        this.#listeners.add(listener);
        let active = true;
        return () => {
            if (active) {
                this.#listeners.delete(listener);
            }
            active = false;
        };
    }

    #activity(id: ProjectionId): ProjectionActivity {
        const primary = id === this.#primary;
        return Object.freeze({
            id,
            primary,
            readonly: this.editor.state.readonly || !primary,
            visible: this.#visible.has(id),
        });
    }

    #snapshot(): ProjectionSnapshot {
        this.#assertAlive();
        return Object.freeze({
            activities: Object.freeze(
                projectionIds.map((id) => this.#activity(id)),
            ),
            primary: this.#primary,
        });
    }

    #notify(): void {
        const snapshot = this.#snapshot();
        const errors: unknown[] = [];
        for (const activity of snapshot.activities) {
            const adapter = this.#adapters.get(activity.id);
            if (adapter !== undefined) {
                try {
                    adapter.update(activity);
                } catch (error: unknown) {
                    errors.push(error);
                }
            }
        }
        for (const listener of [...this.#listeners]) {
            try {
                listener(snapshot);
            } catch (error: unknown) {
                errors.push(error);
            }
        }
        if (errors.length > 0) {
            throw new AggregateError(
                errors,
                'Projection activity notification failed.',
            );
        }
    }

    #assertAttached(id: ProjectionId): void {
        this.#assertAlive();
        assertProjectionId(id);
        if (!this.#adapters.has(id)) {
            throw new ProjectionNotAttachedError(id);
        }
    }

    #assertAlive(): void {
        if (this.#destroyed) {
            throw new ProjectionCoordinatorDestroyedError();
        }
    }
}

function defaultPrimary(format: DocumentFormat): EditableProjectionId {
    return format === 'markdown' ? 'markdown' : 'visual';
}

function isCompatible(id: ProjectionId, format: DocumentFormat): boolean {
    return id === 'preview' || isEditableForFormat(id, format);
}

function isEditableForFormat(
    id: EditorMode,
    format: DocumentFormat,
): id is EditableProjectionId {
    return format === 'html'
        ? id === 'visual' || id === 'source'
        : id === 'markdown';
}

function validateAdapter(adapter: ProjectionAdapter): void {
    if (typeof adapter !== 'object' || adapter === null) {
        throw new TypeError('A projection adapter must be an object.');
    }
    assertProjectionId(adapter.id);
    if (typeof adapter.update !== 'function') {
        throw new TypeError(
            `Projection adapter "${adapter.id}" requires an update function.`,
        );
    }
}

function readProjectionArgument(
    command: string,
    args: readonly unknown[],
): ProjectionId {
    if (args.length !== 1) {
        throw new TypeError(`Command "${command}" requires one projection ID.`);
    }
    assertProjectionId(args[0]);
    return args[0];
}

function assertProjectionId(value: unknown): asserts value is ProjectionId {
    if (!projectionIds.some((id) => id === value)) {
        throw new TypeError(`Unknown projection ID "${String(value)}".`);
    }
}
