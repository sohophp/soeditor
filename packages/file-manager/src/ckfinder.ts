import type {
    FileManager,
    FileManagerResult,
    FileManagerOpenOptions,
} from './file-manager.js';
import type { UploadService, UploadProgress, UploadRequest } from './upload.js';
import { normalizeFileManagerResult } from './validation.js';

interface CKFile {
    getUrl(): string;
    get(name: string): unknown;
}
interface CKFinderInstance {
    on(
        name: string,
        callback: (event: {
            data: { files: { first(): CKFile }; resizedUrl?: string };
        }) => void,
    ): void;
}
export interface CKFinderBrowserSdk {
    modal(options: {
        chooseFiles: boolean;
        resourceType: string;
        onInit(instance: CKFinderInstance): void;
    }): void;
}
export interface CKFinderBrowserOptions {
    readonly scriptUrl: string;
    readonly connectorUrl: string;
    readonly imageResource?: string;
    readonly fileResource?: string;
    readonly csrfCookieName?: string;
    readonly loadSdk?: () => Promise<CKFinderBrowserSdk>;
}
export interface CKFinderBrowserAdapters {
    readonly fileManager: FileManager;
    readonly upload: UploadService;
}

const scripts = new Map<string, Promise<CKFinderBrowserSdk>>();
function loadSdk(url: string): Promise<CKFinderBrowserSdk> {
    const current: unknown = Reflect.get(globalThis, 'CKFinder');
    if (
        (typeof current === 'object' || typeof current === 'function') &&
        current !== null &&
        typeof Reflect.get(current, 'modal') === 'function'
    )
        return Promise.resolve(current as CKFinderBrowserSdk);
    const existing = scripts.get(url);
    if (existing) return existing;
    const promise = new Promise<CKFinderBrowserSdk>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.onload = () => {
            const sdk: unknown = Reflect.get(globalThis, 'CKFinder');
            if (
                (typeof sdk === 'object' || typeof sdk === 'function') &&
                sdk !== null &&
                typeof Reflect.get(sdk, 'modal') === 'function'
            )
                resolve(sdk as CKFinderBrowserSdk);
            else reject(new TypeError('CKFinder SDK did not initialize.'));
        };
        script.onerror = () => {
            script.remove();
            reject(new Error('CKFinder SDK failed to load.'));
        };
        document.head.append(script);
    }).catch((error: unknown) => {
        scripts.delete(url);
        throw error;
    });
    scripts.set(url, promise);
    return promise;
}

