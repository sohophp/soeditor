import { Editor, type DocumentChangeEvent } from '@soeditor/core';

import {
    WorkspaceDestroyedError,
    WorkspaceNotReadyError,
    WorkspaceRecoveryLimitError,
    WorkspaceValuePolicyError,
} from './errors.js';
import type {
    CreateWorkspaceOptions,
    EditorWorkspace,
    WorkspaceAttachment,
    WorkspaceChange,
    WorkspaceSnapshot,
    WorkspaceStatus,
} from './types.js';

const EXTERNAL_VALUE_META = 'soeditor.workspace.external-value';
const DEFAULT_MAX_RESTARTS = 3;
const DEFAULT_WINDOW_MS = 60_000;

interface MountedWorkspace {
    readonly attachments: readonly WorkspaceAttachment[];
    readonly disposeDocumentChange: () => void;
    readonly editor: Editor;
}

interface RecoveryPolicy {
    readonly maxRestarts: number;
    readonly now: () => number;
    readonly windowMs: number;
}

/** Creates and mounts one framework-neutral application workspace. */
export async function createEditorWorkspace(
    options: CreateWorkspaceOptions,
): Promise<EditorWorkspace> {
    const controller = new EditorWorkspaceController(validateOptions(options));
    await controller.initialize();
    return controller.publicApi;
}

class EditorWorkspaceController {
    readonly #externalValueMarker = Object.freeze({});
    readonly #listeners = new Set<(snapshot: WorkspaceSnapshot) => void>();
    readonly #options: CreateWorkspaceOptions;
    readonly #recovery: RecoveryPolicy | undefined;
    readonly #restartTimes: number[] = [];
    #destroyPromise: Promise<void> | undefined;
    #destroyRequested = false;
    #error: unknown;
    #lastKnownSource: string;
    #mounted: MountedWorkspace | undefined;
    #pendingAbort: AbortController | undefined;
    #pendingControlledSource: string | undefined;
    #recoveryCount = 0;
    #recoveryPromise: Promise<void> | undefined;
    #revision = 0;
    #status: WorkspaceStatus = 'recovering';

    constructor(options: CreateWorkspaceOptions) {
        this.#options = options;
        this.#lastKnownSource =
            options.value.kind === 'controlled'
                ? options.value.value
                : options.value.initialValue;
        this.#recovery = createRecoveryPolicy(options);
    }

    get publicApi(): EditorWorkspace {
        const editor = (): Editor => this.editor;
        const snapshot = (): WorkspaceSnapshot => this.snapshot;
        return Object.freeze({
            get editor() {
                return editor();
            },
            get snapshot() {
                return snapshot();
            },
            destroy: () => this.destroy(),
            reportFailure: (error: unknown) => this.reportFailure(error),
            setValue: (source: string) => this.setValue(source),
            subscribe: (listener: (value: WorkspaceSnapshot) => void) =>
                this.subscribe(listener),
        });
    }

