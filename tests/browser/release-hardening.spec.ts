import { expect, test, type Page } from '@playwright/test';

test('exposes the documented Classic, Developer, Markdown, and CMS examples', async ({
    page,
}) => {
    await page.goto('/?preset=classic');
    await expect(page.locator('body')).toHaveAttribute('data-demo', 'classic');
    await expect(page.locator('[data-toolbar-item="source"]')).toBeVisible();
    await expect(page.locator('[data-toolbar-item="problems"]')).toHaveCount(0);

    await page.goto('/');
    await expect(page.locator('body')).toHaveAttribute(
        'data-demo',
        'developer',
    );
    await expect(page.locator('[data-toolbar-item="problems"]')).toBeVisible();

    await page.goto('/?format=markdown');
    await expect(page.locator('body')).toHaveAttribute('data-demo', 'markdown');
    await expect(
        page.locator('[data-testid="markdown-editor"] .cm-content'),
    ).toHaveAttribute('aria-label', 'Markdown editor');

    await page.goto('/?example=cms&files=sofinder');
    await expect(page.locator('body')).toHaveAttribute(
        'data-demo',
        'cms-sofinder',
    );
    await expect(page.locator('[data-testid="source"]')).toContainText(
        '<!--CMS:block:42-->',
    );
    await expect(page.getByRole('navigation')).toContainText('Classic editor');
});

test('keeps CMS markers and custom elements through SoFinder image insertion and preview', async ({
    page,
}) => {
    const pageErrors = monitorPageErrors(page);
    await page.goto('/?example=cms&files=sofinder');
    await page.locator('[data-testid="editor"]').evaluate((host) => {
        const text = host.querySelector('p')?.firstChild;
        if (text === null || text === undefined) {
            throw new Error('CMS example paragraph was not projected.');
        }
        document.getSelection()?.setBaseAndExtent(text, 0, text, 0);
        (host as HTMLElement).focus();
    });
    await page.locator('[data-toolbar-item="image-browse"]').click();

    const source = page.locator('[data-testid="source"]');
    await expect(source).toContainText('<!--CMS:block:42-->');
    await expect(source).toContainText('<product-card data-id="123">');
    await expect(source).toContainText('src="/sofinder-image.png"');

    await page.locator('[data-toolbar-item="preview"]').click();
    const frame = page.frameLocator('[data-testid="preview"] iframe');
    await expect(frame.locator('product-card')).toHaveAttribute(
        'data-id',
        '123',
    );
    await expect(frame.locator('img')).toHaveAttribute(
        'src',
        '/sofinder-image.png',
    );
    expect(await frame.locator('body').innerHTML()).toContain(
        '<!--CMS:block:42-->',
    );
    expect(pageErrors).toEqual([]);
});

test('provides accessible release surfaces and named keyboard controls', async ({
    page,
}) => {
    await page.goto('/');
    await expect(page.getByRole('main')).toBeVisible();
    await expect(
        page.getByRole('navigation', { name: 'Playground examples' }),
    ).toBeVisible();
    await expect(
        page.getByRole('toolbar', { name: 'Editor toolbar' }),
    ).toBeVisible();
    await expect(page.getByRole('status')).toHaveAttribute(
        'aria-live',
        'polite',
    );
    await expect(page.getByRole('textbox').first()).toHaveAttribute(
        'aria-multiline',
        'true',
    );

    const audit = await page.evaluate(() => {
        const duplicateIds = [...document.querySelectorAll('[id]')]
            .map((element) => element.id)
            .filter((id, index, ids) => ids.indexOf(id) !== index);
        const unnamed = [
            ...document.querySelectorAll<HTMLElement>(
                'button, a[href], input, select, textarea, summary',
            ),
        ]
            .filter((element) => !element.hidden)
            .filter((element) => {
                const name =
                    element.getAttribute('aria-label') ??
                    element.getAttribute('title') ??
                    element.textContent ??
                    (element instanceof HTMLInputElement ? element.value : '');
                return name.trim().length === 0;
            })
            .map((element) => element.outerHTML);
        return { duplicateIds, unnamed };
    });
    expect(audit).toEqual({ duplicateIds: [], unnamed: [] });

    await page.locator('[data-toolbar-item="source"]').click();
    await expect(
        page.locator('[data-testid="source-editor"] .cm-content'),
    ).toHaveAttribute('aria-label', 'HTML source editor');
    await page.locator('[data-toolbar-item="preview"]').click();
    await expect(
        page.locator('[data-testid="preview"] iframe'),
    ).toHaveAttribute('title', 'SoEditor content preview');
});

test('survives repeated editor and surface lifecycles within the release budget', async ({
    page,
}) => {
    await page.goto('/?preset=classic');
    const result = await page.evaluate(async () => {
        const harness = (
            window as Window & {
                __soeditor?: {
                    Editor: {
                        create(options: unknown): Promise<{
                            destroy(): Promise<void>;
                        }>;
                    };
                    createEditorUi(options: unknown): { destroy(): void };
                    createVisualEditingEngine(options: unknown): {
                        destroy(): void;
                    };
                    minimalPreset: {
                        format: string;
                        plugins: readonly unknown[];
                        toolbar: readonly unknown[];
                    };
                };
            }
        ).__soeditor;
        if (harness === undefined) {
            throw new Error('Release harness was not exposed.');
        }
        const scratch = document.createElement('section');
        document.body.append(scratch);
        const started = performance.now();
        for (let index = 0; index < 20; index += 1) {
            const uiHost = document.createElement('div');
            const visualHost = document.createElement('div');
            scratch.append(uiHost, visualHost);
            const editor = await harness.Editor.create({
                data: `<p>Lifecycle ${String(index)}</p>`,
                format: harness.minimalPreset.format,
                plugins: harness.minimalPreset.plugins,
            });
            const visual = harness.createVisualEditingEngine({
                editor,
                element: visualHost,
            });
            const ui = harness.createEditorUi({
                editor,
                element: uiHost,
                toolbar: harness.minimalPreset.toolbar,
            });
            ui.destroy();
            visual.destroy();
            await editor.destroy();
            uiHost.remove();
            visualHost.remove();
        }
        const duration = performance.now() - started;
        const residue = scratch.querySelectorAll(
            '.soeditor-ui__chrome, [contenteditable], .soeditor-visual-root',
        ).length;
        scratch.remove();
        return { duration, residue };
    });

    expect(result.residue).toBe(0);
    expect(result.duration).toBeLessThan(6_000);
});

function monitorPageErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
    });
    return errors;
}
