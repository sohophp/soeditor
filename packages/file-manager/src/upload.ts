import { Plugin, createServiceToken } from '@soeditor/core';
import {
    PastePipelinePlugin,
    pastePipelineServiceToken,
    type PasteInputFile,
} from '@soeditor/engine';
import { ImagePlugin, MediaPlugin } from '@soeditor/rich-text';
import {
    EditorUiDestroyedError,
    UiPlugin,
    uiRegistryServiceToken,
    type EditorUi,
} from '@soeditor/ui';

import type { FileManagerResult } from './file-manager.js';
import { normalizeFileManagerResult } from './validation.js';

export interface UploadRequest {
    readonly attempt: number;
    readonly file: Blob;
    readonly kind: 'image';
    readonly name: string;
    readonly size: number;
    readonly type: string;
}

export interface UploadProgress {
    readonly loaded: number;
    readonly total?: number;
}

export interface UploadTask {
    readonly result: PromiseLike<FileManagerResult>;
    cancel(reason?: string): void;
    subscribe(listener: (progress: UploadProgress) => void): () => void;
}

/** Host-owned transport and storage adapter. */
export interface UploadService {
    create(request: UploadRequest): UploadTask;
}

export type UploadStatus = 'cancelled' | 'failed' | 'pending' | 'succeeded';

export interface UploadRecord {
    readonly attempt: number;
    readonly error?: string;
    readonly id: string;
    readonly loaded: number;
    readonly name: string;
    readonly previewUrl?: string;
    readonly result?: FileManagerResult;
    readonly size: number;
    readonly status: UploadStatus;
    readonly total?: number;
    readonly type: string;
}

export interface ImageUploadOptions {
    readonly file: Blob;
    readonly mode?: 'insert' | 'replace';
    readonly name?: string;
    readonly type?: string;
}

export interface UploadWorkflowService {
    cancel(id: string): boolean;
    list(): readonly UploadRecord[];
    retry(id: string): Promise<FileManagerResult>;
    start(options: ImageUploadOptions): Promise<FileManagerResult>;
    subscribe(listener: (records: readonly UploadRecord[]) => void): () => void;
}

export const uploadServiceToken =
    createServiceToken<UploadService>('soeditor.upload');
export const uploadWorkflowServiceToken =
    createServiceToken<UploadWorkflowService>('soeditor.upload-workflow');

interface OwnedUpload {
    attempt: number;
    file: Blob;
    id: string;
    mode: 'insert' | 'replace';
    name: string;
    previewUrl: string | undefined;
    record: UploadRecord;
    task: UploadTask | undefined;
    type: string;
    unsubscribe: (() => void) | undefined;
}

/** Coordinates host uploads without serializing temporary URLs into HTML. */
export class UploadPlugin extends Plugin {
    static readonly id = 'upload';
    static readonly requires = [
        PastePipelinePlugin,
        ImagePlugin,
        MediaPlugin,
        UiPlugin,
    ];

    readonly #listeners = new Set<(records: readonly UploadRecord[]) => void>();
    readonly #uploads = new Map<string, OwnedUpload>();
    #destroyed = false;
    #dispose: (() => void)[] = [];
    #maximumConcurrent = 4;
    #maximumFileSize = 25_000_000;
    #nextId = 1;
    #service: UploadWorkflowService | undefined;

