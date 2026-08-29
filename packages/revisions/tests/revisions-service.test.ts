import { Editor } from '@soeditor/core';
import { describe, expect, it } from 'vitest';

import {
    type RevisionMetadata,
    type RevisionSnapshot,
    type RevisionStorage,
} from '../src/index.js';
import { RevisionsController } from '../src/revisions-service.js';

const oldRevision: RevisionSnapshot = {
    author: { id: 'author-1', name: 'Editor' },
    createdAt: 10,
    format: 'html',
    id: 'revision-1',
    kind: 'saved',
    label: 'Published',
    source: '<p>Old</p>',
};

describe('RevisionsController', () => {
    it('lists, views, compares, saves, and explicitly restores host revisions', async () => {
        const editor = await Editor.create({ data: '<p>Current</p>' });
        const revisions: RevisionSnapshot[] = [oldRevision];
        let sequence = 2;
        const storage: RevisionStorage = {
            erase: async (id) => {
                const index = revisions.findIndex((item) => item.id === id);
                if (index >= 0) revisions.splice(index, 1);
            },
            list: async () => revisions,
            load: async (id) => revisions.find((item) => item.id === id)!,
            save: async (input) => {
                const revision: RevisionSnapshot = {
                    ...input,
                    createdAt: 20,
                    id: `revision-${String(sequence++)}`,
                };
                revisions.push(revision);
                return revision;
            },
        };
        const controller = new RevisionsController(editor, {
            author: () => ({ id: 'author-2', name: 'Reviewer' }),
            permissions: { can: () => true },
            provider: storage,
            storage,
        });
        await controller.init();
        const service = controller.service;

        await service.view('revision-1');
        expect(editor.getData()).toBe('<p>Current</p>');
        expect(service.snapshot.viewing).toBe('revision');
        expect(service.snapshot.comparison?.equivalent).toBe(false);

        const saved = await service.save('draft', 'Autosave');
        expect(saved.kind).toBe('draft');
        expect(service.snapshot.revisions[0]?.id).toBe(saved.id);
        const exported = await service.exportData();
        expect(exported.schema).toBe('soeditor.revisions');
        expect(exported.version).toBe(1);
        expect(exported.revisions).toHaveLength(2);
        expect(Object.isFrozen(exported.revisions)).toBe(true);
        await service.erase(saved.id);
        expect(service.snapshot.revisions).toHaveLength(1);
        expect(revisions).toHaveLength(1);

        let restoreMetadata: unknown;
        editor.events.on('document:change', ({ transaction }) => {
            restoreMetadata = transaction.getMeta('soeditor.revisions.restore');
        });
        await service.restore('revision-1');
        expect(editor.getData()).toBe('<p>Old</p>');
        expect(editor.state.dirty).toBe(true);
        expect(restoreMetadata).toBe('revision-1');
        expect(service.snapshot.viewing).toBe('current');

        controller.destroy();
        await editor.destroy();
    });

    it('enforces edit, comments-only, and readonly content policy', async () => {
        const editor = await Editor.create({ data: '<p>Current</p>' });
        const controller = new RevisionsController(editor, {
            author: () => ({ id: 'author', name: 'Author' }),
            initialPolicy: 'comments-only',
            permissions: { can: () => true },
            provider: provider([oldRevision]),
        });
        await controller.init();
        const service = controller.service;

        expect(editor.state.readonly).toBe(true);
        await expect(service.restore('revision-1')).rejects.toThrow(
            'not permitted',
        );
        await expect(service.save('draft', 'No storage')).rejects.toThrow(
            'not permitted',
        );
        service.setPolicy('edit');
        expect(editor.state.readonly).toBe(false);
        service.setPolicy('readonly');
        expect(editor.state.readonly).toBe(true);

        controller.destroy();
        await editor.destroy();
    });

    it('ignores a stale view result when a newer request wins', async () => {
        const editor = await Editor.create({ data: '<p>Current</p>' });
        const resolvers = new Map<string, (value: RevisionSnapshot) => void>();
        const controller = new RevisionsController(editor, {
            author: () => ({ id: 'author', name: 'Author' }),
            permissions: { can: () => true },
            provider: {
                list: async () => [
                    { ...oldRevision, id: 'first' },
                    { ...oldRevision, id: 'second' },
                ],
                load: (id) =>
                    new Promise((resolve) => resolvers.set(id, resolve)),
            },
        });
        await controller.init();
        const first = controller.service.view('first');
        const second = controller.service.view('second');
        resolvers.get('second')?.({
            ...oldRevision,
            id: 'second',
            label: 'Second',
        });
        await second;
        resolvers.get('first')?.({
            ...oldRevision,
            id: 'first',
            label: 'First',
        });
        await first;

        expect(controller.service.snapshot.revision?.id).toBe('second');
        controller.destroy();
        await editor.destroy();
    });

    it('keeps provider failures observable and rejects incompatible formats', async () => {
        const editor = await Editor.create({ data: '<p>Current</p>' });
        const failure = new Error('offline');
        const controller = new RevisionsController(editor, {
            author: () => ({ id: 'author', name: 'Author' }),
            permissions: { can: () => true },
            provider: {
                list: async () => [
                    { ...oldRevision, id: 'failure' },
                    { ...oldRevision, id: 'markdown' },
                ],
                load: async (id) => {
                    if (id === 'failure') throw failure;
                    return { ...oldRevision, format: 'markdown', id };
                },
            },
        });
        await controller.init();

        await expect(controller.service.view('failure')).rejects.toBe(failure);
        expect(controller.service.snapshot.error).toBe(failure);
        await expect(controller.service.restore('markdown')).rejects.toThrow(
            'uses markdown, not html',
        );
        expect(editor.getData()).toBe('<p>Current</p>');

        controller.destroy();
        await editor.destroy();
    });

    it('exposes storage failures and makes retained services terminal', async () => {
        const editor = await Editor.create({ data: '<p>Current</p>' });
        const failure = new Error('save failed');
        const controller = new RevisionsController(editor, {
            author: () => ({ id: 'author', name: 'Author' }),
            permissions: { can: () => true },
            provider: provider([oldRevision]),
            storage: {
                ...provider([oldRevision]),
                save: async () => {
                    throw failure;
                },
            },
        });
        await controller.init();
        const service = controller.service;

        await expect(service.save('saved', 'Publish')).rejects.toBe(failure);
        expect(service.snapshot.error).toBe(failure);
        controller.destroy();
        expect(() => service.setPolicy('edit')).toThrow('destroyed');
        await expect(service.view('revision-1')).rejects.toThrow('destroyed');
        await editor.destroy();
    });

    it('prevents UI-accessible policy elevation when the host denies it', async () => {
        const editor = await Editor.create({ data: '<p>Current</p>' });
        const controller = new RevisionsController(editor, {
            author: () => ({ id: 'reviewer', name: 'Reviewer' }),
            initialPolicy: 'readonly',
            permissions: {
                can: ({ action, nextPolicy }) =>
                    action !== 'set-policy' || nextPolicy !== 'edit',
            },
            provider: provider([oldRevision]),
        });
        await controller.init();

        expect(() => controller.service.setPolicy('edit')).toThrow(
            'not permitted',
        );
        expect(controller.service.snapshot.policy).toBe('readonly');
        expect(editor.state.readonly).toBe(true);
        controller.destroy();
        await editor.destroy();
    });

    it('requires erasure support and keeps governance failures observable', async () => {
        const editor = await Editor.create({ data: '<p>Current</p>' });
        const failure = new Error('erase failed');
        const controller = new RevisionsController(editor, {
            author: () => ({ id: 'owner', name: 'Owner' }),
            permissions: { can: () => true },
            provider: provider([oldRevision]),
            storage: {
                ...provider([oldRevision]),
                erase: async () => {
                    throw failure;
                },
                save: async () => oldRevision,
            },
        });
        await controller.init();

        await expect(controller.service.erase('revision-1')).rejects.toBe(
            failure,
        );
        expect(controller.service.snapshot.error).toBe(failure);
        expect(controller.service.snapshot.revisions).toHaveLength(1);
        controller.destroy();
        await editor.destroy();

        const secondEditor = await Editor.create({ data: '<p>Current</p>' });
        const withoutErasure = new RevisionsController(secondEditor, {
            author: () => ({ id: 'owner', name: 'Owner' }),
            permissions: { can: () => true },
            provider: provider([oldRevision]),
        });
        await withoutErasure.init();
        expect(withoutErasure.service.can('erase', 'revision-1')).toBe(false);
        withoutErasure.destroy();
        await secondEditor.destroy();
    });

    it('does not resurrect erased metadata from an older refresh', async () => {
        const editor = await Editor.create({ data: '<p>Current</p>' });
        let resolveRefresh:
            ((value: readonly RevisionMetadata[]) => void) | undefined;
        let listCount = 0;
        const revisions = [oldRevision];
        const controller = new RevisionsController(editor, {
            author: () => ({ id: 'owner', name: 'Owner' }),
            permissions: { can: () => true },
            provider: {
                list: () => {
                    listCount += 1;
                    return listCount === 1
                        ? Promise.resolve(revisions)
                        : new Promise((resolve) => {
                              resolveRefresh = resolve;
                          });
                },
                load: async () => oldRevision,
            },
            storage: {
                erase: async () => undefined,
                list: async () => revisions,
                load: async () => oldRevision,
                save: async () => oldRevision,
            },
        });
        await controller.init();

        const staleRefresh = controller.service.refresh();
        await controller.service.erase('revision-1');
        resolveRefresh?.([oldRevision]);
        await staleRefresh;
        expect(controller.service.snapshot.revisions).toEqual([]);

        controller.destroy();
        await editor.destroy();
    });
});

function provider(revisions: readonly RevisionSnapshot[]): {
    list(): Promise<readonly RevisionMetadata[]>;
    load(id: string): Promise<RevisionSnapshot>;
} {
    return {
        list: async () => revisions,
        load: async (id) => revisions.find((revision) => revision.id === id)!,
    };
}
