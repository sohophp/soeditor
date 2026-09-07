import { describe, expect, it } from 'vitest';

import { SoFinderAdapter, SoFinderUploadAdapter } from '../src/index.js';

const request = Object.freeze({
    accept: Object.freeze(['image/*']),
    kind: 'image' as const,
    multiple: false as const,
});

describe('SoFinderAdapter', () => {
    it('maps the injected picker contract without a SoFinder dependency', async () => {
        const seen: unknown[] = [];
        const adapter = new SoFinderAdapter({
            pick: (options) => {
                seen.push(options);
                return Promise.resolve({
                    assetId: 'asset-7',
                    url: '/sofinder.png',
                    name: 'SoFinder asset',
                    mimeType: 'image/png',
                    width: 800,
                    height: 600,
                    metadata: { assetId: 'asset-7' },
                    sizes: '(max-width: 800px) 100vw, 800px',
                    srcset: '/sofinder-400.png 400w, /sofinder.png 800w',
                });
            },
        });

        await expect(adapter.open(request)).resolves.toEqual({
            assetId: 'asset-7',
            url: '/sofinder.png',
            name: 'SoFinder asset',
            mime: 'image/png',
            width: 800,
            height: 600,
            metadata: { assetId: 'asset-7' },
            sizes: '(max-width: 800px) 100vw, 800px',
            srcset: '/sofinder-400.png 400w, /sofinder.png 800w',
        });
        expect(seen).toEqual([request]);
    });

    it('preserves cancellation and validates picker output', async () => {
        const cancelled = new SoFinderAdapter({
            pick: () => Promise.resolve(null),
        });
        await expect(cancelled.open(request)).resolves.toBeNull();

        const unsafe = new SoFinderAdapter({
            pick: () => Promise.resolve({ url: 'javascript:alert(1)' }),
        });
        await expect(unsafe.open(request)).rejects.toThrow('forbidden scheme');
    });

    it('requires an explicit picker function', () => {
        expect(
            () =>
                new SoFinderAdapter({
                    pick: undefined as unknown as () => Promise<null>,
                }),
        ).toThrow('pick function');
    });

    it('rejects an options accessor without invoking it', () => {
        let invoked = false;
        const options = Object.defineProperty({}, 'pick', {
            get: () => {
                invoked = true;
                return () => Promise.resolve(null);
            },
        });
        expect(() => new SoFinderAdapter(options as never)).toThrow(
            'data property',
        );
        expect(invoked).toBe(false);
    });
});

describe('SoFinderUploadAdapter', () => {
    it('maps completion, progress, and cancellation without an SDK dependency', async () => {
        let cancelled = false;
        let progressListener:
            ((snapshot: { progress: number }) => void) | undefined;
        const seen: unknown[] = [];
        const adapter = new SoFinderUploadAdapter({
            upload: (uploadRequest) => {
                seen.push(uploadRequest);
                return {
                    cancel: () => {
                        cancelled = true;
                    },
                    completion: Promise.resolve({
                        alt: 'Uploaded image',
                        height: 600,
                        metadata: { assetId: 'asset-9', resource: 'Images' },
                        mimeType: 'image/png',
                        name: 'upload.png',
                        url: '/upload.png',
                        width: 800,
                    }),
                    subscribe: (listener) => {
                        progressListener = listener;
                        return () => {
                            progressListener = undefined;
                        };
                    },
                };
            },
        });
        const uploadRequest = Object.freeze({
            attempt: 1,
            file: new Blob(['image'], { type: 'image/png' }),
            kind: 'image' as const,
            name: 'upload.png',
            size: 5,
            type: 'image/png',
        });

        const task = adapter.create(uploadRequest);
        const progress: unknown[] = [];
        const unsubscribe = task.subscribe((snapshot) =>
            progress.push(snapshot),
        );
        progressListener?.({ progress: 40 });
        task.cancel();

        await expect(task.result).resolves.toEqual({
            alt: 'Uploaded image',
            height: 600,
            metadata: { assetId: 'asset-9', resource: 'Images' },
            mime: 'image/png',
            name: 'upload.png',
            url: '/upload.png',
            width: 800,
        });
        expect(seen).toEqual([uploadRequest]);
        expect(progress).toEqual([{ loaded: 40, total: 100 }]);
        expect(cancelled).toBe(true);
        unsubscribe();
        expect(progressListener).toBeUndefined();
    });

    it('rejects malformed progress and unsafe completion data', async () => {
        let progressListener:
            ((snapshot: { progress: number }) => void) | undefined;
        const adapter = new SoFinderUploadAdapter({
            upload: () => ({
                cancel: () => undefined,
                completion: Promise.resolve({ url: 'javascript:alert(1)' }),
                subscribe: (listener) => {
                    progressListener = listener;
                    return () => undefined;
                },
            }),
        });
        const task = adapter.create({
            attempt: 1,
            file: new Blob(['x']),
            kind: 'image',
            name: 'x.png',
            size: 1,
            type: 'image/png',
        });
        task.subscribe(() => undefined);

        expect(() => progressListener?.({ progress: 101 })).toThrow(
            'between 0 and 100',
        );
        await expect(task.result).rejects.toThrow('forbidden scheme');
    });
});
