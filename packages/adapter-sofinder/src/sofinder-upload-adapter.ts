import {
    normalizeFileManagerResult,
    type UploadProgress,
    type UploadRequest,
    type UploadService,
    type UploadTask,
} from '@soeditor/file-manager';

import {
    normalizeSoFinderSelection,
    type SoFinderSelection,
} from './sofinder-adapter.js';

/** Progress emitted by a host-provided SoFinder upload task. */
export interface SoFinderUploadSnapshot {
    readonly progress: number;
}

/** Narrow task shape implemented by the host's concrete SoFinder SDK. */
export interface SoFinderUploadTask {
    readonly completion: PromiseLike<SoFinderSelection>;
    cancel(): void;
    subscribe(listener: (snapshot: SoFinderUploadSnapshot) => void): () => void;
}

/** Starts one SoFinder upload without importing a concrete SDK into SoEditor. */
export type SoFinderUploader = (request: UploadRequest) => SoFinderUploadTask;

export interface SoFinderUploadAdapterOptions {
    readonly upload: SoFinderUploader;
}

/** Maps an injected SoFinder upload task to SoEditor's generic UploadService. */
export class SoFinderUploadAdapter implements UploadService {
    readonly #upload: SoFinderUploader;

    constructor(options: SoFinderUploadAdapterOptions) {
        if (typeof options !== 'object' || options === null) {
            throw new TypeError(
                'SoFinder upload adapter options are required.',
            );
        }
        const upload = read(options, 'upload');
        if (typeof upload !== 'function') {
            throw new TypeError(
                'SoFinder upload adapter requires an upload function.',
            );
        }
        this.#upload = upload as SoFinderUploader;
    }

    create(request: UploadRequest): UploadTask {
        const task = this.#upload(request);
        if (typeof task !== 'object' || task === null) {
            throw new TypeError(
                'SoFinder uploader must return an upload task.',
            );
        }
        const completion = read(task, 'completion');
        const cancel = read(task, 'cancel');
        const subscribe = read(task, 'subscribe');
        if (
            !isPromiseLike(completion) ||
            typeof cancel !== 'function' ||
            typeof subscribe !== 'function'
        ) {
            throw new TypeError('SoFinder uploader returned an invalid task.');
        }
        return Object.freeze({
            cancel: () => cancel.call(task),
            result: Promise.resolve(completion).then(normalizeUploadResult),
            subscribe: (listener: (progress: UploadProgress) => void) =>
                subscribe.call(task, (snapshot: SoFinderUploadSnapshot) => {
                    const progress = read(snapshot, 'progress');
                    if (
                        typeof progress !== 'number' ||
                        !Number.isFinite(progress) ||
                        progress < 0 ||
                        progress > 100
                    ) {
                        throw new TypeError(
                            'SoFinder upload progress must be between 0 and 100.',
                        );
                    }
                    listener({ loaded: progress, total: 100 });
                }),
        });
    }
}

function normalizeUploadResult(selection: SoFinderSelection) {
    const result = normalizeFileManagerResult(
        normalizeSoFinderSelection(selection),
    );
    if (result === null) {
        throw new TypeError('SoFinder upload completion must return an asset.');
    }
    return result;
}

function read(value: object, key: PropertyKey): unknown {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined) return undefined;
    if ('get' in descriptor || 'set' in descriptor) {
        throw new TypeError(
            `SoFinder upload property "${String(key)}" must be a data property.`,
        );
    }
    return descriptor.value;
}

function isPromiseLike(
    value: unknown,
): value is PromiseLike<SoFinderSelection> {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof Reflect.get(value, 'then') === 'function'
    );
}
