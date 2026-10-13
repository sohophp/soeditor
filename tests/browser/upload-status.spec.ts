import { expect, test } from '@playwright/test';

for (const width of [1280, 420]) {
    test(`upload status keeps a single-line footer at ${width}px`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/classic.html?test=1');
        await page.locator('body[data-ready="true"]').waitFor();
        const root = page.locator('.soeditor-classic').first();
        const footer = root.locator('.soeditor-ui__status-bar');
        await page.evaluate(() => {
            const demo = globalThis.__classicDemo;
            demo.editor.setData('<p>Original content</p><!-- keep -->');
            demo.select({
                anchor: { block: 0, offset: 16 },
                focus: { block: 0, offset: 16 },
            });
        });
        const heightBefore = (await footer.boundingBox())?.height;
        await page.evaluate(() => {
            const demo = globalThis.__classicDemo;
            demo.setUploadMode('manual');
            for (let index = 0; index < 3; index++) {
                void demo.upload(
                    `image-${index}-${'long-filename-'.repeat(6)}.png`,
                );
            }
        });
        const panel = root.locator('[data-upload-status]');
        await expect(panel.locator('[data-upload-id]')).toHaveCount(3);
        const assertInside = async (): Promise<void> => {
            const lastButton = panel.getByRole('button').last();
            await lastButton.scrollIntoViewIfNeeded();
            const footerBox = await footer.boundingBox();
            const panelBox = await panel.boundingBox();
            const buttonBox = await lastButton.boundingBox();
            if (!footerBox || !panelBox || !buttonBox) {
                throw new Error('Missing upload geometry');
            }
            expect(footerBox.height).toBe(heightBefore);
            expect(panelBox.x).toBeGreaterThanOrEqual(footerBox.x);
            expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(
                footerBox.x + footerBox.width,
            );
            expect(panelBox.y).toBeGreaterThanOrEqual(footerBox.y);
            expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(
                footerBox.y + footerBox.height,
            );
            expect(buttonBox.y).toBeGreaterThanOrEqual(panelBox.y);
            expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(
                panelBox.y + panelBox.height,
            );
            expect(buttonBox.x).toBeGreaterThanOrEqual(panelBox.x);
            expect(buttonBox.x + buttonBox.width).toBeLessThanOrEqual(
                // scrollLeft rounds to physical pixels at fractional widths.
                panelBox.x + panelBox.width + 1,
            );
            expect(
                await panel
                    .locator('[role=status]')
                    .last()
                    .evaluate((node) => ({
                        whiteSpace: getComputedStyle(node).whiteSpace,
                        textOverflow: getComputedStyle(node).textOverflow,
                        title: node.getAttribute('title'),
                        text: node.textContent,
                    })),
            ).toEqual({
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                title: await panel
                    .locator('[role=status]')
                    .last()
                    .textContent(),
                text: await panel.locator('[role=status]').last().textContent(),
            });
        };
        await assertInside();
        expect(
            await page.evaluate(() => globalThis.__classicDemo.getData()),
        ).toBe('<p>Original content</p><!-- keep -->');
        await root.locator('[data-workspace-view=source]').click();
        await root.locator('.cm-content').waitFor();
        await assertInside();
        await root.locator('[data-workspace-view=wysiwyg]').click();
        await assertInside();
        await page.evaluate(() => globalThis.__classicDemo.resolveUploads());
        await expect(panel.locator('[data-upload-id]')).toHaveCount(0);
        await expect(panel).toBeHidden();
        const uploaded = await page.evaluate(() => ({
            data: globalThis.__classicDemo.getData(),
            succeeded: globalThis.__classicDemo
                .uploadRecords()
                .filter((record) => record.status === 'succeeded').length,
        }));
        expect(uploaded.succeeded).toBe(3);
        expect(uploaded.data).toContain('Original content');
        expect(uploaded.data).toContain('<!-- keep -->');
        expect(uploaded.data.match(/<img\b/gu)).toHaveLength(3);
        await root.locator('[data-workspace-view=source]').click();
        await root.locator('.cm-content').waitFor();
        await root.locator('[data-workspace-view=wysiwyg]').click();
        await page.screenshot({
            path: `/tmp/soeditor-upload-layout-20261010/native-${width}.png`,
        });
        await expect(panel.locator('[data-upload-id]')).toHaveCount(0);
        await expect(panel).toBeHidden();
        expect(
            await page.evaluate(() => globalThis.__classicDemo.getData()),
        ).toBe(uploaded.data);
        expect((await footer.boundingBox())?.height).toBe(heightBefore);
    });
}
