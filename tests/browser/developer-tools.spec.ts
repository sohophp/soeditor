import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.goto('/');
});

test('shows selection element path and a read-only HTML inspector', async ({
    page,
}) => {
    await page.locator('[data-testid="editor"] strong').click();
    await expect(page.locator('.soeditor-ui__status')).toContainText(
        'p > strong',
    );

    const inspector = page.locator('[data-toolbar-item="inspector"]');
    await expect(inspector).toBeEnabled();
    await inspector.click();
    const panel = page.locator('.soeditor-ui__panel');
    await expect(panel).toHaveAttribute('aria-label', 'HTML Inspector');
    await expect(panel).toContainText('<strong>');
    await expect(panel).toContainText('p > strong');
    await panel.getByRole('button', { name: 'Close HTML Inspector' }).click();
    await expect(panel).toHaveCount(0);
});

test('validates Problems and navigates a source-backed diagnostic to CodeMirror', async ({
    page,
}) => {
    await page.evaluate(() => {
        const harness = (window as Window & { __soeditor?: DeveloperHarness })
            .__soeditor;
        if (harness === undefined)
            throw new Error('Missing developer harness.');
        harness.editor.setData('<h1>Title</h1><img src="image.png">');
    });
    await page.locator('[data-toolbar-item="problems"]').click();
    const panel = page.locator('.soeditor-ui__panel');
    await expect(panel).toHaveAttribute('aria-label', 'Problems');
    const problem = panel.getByRole('button', { name: /missing an alt/i });
    await expect(problem).toBeVisible();
    await problem.click();
    await expect(page.locator('[data-testid="source-editor"]')).toBeVisible();
    await expect(page.locator('.soeditor-ui__status')).toContainText('Source');
    await expect(
        page.locator('[data-testid="source-editor"] .cm-selectionBackground'),
    ).toHaveCount(1);
});

test('builds a heading outline and navigates headings into Source mode', async ({
    page,
}) => {
    await page.evaluate(() => {
        const harness = (window as Window & { __soeditor?: DeveloperHarness })
            .__soeditor;
        if (harness === undefined)
            throw new Error('Missing developer harness.');
        harness.editor.setData(
            '<h1>Page title</h1><section><h2>First section</h2><product-card><h3>Custom section</h3></product-card></section>',
        );
    });
    await page.locator('[data-toolbar-item="outline"]').click();
    const panel = page.locator('.soeditor-ui__panel');
    await expect(
        panel.locator('.soeditor-dev-tools__outline button'),
    ).toHaveCount(3);
    await expect(panel).toContainText('Custom section');
    await panel.getByRole('button', { name: 'First section' }).click();
    await expect(page.locator('[data-testid="source-editor"]')).toBeVisible();
    await expect(
        page.locator('[data-testid="source-editor"] .cm-selectionBackground'),
    ).toHaveCount(1);
});

test('opens CodeMirror Find/Replace through a shared developer command', async ({
    page,
}) => {
    await page.locator('[data-toolbar-item="find-replace"]').click();
    await expect(page.locator('[data-testid="source-editor"]')).toBeVisible();
    await expect(
        page.locator('[data-testid="source-editor"] .cm-search'),
    ).toBeVisible();

    await page.evaluate(() => {
        const harness = (window as Window & { __soeditor?: DeveloperHarness })
            .__soeditor;
        if (harness === undefined)
            throw new Error('Missing developer harness.');
        harness.editor.execute('developer.find', 'SoEditor');
    });
    await expect(
        page.locator('[data-testid="source-editor"] .cm-search input').first(),
    ).toHaveValue('SoEditor');
});

test('filters and executes labeled commands from Mod-Shift-P palette', async ({
    page,
}) => {
    await page.evaluate(() => {
        const harness = (window as Window & { __soeditor?: DeveloperHarness })
            .__soeditor;
        if (harness === undefined)
            throw new Error('Missing developer harness.');
        harness.editor.setData('<p>  Needs formatting </p>');
    });
    await page.locator('[data-testid="editor"]').click();
    await page.keyboard.press('Control+Shift+P');
    const dialog = page.getByRole('dialog', { name: 'Command Palette' });
    await expect(dialog).toBeVisible();
    const filter = dialog.getByRole('searchbox', { name: 'Filter commands' });
    await filter.fill('format html');
    const format = dialog.locator('[data-command-id="document.format"]');
    await expect(format).toHaveText('Format HTML');
    await format.click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('[data-testid="source"]')).toContainText(
        'Needs formatting',
    );
});

test('rejects duplicate and non-HTML developer engine attachment safely', async ({
    page,
}) => {
    const result = await page.evaluate(async () => {
        const harness = (window as Window & { __soeditor?: DeveloperHarness })
            .__soeditor;
        if (harness === undefined)
            throw new Error('Missing developer harness.');
        let duplicate = '';
        try {
            harness.createDeveloperToolsEngine({
                editor: harness.editor,
                ui: harness.ui,
                visualElement: document.querySelector<HTMLElement>(
                    '[data-testid="editor"]',
                )!,
            });
        } catch (error: unknown) {
            duplicate = error instanceof Error ? error.name : 'unknown';
        }
        const markdown = await harness.Editor.create({ format: 'markdown' });
        const host = document.createElement('div');
        document.body.append(host);
        let unsupported = '';
        try {
            harness.createDeveloperToolsEngine({
                editor: markdown,
                ui: harness.ui,
                visualElement: host,
            });
        } catch (error: unknown) {
            unsupported = error instanceof Error ? error.name : 'unknown';
        }
        await markdown.destroy();
        host.remove();
        return { duplicate, unsupported };
    });

    expect(result).toEqual({
        duplicate: 'ServiceAlreadyRegisteredError',
        unsupported: 'UnsupportedDeveloperToolsDocumentFormatError',
    });
});

test('cleans up idempotently and makes retained developer services terminal', async ({
    page,
}) => {
    const result = await page.evaluate(() => {
        const harness = (window as Window & { __soeditor?: DeveloperHarness })
            .__soeditor;
        if (harness === undefined)
            throw new Error('Missing developer harness.');
        const service = harness.editor.services.get(
            harness.developerToolsServiceToken,
        );
        harness.developerToolsEngine?.destroy();
        harness.developerToolsEngine?.destroy();
        let terminal = '';
        try {
            service.getOutline();
        } catch (error: unknown) {
            terminal = error instanceof Error ? error.name : 'unknown';
        }
        return {
            registered: harness.editor.services.has(
                harness.developerToolsServiceToken,
            ),
            terminal,
        };
    });

    expect(result).toEqual({
        registered: false,
        terminal: 'DeveloperToolsEngineDestroyedError',
    });
    await expect(page.locator('[data-toolbar-item="problems"]')).toBeDisabled();
    await expect(page.locator('.soeditor-ui__status')).toHaveText(
        'Visual · Saved',
    );
});

interface DeveloperHarness {
    Editor: {
        create(options: {
            format: 'markdown';
        }): Promise<DeveloperHarness['editor']>;
    };
    createDeveloperToolsEngine(options: {
        editor: DeveloperHarness['editor'];
        ui: unknown;
        visualElement: HTMLElement;
    }): { destroy(): void };
    developerToolsEngine?: { destroy(): void };
    developerToolsServiceToken: unknown;
    editor: {
        destroy(): Promise<void>;
        execute(id: string, ...args: readonly unknown[]): unknown;
        services: {
            get(token: unknown): { getOutline(): readonly unknown[] };
            has(token: unknown): boolean;
        };
        setData(source: string): void;
    };
    ui: unknown;
}