/** Optional compatibility adapter. CKFinder remains external and keeps its original auth/URLs. */
export function createCKFinderBrowserAdapters(
    options: CKFinderBrowserOptions,
): CKFinderBrowserAdapters {
    let pending = false;
    return Object.freeze({
        fileManager: {
            async open(request: FileManagerOpenOptions) {
                const sdk = await (options.loadSdk?.() ??
                    loadSdk(options.scriptUrl));
                if (pending || document.getElementById('ckf-modal-body'))
                    throw new Error('Close the existing file picker first.');
                pending = true;
                return new Promise<FileManagerResult | null>(
                    (resolve, reject) => {
                        let modal: Element | null = null;
                        let settled = false;
                        const finish = (
                            value: FileManagerResult | null,
                            error?: unknown,
                        ): void => {
                            if (settled) return;
                            settled = true;
                            observer.disconnect();
                            pending = false;
                            if (error) reject(error);
                            else resolve(value);
                        };
                        const observe = (): void => {
                            modal ??= document.getElementById('ckf-modal-body');
                            if (modal && !modal.isConnected) finish(null);
                        };
                        const observer = new MutationObserver(observe);
                        observer.observe(document.body, {
                            childList: true,
                            subtree: true,
                        });
                        try {
                            sdk.modal({
                                chooseFiles: true,
                                resourceType:
                                    request.kind === 'image'
                                        ? (options.imageResource ?? 'Images')
                                        : (options.fileResource ?? 'Files'),
                                onInit: (finder) => {
                                    finder.on('files:choose', (event) => {
                                        try {
                                            const file =
                                                event.data.files.first();
                                            const name = file.get('name');
                                            finish(
                                                normalizeFileManagerResult({
                                                    url: file.getUrl(),
                                                    ...(typeof name === 'string'
                                                        ? { name }
                                                        : {}),
                                                }),
                                            );
                                        } catch (error: unknown) {
                                            finish(null, error);
                                        }
                                    });
                                    finder.on(
                                        'file:choose:resizedImage',
                                        (event) => {
                                            try {
                                                finish(
                                                    normalizeFileManagerResult({
                                                        url: event.data
                                                            .resizedUrl,
                                                    }),
                                                );
                                            } catch (error: unknown) {
                                                finish(null, error);
                                            }
                                        },
                                    );
                                },
                            });
                            observe();
                        } catch (error: unknown) {
                            finish(null, error);
                        }
                    },
                );
            },
        },
        upload: {
            create(request: UploadRequest) {
                const xhr = new XMLHttpRequest();
                const listeners = new Set<(progress: UploadProgress) => void>();
                const form = new FormData();
                form.append('upload', request.file, request.name);
                const cookie = options.csrfCookieName ?? 'ckCsrfToken';
                if (!/^[A-Za-z][\w-]*$/u.test(cookie))
                    throw new TypeError('Invalid CKFinder CSRF cookie name.');
                let token = document.cookie
                    .split('; ')
                    .find((value) => value.startsWith(`${cookie}=`))
                    ?.slice(cookie.length + 1);
                if (!token) {
                    token = Array.from(
                        crypto.getRandomValues(new Uint8Array(24)),
                        (value) => value.toString(16).padStart(2, '0'),
                    ).join('');
                    document.cookie = `${cookie}=${token}; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
                }
                form.append('ckCsrfToken', decodeURIComponent(token));
                const endpoint = new URL(
                    options.connectorUrl,
                    document.baseURI,
                );
                if (endpoint.origin !== location.origin)
                    throw new TypeError(
                        'CKFinder uploads require a same-origin connector.',
                    );
                endpoint.searchParams.set('command', 'QuickUpload');
                endpoint.searchParams.set(
                    'type',
                    options.imageResource ?? 'Images',
                );
                endpoint.searchParams.set('responseType', 'json');
                const result = new Promise<FileManagerResult>(
                    (resolve, reject) => {
                        xhr.open('POST', endpoint.href);
                        xhr.timeout = 60000;
                        xhr.responseType = 'json';
                        xhr.upload.onprogress = (event) => {
                            for (const listener of listeners)
                                listener({
                                    loaded: event.loaded,
                                    ...(event.lengthComputable
                                        ? { total: event.total }
                                        : {}),
                                });
                        };
                        xhr.onerror = () =>
                            reject(new Error('Upload connection failed.'));
                        xhr.ontimeout = () =>
                            reject(new Error('Upload timed out.'));
                        xhr.onabort = () =>
                            reject(
                                new DOMException(
                                    'Upload cancelled.',
                                    'AbortError',
                                ),
                            );
                        xhr.onload = () => {
                            const value: unknown = xhr.response;
                            try {
                                if (
                                    xhr.status < 200 ||
                                    xhr.status >= 300 ||
                                    typeof value !== 'object' ||
                                    value === null ||
                                    !('uploaded' in value) ||
                                    !value.uploaded ||
                                    !('url' in value) ||
                                    typeof value.url !== 'string'
                                )
                                    throw new Error(
                                        'Upload failed. Check login and file restrictions.',
                                    );
                                const name =
                                    'fileName' in value &&
                                    typeof value.fileName === 'string'
                                        ? value.fileName
                                        : request.name;
                                const selected = normalizeFileManagerResult({
                                    url: value.url,
                                    name,
                                    mime: request.type,
                                });
                                if (!selected)
                                    throw new TypeError(
                                        'Upload returned no asset.',
                                    );
                                resolve(selected);
                            } catch (error: unknown) {
                                reject(error);
                            }
                        };
                        xhr.send(form);
                    },
                ).finally(() => listeners.clear());
                return {
                    result,
                    cancel: () => xhr.abort(),
                    subscribe: (
                        listener: (progress: UploadProgress) => void,
                    ) => {
                        listeners.add(listener);
                        return () => listeners.delete(listener);
                    },
                };
            },
        },
    });
}
