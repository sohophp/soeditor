import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const editor = '[data-testid="editor"]';
const source = '[data-testid="source"]';
const mediaBoundary = '[data-soeditor-structured-block="soeditor.media"]';

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('#hello').click();
    await placeCaret(page);
});

test('inserts and command-updates an accessible media figure', async ({
    page,
}) => {
    await page.locator('[data-toolbar-item="media"]').click();
    const dialog = page.getByRole('dialog', { name: 'Media' });
    await dialog.getByLabel('Media URL').fill('/hero.jpg');
    await dialog.getByLabel('Alternative text').fill('Hero image');
    await dialog.getByLabel('Caption').fill('Original caption');
    await dialog.getByLabel('Width').fill('800');
    await dialog.getByLabel('Height').fill('450');
    await dialog.getByRole('button', { name: 'Insert media' }).click();

    const boundary = page.locator(mediaBoundary);
    await expect(boundary).toBeVisible();
    await expect(boundary.locator('img')).toHaveAttribute('src', '/hero.jpg');
    await expect(boundary.locator('img')).toHaveAttribute('alt', 'Hero image');
    await expect(boundary.locator('figcaption')).toHaveText('Original caption');

    await boundary.getByLabel('Alternative text').fill('Updated alt');
    await boundary.getByLabel('Caption').fill('Updated caption');
    await boundary.getByLabel('Width').fill('');
    await boundary
        .getByRole('button', { name: 'Apply media properties' })
        .click();
    await expect(page.locator(source)).toContainText('alt="Updated alt"');
    await expect(page.locator(source)).toContainText(
        '<figcaption>Updated caption</figcaption>',
    );
    await expect(page.locator(source)).not.toContainText('width="800"');

    await page
        .locator(mediaBoundary)
        .getByRole('button', { name: 'Remove caption' })
        .click();
    await expect(page.locator(source)).not.toContainText('<figcaption>');
    await page.keyboard.press('Control+z');
    await expect(page.locator(source)).toContainText(
        '<figcaption>Updated caption</figcaption>',
    );
});

test('uses FileManager for media without coupling it to the media plugin', async ({
    page,
}) => {
    await page.locator('[data-toolbar-item="media-browse"]').click();
    await expect(page.locator(source)).toContainText(
        '<figure data-soeditor-media="image"><img src="/custom-manager-image.png" alt="Custom manager image"></figure>',
    );
    await expect(page.locator(mediaBoundary)).toBeVisible();
});

test('preserves unsafe or unsupported source without executing it', async ({
    page,
}) => {
    await setData(
        page,
        '<figure data-cms="kept"><img src="javascript:window.__mediaExecuted=true" onerror="window.__mediaExecuted=true"><figcaption>Safe text</figcaption></figure>',
    );
    await expect(page.locator(mediaBoundary)).toContainText(
        'Media preview blocked for this URL.',
    );
    await expect(page.locator(`${mediaBoundary} img`)).toHaveCount(0);
    await expect(page.locator(source)).toContainText('onerror=');
    expect(
        await page.evaluate(
            () =>
                (window as Window & { __mediaExecuted?: boolean })
                    .__mediaExecuted,
        ),
    ).toBeUndefined();

    await setData(
        page,
        '<figure data-cms="complex"><picture><img src="x.png"></picture><script>window.__mediaExecuted=true</script></figure>',
    );
    await expect(page.locator(mediaBoundary)).toContainText(
        'Unsupported figure preserved',
    );
    await expect(page.locator(source)).toContainText('<picture>');
    await expect(page.locator(source)).toContainText('<script>');
    expect(
        await page.evaluate(
            () =>
                (window as Window & { __mediaExecuted?: boolean })
                    .__mediaExecuted,
        ),
    ).toBeUndefined();
});

test('disables media controls in readonly mode', async ({ page }) => {
    await page.goto('/?readonly=1');
    await setData(
        page,
        '<figure><img src="/readonly.png" alt="Readonly"><figcaption>Caption</figcaption></figure>',
    );
    const boundary = page.locator(mediaBoundary);
    await expect(boundary.getByLabel('Media URL')).toBeDisabled();
    await expect(
        boundary.getByRole('button', { name: 'Apply media properties' }),
    ).toBeDisabled();
    await expect(page.locator('[data-toolbar-item="media"]')).toBeDisabled();
    await expect(
        page.locator('[data-toolbar-item="media-browse"]'),
    ).toBeDisabled();
});

test('keeps table and media widgets accessible through repeated projection lifecycles', async ({
    page,
}) => {
    const content =
        '<table><tbody><tr><th>Key</th><th>Value</th></tr><tr><td>A</td><td>B</td></tr></tbody></table>' +
        '<figure><img src="data:image/png;base64,iVBORw0KGgo=" alt="Tiny test image"><figcaption>Test caption</figcaption></figure>';
    for (let iteration = 0; iteration < 20; iteration += 1) {
        await setData(page, iteration % 2 === 0 ? content : '<p>Reset</p>');
    }
    await setData(page, content);
    await expect(page.locator(mediaBoundary)).toHaveCount(1);
    await expect(
        page.locator('[data-soeditor-structured-block="soeditor.table"]'),
    ).toHaveCount(1);

    const accessibility = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
    expect(accessibility.violations.map((violation) => violation.id)).toEqual(
        [],
    );
    await expect(page.locator('.soeditor-ui__notification')).toHaveCount(0);

    await setData(page, '<p>Clean</p>');
    await expect(page.locator('[data-soeditor-structured-block]')).toHaveCount(
        0,
    );
});

async function placeCaret(page: Page): Promise<void> {
    await page.locator(editor).evaluate((host) => {
        const text = host.querySelector('p')?.firstChild;
        if (text === null || text === undefined) {
            throw new Error('Editable paragraph was not projected.');
        }
        document
            .getSelection()
            ?.setBaseAndExtent(
                text,
                text.textContent?.length ?? 0,
                text,
                text.textContent?.length ?? 0,
            );
        (host as HTMLElement).focus();
    });
}

async function setData(page: Page, html: string): Promise<void> {
    await page.evaluate((sourceHtml) => {
        const harness = (
            window as Window & {
                __soeditor?: { editor: { setData(source: string): void } };
            }
        ).__soeditor;
        harness?.editor.setData(sourceHtml);
    }, html);
}
