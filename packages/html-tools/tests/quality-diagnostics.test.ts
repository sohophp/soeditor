import { Editor } from '@soeditor/core';
import { describe, expect, it } from 'vitest';

import {
    AccessibilityDiagnosticsPlugin,
    DiagnosticsPlugin,
    diagnosticsServiceToken,
    InvalidDiagnosticRuleConfigurationError,
    SeoDiagnosticsPlugin,
} from '../src/index.js';

describe('accessibility diagnostics', () => {
    it('reports bounded source issues with stable provider identity and ranges', async () => {
        const editor = await Editor.create({
            data: '<!doctype html><html lang="en"><head><title>Page</title></head><body><h1>Main</h1><h3>Skipped</h3><iframe></iframe><button></button><input id="email"><textarea aria-label="Notes"></textarea></body></html>',
            plugins: [AccessibilityDiagnosticsPlugin],
        });

        const problems = await editor.services
            .get(diagnosticsServiceToken)
            .validate();
        expect(problems).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    code: 'a11y.heading-order',
                    provider: 'html.accessibility',
                    severity: 'warning',
                    source: expect.any(Object),
                }),
                expect.objectContaining({
                    code: 'a11y.iframe-title',
                    provider: 'html.accessibility',
                    source: expect.any(Object),
                }),
                expect.objectContaining({
                    code: 'a11y.interactive-name',
                    provider: 'html.accessibility',
                    source: expect.any(Object),
                }),
                expect.objectContaining({
                    code: 'a11y.form-label',
                    provider: 'html.accessibility',
                    source: expect.any(Object),
                }),
            ]),
        );
        expect(
            problems.filter(
                ({ provider }) => provider === 'html.accessibility',
            ),
        ).toHaveLength(4);
    });

    it('recognizes native, wrapping, external, and ARIA naming paths', async () => {
        const editor = await Editor.create({
            data: '<label for="email">Email</label><input id="email"><label>Search <input></label><select aria-labelledby="choice-label"><option>One</option></select><button>Save</button><input type="submit" value="Send"><iframe title="Preview"></iframe>',
            plugins: [AccessibilityDiagnosticsPlugin],
        });

        expect(
            (
                await editor.services.get(diagnosticsServiceToken).validate()
            ).filter(({ provider }) => provider === 'html.accessibility'),
        ).toEqual([]);
    });

    it('does not inspect inert template content or non-HTML namespaces', async () => {
        const editor = await Editor.create({
            data: '<template><button></button><iframe></iframe><input></template><svg><title>Vector</title><foreignObject><button>SVG button</button></foreignObject></svg><math><mi>x</mi></math><custom-card><button>Named</button></custom-card>',
            plugins: [AccessibilityDiagnosticsPlugin],
        });

        expect(
            (
                await editor.services.get(diagnosticsServiceToken).validate()
            ).filter(({ provider }) => provider === 'html.accessibility'),
        ).toEqual([]);
    });

    it('supports immutable per-rule disablement and severity overrides', async () => {
        const editor = await Editor.create({
            data: '<button></button><iframe></iframe><input>',
            plugins: [AccessibilityDiagnosticsPlugin],
            config: {
                htmlTools: {
                    accessibility: {
                        rules: {
                            'a11y.form-label': false,
                            'a11y.iframe-title': 'error',
                            'a11y.interactive-name': 'hint',
                        },
                    },
                },
            },
        });

        const problems = (
            await editor.services.get(diagnosticsServiceToken).validate()
        ).filter(({ provider }) => provider === 'html.accessibility');
        expect(problems.map(({ code, severity }) => [code, severity])).toEqual([
            ['a11y.interactive-name', 'hint'],
            ['a11y.iframe-title', 'error'],
        ]);
    });
});

