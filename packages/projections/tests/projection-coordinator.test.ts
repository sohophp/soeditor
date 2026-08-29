import { Editor } from '@soeditor/core';
import { describe, expect, it, vi } from 'vitest';

import {
    IncompatibleProjectionError,
    InvalidProjectionTransitionError,
    ProjectionAlreadyAttachedError,
    ProjectionCoordinatorPlugin,
    projectionCoordinatorServiceToken,
    ProjectionNotAttachedError,
    type ProjectionActivity,
} from '../src/index.js';

describe('ProjectionCoordinatorPlugin', () => {
    it('starts from the compatible editor mode and transfers one primary through commands', async () => {
        const editor = await Editor.create({
            mode: 'source',
            plugins: [ProjectionCoordinatorPlugin],
        });
        const service = editor.services.get(projectionCoordinatorServiceToken);
        const visual: ProjectionActivity[] = [];
        const source: ProjectionActivity[] = [];
        service.attach({ id: 'visual', update: (value) => visual.push(value) });
        service.attach({ id: 'source', update: (value) => source.push(value) });

        expect(service.get('visual')).toMatchObject({
            primary: false,
            readonly: true,
            visible: false,
        });
        expect(service.get('source')).toMatchObject({
            primary: true,
            readonly: false,
            visible: true,
        });
        editor.execute('projection.show', 'visual');
        editor.execute('projection.activate', 'visual');

        expect(editor.state.mode).toBe('visual');
        expect(service.get('visual')).toMatchObject({
            primary: true,
            readonly: false,
            visible: true,
        });
        expect(service.get('source')).toMatchObject({
            primary: false,
            readonly: true,
            visible: true,
        });
        expect(visual.length).toBeGreaterThan(1);
        expect(source.length).toBeGreaterThan(1);
    });

    it('keeps preview visible and readonly without replacing the writer', async () => {
        const editor = await Editor.create({
            plugins: [ProjectionCoordinatorPlugin],
        });
        const service = editor.services.get(projectionCoordinatorServiceToken);
        service.attach({ id: 'visual', update: () => undefined });
        service.attach({ id: 'preview', update: () => undefined });

        editor.execute('projection.show', 'preview');
        expect(service.get('preview')).toMatchObject({
            primary: false,
            readonly: true,
            visible: true,
        });
        expect(service.snapshot.primary).toBe('visual');
        expect(() => editor.execute('projection.activate', 'preview')).toThrow(
            InvalidProjectionTransitionError,
        );
    });

    it('maps external mode changes without hiding persistent projections', async () => {
        const editor = await Editor.create({
            plugins: [ProjectionCoordinatorPlugin],
        });
        const service = editor.services.get(projectionCoordinatorServiceToken);
        service.attach({ id: 'visual', update: () => undefined });
        service.attach({ id: 'source', update: () => undefined });
        service.attach({ id: 'preview', update: () => undefined });
        editor.execute('projection.show', 'source');
        editor.execute('projection.show', 'preview');

        editor.update((transaction) => transaction.setMode('source'));
        expect(service.snapshot.primary).toBe('source');
        expect(service.get('visual').visible).toBe(true);
        expect(service.get('preview').visible).toBe(true);
    });

    it('keeps every projection effectively readonly for a readonly editor', async () => {
        const editor = await Editor.create({
            plugins: [ProjectionCoordinatorPlugin],
            readonly: true,
        });
        const service = editor.services.get(projectionCoordinatorServiceToken);
        service.attach({ id: 'visual', update: () => undefined });
        expect(service.get('visual')).toMatchObject({
            primary: true,
            readonly: true,
        });
    });

    it('rejects invalid transitions and incompatible or duplicate attachments', async () => {
        const editor = await Editor.create({
            plugins: [ProjectionCoordinatorPlugin],
        });
        const service = editor.services.get(projectionCoordinatorServiceToken);
        service.attach({ id: 'visual', update: () => undefined });
        expect(() =>
            service.attach({ id: 'visual', update: () => undefined }),
        ).toThrow(ProjectionAlreadyAttachedError);
        expect(() =>
            service.attach({ id: 'markdown', update: () => undefined }),
        ).toThrow(IncompatibleProjectionError);
        expect(() => editor.execute('projection.show', 'source')).toThrow(
            ProjectionNotAttachedError,
        );
        expect(() => editor.execute('projection.hide', 'visual')).toThrow(
            InvalidProjectionTransitionError,
        );
        expect(() => editor.execute('projection.activate', 'unknown')).toThrow(
            'Unknown projection ID',
        );
    });

    it('rolls back an attachment whose initial adapter update fails', async () => {
        const editor = await Editor.create({
            plugins: [ProjectionCoordinatorPlugin],
        });
        const service = editor.services.get(projectionCoordinatorServiceToken);

        expect(() =>
            service.attach({
                id: 'visual',
                update: () => {
                    throw new Error('initial update failed');
                },
            }),
        ).toThrow('initial update failed');
        expect(service.isAttached('visual')).toBe(false);
        expect(() =>
            service.attach({ id: 'visual', update: () => undefined }),
        ).not.toThrow();
    });

    it('repairs primary ownership and disposes attachment idempotently', async () => {
        const editor = await Editor.create({
            plugins: [ProjectionCoordinatorPlugin],
        });
        const service = editor.services.get(projectionCoordinatorServiceToken);
        const disposeVisual = service.attach({
            id: 'visual',
            update: () => undefined,
        });
        service.attach({ id: 'source', update: () => undefined });
        editor.execute('projection.show', 'source');

        disposeVisual();
        disposeVisual();
        expect(service.snapshot.primary).toBe('source');
        expect(service.get('source').visible).toBe(true);
    });

    it('visits every adapter and listener before reporting notification failures', async () => {
        const editor = await Editor.create({
            plugins: [ProjectionCoordinatorPlugin],
        });
        const service = editor.services.get(projectionCoordinatorServiceToken);
        const laterAdapter = vi.fn();
        const laterListener = vi.fn();
        service.attach({ id: 'visual', update: () => undefined });
        service.attach({
            id: 'source',
            update: (activity) => {
                laterAdapter(activity);
                if (activity.visible) throw new Error('adapter failed');
            },
        });
        service.subscribe(() => {
            throw new Error('listener failed');
        });
        service.subscribe(laterListener);

        expect(() => editor.execute('projection.show', 'source')).toThrow(
            AggregateError,
        );
        expect(laterAdapter).toHaveBeenCalled();
        expect(laterListener).toHaveBeenCalled();
    });

    it('makes retained services terminal after editor destruction', async () => {
        const editor = await Editor.create({
            plugins: [ProjectionCoordinatorPlugin],
        });
        const service = editor.services.get(projectionCoordinatorServiceToken);
        const dispose = service.attach({
            id: 'visual',
            update: () => undefined,
        });
        await editor.destroy();

        expect(() => service.snapshot).toThrow('destroyed');
        expect(() => service.get('visual')).toThrow('destroyed');
        expect(() => service.isAttached('visual')).toThrow('destroyed');
        expect(() => service.subscribe(() => undefined)).toThrow('destroyed');
        expect(() =>
            service.attach({ id: 'visual', update: () => undefined }),
        ).toThrow('destroyed');
        expect(() => dispose()).not.toThrow();
    });
});
