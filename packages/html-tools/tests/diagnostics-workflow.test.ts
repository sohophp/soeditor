import { Editor } from '@soeditor/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    DiagnosticsPlugin,
    diagnosticsServiceToken,
    type Diagnostic,
    type DiagnosticsSnapshot,
} from '../src/index.js';

afterEach(() => vi.useRealTimers());

describe('diagnostics workflow', () => {
    it('keeps manual validation as the default', async () => {
        const editor = await Editor.create({ plugins: [DiagnosticsPlugin] });
        const service = editor.services.get(diagnosticsServiceToken);
        expect(service.snapshot.status).toBe('idle');

        editor.setData('<img>');
        await Promise.resolve();
        expect(service.snapshot.status).toBe('idle');
    });

    it('debounces rapid changes and validates only the latest source', async () => {
        vi.useFakeTimers();
        const seen: string[] = [];
        const editor = await Editor.create({
            plugins: [DiagnosticsPlugin],
            config: {
                htmlTools: {
                    diagnostics: {
                        validation: { mode: 'debounced', delay: 20 },
                    },
                },
            },
        });
        const service = editor.services.get(diagnosticsServiceToken);
        service.register({
            id: 'example.seen',
            provide: (source) => {
                seen.push(source);
                return [];
            },
        });

        editor.setData('first');
        editor.setData('second');
        await vi.advanceTimersByTimeAsync(19);
        expect(seen).toEqual([]);
        await vi.advanceTimersByTimeAsync(1);
        expect(seen).toEqual(['second']);
        expect(service.snapshot.status).toBe('ready');
    });

    it('finishes independent providers concurrently and preserves registration order', async () => {
        const editor = await Editor.create({ plugins: [DiagnosticsPlugin] });
        const service = editor.services.get(diagnosticsServiceToken);
        let resolveFirst:
            ((diagnostics: readonly Diagnostic[]) => void) | undefined;
        service.register({
            id: 'example.first',
            provide: () =>
                new Promise((resolve) => {
                    resolveFirst = resolve;
                }),
        });
        service.register({
            id: 'example.failure',
            provide: () => Promise.reject(new Error('isolated')),
        });
        service.register({
            id: 'example.last',
            provide: () => [
                { code: 'last', message: 'last', severity: 'info' },
            ],
        });

        const validation = service.validate();
        await vi.waitFor(() => expect(resolveFirst).toBeTypeOf('function'));
        resolveFirst?.([
            { code: 'first', message: 'first', severity: 'warning' },
        ]);
        await validation;

        expect(service.problems.map(({ code }) => code)).toEqual([
            'first',
            'last',
        ]);
        expect(service.failures).toEqual([
            expect.objectContaining({ provider: 'example.failure' }),
        ]);
    });

    it('provides immutable filtered problems and stable counts', async () => {
        const editor = await Editor.create({ plugins: [DiagnosticsPlugin] });
        const service = editor.services.get(diagnosticsServiceToken);
        service.register({
            id: 'example.mixed',
            provide: () => [
                { code: 'one', message: 'one', severity: 'error' },
                { code: 'two', message: 'two', severity: 'warning' },
            ],
        });
        await service.validate();

        const errors = service.getProblems({ severities: ['error'] });
        expect(errors.map(({ code }) => code)).toEqual(['one']);
        expect(Object.isFrozen(errors)).toBe(true);
        expect(service.getCounts()).toEqual({
            total: 2,
            byProvider: { 'example.mixed': 2 },
            bySeverity: { error: 1, warning: 1, info: 0, hint: 0 },
        });
        expect(service.getCounts({ providers: ['missing'] }).total).toBe(0);
        expect(() =>
            service.getProblems({ severities: ['fatal' as 'error'] }),
        ).toThrow('supported severities');
    });

    it('publishes observable validating and ready snapshots', async () => {
        const editor = await Editor.create({ plugins: [DiagnosticsPlugin] });
        const service = editor.services.get(diagnosticsServiceToken);
        const snapshots: DiagnosticsSnapshot[] = [];
        const dispose = service.subscribe((snapshot) =>
            snapshots.push(snapshot),
        );

        await service.validate();
        dispose();
        await service.validate();

        expect(snapshots.map(({ status }) => status)).toEqual([
            'validating',
            'ready',
        ]);
        expect(snapshots.every(Object.isFrozen)).toBe(true);
    });

    it('suppresses publication when a provider is unregistered during validation', async () => {
        const editor = await Editor.create({ plugins: [DiagnosticsPlugin] });
        const service = editor.services.get(diagnosticsServiceToken);
        const baseline = await service.validate();
        let resolvePending:
            ((diagnostics: readonly Diagnostic[]) => void) | undefined;
        const unregister = service.register({
            id: 'example.pending',
            provide: () =>
                new Promise((resolve) => {
                    resolvePending = resolve;
                }),
        });
        const validation = service.validate();
        await vi.waitFor(() => expect(resolvePending).toBeTypeOf('function'));
        unregister();
        resolvePending?.([
            { code: 'stale', message: 'stale', severity: 'error' },
        ]);
        await validation;

        expect(service.problems).toBe(baseline);
    });

    it('cancels owned automatic work during destruction', async () => {
        vi.useFakeTimers();
        let calls = 0;
        const editor = await Editor.create({
            plugins: [DiagnosticsPlugin],
            config: {
                htmlTools: {
                    diagnostics: {
                        validation: { mode: 'debounced', delay: 10 },
                    },
                },
            },
        });
        editor.services.get(diagnosticsServiceToken).register({
            id: 'example.calls',
            provide: () => {
                calls += 1;
                return [];
            },
        });
        await editor.destroy();
        await vi.runAllTimersAsync();
        expect(calls).toBe(0);
    });

    it('rejects malformed automatic validation policy', async () => {
        await expect(
            Editor.create({
                plugins: [DiagnosticsPlugin],
                config: {
                    htmlTools: {
                        diagnostics: {
                            validation: { mode: 'debounced', delay: -1 },
                        },
                    },
                },
            }),
        ).rejects.toThrow('integer from 0 to 60000');
    });
});
