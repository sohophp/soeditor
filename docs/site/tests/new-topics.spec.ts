import { expect, test } from '@playwright/test';

for (const locale of ['en', 'zh-CN']) {
    for (const topic of ['react', 'vue', 'video']) {
        test(`${locale}: new ${topic} guide and example are discoverable without loading demos`, async ({
            page,
        }) => {
            const demoRequests: string[] = [];
            page.on('request', (request) => {
                if (request.url().includes('/demos/'))
                    demoRequests.push(request.url());
            });
            await page.goto(`/${locale}/guide/${topic}`);
            await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
            await expect(
                page.locator(`a[href="/${locale}/examples/${topic}"]`).first(),
            ).toBeAttached();
            await expect(
                page
                    .locator(
                        `a[href="/${locale === 'en' ? 'zh-CN' : 'en'}/guide/${topic}"]`,
                    )
                    .first(),
            ).toBeAttached();
            await page.goto(`/${locale}/examples/${topic}`);
            await expect(page.locator('iframe')).toHaveCount(0);
            expect(demoRequests).toEqual([]);
            expect(
                await page.evaluate(
                    () => document.documentElement.scrollWidth <= innerWidth,
                ),
            ).toBe(true);
        });
    }
}

for (const framework of ['react', 'vue']) {
    test(`${framework}: component availability matches the build and form binding works`, async ({
        page,
        request,
    }) => {
        const manifest = (await (
            await request.get('/deployment.json')
        ).json()) as { editorVersion: string };
        expect(manifest.editorVersion).toBe('1.3.0');
        await page.goto(`/en/examples/${framework}`);
        await page.getByRole('button', { name: 'Start editing' }).click();
        const frame = page.frameLocator('iframe');
        await expect(frame.locator('body')).toHaveAttribute(
            'data-ready',
            'true',
        );
        const surface = frame.locator('[contenteditable=true]').first();
        await surface.locator('p').click();
        await page.keyboard.press('ControlOrMeta+End');
        await page.keyboard.type(' FRAMEWORK-EDIT');
        await expect(frame.locator('[data-bound-value]')).toContainText(
            'FRAMEWORK-EDIT',
        );
        await frame
            .getByRole('button', { name: 'Submit form', exact: true })
            .click();
        await expect(frame.locator('pre')).toContainText('FRAMEWORK-EDIT');
        await frame
            .getByRole('button', { name: 'Reset form', exact: true })
            .click();
        await expect(surface).not.toContainText('FRAMEWORK-EDIT');
        await frame
            .getByRole('button', { name: 'Replace HTML', exact: true })
            .click();
        await expect(surface).toContainText('External value');
        await frame
            .getByRole('button', { name: 'Toggle readonly', exact: true })
            .click();
        await expect(frame.locator('[contenteditable=true]')).toHaveCount(0);
        await frame
            .getByRole('button', { name: 'Toggle readonly', exact: true })
            .click();
        await expect(frame.locator('.cm-editor')).toHaveCount(0);
        await frame
            .locator('.controls')
            .getByRole('button', { name: 'HTML Source', exact: true })
            .click();
        await expect(frame.locator('.cm-editor')).toBeVisible();
        await frame
            .getByRole('button', { name: 'Recreate demo', exact: true })
            .click();
        await expect(surface).toContainText('External value');
        await expect(frame.locator('textarea')).toHaveCount(1);
        await page.getByRole('button', { name: 'Close demo' }).click();
        await expect(page.locator('iframe')).toHaveCount(0);
    });
}

test('video example saves canonical HTML and plays only in article preview', async ({
    page,
}) => {
    const mediaRequests: string[] = [];
    page.on('request', (request) => {
        if (request.url().includes('demo-video.webm'))
            mediaRequests.push(request.url());
    });
    await page.goto('/demos/video.html?lang=en');
    await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
    await expect(page.locator('[data-soeditor-video-card]')).toHaveCount(1);
    expect(mediaRequests).toEqual([]);
    await page.getByRole('button', { name: 'Read HTML', exact: true }).click();
    await expect(page.locator('pre')).toContainText('<video');
    await expect(page.locator('pre')).toContainText('/demo-video.webm');
    await page.locator('[data-soeditor-video-card]').dblclick();
    const dialog = page.getByRole('dialog').last();
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Title', { exact: true }).fill('Edited demo video');
    await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
    await page.getByRole('button', { name: 'Read HTML', exact: true }).click();
    await expect(page.locator('pre')).toContainText('Edited demo video');
    await expect(page.locator('pre')).not.toContainText(
        'data-soeditor-video-card',
    );
    const popupPromise = page.waitForEvent('popup');
    await page
        .getByRole('button', { name: 'Preview article', exact: true })
        .click();
    const popup = await popupPromise;
    const video = popup.locator('video').first();
    await expect(video).toBeVisible();
    await video.evaluate(async (element: HTMLVideoElement) => {
        await element.play();
    });
    await expect
        .poll(() =>
            video.evaluate((element: HTMLVideoElement) => element.currentTime),
        )
        .toBeGreaterThan(0);
    await popup.close();
});
