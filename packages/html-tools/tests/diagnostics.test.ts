import { Editor } from '@soeditor/core';
import { describe, expect, it, vi } from 'vitest';

import {
    DiagnosticProviderAlreadyRegisteredError,
    DiagnosticsPlugin,
    diagnosticsServiceToken,
    type Diagnostic,
    type DiagnosticProvider,
} from '../src/index.js';

describe('HTML diagnostics', () => {
    it('maps parser errors and selected structural warnings to problems', async () => {
        const editor = await Editor.create({
            data: '<div id="same"></div><p id="same"><img src="x"></p><span a="1" a="2"></span>',
            plugins: [DiagnosticsPlugin],
        });

        const problems = await editor.execute('document.validate');
        expect(problems).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    code: 'duplicate-attribute',
                    provider: 'html.parser',
                    severity: 'error',
                    source: expect.any(Object),
                }),
                expect.objectContaining({
                    code: 'html.duplicate-id',
                    provider: 'html.structure',
                    severity: 'warning',
                }),
                expect.objectContaining({
                    code: 'html.image-alt',
                    provider: 'html.structure',
                    severity: 'warning',
                }),
            ]),
        );
        const service = editor.services.get(diagnosticsServiceToken);
        expect(service.problems).toBe(problems);
        expect(Object.isFrozen(problems)).toBe(true);
        expect(Object.isFrozen(service.problems[0])).toBe(true);
    });

    it('warns when a complete document omits root language', async () => {
        const editor = await Editor.create({
            data: '<!doctype html><html><head><title>X</title></head><body></body></html>',
            plugins: [DiagnosticsPlugin],
        });

        const problems = await editor.services
            .get(diagnosticsServiceToken)
            .validate();
        expect(problems).toContainEqual(
            expect.objectContaining({ code: 'html.document-lang' }),
        );
    });

    it('does not diagnose custom, SVG, template, comments, or unsafe attributes merely for existing', async () => {
        const editor = await Editor.create({
            data: '<!--CMS:block--><product-card data-id="1"></product-card><svg><foreignObject><div>SVG</div></foreignObject></svg><template><custom-element></custom-element></template><p onclick="alert(1)">Text</p>',
            plugins: [DiagnosticsPlugin],
        });

        expect(
            await editor.services.get(diagnosticsServiceToken).validate(),
        ).toEqual([]);
    });

    it('registers providers deterministically and disposes them idempotently', async () => {
        const editor = await Editor.create({ plugins: [DiagnosticsPlugin] });
        const service = editor.services.get(diagnosticsServiceToken);
        const first = provider('example.first', 'first');
        const second = provider('example.second', 'second');
        const disposeFirst = service.register(first);
        service.register(second);

        expect((await service.validate()).map(({ code }) => code)).toEqual([
            'first',
            'second',
        ]);
        expect(() => service.register(first)).toThrow(
            DiagnosticProviderAlreadyRegisteredError,
        );

        disposeFirst();
        disposeFirst();
        expect((await service.validate()).map(({ code }) => code)).toEqual([
            'second',
        ]);
    });

    it('keeps the last successful publication when a provider fails', async () => {
        const editor = await Editor.create({ plugins: [DiagnosticsPlugin] });
        const service = editor.services.get(diagnosticsServiceToken);
        const previous = await service.validate();
        service.register({
            id: 'example.failure',
            provide: () => {
                throw new Error('provider failed');
            },
        });

        await expect(service.validate()).rejects.toThrow('provider failed');
        expect(service.problems).toBe(previous);
    });

    it('does not publish stale asynchronous validation over newer results', async () => {
        const editor = await Editor.create({
            data: 'old',
            plugins: [DiagnosticsPlugin],
        });
        const service = editor.services.get(diagnosticsServiceToken);
        let resolveOld:
            ((diagnostics: readonly Diagnostic[]) => void) | undefined;
        service.register({
            id: 'example.async',
            provide: (source) =>
                source === 'old'
                    ? new Promise((resolve) => {
                          resolveOld = resolve;
                      })
                    : [
                          {
                              code: 'new',
                              message: 'new',
                              severity: 'info',
                          },
                      ],
        });

        const oldValidation = service.validate();
        await vi.waitFor(() => expect(resolveOld).toBeTypeOf('function'));
        editor.setData('new');
        await service.validate();
        resolveOld?.([{ code: 'old', message: 'old', severity: 'info' }]);
        await oldValidation;

        expect(service.problems.map(({ code }) => code)).toEqual(['new']);
    });

    it('rejects arguments to the validation command', async () => {
        const editor = await Editor.create({ plugins: [DiagnosticsPlugin] });

        expect(() => editor.execute('document.validate', true)).toThrow(
            'does not accept arguments',
        );
    });

    it('rejects provider ranges outside or reversed within the source', async () => {
        const editor = await Editor.create({
            data: 'abc',
            plugins: [DiagnosticsPlugin],
        });
        const service = editor.services.get(diagnosticsServiceToken);
        service.register({
            id: 'example.invalid-range',
            provide: () => [
                {
                    code: 'invalid-range',
                    message: 'invalid range',
                    severity: 'warning',
                    source: {
                        start: { line: 1, column: 3, offset: 2 },
                        end: { line: 1, column: 2, offset: 1 },
                    },
                },
            ],
        });

        await expect(service.validate()).rejects.toThrow(
            'returned an invalid source range',
        );
    });

    it('makes retained service references terminal on editor destruction', async () => {
        const editor = await Editor.create({ plugins: [DiagnosticsPlugin] });
        const service = editor.services.get(diagnosticsServiceToken);

        await editor.destroy();
        expect(() => service.problems).toThrow('destroyed');
        await expect(service.validate()).rejects.toThrow('destroyed');
        expect(() => service.register(provider('late', 'late'))).toThrow(
            'destroyed',
        );
    });
});

function provider(id: string, code: string): DiagnosticProvider {
    return {
        id,
        provide: () => [{ code, message: code, severity: 'info' }],
    };
}
