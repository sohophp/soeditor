import type {
    FileManager,
    UploadService,
    UploadRequest,
} from '@soeditor/file-manager';
import { SoFinderAdapter, type SoFinderSelection } from './sofinder-adapter.js';
import {
    SoFinderUploadAdapter,
    type SoFinderUploadTask,
    type SoFinderUploadSnapshot,
} from './sofinder-upload-adapter.js';

/** Configuration for the independent SoFinder browser SDK; no CMS classes are imported. */
export interface SoFinderBrowserOptions {
    readonly baseUrl: string;
    readonly csrfToken: string | (() => string);
    readonly language?: string;
    readonly imageResource?: string;
    readonly fileResource?: string;
    readonly uploadPath?: string;
    /** Optional loader for bundlers, CSP deployments and tests. SDKs load on first use. */
    readonly loadModule?: (url: string) => Promise<unknown>;
}

export interface SoFinderBrowserAdapters {
    readonly fileManager: FileManager;
    readonly upload: UploadService;
}

interface PickerModule {
    openPicker(
        options: Readonly<Record<string, unknown>>,
    ): Promise<SoFinderSelection>;
}
interface SdkModule {
    createSoFinderClient(options: Readonly<Record<string, unknown>>): {
        upload(options: Readonly<Record<string, unknown>>): SoFinderUploadTask;
    };
}

/** Reusable picker, SDK transport, cancellation and result mapping for Link and Image tools. */
export function createSoFinderBrowserAdapters(
    options: SoFinderBrowserOptions,
): SoFinderBrowserAdapters {
    const base = options.baseUrl.replace(/\/+$/u, '');
    // eslint-disable-next-line no-control-regex -- Reject unsafe SDK URL characters.
    const unsafeBase = /[\u0000-\u0020\u007f\\?#]/u.test(base);
    if (
        !base ||
        unsafeBase ||
        (!base.startsWith('/') && !/^https?:\/\//iu.test(base)) ||
        base.startsWith('//')
    )
        throw new TypeError(
            'SoFinder baseUrl must be an HTTP(S) URL or a site-relative path.',
        );
    const load = options.loadModule ?? createModuleLoader(options.language);
    let picker: Promise<PickerModule> | undefined;
    let sdk: Promise<SdkModule> | undefined;
    const loadPicker = (): Promise<PickerModule> =>
        (picker ??= load(`${base}/assets/sofinder-picker.js`)
            .then((module) => {
                if (!hasFunction(module, 'openPicker'))
                    throw new TypeError('SoFinder picker module is invalid.');
                return module as unknown as PickerModule;
            })
            .catch((error: unknown) => {
                picker = undefined;
                throw error;
            }));
    const loadSdk = (): Promise<SdkModule> =>
        (sdk ??= load(`${base}/assets/sofinder-sdk.js`)
            .then((module) => {
                if (!hasFunction(module, 'createSoFinderClient'))
                    throw new TypeError('SoFinder SDK module is invalid.');
                return module as unknown as SdkModule;
            })
            .catch((error: unknown) => {
                sdk = undefined;
                throw error;
            }));
    return Object.freeze({
        fileManager: new SoFinderAdapter({
            pick: async (request) => {
                try {
                    return cleanSdkSelection(
                        await (
                            await loadPicker()
                        ).openPicker({
                            baseUrl: `${base}/browser`,
                            kind: request.kind === 'image' ? 'image' : 'file',
                            resource:
                                request.kind === 'image'
                                    ? (options.imageResource ?? 'Images')
                                    : (options.fileResource ?? 'Files'),
                            lockResource: true,
                            tools: 'full',
                            ...(options.language
                                ? { language: options.language }
                                : {}),
                        }),
                    );
                } catch (error: unknown) {
                    if (isCancelled(error)) return null;
                    throw error;
                }
            },
        }),
        upload: new SoFinderUploadAdapter({
            upload: (request: UploadRequest): SoFinderUploadTask => {
                const listeners = new Set<
                    (snapshot: SoFinderUploadSnapshot) => void
                >();
                let cancelled = false;
                let task: SoFinderUploadTask | undefined;
                let unsubscribe: (() => void) | undefined;
                const completion = (async () => {
                    const module = await loadSdk();
                    if (cancelled)
                        throw new DOMException(
                            'Upload cancelled.',
                            'AbortError',
                        );
                    const csrfToken =
                        typeof options.csrfToken === 'function'
                            ? options.csrfToken()
                            : options.csrfToken;
                    if (!csrfToken)
                        throw new TypeError(
                            'A SoFinder CSRF token is required for uploads.',
                        );
                    task = module
                        .createSoFinderClient({
                            apiBase: `${base}/api`,
                            csrfToken,
                            credentials: 'same-origin',
                            chunkThreshold: 1048576,
                            chunkSize: 1048576,
                        })
                        .upload({
                            file: new File([request.file], request.name, {
                                type: request.type,
                            }),
                            resource: options.imageResource ?? 'Images',
                            path: options.uploadPath ?? '',
                            conflictStrategy: 'rename',
                        });
                    unsubscribe = task.subscribe((snapshot) => {
                        for (const listener of listeners) listener(snapshot);
                    });
                    const selected = await task.completion;
                    if (cancelled)
                        throw new DOMException(
                            'Upload cancelled.',
                            'AbortError',
                        );
                    return cleanSdkSelection(selected);
                })()
                    .catch((error: unknown) => {
                        if (isCancelled(error))
                            throw new DOMException(
                                'Upload cancelled.',
                                'AbortError',
                            );
                        throw error;
                    })
                    .finally(() => {
                        unsubscribe?.();
                        listeners.clear();
                    });
                return {
                    completion,
                    cancel: () => {
                        cancelled = true;
                        task?.cancel();
                    },
                    subscribe: (listener) => {
                        listeners.add(listener);
                        return () => listeners.delete(listener);
                    },
                };
            },
        }),
    });
}

function hasFunction(value: unknown, key: string): value is object {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof Reflect.get(value, key) === 'function'
    );
}
function isCancelled(error: unknown): boolean {
    return (
        (error instanceof DOMException && error.name === 'AbortError') ||
        (typeof error === 'object' &&
            error !== null &&
            Reflect.get(error, 'code') === 'upload_canceled')
    );
}

// Official SDK entries may use null for unavailable dimensions or optional metadata.
// Omit null data fields before the strict generic adapter validates the remaining values.
function cleanSdkSelection(value: SoFinderSelection): SoFinderSelection {
    if (typeof value !== 'object' || value === null) return value;
    const result = Object.create(null) as Record<string, unknown>;
    for (const key of [
        'url',
        'name',
        'alt',
        'mimeType',
        'width',
        'height',
        'assetId',
        'metadata',
        'sizes',
        'srcset',
    ]) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor) continue;
        if (!('value' in descriptor))
            throw new TypeError(
                'SoFinder SDK selection must contain data properties.',
            );
        if (key === 'url' || descriptor.value != null)
            result[key] = descriptor.value;
    }
    return result as unknown as SoFinderSelection;
}

