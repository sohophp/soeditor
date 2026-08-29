import { Editor } from '@soeditor/core';
import { describe, expect, it, vi } from 'vitest';

import {
    VisualDecorationsPlugin,
    visualDecorationsServiceToken,
    type VisualDecoration,
} from '../src/index.js';

const decoration: VisualDecoration = {
    from: { block: 0, offset: 1 },
    id: 'comments.thread-1',
    label: 'Comment',
    status: 'active',
    to: { block: 0, offset: 3 },
};

describe('VisualDecorationsPlugin', () => {
    it('owns immutable per-editor decoration snapshots and notifications', async () => {
        const editor = await Editor.create({
            data: '<p>Test</p>',
            plugins: [VisualDecorationsPlugin],
        });
        const service = editor.services.get(visualDecorationsServiceToken);
        const listener = vi.fn();
        const dispose = service.subscribe(listener);

        service.replace('comments', [decoration]);

        expect(service.snapshot).toEqual([decoration]);
        expect(Object.isFrozen(service.snapshot)).toBe(true);
        expect(Object.isFrozen(service.snapshot[0]?.from)).toBe(true);
        expect(listener).toHaveBeenCalledOnce();

        dispose();
        service.clear('comments');
        expect(service.snapshot).toEqual([]);
        expect(listener).toHaveBeenCalledOnce();
        await editor.destroy();
    });

    it('rejects malformed, duplicate, empty, and unbounded ranges atomically', async () => {
        const editor = await Editor.create({
            data: '<p>Test</p>',
            plugins: [VisualDecorationsPlugin],
        });
        const service = editor.services.get(visualDecorationsServiceToken);
        service.replace('comments', [decoration]);

        expect(() =>
            service.replace('comments', [decoration, decoration]),
        ).toThrow(/duplicated/u);
        service.replace('other-owner', [
            { ...decoration, id: 'other-decoration' },
        ]);
        expect(() =>
            service.replace('comments', [
                { ...decoration, id: 'other-decoration' },
            ]),
        ).toThrow(/another owner/u);
        expect(() =>
            service.replace('comments', [
                { ...decoration, to: decoration.from },
            ]),
        ).toThrow(/must not be empty/u);
        expect(() =>
            service.replace(
                'comments',
                Array.from({ length: 1001 }, (_, index) => ({
                    ...decoration,
                    id: `comments.${String(index)}`,
                })),
            ),
        ).toThrow(/limited to 1000/u);
        expect(service.snapshot).toHaveLength(2);
        expect(service.snapshot[0]).toEqual(decoration);
        await editor.destroy();
    });
});
