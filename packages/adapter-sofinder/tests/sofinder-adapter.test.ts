import { describe, expect, it } from 'vitest';

import { SoFinderAdapter } from '../src/index.js';

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
                    url: '/sofinder.png',
                    name: 'SoFinder asset',
                    mimeType: 'image/png',
                    width: 800,
                    height: 600,
                    metadata: { assetId: 'asset-7' },
                });
            },
        });

        await expect(adapter.open(request)).resolves.toEqual({
            url: '/sofinder.png',
            name: 'SoFinder asset',
            mime: 'image/png',
            width: 800,
            height: 600,
            metadata: { assetId: 'asset-7' },
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