    get editor(): Editor {
        this.#assertNotDestroyed();
        if (this.#status !== 'ready' || this.#mounted === undefined) {
            throw new WorkspaceNotReadyError(this.#status);
        }
        return this.#mounted.editor;
    }

    get snapshot(): WorkspaceSnapshot {
        return Object.freeze({
            error: this.#error,
            lastKnownSource: this.#lastKnownSource,
            recoveryCount: this.#recoveryCount,
            revision: this.#revision,
            status: this.#status,
        });
    }

    async initialize(): Promise<void> {
        try {
            this.#mounted = await this.#mount(this.#lastKnownSource, 0);
            this.#lastKnownSource = this.#mounted.editor.getData();
            this.#status = 'ready';
        } catch (error: unknown) {
            this.#error = error;
            this.#status = 'failed';
            throw error;
        }
    }

    setValue(source: string): void {
        this.#assertNotDestroyed();
        if (this.#options.value.kind !== 'controlled') {
            throw new WorkspaceValuePolicyError(
                'Only a controlled SoEditor workspace accepts setValue().',
            );
        }
        const value = sourceValue(source);
        if (this.#status === 'recovering') {
            if (this.#lastKnownSource === value) return;
            this.#pendingControlledSource = value;
            this.#lastKnownSource = value;
            this.#revision += 1;
            this.#notify();
            return;
        }
        const editor = this.editor;
        if (editor.getData() === value) return;
        editor.update(
            (transaction) => {
                transaction.replaceDocument(value);
                transaction.setMeta(
                    EXTERNAL_VALUE_META,
                    this.#externalValueMarker,
                );
            },
            { origin: 'system' },
        );
    }

    subscribe(listener: (snapshot: WorkspaceSnapshot) => void): () => void {
        this.#assertNotDestroyed();
        if (typeof listener !== 'function') {
            throw new TypeError('A workspace listener must be a function.');
        }
        this.#listeners.add(listener);
        return () => this.#listeners.delete(listener);
    }

    reportFailure(error: unknown): Promise<void> {
        this.#assertNotDestroyed();
        if (this.#status === 'failed') {
            return Promise.reject(new WorkspaceNotReadyError(this.#status));
        }
        if (this.#recoveryPromise !== undefined) {
            return this.#recoveryPromise;
        }
        const recovery = this.#recover(error);
        this.#recoveryPromise = recovery;
        void recovery.then(
            () => {
                if (this.#recoveryPromise === recovery) {
                    this.#recoveryPromise = undefined;
                }
            },
            () => {
                if (this.#recoveryPromise === recovery) {
                    this.#recoveryPromise = undefined;
                }
            },
        );
        return recovery;
    }

    destroy(): Promise<void> {
        if (this.#destroyPromise !== undefined) return this.#destroyPromise;
        this.#destroyRequested = true;
        this.#pendingAbort?.abort();
        const destruction = this.#performDestroy();
        this.#destroyPromise = destruction;
        return destruction;
    }

    async #recover(cause: unknown): Promise<void> {
        this.#status = 'recovering';
        this.#error = cause;
        this.#captureSource();
        this.#notify();
        try {
            await this.#teardownMounted();
        } catch (cleanupError: unknown) {
            const error = new AggregateError(
                [cause, cleanupError],
                'Workspace recovery stopped because cleanup failed.',
            );
            this.#fail(error);
            throw error;
        }
        if (this.#destroyRequested) throw new WorkspaceDestroyedError();
        if (this.#recovery === undefined) {
            this.#fail(cause);
            throw cause;
        }
        const now = recoveryTime(this.#recovery.now());
        const windowStart = now - this.#recovery.windowMs;
        while (
            this.#restartTimes.length > 0 &&
            this.#restartTimes[0]! < windowStart
        ) {
            this.#restartTimes.shift();
        }
        if (this.#restartTimes.length >= this.#recovery.maxRestarts) {
            const error = new WorkspaceRecoveryLimitError(cause);
            this.#fail(error);
            throw error;
        }
        this.#restartTimes.push(now);
        this.#recoveryCount += 1;
        try {
            const mounted = await this.#mount(
                this.#lastKnownSource,
                this.#recoveryCount,
            );
            if (this.#destroyRequested) {
                await teardown(mounted);
                throw new WorkspaceDestroyedError();
            }
            const pendingControlledSource = this.#pendingControlledSource;
            if (
                pendingControlledSource !== undefined &&
                mounted.editor.getData() !== pendingControlledSource
            ) {
                mounted.editor.update(
                    (transaction) => {
                        transaction.replaceDocument(pendingControlledSource);
                        transaction.setMeta(
                            EXTERNAL_VALUE_META,
                            this.#externalValueMarker,
                        );
                    },
                    { origin: 'system' },
                );
            }
            this.#pendingControlledSource = undefined;
            this.#lastKnownSource = mounted.editor.getData();
            this.#mounted = mounted;
            this.#error = undefined;
            this.#status = 'ready';
            this.#revision += 1;
            this.#notify();
        } catch (error: unknown) {
            if (!this.#destroyRequested) this.#fail(error);
            throw error;
        }
    }

    async #mount(source: string, recovery: number): Promise<MountedWorkspace> {
        const abort = new AbortController();
        this.#pendingAbort = abort;
        let editor: Editor | undefined;
        let disposeDocumentChange: (() => void) | undefined;
        const attachments: WorkspaceAttachment[] = [];
        try {
            editor = await this.#options.createEditor({
                recovery,
                signal: abort.signal,
                source,
            });
            if (!(editor instanceof Editor)) {
                throw new TypeError(
                    'A workspace editor factory must return a SoEditor Editor.',
                );
            }
            throwIfAborted(abort.signal);
            const mountedEditor = editor;
            disposeDocumentChange = mountedEditor.events.on(
                'document:change',
                (event) => this.#documentChanged(mountedEditor, event),
            );
            for (const factory of this.#options.attachments ?? []) {
                const attachment = await factory.attach({
                    editor: mountedEditor,
                    recovery,
                    signal: abort.signal,
                });
                if (
                    typeof attachment !== 'object' ||
                    attachment === null ||
                    typeof attachment.destroy !== 'function'
                ) {
                    throw new TypeError(
                        `Workspace attachment "${factory.id}" did not return a destroyable handle.`,
                    );
                }
                if (abort.signal.aborted) {
                    await attachment.destroy();
                    throw new WorkspaceDestroyedError();
                }
                attachments.push(attachment);
            }
            throwIfAborted(abort.signal);
            return Object.freeze({
                attachments: Object.freeze([...attachments]),
                disposeDocumentChange,
                editor: mountedEditor,
            });
        } catch (error: unknown) {
            const cleanupErrors = await teardownParts(
                attachments,
                disposeDocumentChange,
                editor,
            );
            if (cleanupErrors.length > 0) {
                throw new AggregateError(
                    [error, ...cleanupErrors],
                    'Workspace mounting and cleanup failed.',
                );
            }
            throw error;
        } finally {
            if (this.#pendingAbort === abort) this.#pendingAbort = undefined;
        }
    }

    #documentChanged(editor: Editor, event: DocumentChangeEvent): void {
        if (this.#mounted?.editor !== editor || this.#destroyRequested) return;
        this.#lastKnownSource = event.current.source;
        this.#revision += 1;
        this.#notify();
        if (
            event.transaction.getMeta(EXTERNAL_VALUE_META) ===
            this.#externalValueMarker
        ) {
            return;
        }
        const onChange = this.#options.value.onChange;
        if (onChange === undefined) return;
        const change: WorkspaceChange = Object.freeze({
            origin: event.transaction.origin,
            previousSource: event.previous.source,
            source: event.current.source,
        });
        globalThis.queueMicrotask(() => {
            if (this.#mounted?.editor !== editor || this.#destroyRequested) {
                return;
            }
            try {
                onChange(change);
            } catch (error: unknown) {
                this.#error = error;
                this.#notify();
            }
        });
    }

    #captureSource(): void {
        if (this.#mounted !== undefined) {
            this.#lastKnownSource = this.#mounted.editor.getData();
        }
    }

    async #teardownMounted(): Promise<void> {
        const mounted = this.#mounted;
        this.#mounted = undefined;
        if (mounted !== undefined) await teardown(mounted);
    }

    async #performDestroy(): Promise<void> {
        let error: unknown;
        try {
            await this.#recoveryPromise?.catch(() => undefined);
            this.#captureSource();
            await this.#teardownMounted();
        } catch (caught: unknown) {
            error = caught;
        }
        this.#status = 'destroyed';
        this.#error = error;
        this.#revision += 1;
        this.#notify();
        this.#listeners.clear();
        if (error !== undefined) throw error;
    }

    #fail(error: unknown): void {
        this.#error = error;
        this.#status = 'failed';
        this.#revision += 1;
        this.#notify();
    }