describe('SEO diagnostics', () => {
    it('checks complete-document title, description, and h1 semantics', async () => {
        const editor = await Editor.create({
            data: '<!doctype html><html lang="en"><head><title></title><meta name="description" content=""></head><body><h1>First</h1><h1>Second</h1></body></html>',
            plugins: [SeoDiagnosticsPlugin],
        });

        const problems = (
            await editor.services.get(diagnosticsServiceToken).validate()
        ).filter(({ provider }) => provider === 'html.seo');
        expect(problems.map(({ code }) => code)).toEqual([
            'seo.document-title',
            'seo.meta-description',
            'seo.h1',
        ]);
        expect(problems.every(({ source }) => source !== undefined)).toBe(true);
    });

    it('does not apply page-context SEO rules to fragments', async () => {
        const editor = await Editor.create({
            data: '<article><h2>Fragment</h2></article>',
            plugins: [SeoDiagnosticsPlugin],
        });

        expect(
            (
                await editor.services.get(diagnosticsServiceToken).validate()
            ).filter(({ provider }) => provider === 'html.seo'),
        ).toEqual([]);
    });

    it('accepts a useful complete document without making ranking claims', async () => {
        const editor = await Editor.create({
            data: '<!doctype html><html lang="en"><head><title>Page</title><meta name="description" content="Summary"></head><body><h1>Page</h1></body></html>',
            plugins: [SeoDiagnosticsPlugin],
        });

        expect(
            (
                await editor.services.get(diagnosticsServiceToken).validate()
            ).filter(({ provider }) => provider === 'html.seo'),
        ).toEqual([]);
    });
});

describe('quality diagnostic lifecycle and configuration', () => {
    it('composes in plugin registration order with built-in and third-party providers', async () => {
        const editor = await Editor.create({
            data: '<!doctype html><html data-x="1" data-x="2"><head></head><body><div id="same"></div><div id="same"></div><button></button></body></html>',
            plugins: [AccessibilityDiagnosticsPlugin, SeoDiagnosticsPlugin],
        });
        const service = editor.services.get(diagnosticsServiceToken);
        service.register({
            id: 'example.third-party',
            provide: () => [
                { code: 'example.last', message: 'Last', severity: 'info' },
            ],
        });

        const providers = (await service.validate()).map(
            ({ provider }) => provider,
        );
        expect(firstIndex(providers, 'html.parser')).toBeLessThan(
            firstIndex(providers, 'html.structure'),
        );
        expect(firstIndex(providers, 'html.structure')).toBeLessThan(
            firstIndex(providers, 'html.accessibility'),
        );
        expect(firstIndex(providers, 'html.accessibility')).toBeLessThan(
            firstIndex(providers, 'html.seo'),
        );
        expect(firstIndex(providers, 'html.seo')).toBeLessThan(
            firstIndex(providers, 'example.third-party'),
        );
    });

    it('rejects unknown and malformed rule configuration actionably', async () => {
        await expect(
            Editor.create({
                plugins: [AccessibilityDiagnosticsPlugin],
                config: {
                    htmlTools: {
                        accessibility: {
                            rules: { 'a11y.unknown': false },
                        },
                    },
                },
            }),
        ).rejects.toThrow(InvalidDiagnosticRuleConfigurationError);

        await expect(
            Editor.create({
                plugins: [SeoDiagnosticsPlugin],
                config: {
                    htmlTools: { seo: { rules: { 'seo.h1': true } } },
                },
            }),
        ).rejects.toThrow('expected false');
    });

    it('uses parser recovery without executing preserved dangerous content', async () => {
        const editor = await Editor.create({
            data: '<script>globalThis.__soeditorExecuted = true</script><button onclick="globalThis.__soeditorExecuted = true"><iframe src="javascript:alert(1)">',
            plugins: [AccessibilityDiagnosticsPlugin, SeoDiagnosticsPlugin],
        });

        const problems = await editor.services
            .get(diagnosticsServiceToken)
            .validate();
        expect(
            problems.some(({ provider }) => provider === 'html.accessibility'),
        ).toBe(true);
        expect(Reflect.get(globalThis, '__soeditorExecuted')).not.toBe(true);
        expect(editor.getData()).toContain('javascript:alert(1)');
    });

    it('loads the diagnostics dependency and remains terminal after destruction', async () => {
        const editor = await Editor.create({
            plugins: [AccessibilityDiagnosticsPlugin],
        });
        const service = editor.services.get(diagnosticsServiceToken);
        expect(editor.plugins.has(DiagnosticsPlugin)).toBe(true);

        await editor.destroy();
        await expect(service.validate()).rejects.toThrow('destroyed');
    });
});

function firstIndex(values: readonly string[], value: string): number {
    const index = values.indexOf(value);
    expect(index).toBeGreaterThanOrEqual(0);
    return index;
}
