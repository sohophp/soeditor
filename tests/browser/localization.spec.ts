import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const videoSource =
    '/@fs' +
    fileURLToPath(
        new URL('../../packages/soeditor/src/video.ts', import.meta.url),
    );
const presetSource =
    '/@fs' +
    fileURLToPath(
        new URL('../../packages/presets/src/cms.ts', import.meta.url),
    );

const cases = [
    {
        locale: 'en',
        unnamedVideo: 'Video',
        anchorTitle: 'Named anchor',
        anchorName: 'Anchor name',
        anchorAction: 'Insert named anchor',
        image: [
            'Upload from computer',
            'Insert with file manager',
            'Insert via URL',
        ],
        imageTitle: 'Insert image via URL',
        imageUrl: 'Image URL',
        cancel: 'Cancel',
        video: 'Video URL',
        videoTitle: 'Insert video',
        find: 'Find',
        next: 'next',
        replace: 'replace all',
        color: 'Remove text color',
        caption: 'Table caption',
        tableProps: 'Table properties',
        attributes: 'Additional attributes',
        attributeName: 'Attribute name',
        attributeError:
            'This attribute is not applicable to the tag or is managed by a dedicated field.',
        preview: 'Content preview',
        theme: 'Source color scheme',
        title: 'Default (light)',
    },
    {
        locale: 'zh-CN',
        unnamedVideo: '视频',
        anchorTitle: '命名锚点',
        anchorName: '锚点名称',
        anchorAction: '插入命名锚点',
        image: ['从电脑上传', '从文件管理器插入', '通过网址插入'],
        imageTitle: '通过网址插入图片',
        imageUrl: '图片地址',
        cancel: '取消',
        video: '视频地址',
        videoTitle: '插入视频',
        find: '查找',
        next: '下一项',
        replace: '全部替换',
        color: '移除文字颜色',
        caption: '表格标题',
        tableProps: '表格属性',
        attributes: '附加属性',
        attributeName: '属性名',
        attributeError: '此属性不适用于当前标签或已被专用字段管理。',
        preview: '内容预览',
        theme: '源码配色',
        title: '默认（浅色）',
    },
    {
        locale: 'zh-TW',
        unnamedVideo: '影片',
        anchorTitle: '命名錨點',
        anchorName: '錨點名稱',
        anchorAction: '插入命名錨點',
        image: ['從電腦上傳', '從檔案管理員插入', '透過網址插入'],
        imageTitle: '透過網址插入圖片',
        imageUrl: '圖片網址',
        cancel: '取消',
        video: '影片網址',
        videoTitle: '插入影片',
        find: '尋找',
        next: '下一項',
        replace: '全部取代',
        color: '移除文字顏色',
        caption: '表格標題',
        tableProps: '表格屬性',
        attributes: '附加屬性',
        attributeName: '屬性名稱',
        attributeError: '此屬性不適用於此標籤或已由專用欄位管理。',
        preview: '內容預覽',
        theme: '原始碼配色',
        title: '預設（淺色）',
    },
] as const;

