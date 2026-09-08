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

test('loads the self-contained CMS CDN editor', async ({ page }) => {
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
    expect(stylesheetSource).toContain('.soeditor-classic__image-dialog');
    expect(stylesheetSource).not.toContain(
        '.soeditor-classic .soeditor-table-widget',
    );
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

test('CMS global image resizing and table paragraph controls work after property mangling', async ({
    page,
}) => {
    await page.setContent('<textarea id="content"></textarea>');
    await page.addStyleTag({ path: stylesheet });
    await page.addScriptTag({ path: globalBundle });
    await page.evaluate(async () => {
        const api = Reflect.get(globalThis, 'SoEditor') as {
            createClassicEditor(
                host: HTMLTextAreaElement,
                options: { data: string },
            ): Promise<unknown>;
        };
        const host = document.querySelector<HTMLTextAreaElement>('#content');
        if (host === null) throw new Error('Missing host.');
        const editor = await api.createClassicEditor(host, {
            data: '<p><img src="data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%22400%22%20height=%22150%22%3E%3C/svg%3E" width="400" height="150" alt="Image"></p><table><tbody><tr><td>Cell</td></tr></tbody></table>',
        });
        Reflect.set(globalThis, '__globalImageTest', editor);
    });
    const visual = page.locator('.soeditor-wysiwyg-content');
    // Table appearance lives inside the editing shadow, not the legacy light DOM CSS.
    await expect(visual.locator('table')).toHaveCSS(
        'border-collapse',
        'collapse',
    );
    await expect(visual.locator('td')).toHaveCSS('border-top-width', '1px');
    await expect(visual.locator('td')).toHaveCSS('padding-top', '0px');
    const image = visual.locator('img');
    await image.hover();
    const controls = page.locator('.soeditor-block-paragraph');
    await expect(controls).toHaveCSS('opacity', '1');
    await page.mouse.move(1, 1);
    expect(
        await controls.evaluate((node) => getComputedStyle(node).opacity),
    ).toBe('0');
    await image.click();
    const imageTools = page.locator('[data-image-tools]');
    await expect(imageTools.getByRole('button')).toHaveCount(4);
    await imageTools
        .getByRole('button', { name: 'Align center', exact: true })
        .click();
    await expect(visual.locator('figure')).toHaveAttribute(
        'data-align',
        'center',
    );
    await page.evaluate(() => {
        const instance = Reflect.get(globalThis, '__globalImageTest') as {
            editor: { execute(command: string): unknown };
        };
        instance.editor.execute('editor.undo');
    });
    await expect(visual.locator('figure')).toHaveCount(0);
    await image.click();
    const handle = page.locator('[data-resize-direction="se"]');
    await expect(handle).toBeVisible();
    await handle.focus();
    await page.keyboard.press('Shift+ArrowRight');
    await expect(image).toHaveAttribute('width', '410');
    await expect(image).toHaveAttribute('height', '154');
    await image.click();
    await page
        .getByRole('button', { name: 'Insert paragraph after this block' })
        .click();
    await page.keyboard.type('After image');
    await expect(visual.locator(':scope > p').nth(1)).toHaveText('After image');
    await visual.locator('td').click();
    await page.keyboard.press('End');
    await page.keyboard.type(' updated');
    await expect(visual.locator('td')).toHaveText('Cell updated');
    const saved = await page.evaluate(() => {
        const instance = Reflect.get(globalThis, '__globalImageTest') as {
            editor: { execute(command: string): unknown };
            getData(): string;
        };
        const data = instance.getData();
        instance.editor.execute('table.row.insertAfter');
        return data;
    });
    expect(saved).toContain('<td>Cell updated</td>');
    expect(saved).not.toContain('soeditor-table-cell');
    await expect(visual.locator('tr')).toHaveCount(2);
    await page.evaluate(() => {
        const instance = Reflect.get(globalThis, '__globalImageTest') as {
            editor: { execute(command: string): unknown };
        };
        instance.editor.execute('editor.undo');
    });
    await expect(visual.locator('tr')).toHaveCount(1);
    await visual.locator('td').hover();
    await page
        .getByRole('button', { name: 'Insert paragraph after this block' })
        .click();
    await page.keyboard.type('After table');
    await expect(visual.locator(':scope > table + p')).toHaveText(
        'After table',
    );
    await page.evaluate(async () => {
        const editor = Reflect.get(globalThis, '__globalImageTest') as {
            destroy(): Promise<void>;
        };
        await editor.destroy();
    });
    await expect(page.locator('.soeditor-block-paragraph')).toHaveCount(0);
});

test('renders saved image alignment with the standalone frontend content stylesheet', async ({
    page,
}) => {
    const cssPath = fileURLToPath(
        new URL('../../packages/soeditor/dist/content.css', import.meta.url),
    );
    const css = await readFile(cssPath, 'utf8');
    expect(css).not.toContain('soeditor-ui__');
    await page.setContent('<textarea></textarea>');
    await page.addScriptTag({ path: globalBundle });
    for (const alignment of ['left', 'center', 'right']) {
        const html = `<figure data-soeditor-media="image" data-align="${alignment}"><a href="/photo"><img width="200" height="80" style="display:block"></a><figcaption>Caption</figcaption></figure>`;
        const saved = await page.evaluate(async (html) => {
            const api = Reflect.get(globalThis, 'SoEditor') as {
                createClassicEditor(host: HTMLTextAreaElement): Promise<{
                    setData(html: string): void;
                    getData(): string;
                    destroy(): Promise<void>;
                }>;
            };
            const host = document.createElement('textarea');
            document.body.append(host);
            const editor = await api.createClassicEditor(host);
            editor.setData(html);
            const saved = editor.getData();
            await editor.destroy();
            host.remove();
            return saved;
        }, html);
        expect(saved).toBe(html);
        await page.setContent(
            `<article class="soeditor-content" style="width:800px">${saved}</article>`,
        );
        await page.addStyleTag({ content: css });
        const difference = await page
            .locator('figure')
            .evaluate((figure, alignment) => {
                const image = figure.querySelector('img');
                if (image === null) throw new Error('Missing frontend image');
                const frame = figure.getBoundingClientRect();
                const picture = image.getBoundingClientRect();
                return Math.abs(
                    alignment === 'left'
                        ? picture.left - frame.left
                        : alignment === 'right'
                          ? picture.right - frame.right
                          : picture.left +
                            picture.width / 2 -
                            frame.left -
                            frame.width / 2,
                );
            }, alignment);
        expect(difference).toBeLessThan(1);
    }
});

// Exercise the actual minified ESM artifact, not Vite's source aliases.
test('CMS ESM artifact parses HTML after property mangling', async ({
    page,
}) => {
    await page.goto('/');
    await page.setContent(
        '<textarea id="artifact-content" name="content"></textarea>',
    );
    const entry = fileURLToPath(
        new URL('../../packages/soeditor/dist/cms.js', import.meta.url),
    );
    const result = await page.evaluate(async (path) => {
        const module: {
            createClassicEditor(host: HTMLElement): Promise<{
                getData(): string;
                setData(html: string): void;
                destroy(): Promise<void>;
            }>;
        } = await import(path);
        const host =
            document.querySelector<HTMLTextAreaElement>('#artifact-content');
        if (!host) throw new Error('Missing artifact host');
        host.value =
            '<h2>Article</h2><p data-cms="kept">Text &amp; more</p><table><tbody><tr><td>Cell</td></tr></tbody></table><!-- marker -->';
        const editor = await module.createClassicEditor(host);
        const initial = editor.getData();
        editor.setData('<p>Updated</p>');
        const updated = editor.getData();
        await editor.destroy();
        return { initial, updated };
    }, `/@fs${entry}`);
    expect(result.initial).toContain('data-cms="kept"');
    expect(result.initial).toContain('<td>Cell</td>');
    expect(result.initial).toContain('<!-- marker -->');
    expect(result.updated).toBe('<p>Updated</p>');
});
