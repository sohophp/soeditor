import { describe, expect, it, vi } from 'vitest';
import { createSoFinderBrowserAdapters } from '../src/browser.js';

const request = {
    attempt: 1,
    kind: 'image' as const,
    file: new Blob(['image'], { type: 'image/png' }),
    name: 'original.png',
    size: 5,
    type: 'image/png',
};

describe('optional SoFinder browser adapter', () => {
    it('loads the picker only on use, locks the requested resource and keeps original URLs', async () => {
        const openPicker = vi.fn().mockResolvedValue({
            url: '/site/uploads/original.png',
            name: 'Original',
            mimeType: 'image/png',
            width: 80,
            height: null,
        });
        const loadModule = vi.fn().mockResolvedValue({ openPicker });
        const adapters = createSoFinderBrowserAdapters({
            baseUrl: '/site/sofinder/',
            csrfToken: 'token',
            language: 'zh-TW',
            loadModule,
        });
        expect(loadModule).not.toHaveBeenCalled();
        expect(
            await adapters.fileManager.open({ kind: 'image', multiple: false }),
        ).toEqual({
            url: '/site/uploads/original.png',
            name: 'Original',
            mime: 'image/png',
            width: 80,
        });
        expect(openPicker).toHaveBeenLastCalledWith({
            baseUrl: '/site/sofinder/browser',
            resource: 'Images',
            kind: 'image',
            lockResource: true,
            tools: 'full',
            language: 'zh-TW',
        });
        await adapters.fileManager.open({ kind: 'file', multiple: false });
        expect(openPicker).toHaveBeenLastCalledWith(
            expect.objectContaining({ resource: 'Files', kind: 'file' }),
        );
        expect(loadModule).toHaveBeenCalledTimes(1);
    });
    it('treats picker closing as cancellation, reports errors and retries failed module loading', async () => {
        const openPicker = vi
            .fn()
            .mockRejectedValueOnce(new DOMException('Closed', 'AbortError'))
            .mockRejectedValueOnce(new Error('Permission denied'));
        const loadModule = vi
            .fn()
            .mockRejectedValueOnce(new Error('SDK unavailable'))
            .mockResolvedValue({ openPicker });
        const adapters = createSoFinderBrowserAdapters({
            baseUrl: '/finder',
            csrfToken: 'token',
            loadModule,
        });
        await expect(
            adapters.fileManager.open({ kind: 'file', multiple: false }),
        ).rejects.toThrow('SDK unavailable');
        expect(
            await adapters.fileManager.open({ kind: 'file', multiple: false }),
        ).toBeNull();
        await expect(
            adapters.fileManager.open({ kind: 'file', multiple: false }),
        ).rejects.toThrow('Permission denied');
        expect(loadModule).toHaveBeenCalledTimes(2);
    });
    it('cancels during lazy loading without starting an upload', async () => {
        let resolve!: (value: unknown) => void;
        const createSoFinderClient = vi.fn();
        const adapters = createSoFinderBrowserAdapters({
            baseUrl: '/finder',
            csrfToken: 'token',
            loadModule: () =>
                new Promise((done) => {
                    resolve = done;
                }),
        });
        const task = adapters.upload.create(request);
        const completion = expect(task.result).rejects.toMatchObject({
            name: 'AbortError',
        });
        task.cancel();
        resolve({ createSoFinderClient });
        await completion;
        expect(createSoFinderClient).not.toHaveBeenCalled();
    });
    it('maps CSRF, upload names, progress, completion and subscription cleanup', async () => {
        let progress!: (value: { progress: number }) => void;
        let resolve!: (value: unknown) => void;
        const unsubscribe = vi.fn();
        const cancel = vi.fn();
        const upload = vi.fn().mockReturnValue({
            completion: new Promise((done) => {
                resolve = done;
            }),
            cancel,
            subscribe: (listener: typeof progress) => {
                progress = listener;
                return unsubscribe;
            },
        });
        const createSoFinderClient = vi.fn().mockReturnValue({ upload });
        const adapters = createSoFinderBrowserAdapters({
            baseUrl: '/finder',
            csrfToken: () => 'current-token',
            loadModule: async () => ({ createSoFinderClient }),
        });
        const task = adapters.upload.create(request);
        const listener = vi.fn();
        task.subscribe(listener);
        await vi.waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
        expect(createSoFinderClient).toHaveBeenCalledWith({
            apiBase: '/finder/api',
            csrfToken: 'current-token',
            credentials: 'same-origin',
            chunkSize: 1048576,
            chunkThreshold: 1048576,
        });
        expect(upload.mock.calls[0]?.[0]).toMatchObject({
            resource: 'Images',
            path: '',
            conflictStrategy: 'rename',
        });
        progress({ progress: 42 });
        expect(listener).toHaveBeenCalledWith({ loaded: 42, total: 100 });
        resolve({
            url: '/original/uploads/original.png',
            name: 'original.png',
            mimeType: 'image/png',
        });
        expect(await task.result).toEqual({
            url: '/original/uploads/original.png',
            name: 'original.png',
            mime: 'image/png',
        });
        expect(unsubscribe).toHaveBeenCalledTimes(1);
        progress({ progress: 100 });
        expect(listener).toHaveBeenCalledTimes(1);
    });
    it('rejects missing upload CSRF before creating a client', async () => {
        const createSoFinderClient = vi.fn();
        const adapters = createSoFinderBrowserAdapters({
            baseUrl: '/finder',
            csrfToken: '',
            loadModule: async () => ({ createSoFinderClient }),
        });
        await expect(adapters.upload.create(request).result).rejects.toThrow(
            'CSRF',
        );
        expect(createSoFinderClient).not.toHaveBeenCalled();
    });
    it.each([
        '//external.example/finder',
        'javascript:bad',
        '/finder?x=1',
        '/bad\\path',
    ])('rejects invalid SDK base %s', (baseUrl) => {
        expect(() =>
            createSoFinderBrowserAdapters({ baseUrl, csrfToken: 'token' }),
        ).toThrow('baseUrl');
    });
});
