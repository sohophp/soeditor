import { Editor } from '@soeditor/core';
import { projectionCoordinatorServiceToken } from '@soeditor/projections';
import { describe, expect, it, vi } from 'vitest';

import {
    IncompatibleSplitViewPairError,
    InvalidSplitViewTransitionError,
    SplitViewAlreadyAttachedError,
    SplitViewDestroyedError,
    SplitViewPlugin,
    splitViewServiceToken,
} from '../src/index.js';

describe('SplitViewPlugin', () => {
    it('opens, resizes, collapses, and restores Visual with command-driven authority', async () => {
        const editor = await Editor.create({ plugins: [SplitViewPlugin] });
        const projections = editor.services.get(
            projectionCoordinatorServiceToken,
        );
        projections.attach({ id: 'visual', update: () => undefined });
        projections.attach({ id: 'source', update: () => undefined });
        const update = vi.fn();
        const focus = vi.fn();
        const service = editor.services.get(splitViewServiceToken);
        service.attach({ focus, supports: () => true, update });

        editor.execute('layout.split.open', 'visual-source');
        editor.execute('layout.split.resize', 65);
        editor.execute('layout.split.orientation', 'vertical');
        expect(service.snapshot).toMatchObject({
            open: true,
            orientation: 'vertical',
            pair: 'visual-source',
            ratio: 65,
        });
        expect(projections.get('source').visible).toBe(true);

        editor.execute('layout.split.collapse', 'visual');
        expect(projections.snapshot.primary).toBe('source');
        expect(projections.get('visual').visible).toBe(false);
        expect(service.snapshot.collapsed).toBe('visual');
        editor.execute('layout.split.restore');
        expect(projections.get('visual').visible).toBe(true);

        editor.execute('layout.split.focus', 'visual');
        expect(projections.snapshot.primary).toBe('visual');
        expect(focus).toHaveBeenCalledWith('visual');
        expect(update).toHaveBeenCalled();
    });

    it('validates format, attachment, ratio, pair membership, and no-writer collapse', async () => {
        const editor = await Editor.create({ plugins: [SplitViewPlugin] });
        const projections = editor.services.get(
            projectionCoordinatorServiceToken,
        );
        projections.attach({ id: 'visual', update: () => undefined });
        projections.attach({ id: 'source', update: () => undefined });
        projections.attach({ id: 'preview', update: () => undefined });
        const service = editor.services.get(splitViewServiceToken);
        service.attach({
            focus: () => undefined,
            supports: () => true,
            update: () => undefined,
        });

        expect(() =>
            editor.execute('layout.split.open', 'markdown-preview'),
        ).toThrow(IncompatibleSplitViewPairError);
        editor.execute('layout.split.open', 'source-preview');
        expect(() => editor.execute('layout.split.resize', 10)).toThrow(
            '20 through 80',
        );
        expect(() => editor.execute('layout.split.collapse', 'visual')).toThrow(
            InvalidSplitViewTransitionError,
        );
        expect(() => editor.execute('layout.split.collapse', 'source')).toThrow(
            'without another writer',
        );
    });

    it('supports Markdown Preview and reversible responsive fallback', async () => {
        const editor = await Editor.create({
            format: 'markdown',
            plugins: [SplitViewPlugin],
        });
        const projections = editor.services.get(
            projectionCoordinatorServiceToken,
        );
        projections.attach({ id: 'markdown', update: () => undefined });
        projections.attach({ id: 'preview', update: () => undefined });
        const attachment = editor.services.get(splitViewServiceToken).attach({
            focus: () => undefined,
            supports: () => true,
            update: () => undefined,
        });

        editor.execute('layout.split.open', 'markdown-preview');
        attachment.setResponsive(true);
        expect(
            editor.services.get(splitViewServiceToken).snapshot,
        ).toMatchObject({
            effectiveOrientation: 'vertical',
            orientation: 'horizontal',
            responsive: true,
        });
        attachment.setResponsive(false);
        expect(
            editor.services.get(splitViewServiceToken).snapshot
                .effectiveOrientation,
        ).toBe('horizontal');
    });

    it('enforces exclusive attachment and terminal retained services', async () => {
        const editor = await Editor.create({ plugins: [SplitViewPlugin] });
        const service = editor.services.get(splitViewServiceToken);
        const attachment = service.attach({
            focus: () => undefined,
            supports: () => true,
            update: () => undefined,
        });
        expect(() =>
            service.attach({
                focus: () => undefined,
                supports: () => true,
                update: () => undefined,
            }),
        ).toThrow(SplitViewAlreadyAttachedError);

        await editor.destroy();
        expect(() => service.snapshot).toThrow(SplitViewDestroyedError);
        expect(() => attachment.setResponsive(true)).toThrow();
        expect(() => attachment.destroy()).not.toThrow();
    });
});