    #notify(): void {
        const snapshot = this.snapshot;
        const errors: unknown[] = [];
        for (const listener of [...this.#listeners]) {
            try {
                listener(snapshot);
            } catch (error: unknown) {
                errors.push(error);
            }
        }
        if (errors.length > 0) {
            this.#error = new AggregateError(
                this.#error === undefined ? errors : [this.#error, ...errors],
                'Workspace listeners failed.',
            );
        }
    }

    #assertNotDestroyed(): void {
        if (this.#destroyRequested || this.#status === 'destroyed') {
            throw new WorkspaceDestroyedError();
        }
    }
}

function validateOptions(
    options: CreateWorkspaceOptions,
): CreateWorkspaceOptions {
    if (
        typeof options !== 'object' ||
        options === null ||
        typeof options.createEditor !== 'function' ||
        typeof options.value !== 'object' ||
        options.value === null
    ) {
        throw new TypeError(
            'A workspace requires explicit editor and value configuration.',
        );
    }
    if (
        options.value.kind !== 'controlled' &&
        options.value.kind !== 'uncontrolled'
    ) {
        throw new WorkspaceValuePolicyError(
            'Workspace value policy must be controlled or uncontrolled.',
        );
    }
    sourceValue(
        options.value.kind === 'controlled'
            ? options.value.value
            : options.value.initialValue,
    );
    if (
        (options.value.kind === 'controlled' &&
            typeof options.value.onChange !== 'function') ||
        (options.value.onChange !== undefined &&
            typeof options.value.onChange !== 'function')
    ) {
        throw new WorkspaceValuePolicyError(
            'Workspace onChange must be a function when supplied.',
        );
    }
    if (!Array.isArray(options.attachments ?? [])) {
        throw new TypeError('Workspace attachments must be an array.');
    }
    const ids = new Set<string>();
    for (const factory of options.attachments ?? []) {
        if (
            typeof factory !== 'object' ||
            factory === null ||
            typeof factory.attach !== 'function' ||
            typeof factory.id !== 'string' ||
            factory.id.trim().length === 0
        ) {
            throw new TypeError(
                'Each workspace attachment requires an ID and attach function.',
            );
        }
        if (ids.has(factory.id)) {
            throw new Error(
                `Workspace attachment "${factory.id}" is duplicated.`,
            );
        }
        ids.add(factory.id);
    }
    return Object.freeze({
        ...(options.attachments === undefined
            ? {}
            : { attachments: Object.freeze([...options.attachments]) }),
        createEditor: options.createEditor,
        ...(options.recovery === undefined
            ? {}
            : { recovery: Object.freeze({ ...options.recovery }) }),
        value: Object.freeze({ ...options.value }),
    });
}

