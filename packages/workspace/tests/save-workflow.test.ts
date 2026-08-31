import { Editor } from '@soeditor/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    createEditorSaveWorkflow,
    type EditorSaveRequest,
    type EditorSaveState,
} from '../src/index.js';

afterEach(() => vi.useRealTimers());

describe('editor save workflow', () => {
    it('saves canonical source and advances an opaque revision token', async () => {
        const editor = await Editor.create({ data: '<p>Initial</p>' });
        editor.setData('<p>Changed</p>');
        const requests: EditorSaveRequest[] = [];
        const states: EditorSaveState[] = [];
        const workflow = createEditorSaveWorkflow({
            adapter: {
                save: async (request) => {
                    requests.push(request);
                    request.reportProgress(0.5);
                    return { revisionToken: 'v2', status: 'saved' };
                },
            },
            editor,
            initialRevisionToken: 'v1',
            onStateChange: (state) => states.push(state),
        });

        await expect(workflow.save()).resolves.toEqual({
            revisionToken: 'v2',
            status: 'saved',
        });
        expect(requests[0]).toMatchObject({
            reason: 'manual',
            revisionToken: 'v1',
            source: '<p>Changed</p>',
        });
        expect(editor.state.dirty).toBe(false);
        expect(states).toContainEqual(
            expect.objectContaining({ progress: 0.5, status: 'saving' }),
        );
        expect(workflow.state).toMatchObject({
            dirty: false,
            progress: 1,
            revisionToken: 'v2',
            status: 'saved',
        });
        workflow.destroy();
        await editor.destroy();
    });

    it('never marks a newer edit clean or overlaps saves', async () => {
        const editor = await Editor.create({ data: '<p>Initial</p>' });
        editor.setData('<p>First</p>');
        let finish!: (value: { status: 'saved' }) => void;
        const adapter = vi.fn(
            () =>
                new Promise<{ status: 'saved' }>((resolve) => {
                    finish = resolve;
                }),
        );
        const workflow = createEditorSaveWorkflow({
            adapter: { save: adapter },
            editor,
        });

        const first = workflow.save();
        const same = workflow.save('retry');
        editor.setData('<p>Newer</p>');
        await Promise.resolve();
        finish({ status: 'saved' });
        await expect(first).resolves.toEqual({ status: 'saved' });
        await expect(same).resolves.toEqual({ status: 'saved' });
        expect(adapter).toHaveBeenCalledTimes(1);
        expect(editor.state.dirty).toBe(true);
        expect(workflow.state.status).toBe('idle');
        workflow.destroy();
        await editor.destroy();
    });

    it('reports failure, retries, and preserves conflicts', async () => {
        const editor = await Editor.create({ data: '<p>Initial</p>' });
        editor.setData('<p>Changed</p>');
        const failure = new Error('offline');
        const adapter = vi
            .fn()
            .mockRejectedValueOnce(failure)
            .mockResolvedValueOnce({
                message: 'Server changed',
                revisionToken: 'server-v3',
                source: '<p>Server</p>',
                status: 'conflict',
            });
        const workflow = createEditorSaveWorkflow({
            adapter: { save: adapter },
            editor,
        });

        await expect(workflow.save()).rejects.toBe(failure);
        expect(editor.getData()).toBe('<p>Changed</p>');
        expect(workflow.state).toMatchObject({
            error: failure,
            status: 'error',
        });
        await expect(workflow.retry()).resolves.toMatchObject({
            status: 'conflict',
        });
        expect(editor.getData()).toBe('<p>Changed</p>');
        expect(workflow.state).toMatchObject({
            dirty: true,
            revisionToken: 'server-v3',
            status: 'conflict',
        });
        workflow.destroy();
        await editor.destroy();
    });

    it('debounces autosave and aborts owned work on destruction', async () => {
        vi.useFakeTimers();
        const editor = await Editor.create({ data: '<p>Initial</p>' });
        let request: EditorSaveRequest | undefined;
        const workflow = createEditorSaveWorkflow({
            adapter: {
                save: (value) => {
                    request = value;
                    return new Promise((_resolve, reject) => {
                        value.signal.addEventListener('abort', () =>
                            reject(new DOMException('Aborted', 'AbortError')),
                        );
                    });
                },
            },
            autoSaveDelay: 200,
            editor,
        });

        editor.setData('<p>One</p>');
        editor.setData('<p>Two</p>');
        expect(workflow.state.status).toBe('scheduled');
        await vi.advanceTimersByTimeAsync(200);
        expect(request?.source).toBe('<p>Two</p>');
        workflow.destroy();
        expect(request?.signal.aborted).toBe(true);
        expect(workflow.state.status).toBe('destroyed');
        await editor.destroy();
    });

    it('keeps destruction terminal when an adapter ignores abort', async () => {
        const editor = await Editor.create({ data: '<p>Initial</p>' });
        editor.setData('<p>Dirty</p>');
        let finish!: (value: { status: 'saved' }) => void;
        const workflow = createEditorSaveWorkflow({
            adapter: {
                save: () =>
                    new Promise((resolve) => {
                        finish = resolve;
                    }),
            },
            editor,
        });
        const saving = workflow.save();
        await Promise.resolve();
        workflow.destroy();
        finish({ status: 'saved' });

        await expect(saving).rejects.toMatchObject({ name: 'AbortError' });
        expect(workflow.state.status).toBe('destroyed');
        expect(editor.state.dirty).toBe(true);
        await editor.destroy();
    });

    it('turns synchronous adapter and invalid progress failures into errors', async () => {
        const editor = await Editor.create({ data: '<p>Initial</p>' });
        const synchronous = new Error('synchronous');
        const workflow = createEditorSaveWorkflow({
            adapter: {
                save: () => {
                    throw synchronous;
                },
            },
            editor,
        });
        await expect(workflow.save()).rejects.toBe(synchronous);
        expect(workflow.state.status).toBe('error');
        workflow.destroy();

        const invalid = createEditorSaveWorkflow({
            adapter: {
                save: async (request) => {
                    request.reportProgress(2);
                    return { status: 'saved' };
                },
            },
            editor,
        });
        await expect(invalid.save()).rejects.toThrow('between 0 and 1');
        invalid.destroy();
        await editor.destroy();
    });
});
