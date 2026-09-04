import { expect, test } from '@playwright/test';

test.use({ javaScriptEnabled: false });

test('styles the Classic demo before JavaScript initialization', async ({
    page,
}) => {
    await page.goto('/classic.html');

    await expect(page.locator('body')).toHaveCSS('margin', '0px');
    await expect(page.locator('body')).toHaveCSS(
        'background-color',
        'rgb(245, 247, 251)',
    );
    await expect(page.locator('.demo-topbar')).toHaveCSS('display', 'flex');
    await expect(page.locator('.demo-topbar')).toHaveCSS('min-height', '72px');
    await expect(page.locator('.soeditor-classic')).toHaveCount(0);
});
