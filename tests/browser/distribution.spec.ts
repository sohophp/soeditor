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

test('loads the self-contained CMS CDN editor in Chromium', async ({
    page,
}) => {
    await access(globalMap);
    await access(stylesheet);
    await page.setContent(
        '<form><textarea id="content" name="content"><p>CDN</p></textarea></form>',
    );
    await page.addStyleTag({ path: stylesheet });
    await page.addScriptTag({ path: globalBundle });

    const result = await page.evaluate(async () => {
        const api = Reflect.get(globalThis, 'SoEditor') as {
            createClassicEditor(host: HTMLTextAreaElement): Promise<{
                destroy(): Promise<void>;
                getData(): string;
                setData(source: string): void;
            }>;
        };
        const host = document.querySelector<HTMLTextAreaElement>('#content');
        if (host === null) throw new Error('Missing CDN textarea.');
        const editor = await api.createClassicEditor(host);
        editor.setData('<p>Updated CDN</p>');
        const data = editor.getData();
        const synchronized = host.value;
        const mounted = document.querySelector('.soeditor-classic') !== null;
        await editor.destroy();
        return {
            bindingWritable: Object.getOwnPropertyDescriptor(
                globalThis,
                'SoEditor',
            )?.writable,
            data,
            excludedDiagnostics: !Reflect.has(
                api,
                'AccessibilityDiagnosticsPlugin',
            ),
            excludedMarkdown: !Reflect.has(api, 'MarkdownPlugin'),
            extraGlobal: Reflect.has(globalThis, 'SoEditorBundle'),
            frozen: Object.isFrozen(api),
            mounted,
            restored: host.hidden === false,
            synchronized,
        };
    });

    expect(result).toEqual({
        bindingWritable: false,
        data: '<p>Updated CDN</p>',
        excludedDiagnostics: true,
        excludedMarkdown: true,
        extraGlobal: false,
        frozen: true,
        mounted: true,
        restored: true,
        synchronized: '<p>Updated CDN</p>',
    });
    const stylesheetSource = await readFile(stylesheet, 'utf8');
    expect(stylesheetSource).toContain('--soeditor-bg');
    expect(stylesheetSource).toContain('.soeditor-table-widget');
    expect(await readFile(globalMap, 'utf8')).toContain('sources');
});

test('keeps Source outside the standalone CMS global', async ({ page }) => {
    await page.setContent(
        '<textarea id="content"><p>Source boundary</p></textarea>',
    );
    await page.addScriptTag({ path: globalBundle });

    const message = await page.evaluate(async () => {
        const api = Reflect.get(globalThis, 'SoEditor') as {
            createClassicEditor(
                host: HTMLTextAreaElement,
                options: { editingModes: readonly string[] },
            ): Promise<unknown>;
        };
        const host = document.querySelector<HTMLTextAreaElement>('#content');
        if (host === null) throw new Error('Missing CDN textarea.');
        try {
            await api.createClassicEditor(host, {
                editingModes: ['wysiwyg', 'source'],
            });
            return 'unexpected success';
        } catch (error) {
            return error instanceof Error ? error.message : String(error);
        }
    });

    expect(message).toContain('does not bundle HTML Source');
});