for (const labels of cases) {
    test(`localizes complete CMS controls and lazy panels in ${labels.locale}`, async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.goto('/classic.html?test=1');
        await page.locator('body[data-ready=true]').waitFor();
        await page.evaluate(
            async ({ locale, videoSource, presetSource }) => {
                await globalThis.__classicDemo.editor.destroy();
                const host = document.createElement('textarea');
                host.value =
                    '<p>Bold · 原文 · 原文繁體</p><!-- keep --><table><colgroup><col></colgroup><tbody><tr><td>Table content</td></tr></tbody></table><video src="/sample.mp4"></video>';
                document.body.append(host);
                const source = videoSource;
                const { cmsPreset } = await import(
                    /* @vite-ignore */ presetSource
                );
                const { createCmsVideoPlugin } = await import(
                    /* @vite-ignore */ source
                );
                const editor = await globalThis.__classicDemo.create(host, {
                    locale,
                    preview: true,
                    editingModes: ['wysiwyg', 'source'],
                    plugins: [...cmsPreset.plugins, createCmsVideoPlugin()],
                    toolbar: [
                        'undo',
                        'redo',
                        'reset',
                        'image-actions',
                        'specialCharacter',
                        'anchor',
                        'fontColor',
                        'fontBackgroundColor',
                        'highlight',
                        'table',
                        'cmsVideo',
                        'source',
                        'format',
                        'minify',
                        'popupPreview',
                        'link',
                    ],
                });
                host.addEventListener('test:readonly', () =>
                    editor.setReadonly(true),
                );
                host.addEventListener('test:source', () =>
                    editor.setWorkspaceView('source'),
                );
                host.addEventListener('test:visual', () =>
                    editor.setWorkspaceView('wysiwyg'),
                );
                Reflect.set(globalThis, '__localeEditor', editor);
                Reflect.set(globalThis, '__localeOriginal', editor.getData());
            },
            { locale: labels.locale, videoSource, presetSource },
        );
        const root = page.locator('.soeditor-classic');
        await expect(root).toHaveAttribute('lang', labels.locale);
        await expect(
            root.locator('[data-soeditor-video-card] strong'),
        ).toHaveText(`▶ ${labels.unnamedVideo}`);
        await root.locator('.soeditor-wysiwyg-content p').click();
        // Generic action text is generated at runtime, beyond literal-key scans.
        for (const [item, title, field, action] of [
            [
                'anchor',
                labels.anchorTitle,
                labels.anchorName,
                labels.anchorAction,
            ],
        ]) {
            await root.locator(`[data-toolbar-item=${item}]`).click();
            const dialog = root.getByRole('dialog', {
                name: title,
                exact: true,
            });
            await expect(dialog).toBeVisible();
            await expect(
                dialog.getByLabel(field, { exact: true }),
            ).toBeVisible();
            await expect(
                dialog.getByRole('button', { name: action, exact: true }),
            ).toBeVisible();
            await dialog
                .getByRole('button', { name: labels.cancel, exact: true })
                .click();
        }
        await root.locator('[data-toolbar-item=image-actions] summary').click();
        for (const label of labels.image)
            await expect(
                root.getByRole('menuitem', { name: label, exact: true }),
            ).toBeVisible();
        await root
            .getByRole('menuitem', { name: labels.image[2], exact: true })
            .click();
        const image = root.getByRole('dialog', {
            name: labels.imageTitle,
            exact: true,
        });
        await expect(image).toBeVisible();
        await expect(
            image.getByLabel(labels.imageUrl, { exact: true }),
        ).toBeVisible();
        await image
            .getByRole('button', { name: labels.cancel, exact: true })
            .click();
        await root.locator('[data-toolbar-item=fontColor] summary').click();
        await expect(
            root.getByRole('button', { name: labels.color, exact: true }),
        ).toBeVisible();
        await page.keyboard.press('Escape');
        await root.locator('.soeditor-wysiwyg-content p').click();
        await root.locator('[data-toolbar-item=cmsVideo]').click();
        const video = root.getByRole('dialog', {
            name: labels.videoTitle,
            exact: true,
        });
        await expect(
            video.getByLabel(labels.video, { exact: true }),
        ).toBeVisible();
        await video
            .getByRole('button', { name: labels.cancel, exact: true })
            .click();
        await root.locator('.soeditor-table-cell').first().click();
        await root.locator('[data-table-menu=properties]').click();
        await root
            .getByRole('button', { name: labels.caption, exact: true })
            .click();
        const caption = root.getByRole('dialog', {
            name: labels.caption,
            exact: true,
        });
        await expect(caption).toBeVisible();
        await page.keyboard.press('Escape');
        await root.locator('.soeditor-table-cell').first().click();
        await root.locator('[data-table-menu=properties]').click();
        await root
            .getByRole('button', { name: labels.tableProps, exact: true })
            .click();
        const table = root.getByRole('dialog', {
            name: labels.tableProps,
            exact: true,
        });
        await expect(table).toBeVisible();
        await expect(
            table.getByText(labels.attributes, { exact: true }).first(),
        ).toBeVisible();
        const name = table
            .getByLabel(labels.attributeName, { exact: true })
            .first();
        // Browser validity text must be localized too, not just its caption.
        await name.fill('onclick');
        await name.locator('xpath=../..').getByRole('button').first().click();
        await expect
            .poll(() =>
                name.evaluate((input) =>
                    input instanceof HTMLInputElement
                        ? input.validationMessage
                        : '',
                ),
            )
            .toBe(labels.attributeError);
        await page.keyboard.press('Escape');
        const popup = page.waitForEvent('popup');
        await root.locator('[data-toolbar-item=popupPreview]').click();
        const preview = await popup;
        await expect(preview).toHaveTitle(labels.preview);
        await preview.close();
        await root.locator('[data-workspace-view=source]').click();
        await expect(
            root.getByLabel(labels.theme, { exact: true }),
        ).toBeVisible();
        await expect(
            root
                .getByLabel(labels.theme, { exact: true })
                .locator('option')
                .first(),
        ).toHaveText(labels.title);
        await root.locator('.cm-content').click();
        await page.keyboard.press('ControlOrMeta+f');
        await expect(
            root.getByLabel(labels.find, { exact: true }),
        ).toBeVisible();
        await expect(
            root.getByRole('button', { name: labels.next, exact: true }),
        ).toBeVisible();
        await expect(
            root.getByRole('button', { name: labels.replace, exact: true }),
        ).toBeVisible();
        const preserved = await page.evaluate(() => {
            const editor: unknown = Reflect.get(globalThis, '__localeEditor');
            if (
                typeof editor !== 'object' ||
                editor === null ||
                !('getData' in editor) ||
                typeof editor.getData !== 'function'
            )
                throw new Error('Missing editor');
            return (
                editor.getData() === Reflect.get(globalThis, '__localeOriginal')
            );
        });
        expect(preserved).toBe(true);
        expect(errors).toEqual([]);
    });
}
