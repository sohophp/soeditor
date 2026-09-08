import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const locale of ['zh-CN', 'en']) {
    test(`${locale}: docs stay light, responsive and accessible`, async ({
        page,
    }) => {
        const demoRequests: string[] = [];
        page.on('request', (request) => {
            if (request.url().includes('/demos/'))
                demoRequests.push(request.url());
        });
        await page.goto(`/${locale}/`);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expect(
            page
                .locator(
                    '.home-install a[href="https://sofinder.sohophp.app/"]',
                )
                .first(),
        ).toBeVisible();
        await expect(
            page.locator(`.home-install a[href="/${locale}/guide/sofinder"]`),
        ).toBeVisible();
        expect(demoRequests).toEqual([]);
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
        ).toBe(true);
        const audit = await new AxeBuilder({ page }).analyze();
        expect(
            audit.violations.filter((issue) =>
                ['serious', 'critical'].includes(issue.impact ?? ''),
            ),
        ).toEqual([]);
        await page.goto(`/${locale}/guide/installation`);
        expect(demoRequests).toEqual([]);
        await expect(page.locator('link[rel=canonical]')).toHaveAttribute(
            'href',
            `https://soeditor.sohophp.app/${locale}/guide/installation`,
        );
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        await expect(page.locator('.docs-version')).toContainText(
            'SoEditor 1.3.0',
        );
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
        ).toBe(true);
        await page
            .locator('html')
            .evaluate((html) => html.classList.add('dark'));
        await expect(
            page.locator('.vp-doc div[class*=language-]').first(),
        ).toHaveCSS('background-color', 'rgb(22, 22, 24)');
        const darkAudit = await new AxeBuilder({ page }).analyze();
        expect(
            darkAudit.violations.filter((issue) =>
                ['serious', 'critical'].includes(issue.impact ?? ''),
            ),
        ).toEqual([]);
    });
    test(`${locale}: search finds CMS tasks`, async ({ page }) => {
        await page.goto(`/${locale}/guide/installation`);
        const queries: readonly (readonly [string, string])[] =
            locale === 'en'
                ? [
                      ['Source', 'guide/source'],
                      ['saving', 'guide/saving'],
                      ['upload', 'guide/uploads'],
                      ['tables', 'guide/tables'],
                      ['SoFinder', 'guide/sofinder'],
                      ['React', 'guide/react'],
                      ['Vue', 'guide/vue'],
                      ['Video', 'guide/video'],
                  ]
                : [
                      ['源码', 'guide/source'],
                      ['保存', 'guide/saving'],
                      ['上传', 'guide/uploads'],
                      ['表格', 'guide/tables'],
                      ['SoFinder', 'guide/sofinder'],
                      ['React', 'guide/react'],
                      ['Vue', 'guide/vue'],
                      ['视频', 'guide/video'],
                  ];
        for (const [term, topic] of queries) {
            await page.locator('button.DocSearch-Button').click();
            await page.locator('input[type=search]').fill(term);
            await expect(
                page
                    .locator(`.VPLocalSearchBox a[href*='/${locale}/${topic}']`)
                    .first(),
            ).toBeVisible();
            await page.keyboard.press('Escape');
        }
    });
}

test('iframe starts explicitly and can be closed with keyboard', async ({
    page,
}) => {
    await page.goto('/en/examples/basic');
    await expect(page.locator('iframe')).toHaveCount(0);
    await page.getByRole('button', { name: 'Start editing' }).focus();
    await page.keyboard.press('Enter');
    const frame = page.frameLocator('iframe');
    await expect(frame.locator('body')).toHaveAttribute('data-ready', 'true');
    await page.getByRole('button', { name: 'Close demo' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('iframe')).toHaveCount(0);
});

for (const example of [
    'basic',
    'form',
    'source',
    'assets',
    'save',
    'multiple',
]) {
    test(`${example}: released editor runs and reads canonical HTML`, async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.goto(`/demos/${example}.html?lang=en`);
        await expect(page.locator('body')).toHaveAttribute(
            'data-ready',
            'true',
        );
        await page
            .getByRole('button', { name: 'Read HTML', exact: true })
            .click();
        await expect(page.locator('pre')).toContainText('<h2>');
        expect(await page.locator('pre').textContent()).not.toContain(
            'soeditor-',
        );
        expect(errors).toEqual([]);
    });
}

test('form submission and reset use canonical data', async ({ page }) => {
    await page.goto('/demos/form.html?lang=en');
    await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
    const editable = page.locator('[contenteditable=true]').first();
    await editable.click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type(' FORM-EDIT');
    await page
        .getByRole('button', { name: 'Submit form', exact: true })
        .click();
    await expect(page.locator('pre')).toContainText('FORM-EDIT');
    await page.getByRole('button', { name: 'Reset form', exact: true }).click();
    await expect(editable).not.toContainText('FORM-EDIT');
});