    override init(): void {
        this.#maximumConcurrent = readPositiveInteger(
            this.editor.config.get<unknown>('cms.upload.maxConcurrent'),
            4,
            16,
            'cms.upload.maxConcurrent',
        );
        this.#maximumFileSize = readPositiveInteger(
            this.editor.config.get<unknown>('cms.upload.maxFileBytes'),
            25_000_000,
            500_000_000,
            'cms.upload.maxFileBytes',
        );
        const service: UploadWorkflowService = Object.freeze({
            cancel: (id: string) => this.#cancel(id),
            list: () => this.#snapshot(),
            retry: (id: string) => this.#retry(id),
            start: (options: ImageUploadOptions) =>
                this.#start(readUploadOptions(options)),
            subscribe: (listener: (records: readonly UploadRecord[]) => void) =>
                this.#subscribe(listener),
        });
        this.#service = service;
        this.editor.services.register(uploadWorkflowServiceToken, service);
        this.editor.commands.register({
            id: 'image.upload',
            label: 'Upload image',
            canExecute: ({ editor }) =>
                editor.services.has(uploadServiceToken) &&
                editor.commands.canExecute('media.insert'),
            execute: (_context, candidate) =>
                this.#start(readUploadOptions(candidate)),
        });
        this.editor.commands.register({
            id: 'image.upload.cancel',
            label: 'Cancel image upload',
            canExecute: () =>
                [...this.#uploads.values()].some(
                    (upload) => upload.record.status === 'pending',
                ),
            execute: (_context, id) => this.#cancel(readId(id)),
        });
        this.editor.commands.register({
            id: 'image.upload.retry',
            label: 'Retry image upload',
            canExecute: () =>
                [...this.#uploads.values()].some(
                    (upload) => upload.record.status === 'failed',
                ),
            execute: (_context, id) => this.#retry(readId(id)),
        });
        this.#dispose.push(
            this.editor.services.get(pastePipelineServiceToken).register({
                id: 'soeditor.upload.files',
                priority: 100,
                process: (context) => {
                    if (context.classification !== 'files') return undefined;
                    const images = context.files.filter(
                        (file) =>
                            file.data !== undefined &&
                            /^image\//u.test(file.type),
                    );
                    if (
                        images.length === 0 ||
                        images.length !== context.files.length
                    ) {
                        throw new Error(
                            'Only image files can be uploaded here.',
                        );
                    }
                    for (const file of images) this.#startTransferredFile(file);
                    return Object.freeze({
                        consumed: true,
                        html: '',
                        text: '',
                    });
                },
            }),
        );
        this.#registerToolbar();
    }

    override destroy(): void {
        this.#destroyed = true;
        for (const dispose of this.#dispose.reverse()) dispose();
        this.#dispose = [];
        for (const upload of this.#uploads.values()) {
            upload.unsubscribe?.();
            if (upload.record.status === 'pending') {
                upload.task?.cancel('Editor destroyed.');
            }
            revokePreview(upload);
        }
        this.#listeners.clear();
        if (
            this.editor.services.tryGet(uploadWorkflowServiceToken) ===
            this.#service
        ) {
            this.editor.services.unregister(uploadWorkflowServiceToken);
        }
        this.#service = undefined;
    }

    #registerToolbar(): void {
        const ui = this.editor.services.get(uiRegistryServiceToken);
        this.#dispose.push(
            ui.registerToolbarItem(
                'image-upload',
                ({ document, editor, ui: editorUi }) => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.hidden = true;
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'soeditor-ui__button';
                    editorUi.setIcon(button, 'image.upload', 'Upload image');
                    button.title = 'Upload an image';
                    button.setAttribute('aria-label', 'Upload an image');
                    const click = (): void => input.click();
                    const change = (): void => {
                        const file = input.files?.item(0);
                        input.value = '';
                        if (file === null || file === undefined) return;
                        try {
                            const pending = editor.execute('image.upload', {
                                file,
                                name: file.name,
                                type: file.type,
                            });
                            void Promise.resolve(pending).catch(
                                (error: unknown) => showError(editorUi, error),
                            );
                        } catch (error: unknown) {
                            showError(editorUi, error);
                        }
                    };
                    button.addEventListener('click', click);
                    input.addEventListener('change', change);
                    const wrapper = document.createElement('span');
                    wrapper.append(button, input);
                    return {
                        element: wrapper,
                        update: () => {
                            button.disabled =
                                !editor.commands.canExecute('image.upload');
                        },
                        destroy: () => {
                            button.removeEventListener('click', click);
                            input.removeEventListener('change', change);
                        },
                    };
                },
            ),
        );
    }

    #startTransferredFile(file: PasteInputFile): void {
        if (file.data === undefined) return;
        void this.#start({
            file: file.data,
            name: file.name,
            type: file.type,
        }).catch(() => undefined);
    }

    async #start(options: ImageUploadOptions): Promise<FileManagerResult> {
        this.#assertAlive();
        if (options.file.size > this.#maximumFileSize) {
            throw new TypeError(
                `Image upload exceeds ${String(this.#maximumFileSize)} bytes.`,
            );
        }
        const pending = [...this.#uploads.values()].filter(
            (upload) => upload.record.status === 'pending',
        ).length;
        if (pending >= this.#maximumConcurrent) {
            throw new Error(
                `At most ${String(this.#maximumConcurrent)} uploads may run concurrently.`,
            );
        }
        const id = `upload-${String(this.#nextId++)}`;
        const upload: OwnedUpload = {
            attempt: 1,
            file: options.file,
            id,
            mode: options.mode ?? 'insert',
            name: options.name ?? 'image',
            previewUrl: undefined,
            record: Object.freeze({
                attempt: 1,
                id,
                loaded: 0,
                name: options.name ?? 'image',
                size: options.file.size,
                status: 'pending',
                type: options.type ?? options.file.type,
            }),
            type: options.type ?? options.file.type,
            task: undefined,
            unsubscribe: undefined,
        };
        upload.previewUrl = createPreview(options.file);
        upload.record = Object.freeze({
            ...upload.record,
            ...(upload.previewUrl === undefined
                ? {}
                : { previewUrl: upload.previewUrl }),
        });
        this.#uploads.set(id, upload);
        this.#publish();
        return this.#run(upload);
    }

    async #run(upload: OwnedUpload): Promise<FileManagerResult> {
        let task: UploadTask;
        try {
            const adapter = this.editor.services.get(uploadServiceToken);
            task = validateTask(
                adapter.create(
                    Object.freeze({
                        attempt: upload.attempt,
                        file: upload.file,
                        kind: 'image',
                        name: upload.name,
                        size: upload.file.size,
                        type: upload.type,
                    }),
                ),
            );
        } catch (error: unknown) {
            this.#fail(upload, error);
            throw error;
        }
        try {
            upload.task = task;
            upload.unsubscribe = task.subscribe((progress) =>
                this.#progress(upload, progress),
            );
            const result = normalizeFileManagerResult(await task.result);
            if (result === null) {
                throw new TypeError('Upload service returned null.');
            }
            if (this.#destroyed || upload.record.status !== 'pending') {
                return result;
            }
            upload.unsubscribe?.();
            upload.unsubscribe = undefined;
            revokePreview(upload);
            upload.record = Object.freeze({
                ...withoutPreview(upload.record),
                loaded: upload.file.size,
                result,
                status: 'succeeded',
                total: upload.file.size,
            });
            this.#publish();
            const command =
                upload.mode === 'replace' ? 'media.update' : 'media.insert';
            this.editor.execute(command, {
                alt: result.alt ?? result.name ?? upload.name,
                ...(result.height === undefined
                    ? {}
                    : { height: result.height }),
                src: result.url,
                ...(result.width === undefined ? {} : { width: result.width }),
            });
            return result;
        } catch (error: unknown) {
            if (upload.record.status === 'cancelled' || this.#destroyed) {
                throw error;
            }
            this.#fail(upload, error);
            throw error;
        }
    }

    #progress(upload: OwnedUpload, progress: UploadProgress): void {
        if (upload.record.status !== 'pending') return;
        const normalized = normalizeProgress(progress, upload.file.size);
        upload.record = Object.freeze({
            ...upload.record,
            loaded: normalized.loaded,
            ...(normalized.total === undefined
                ? {}
                : { total: normalized.total }),
        });
        this.#publish();
    }

    #fail(upload: OwnedUpload, error: unknown): void {
        upload.unsubscribe?.();
        upload.unsubscribe = undefined;
        revokePreview(upload);
        upload.record = Object.freeze({
            ...withoutPreview(upload.record),
            error: errorMessage(error),
            status: 'failed',
        });
        this.#publish();
    }

    #cancel(id: string): boolean {
        this.#assertAlive();
        const upload = this.#uploads.get(id);
        if (upload === undefined || upload.record.status !== 'pending') {
            return false;
        }
        upload.task?.cancel('Cancelled by user.');
        upload.unsubscribe?.();
        upload.unsubscribe = undefined;
        revokePreview(upload);
        upload.record = Object.freeze({
            ...withoutPreview(upload.record),
            status: 'cancelled',
        });
        this.#publish();
        return true;
    }

    #retry(id: string): Promise<FileManagerResult> {
        this.#assertAlive();
        const upload = this.#uploads.get(id);
        if (upload === undefined || upload.record.status !== 'failed') {
            throw new Error(`Upload "${id}" is not available for retry.`);
        }
        if (
            [...this.#uploads.values()].filter(
                (candidate) => candidate.record.status === 'pending',
            ).length >= this.#maximumConcurrent
        ) {
            throw new Error(
                `At most ${String(this.#maximumConcurrent)} uploads may run concurrently.`,
            );
        }
        upload.attempt += 1;
        upload.previewUrl = createPreview(upload.file);
        upload.record = Object.freeze({
            attempt: upload.attempt,
            id: upload.id,
            loaded: 0,
            name: upload.name,
            ...(upload.previewUrl === undefined
                ? {}
                : { previewUrl: upload.previewUrl }),
            size: upload.file.size,
            status: 'pending',
            type: upload.type,
        });
        this.#publish();
        return this.#run(upload);
    }

    #snapshot(): readonly UploadRecord[] {
        return Object.freeze(
            [...this.#uploads.values()].map((upload) => upload.record),
        );
    }

    #subscribe(
        listener: (records: readonly UploadRecord[]) => void,
    ): () => void {
        this.#assertAlive();
        this.#listeners.add(listener);
        listener(this.#snapshot());
        return () => this.#listeners.delete(listener);
    }

    #publish(): void {
        if (this.#destroyed) return;
        const snapshot = this.#snapshot();
        for (const listener of [...this.#listeners]) listener(snapshot);
    }

    #assertAlive(): void {
        if (this.#destroyed) {
            throw new Error('The upload workflow was destroyed.');
        }
    }
}

function readUploadOptions(value: unknown): ImageUploadOptions {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new TypeError('image.upload requires an options object.');
    }
    const file = Reflect.get(value, 'file');
    const mode = Reflect.get(value, 'mode');
    const name = Reflect.get(value, 'name');
    const type = Reflect.get(value, 'type');
    if (!(file instanceof Blob) || file.size < 1) {
        throw new TypeError('image.upload requires a non-empty Blob file.');
    }
    if (mode !== undefined && mode !== 'insert' && mode !== 'replace') {
        throw new TypeError('image.upload mode must be "insert" or "replace".');
    }
    if (name !== undefined && (typeof name !== 'string' || name.length > 512)) {
        throw new TypeError('image.upload name must be a bounded string.');
    }
    if (type !== undefined && (typeof type !== 'string' || type.length > 255)) {
        throw new TypeError('image.upload type must be a bounded string.');
    }
    const mime = type ?? file.type;
    if (!/^image\/(?:avif|gif|jpeg|png|webp)$/u.test(mime)) {
        throw new TypeError(`Unsupported image upload type "${mime}".`);
    }
    return Object.freeze({
        file,
        ...(mode === undefined ? {} : { mode }),
        ...(name === undefined ? {} : { name }),
        type: mime,
    });
}