function createRecoveryPolicy(
    options: CreateWorkspaceOptions,
): RecoveryPolicy | undefined {
    if (options.recovery === undefined) return undefined;
    const maxRestarts = options.recovery.maxRestarts ?? DEFAULT_MAX_RESTARTS;
    const windowMs = options.recovery.windowMs ?? DEFAULT_WINDOW_MS;
    const now = options.recovery.now ?? Date.now;
    if (
        !Number.isInteger(maxRestarts) ||
        maxRestarts < 1 ||
        maxRestarts > 10 ||
        !Number.isFinite(windowMs) ||
        windowMs < 1_000 ||
        windowMs > 3_600_000 ||
        typeof now !== 'function'
    ) {
        throw new RangeError(
            'Workspace recovery requires 1 to 10 restarts and a 1000 to 3600000 ms window.',
        );
    }
    return Object.freeze({ maxRestarts, now, windowMs });
}

async function teardown(mounted: MountedWorkspace): Promise<void> {
    const errors = await teardownParts(
        [...mounted.attachments],
        mounted.disposeDocumentChange,
        mounted.editor,
    );
    if (errors.length > 0) {
        throw new AggregateError(errors, 'Workspace cleanup failed.');
    }
}

async function teardownParts(
    attachments: WorkspaceAttachment[],
    disposeDocumentChange: (() => void) | undefined,
    editor: Editor | undefined,
): Promise<unknown[]> {
    const errors: unknown[] = [];
    try {
        disposeDocumentChange?.();
    } catch (error: unknown) {
        errors.push(error);
    }
    for (const attachment of attachments.reverse()) {
        try {
            await attachment.destroy();
        } catch (error: unknown) {
            errors.push(error);
        }
    }
    if (editor !== undefined) {
        try {
            await editor.destroy();
        } catch (error: unknown) {
            errors.push(error);
        }
    }
    return errors;
}

function throwIfAborted(signal: AbortSignal): void {
    if (signal.aborted) throw new WorkspaceDestroyedError();
}

function sourceValue(value: unknown): string {
    if (typeof value !== 'string') {
        throw new WorkspaceValuePolicyError(
            'Workspace source value must be a string.',
        );
    }
    return value;
}

function recoveryTime(value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        throw new TypeError(
            'The workspace recovery clock returned invalid time.',
        );
    }
    return value;
}