/** A failed native import is cached by browsers even after the server recovers. */
function createModuleLoader(
    language?: string,
): (url: string) => Promise<unknown> {
    const failed = new Set<string>();
    return async (url) => {
        const target = failed.has(url)
            ? `${url}?soeditorRetry=${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
            : url;
        try {
            const module: unknown = await import(/* @vite-ignore */ target);
            failed.delete(url);
            return module;
        } catch (cause: unknown) {
            failed.add(url);
            // Probe only on failure. Normal first-use loading still makes one request.
            let status = 0;
            try {
                const response = await fetch(target, {
                    credentials: 'same-origin',
                    cache: 'no-store',
                });
                status = response.status;
                await response.body?.cancel();
            } catch {
                // Transport/CSP failures must remain retryable; never bypass authentication.
            }
            throw new Error(moduleFailureMessage(status, language), { cause });
        }
    };
}

function moduleFailureMessage(status: number, language?: string): string {
    const messages = {
        en: [
            'Please sign in again before opening SoFinder. Save your current edits first.',
            'SoFinder login verification failed or permissions changed. Save your edits, then sign in again or check your permissions.',
            'SoFinder could not load. Please try again.',
        ],
        'zh-CN': [
            '请先保存当前编辑内容，再重新登录后打开 SoFinder。',
            'SoFinder 登录验证失败或权限已变更。请先保存编辑内容，再重新登录或检查权限。',
            'SoFinder 资源暂时无法加载，请重试。',
        ],
        'zh-TW': [
            '請先儲存目前編輯內容，再重新登入後開啟 SoFinder。',
            'SoFinder 登入驗證失敗或權限已變更。請先儲存編輯內容，再重新登入或檢查權限。',
            'SoFinder 資源暫時無法載入，請重試。',
        ],
    } as const;
    const locale = language?.toLowerCase();
    const key =
        locale === 'zh-tw' || locale === 'zh-hant' || locale === 'zh-hk'
            ? 'zh-TW'
            : locale?.startsWith('zh')
              ? 'zh-CN'
              : 'en';
    return messages[key][status === 401 ? 0 : status === 403 ? 1 : 2];
}
