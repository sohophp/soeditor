import { describe, expect, it } from 'vitest';

import {
    InvalidFileManagerResultError,
    normalizeFileManagerResult,
} from '../src/index.js';

describe('file-manager result validation', () => {
    it('freezes a valid result and nested JSON-like metadata', () => {
        const metadata = { folder: { id: 3 }, tags: ['hero', true] };
        const result = normalizeFileManagerResult({
            url: '/image.png',
            name: 'Image',
            width: 640,
            height: 480,
            metadata,
        });

        expect(result).toMatchObject({
            url: '/image.png',
            width: 640,
            height: 480,
        });
        expect(Object.isFrozen(result)).toBe(true);
        expect(Object.isFrozen(result?.metadata)).toBe(true);
        expect(
            Object.isFrozen(
                result?.metadata?.folder as Readonly<Record<string, unknown>>,
            ),
        ).toBe(true);
        expect(Object.isFrozen(result?.metadata?.tags)).toBe(true);
        metadata.folder.id = 7;
        expect(
            (result?.metadata?.folder as Readonly<Record<string, unknown>>).id,
        ).toBe(3);
    });

    it('accepts cancellation and safe data/blob/http/relative URLs', () => {
        expect(normalizeFileManagerResult(null)).toBeNull();
        for (const url of [
            '/relative.png',
            'https://example.test/image.png',
            'data:image/png;base64,AA==',
            'blob:https://example.test/id',
        ]) {
            expect(normalizeFileManagerResult({ url })?.url).toBe(url);
        }
    });

    it.each([
        [{}, 'url'],
        [{ url: 'javascript:alert(1)' }, 'forbidden scheme'],
        [{ url: 'file:///secret' }, 'forbidden scheme'],
        [{ url: '/x\n.png' }, 'control characters'],
        [{ url: '/x', width: 0 }, 'positive safe integer'],
        [{ url: '/x', height: 2.5 }, 'positive safe integer'],
        [{ url: '/x', metadata: new Date() }, 'plain object'],
    ])('rejects malformed result %#', (value, message) => {
        expect(() => normalizeFileManagerResult(value)).toThrow(
            InvalidFileManagerResultError,
        );
        expect(() => normalizeFileManagerResult(value)).toThrow(message);
    });

    it('rejects metadata accessors and cycles without invoking them', () => {
        let invoked = false;
        const metadata: Record<string, unknown> = {};
        Object.defineProperty(metadata, 'secret', {
            enumerable: true,
            get: () => {
                invoked = true;
                return 'secret';
            },
        });
        expect(() =>
            normalizeFileManagerResult({ url: '/x', metadata }),
        ).toThrow('data property');
        expect(invoked).toBe(false);

        const cyclic: Record<string, unknown> = {};
        cyclic.self = cyclic;
        expect(() =>
            normalizeFileManagerResult({ url: '/x', metadata: cyclic }),
        ).toThrow('cycles');
    });

    it('rejects sparse, custom, and excessively deep metadata', () => {
        const sparse = new Array<unknown>(2);
        sparse[0] = 'x';
        expect(() =>
            normalizeFileManagerResult({
                url: '/x',
                metadata: { sparse },
            }),
        ).toThrow('sparse');

        const custom: unknown[] = [];
        Object.defineProperty(custom, 'hidden', { value: true });
        expect(() =>
            normalizeFileManagerResult({
                url: '/x',
                metadata: { custom },
            }),
        ).toThrow('custom properties');

        let nested: Record<string, unknown> = {};
        const root = nested;
        for (let index = 0; index < 40; index += 1) {
            const child: Record<string, unknown> = {};
            nested.child = child;
            nested = child;
        }
        expect(() =>
            normalizeFileManagerResult({ url: '/x', metadata: root }),
        ).toThrow('too deep');
    });

    it('copies __proto__ as inert metadata without prototype mutation', () => {
        const metadata: Record<string, unknown> = {};
        Object.defineProperty(metadata, '__proto__', {
            enumerable: true,
            value: { polluted: true },
        });
        const result = normalizeFileManagerResult({ url: '/x', metadata });
        expect(Object.getPrototypeOf(result?.metadata)).toBeNull();
        expect(result?.metadata?.__proto__).toEqual({ polluted: true });
        expect(Reflect.get({}, 'polluted')).toBeUndefined();
    });
});
