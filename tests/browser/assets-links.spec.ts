import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const presetSource =
    '/@fs' +
    fileURLToPath(
        new URL('../../packages/presets/src/cms.ts', import.meta.url),
    );
const managerSource =
    '/@fs' +
    fileURLToPath(
        new URL('../../packages/file-manager/src/index.ts', import.meta.url),
    );

for (const custom of [false, true]) {
    test(`shared file controls preserve dialog semantics with ${custom ? 'host provider' : 'selection-only fallback'}`, async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.goto('/classic.html?test=1');
        await page.locator('body[data-ready=true]').waitFor();
        await page.evaluate(
            async ({ presetSource, managerSource, custom }) => {
                await globalThis.__classicDemo.editor.destroy();
                const { cmsPreset } = await import(
                    /* @vite-ignore */ presetSource
                );
                const {
                    fileManagerServiceToken,
                    linkTargetProviderServiceToken,
                    createFileManagerLinkTargetProvider,
                } = await import(/* @vite-ignore */ managerSource);
                const host = document.createElement('textarea');
                host.value =
                    '<p>Selected text</p><p><img src="/demo-editor-cover.svg" alt="Original" width="640" height="240"></p><!-- preserve -->';
                document.body.append(host);
                const editor = await globalThis.__classicDemo.create(host, {
                    plugins: cmsPreset.plugins,
                    toolbar: ['undo', 'redo', ...cmsPreset.toolbar],
                    locale: 'en',
                });
                const manager = {
                    open: async () => ({
                        url: '/original/uploads/guide.pdf',
                        name: 'Guide',
                    }),
                };
                editor.editor.services.register(
                    fileManagerServiceToken,
                    manager,
                );
                if (custom)
                    editor.editor.services.register(
                        linkTargetProviderServiceToken,
                        createFileManagerLinkTargetProvider({
                            fileManager: manager,
                            resolveFile: async () => ({
                                href: '/published/guide/7',
                                title: 'Published guide',
                            }),
                            searchInternal: async () => [
                                { href: '/site/about', title: 'About us' },
                            ],
                        }),
                    );
                Reflect.set(globalThis, '__assetsEditor', editor);
                Reflect.set(globalThis, '__assetsOriginal', editor.getData());
            },
            { presetSource, managerSource, custom },
        );
        const root = page.locator('.soeditor-classic');
        const read = () =>
            page.evaluate(() =>
                Reflect.get(globalThis, '__assetsEditor').getData(),
            );
        const original = await read();
        await expect(
            root.locator(
                '[data-toolbar-item=image-browse],[data-toolbar-item=image-upload],[data-toolbar-item=file-link]',
            ),
        ).toHaveCount(0);
        await root.locator('.soeditor-wysiwyg-content p').first().click();
        await root.locator('[data-toolbar-item=link]').click();
        let dialog = root.getByRole('dialog', { name: 'Link', exact: true });
        await dialog
            .getByRole('button', { name: 'Choose file link', exact: true })
            .click();
        const expected = custom
            ? '/published/guide/7'
            : '/original/uploads/guide.pdf';
        await expect(
            dialog.getByLabel('Link URL', { exact: true }),
        ).toHaveValue(expected);
        expect(await read()).toBe(original);
        await dialog
            .getByRole('button', { name: 'Cancel', exact: true })
            .click();
        expect(await read()).toBe(original);
        await root.locator('.soeditor-wysiwyg-content img').dblclick();
        dialog = root.getByRole('dialog', {
            name: 'Image properties',
            exact: true,
        });
        await dialog
            .getByRole('button', { name: 'Choose file link', exact: true })
            .click();
        await expect(
            dialog.getByLabel('Link URL', { exact: true }),
        ).toHaveValue(expected);
        if (custom) {
            const input = dialog.getByLabel('Link URL', { exact: true });
            await input.fill('/about');
            await expect(
                dialog.locator('.soeditor-ui__link-suggestion'),
            ).toHaveCount(1);
            await input.press('ArrowDown');
            await input.press('Enter');
            await expect(input).toHaveValue('/site/about');
            await expect(dialog).toBeVisible();
        }
        expect(await read()).toBe(original);
        await dialog
            .getByRole('button', { name: 'Update image', exact: true })
            .click();
        const updated = await read();
        expect(updated).toContain(
            `href="${custom ? '/site/about' : expected}"`,
        );
        expect(updated).toContain('<!-- preserve -->');
        await root.locator('[data-toolbar-item=undo]').click();
        expect(await read()).toBe(original);
        await root.locator('[data-toolbar-item=redo]').click();
        expect(await read()).toBe(updated);
        await page.evaluate(() =>
            Reflect.get(globalThis, '__assetsEditor').setReadonly(true),
        );
        await expect(root.locator('[data-toolbar-item=link]')).toBeDisabled();
        expect(errors).toEqual([]);
    });
}
