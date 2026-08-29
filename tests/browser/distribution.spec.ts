import { expect, test } from '@playwright/test';
import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const globalBundle = fileURLToPath(
    new URL('../../packages/soeditor/dist/soeditor.global.js', import.meta.url),
);
const globalMap = `${globalBundle}.map`;
const stylesheet = fileURLToPath(
    new URL('../../packages/soeditor/dist/soeditor.css', import.meta.url),
);

test('loads the self-contained immutable CDN facade in Chromium', async ({
    page,
}) => {
    await access(globalMap);
    await access(stylesheet);
    await page.addStyleTag({ path: stylesheet });
    await page.addScriptTag({ path: globalBundle });

    const result = await page.evaluate(async () => {
        const api = Reflect.get(globalThis, 'SoEditor') as {
            SoEditor: { create(options: { data: string }): Promise<unknown> };
            create(options: { data: string }): Promise<{
                destroy(): Promise<void>;
                getData(): string;
            }>;
            minimalPreset: { format: string };
        };
        const editor = await api.create({ data: '<p>CDN</p>' });
        const data = editor.getData();
        await editor.destroy();
        const styled = document.createElement('div');
        styled.className = 'soeditor-ui';
        document.body.append(styled);
        return {
            alias: api.SoEditor.create === undefined ? 'missing' : 'available',
            bindingWritable: Object.getOwnPropertyDescriptor(
                globalThis,
                'SoEditor',
            )?.writable,
            cssBackground:
                getComputedStyle(styled).getPropertyValue('--soeditor-bg'),
            data,
            extraGlobal: Reflect.has(globalThis, 'SoEditorBundle'),
            frozen: Object.isFrozen(api),
            format: api.minimalPreset.format,
        };
    });

    expect(result).toEqual({
        alias: 'available',
        bindingWritable: false,
        cssBackground: '#ffffff',
        data: '<p>CDN</p>',
        extraGlobal: false,
        format: 'html',
        frozen: true,
    });
    const stylesheetSource = await readFile(stylesheet, 'utf8');
    expect(stylesheetSource).toContain('--soeditor-bg');
    expect(stylesheetSource).toContain('.soeditor-split-view');
    expect(await readFile(globalMap, 'utf8')).toContain('sources');
});

test('runs accessibility and SEO diagnostics from the browser global', async ({
    page,
}) => {
    await page.addScriptTag({ path: globalBundle });

    const result = await page.evaluate(async () => {
        const api = Reflect.get(globalThis, 'SoEditor') as {
            AccessibilityDiagnosticsPlugin: new (...args: never[]) => unknown;
            SeoDiagnosticsPlugin: new (...args: never[]) => unknown;
            diagnosticsServiceToken: unknown;
            create(options: {
                data: string;
                plugins: readonly unknown[];
            }): Promise<{
                destroy(): Promise<void>;
                services: {
                    get(token: unknown): {
                        validate(): Promise<
                            readonly { code: string; provider: string }[]
                        >;
                    };
                };
            }>;
        };
        const editor = await api.create({
            data: '<!doctype html><html><head></head><body><button></button></body></html>',
            plugins: [
                api.AccessibilityDiagnosticsPlugin,
                api.SeoDiagnosticsPlugin,
            ],
        });
        const problems = await editor.services
            .get(api.diagnosticsServiceToken)
            .validate();
        await editor.destroy();
        return problems.map(({ code, provider }) => ({ code, provider }));
    });

    expect(result).toEqual(
        expect.arrayContaining([
            {
                code: 'a11y.interactive-name',
                provider: 'html.accessibility',
            },
            { code: 'seo.document-title', provider: 'html.seo' },
        ]),
    );
});