test('save failure stays dirty and retry succeeds', async ({ page }) => {
    await page.goto('/demos/save.html?lang=en');
    await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
    await page.locator('[contenteditable=true]').first().click();
    await page.keyboard.type('SAVE-EDIT');
    await page
        .getByRole('button', { name: 'Fail next save', exact: true })
        .click();
    await page
        .locator('.controls')
        .getByRole('button', { name: 'Save', exact: true })
        .click();
    await expect(page.locator('body > [role=status]')).toContainText(
        'Mock save failed',
    );
    await expect(page.locator('body > [role=status]')).toHaveAttribute(
        'data-dirty',
        'true',
    );
    await page
        .locator('.controls')
        .getByRole('button', { name: 'Retry save', exact: true })
        .click();
    await expect(page.locator('body > [role=status]')).toContainText('Clean');
    await expect(page.locator('pre')).toContainText('SAVE-EDIT');
});

test('Source loads on demand, switches both splits, and reuses chunks', async ({
    page,
}) => {
    const scripts: string[] = [];
    page.on('request', (request) => {
        if (request.resourceType() === 'script') scripts.push(request.url());
    });
    await page.goto('/demos/source.html?lang=en');
    await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
    const initial = [...scripts];
    await expect(page.locator('.cm-editor')).toHaveCount(0);
    await page
        .locator('.controls')
        .getByRole('button', { name: 'HTML Source', exact: true })
        .click();
    await expect(page.locator('.cm-editor')).toBeVisible();
    expect(scripts.length).toBeGreaterThan(initial.length);
    const firstSource = scripts.filter((url) => !initial.includes(url));
    await page
        .getByRole('button', { name: 'Side by side', exact: true })
        .click();
    await expect(page.locator('.cm-editor')).toBeVisible();
    await page.getByRole('button', { name: 'Stacked', exact: true }).click();
    await expect(page.locator('.cm-editor')).toBeVisible();
    await page
        .locator('.controls')
        .getByRole('button', { name: 'WYSIWYG', exact: true })
        .click();
    await page
        .locator('.controls')
        .getByRole('button', { name: 'HTML Source', exact: true })
        .click();
    for (const url of firstSource)
        expect(scripts.filter((item) => item === url)).toHaveLength(1);
});

test('assets: picker and mock upload failure/retry', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (request) => {
        if (request.method() !== 'GET') requests.push(request.url());
    });
    await page.goto('/demos/assets.html?lang=en');
    await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
    await page
        .getByRole('button', { name: 'Choose sample image', exact: true })
        .click();
    await page.getByRole('button', { name: 'Read HTML', exact: true }).click();
    await expect(page.locator('pre')).toContainText('/sample-image.svg');
    await page
        .getByRole('button', { name: 'Fail next upload', exact: true })
        .click();
    const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
        'base64',
    );
    await page.getByLabel('Mock image upload', { exact: true }).setInputFiles({
        name: 'test.png',
        mimeType: 'image/png',
        buffer: png,
    });
    await expect(page.locator('body > [role=status]')).toContainText(
        'Mock upload failed',
    );
    await page.getByLabel('Mock image upload', { exact: true }).setInputFiles({
        name: 'test.png',
        mimeType: 'image/png',
        buffer: png,
    });
    await expect(page.locator('body > [role=status]')).toContainText(
        'Mock upload complete',
    );
    expect(requests).toEqual([]);
});

test('twenty create/destroy cycles keep instances isolated', async ({
    page,
}) => {
    test.setTimeout(120000);
    await page.goto('/demos/multiple.html?lang=en');
    await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
    const editables = page.locator('[contenteditable=true]');
    await editables.first().click();
    await page.keyboard.type('FIRST-ONLY');
    await expect(editables.nth(1)).not.toContainText('FIRST-ONLY');
    for (let i = 0; i < 20; i++) {
        await page
            .getByRole('button', { name: 'Recreate demo', exact: true })
            .click();
        await expect(
            page.getByRole('button', { name: 'Recreate demo', exact: true }),
        ).toBeEnabled();
        await expect(editables).toHaveCount(2);
        await expect(page.locator('textarea[name=secondary]')).toHaveCount(1);
    }
});

test('twenty route visits remove demo frames and keep the current language topic', async ({
    page,
}) => {
    test.setTimeout(120000);
    for (let visit = 0; visit < 20; visit++) {
        await page.goto('/en/examples/basic');
        await page.getByRole('button', { name: 'Start editing' }).click();
        await expect(
            page.frameLocator('iframe').locator('body'),
        ).toHaveAttribute('data-ready', 'true');
        expect(page.frames()).toHaveLength(2);
        await page.getByRole('button', { name: 'Close demo' }).click();
        await expect(page.locator('iframe')).toHaveCount(0);
        expect(page.frames()).toHaveLength(1);
        await page
            .locator('.VPSidebar a[href="/en/guide/installation"]')
            .evaluate((link: HTMLAnchorElement) => link.click());
        await expect(page).toHaveURL(/\/en\/guide\/installation$/);
        await expect(page.locator('iframe')).toHaveCount(0);
    }
    await expect(
        page.locator('a[href="/zh-CN/guide/installation"]').first(),
    ).toHaveCount(1);
});