function validateTask(value: unknown): UploadTask {
    if (
        typeof value !== 'object' ||
        value === null ||
        typeof Reflect.get(value, 'cancel') !== 'function' ||
        typeof Reflect.get(value, 'subscribe') !== 'function' ||
        !isPromiseLike(Reflect.get(value, 'result'))
    ) {
        throw new TypeError('UploadService.create() returned an invalid task.');
    }
    return value as UploadTask;
}

function normalizeProgress(
    value: UploadProgress,
    size: number,
): UploadProgress {
    if (
        typeof value !== 'object' ||
        value === null ||
        !Number.isFinite(value.loaded) ||
        value.loaded < 0 ||
        (value.total !== undefined &&
            (!Number.isFinite(value.total) || value.total < value.loaded))
    ) {
        throw new TypeError('Upload progress is malformed.');
    }
    return Object.freeze({
        loaded: Math.min(value.loaded, value.total ?? size),
        ...(value.total === undefined ? {} : { total: value.total }),
    });
}

function createPreview(file: Blob): string | undefined {
    return typeof URL.createObjectURL === 'function'
        ? URL.createObjectURL(file)
        : undefined;
}

function revokePreview(upload: OwnedUpload): void {
    if (upload.previewUrl === undefined) return;
    URL.revokeObjectURL(upload.previewUrl);
    upload.previewUrl = undefined;
}

