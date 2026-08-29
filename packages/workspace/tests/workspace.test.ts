import { Editor } from '@soeditor/core';
import { describe, expect, it, vi } from 'vitest';

import {
    createEditorWorkspace,
    WorkspaceDestroyedError,
    WorkspaceNotReadyError,
    WorkspaceRecoveryLimitError,
    WorkspaceValuePolicyError,
    type WorkspaceAttachmentFactory,
} from '../src/index.js';

describe('EditorWorkspace', () => {
    it('mounts explicit attachments and destroys them in reverse order', async () => {
        const events: string[] = [];
        const onChange = vi.fn();
        const workspace = await createEditorWorkspace({
            attachments: [
                attachment('visual', events),
                attachment('ui', events),
            ],
            createEditor: async ({ source }) => {
                events.push('create-editor');
                const editor = await Editor.create({ data: source });
                editor.events.on('editor:destroy', () =>
                    events.push('destroy-editor'),
                );
                return editor;
            },
            value: {
                initialValue: '<p>Initial</p>',
                kind: 'uncontrolled',
                onChange,
            },
        });

        workspace.editor.setData('<p>Changed</p>');
        await Promise.resolve();
        expect(onChange).toHaveBeenCalledWith({
            origin: 'source',
            previousSource: '<p>Initial</p>',
            source: '<p>Changed</p>',
        });
        expect(workspace.snapshot.lastKnownSource).toBe('<p>Changed</p>');
        expect(() => workspace.setValue('<p>External</p>')).toThrow(
            WorkspaceValuePolicyError,
        );

        const firstDestroy = workspace.destroy();
        expect(workspace.destroy()).toBe(firstDestroy);
        await firstDestroy;
        expect(events).toEqual([
            'create-editor',
            'attach-visual-0',
            'attach-ui-0',
            'destroy-ui',
            'destroy-visual',
            'destroy-editor',
        ]);
        expect(workspace.snapshot.status).toBe('destroyed');
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(() => workspace.editor).toThrow(WorkspaceDestroyedError);
    });

    it('applies controlled values without feedback or reentrant dispatch', async () => {
        const changes: string[] = [];
        const workspace = await createEditorWorkspace({
            createEditor: ({ source }) => Editor.create({ data: source }),
            value: {
                kind: 'controlled',
                onChange: ({ source }) => {
                    changes.push(source);
                    workspace?.setValue('<p>Parent accepted</p>');
                },
                value: '<p>Initial</p>',
            },
        });

        workspace.setValue('<p>External</p>');
        await Promise.resolve();
        expect(changes).toEqual([]);
        workspace.editor.setData('<p>User</p>');
        await Promise.resolve();
        expect(changes).toEqual(['<p>User</p>']);
        expect(workspace.editor.getData()).toBe('<p>Parent accepted</p>');
        await Promise.resolve();
        expect(changes).toHaveLength(1);
        await workspace.destroy();
    });

    it('keeps the latest controlled value authoritative during recovery', async () => {
        let resolveRecovery: ((value: { destroy(): void }) => void) | undefined;
        const onChange = vi.fn();
        const workspace = await createEditorWorkspace({
            attachments: [
                {
                    id: 'async-surface',
                    attach: ({ recovery }) =>
                        recovery === 0
                            ? { destroy: () => {} }
                            : new Promise((resolve) => {
                                  resolveRecovery = resolve;
                              }),
                },
            ],
            createEditor: ({ source }) => Editor.create({ data: source }),
            recovery: { maxRestarts: 2 },
            value: {
                kind: 'controlled',
                onChange,
                value: '<p>Initial</p>',
            },
        });

        const recovery = workspace.reportFailure(new Error('crash'));
        await vi.waitFor(() => expect(resolveRecovery).toBeTypeOf('function'));
        workspace.setValue('<p>Latest owner value</p>');
        resolveRecovery?.({ destroy: () => {} });
        await recovery;

        expect(workspace.editor.getData()).toBe('<p>Latest owner value</p>');
        expect(workspace.snapshot.lastKnownSource).toBe(
            '<p>Latest owner value</p>',
        );
        expect(onChange).not.toHaveBeenCalled();
        await workspace.destroy();
    });

    it('recovers from the last canonical source with explicit recreation', async () => {
        const events: string[] = [];
        const snapshots: string[] = [];
        const workspace = await createEditorWorkspace({
            attachments: [attachment('surface', events)],
            createEditor: ({ recovery, source }) => {
                events.push(`create-${String(recovery)}:${source}`);
                return Editor.create({ data: source });
            },
            recovery: { maxRestarts: 2, now: () => 10_000, windowMs: 1_000 },
            value: { initialValue: '<p>Initial</p>', kind: 'uncontrolled' },
        });
        workspace.subscribe(({ status }) => snapshots.push(status));
        workspace.editor.setData('<p>Unsaved</p>');

        await workspace.reportFailure(new Error('surface crashed'));

        expect(workspace.editor.getData()).toBe('<p>Unsaved</p>');
        expect(workspace.snapshot).toMatchObject({
            error: undefined,
            lastKnownSource: '<p>Unsaved</p>',
            recoveryCount: 1,
            status: 'ready',
        });
        expect(events).toEqual([
            'create-0:<p>Initial</p>',
            'attach-surface-0',
            'destroy-surface',
            'create-1:<p>Unsaved</p>',
            'attach-surface-1',
        ]);
        expect(snapshots).toContain('recovering');
        await workspace.destroy();
    });

    it('becomes observably terminal when the crash-rate limit is reached', async () => {
        const workspace = await createEditorWorkspace({
            createEditor: ({ source }) => Editor.create({ data: source }),
            recovery: { maxRestarts: 1, now: () => 2_000, windowMs: 1_000 },
            value: { initialValue: '<p>Initial</p>', kind: 'uncontrolled' },
        });
        workspace.editor.setData('<p>Preserved</p>');
        await workspace.reportFailure(new Error('first'));

        await expect(
            workspace.reportFailure(new Error('second')),
        ).rejects.toBeInstanceOf(WorkspaceRecoveryLimitError);
        expect(workspace.snapshot).toMatchObject({
            lastKnownSource: '<p>Preserved</p>',
            recoveryCount: 1,
            status: 'failed',
        });
        expect(() => workspace.editor).toThrow(WorkspaceNotReadyError);
        await workspace.destroy();
    });

    it('cleans a partial mount without hiding attachment cleanup failures', async () => {
        const events: string[] = [];
        let editor: Editor | undefined;
        await expect(
            createEditorWorkspace({
                attachments: [
                    attachment('first', events),
                    {
                        id: 'failure',
                        attach: () => {
                            events.push('attach-failure');
                            throw new Error('mount failed');
                        },
                    },
                ],
                createEditor: async ({ source }) => {
                    editor = await Editor.create({ data: source });
                    editor.events.on('editor:destroy', () =>
                        events.push('destroy-editor'),
                    );
                    return editor;
                },
                value: { initialValue: '', kind: 'uncontrolled' },
            }),
        ).rejects.toThrow('mount failed');
        expect(events).toEqual([
            'attach-first-0',
            'attach-failure',
            'destroy-first',
            'destroy-editor',
        ]);
        expect(editor?.getData()).toBe('');
    });

    it('makes a recovery mount failure terminal and preserves source evidence', async () => {
        let createCount = 0;
        const workspace = await createEditorWorkspace({
            createEditor: ({ source }) => {
                createCount += 1;
                if (createCount === 2) throw new Error('restart failed');
                return Editor.create({ data: source });
            },
            recovery: { maxRestarts: 2 },
            value: { initialValue: '<p>Initial</p>', kind: 'uncontrolled' },
        });
        workspace.editor.setData('<p>Unsaved</p>');

        await expect(
            workspace.reportFailure(new Error('crash')),
        ).rejects.toThrow('restart failed');
        expect(workspace.snapshot).toMatchObject({
            lastKnownSource: '<p>Unsaved</p>',
            status: 'failed',
        });
        await workspace.destroy();
    });

    it('reports a final destroyed snapshot and disables unconfigured recovery', async () => {
        const statuses: string[] = [];
        const workspace = await createEditorWorkspace({
            createEditor: ({ source }) => Editor.create({ data: source }),
            value: { initialValue: '<p>Initial</p>', kind: 'uncontrolled' },
        });
        workspace.subscribe(({ status }) => statuses.push(status));

        await expect(workspace.reportFailure('fatal')).rejects.toBe('fatal');
        expect(workspace.snapshot).toMatchObject({
            error: 'fatal',
            lastKnownSource: '<p>Initial</p>',
            status: 'failed',
        });
        await workspace.destroy();
        expect(statuses.at(-1)).toBe('destroyed');
    });

    it('rejects duplicate attachments and incomplete controlled policies', async () => {
        await expect(
            createEditorWorkspace({
                attachments: [
                    { id: 'duplicate', attach: () => ({ destroy: () => {} }) },
                    { id: 'duplicate', attach: () => ({ destroy: () => {} }) },
                ],
                createEditor: ({ source }) => Editor.create({ data: source }),
                value: { initialValue: '', kind: 'uncontrolled' },
            }),
        ).rejects.toThrow('duplicated');
        await expect(
            createEditorWorkspace({
                createEditor: ({ source }) => Editor.create({ data: source }),
                value: {
                    kind: 'controlled',
                    value: '',
                } as never,
            }),
        ).rejects.toThrow('onChange');
    });

    it('aborts and cleans a late recovery attachment during destruction', async () => {
        const events: string[] = [];
        let resolveAttachment:
            ((value: { destroy(): void }) => void) | undefined;
        const workspace = await createEditorWorkspace({
            attachments: [
                {
                    id: 'async-surface',
                    attach: ({ recovery }) => {
                        if (recovery === 0) {
                            return {
                                destroy: () => {
                                    events.push('destroy-initial');
                                },
                            };
                        }
                        return new Promise((resolve) => {
                            resolveAttachment = resolve;
                        });
                    },
                },
            ],
            createEditor: ({ source }) => Editor.create({ data: source }),
            recovery: { maxRestarts: 2 },
            value: { initialValue: '<p>Initial</p>', kind: 'uncontrolled' },
        });

        const recovery = workspace.reportFailure(new Error('crash'));
        await vi.waitFor(() =>
            expect(resolveAttachment).toBeTypeOf('function'),
        );
        const destruction = workspace.destroy();
        resolveAttachment?.({
            destroy: () => events.push('destroy-late'),
        });
        await expect(recovery).rejects.toBeInstanceOf(WorkspaceDestroyedError);
        await destruction;
        expect(events).toEqual(['destroy-initial', 'destroy-late']);
        expect(workspace.snapshot.status).toBe('destroyed');
    });
});

function attachment(id: string, events: string[]): WorkspaceAttachmentFactory {
    return {
        id,
        attach: ({ recovery }) => {
            events.push(`attach-${id}-${String(recovery)}`);
            return {
                destroy: () => {
                    events.push(`destroy-${id}`);
                },
            };
        },
    };
}
