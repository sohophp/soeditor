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
    expect(await readFile(stylesheet, 'utf8')).toContain('--soeditor-bg');
    expect(await readFile(globalMap, 'utf8')).toContain('sources');
});
