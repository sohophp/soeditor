import { expect, test, type Page } from '@playwright/test';

async function snapshot(page: Page) {
    return page.evaluate(() => {
        const harness = Reflect.get(globalThis, '__frameworkCms') as {
            snapshot(): {
                creates: number;
                changes: number;
                errors: string[];
                live: number;
            };
        };
        return harness.snapshot();
    });
}

for (const framework of ['react', 'vue']) {
    test(`${framework} CMS edits, syncs props, resets forms and tears down`, async ({
        page,
    }) => {
        await page.goto('/framework-cms.html');
        await expect
            .poll(() => snapshot(page))
            .toMatchObject({ live: 2, errors: [] });
        const surface = page
            .locator(`#${framework}-root [contenteditable="true"]`)
            .first();
        await expect(surface).toContainText('Initial CMS content');
        await surface.locator('p').click();
        await page.keyboard.press('ControlOrMeta+End');
        await page.keyboard.type(' authored');
        await expect(page.locator(`#${framework}-value`)).toContainText(
            'authored',
        );
        expect(
            await page
                .locator(`textarea[name="${framework}Html"]`)
                .inputValue(),
        ).toContain('authored');
        await page.keyboard.press('ControlOrMeta+z');
        await expect(surface).not.toContainText('authored');
        await page.keyboard.press('ControlOrMeta+Shift+z');
        await expect(surface).toContainText('authored');
        const before = await snapshot(page);
        await page.getByRole('button', { name: 'External HTML' }).click();
        await expect(surface).toContainText('External CMS content');
        expect((await snapshot(page)).changes).toBe(before.changes);
        expect((await snapshot(page)).creates).toBe(before.creates);
        await page.getByRole('button', { name: 'Toggle readonly' }).click();
        await expect(
            page.locator(`#${framework}-root [contenteditable="true"]`),
        ).toHaveCount(0);
        await page.getByRole('button', { name: 'Toggle readonly' }).click();
        await expect(surface).toContainText('External CMS content');
        await page.getByRole('button', { name: 'Reset form' }).click();
        await expect(surface).toContainText('Initial CMS content');
        await expect(page.locator(`#${framework}-value`)).toContainText(
            'Initial CMS content',
        );
        const data = await page.evaluate(() => {
            const form = document.querySelector('form');
            if (!form) throw new Error('Missing form');
            return Object.fromEntries(new FormData(form));
        });
        expect(data[`${framework}Html`]).toBe('<p>Initial CMS content</p>');
        await page
            .getByRole('button', { name: 'Unmount', exact: true })
            .click();
        await expect
            .poll(() => snapshot(page))
            .toMatchObject({ live: 0, errors: [] });
        await page
            .getByRole('button', { name: 'Remount', exact: true })
            .click();
        await expect
            .poll(() => snapshot(page))
            .toMatchObject({ live: 2, errors: [] });
        await expect(page.locator(`#${framework}-root textarea`)).toHaveCount(
            1,
        );
    });
}

test('disposes both editors when async initialization finishes after unmount', async ({
    page,
}) => {
    await page.goto('/framework-cms.html?delay');
    await expect.poll(() => snapshot(page)).toMatchObject({ live: 2 });
    await page.getByRole('button', { name: 'External HTML' }).click();
    await page.getByRole('button', { name: 'Unmount', exact: true }).click();
    await page.getByRole('button', { name: 'Finish initialization' }).click();
    await expect
        .poll(() => snapshot(page))
        .toMatchObject({ live: 0, errors: [] });
    await expect(page.locator('[contenteditable="true"]')).toHaveCount(0);
});

test('applies latest props after async creation and loads Source only on activation', async ({
    page,
}) => {
    const sourceRequests: string[] = [];
    page.on('request', (request) => {
        if (
            /packages\/source\/src\/(index|source-engine)\.ts/.test(
                request.url(),
            )
        )
            sourceRequests.push(request.url());
    });
    await page.goto('/framework-cms.html?delay&source');
    await expect.poll(() => snapshot(page)).toMatchObject({ live: 2 });
    await page.getByRole('button', { name: 'External HTML' }).click();
    await page.getByRole('button', { name: 'Toggle readonly' }).click();
    await page.getByRole('button', { name: 'Finish initialization' }).click();
    await expect(page.locator('[contenteditable="true"]')).toHaveCount(0);
    expect(sourceRequests).toEqual([]);
    await page.getByRole('button', { name: 'Toggle readonly' }).click();
    for (const framework of ['react', 'vue'])
        await expect(
            page.locator(`#${framework}-root [contenteditable="true"]`).first(),
        ).toContainText('External CMS content');
    await page.evaluate(async () => {
        const harness = Reflect.get(globalThis, '__frameworkCms') as {
            source(): Promise<void>;
        };
        await harness.source();
    });
    await expect.poll(() => sourceRequests.length).toBeGreaterThan(0);
    await expect(page.locator('.cm-editor')).toHaveCount(2);
    expect((await snapshot(page)).errors).toEqual([]);
});

test('a canceled native input does not disable external mutation repair', async ({
    page,
}) => {
    await page.goto('/framework-cms.html');
    const surface = page
        .locator('#react-root [contenteditable="true"]')
        .first();
    await expect(surface).toContainText('Initial CMS content');
    await surface.evaluate((element) => {
        element.addEventListener(
            'beforeinput',
            (event) => event.preventDefault(),
            { once: true },
        );
        element.dispatchEvent(
            new InputEvent('beforeinput', {
                bubbles: true,
                cancelable: true,
                inputType: 'insertText',
                data: 'canceled',
            }),
        );
        const paragraph = element.querySelector('p');
        if (paragraph) paragraph.textContent = 'Uncommitted mutation';
    });
    await expect(surface).toContainText('Initial CMS content');
    expect((await snapshot(page)).changes).toBe(0);
});

test('reports failed mounts and permits a fresh mount to recover', async ({
    page,
}) => {
    await page.goto('/framework-cms.html?fail');
    await expect
        .poll(() => snapshot(page))
        .toMatchObject({
            live: 0,
            errors: [
                'Error: Expected CMS mount failure',
                'Error: Expected CMS mount failure',
            ],
        });
    await page.getByRole('button', { name: 'Unmount', exact: true }).click();
    await page.getByRole('button', { name: 'Remount', exact: true }).click();
    await expect.poll(() => snapshot(page)).toMatchObject({ live: 2 });
    await expect(page.locator('[contenteditable="true"]')).toHaveCount(2);
});