function withoutPreview(
    record: UploadRecord,
): Omit<UploadRecord, 'previewUrl'> {
    return {
        attempt: record.attempt,
        ...(record.error === undefined ? {} : { error: record.error }),
        id: record.id,
        loaded: record.loaded,
        name: record.name,
        ...(record.result === undefined ? {} : { result: record.result }),
        size: record.size,
        status: record.status,
        ...(record.total === undefined ? {} : { total: record.total }),
        type: record.type,
    };
}

function readId(value: unknown): string {
    if (typeof value !== 'string' || !/^upload-\d+$/u.test(value)) {
        throw new TypeError('Upload command requires a valid upload id.');
    }
    return value;
}

function showError(ui: EditorUi, error: unknown): void {
    try {
        ui.notifications.show({
            message: errorMessage(error),
            severity: 'error',
        });
    } catch (notificationError: unknown) {
        if (!(notificationError instanceof EditorUiDestroyedError)) {
            throw notificationError;
        }
    }
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
    return (
        ((typeof value === 'object' && value !== null) ||
            typeof value === 'function') &&
        typeof Reflect.get(value, 'then') === 'function'
    );
}

function readPositiveInteger(
    value: unknown,
    fallback: number,
    maximum: number,
    path: string,
): number {
    if (value === undefined) return fallback;
    if (
        !Number.isInteger(value) ||
        Number(value) < 1 ||
        Number(value) > maximum
    ) {
        throw new TypeError(
            `${path} must be an integer from 1 to ${String(maximum)}.`,
        );
    }
    return Number(value);
}
