import { expect, test, type Page } from '@playwright/test';

const preview = '[data-testid="preview"]';
const previewButton = '[data-toolbar-item="preview"]';
const source = '[data-testid="source"]';

test.beforeEach(async ({ page }) => {
    await page.goto('/?developer=1');
    await expect(page.locator(previewButton)).toBeEnabled();
});

test('renders configured fragment preview in an isolated iframe', async ({
    page,
}) => {
    await page.locator(previewButton).click();
    await expect(page.locator(preview)).toBeVisible();
    await expect(page.locator('[data-testid="editor"]')).toBeHidden();
    await expect(page.locator('[data-testid="source-editor"]')).toBeHidden();
    await expect(page.locator('.soeditor-ui__status')).toHaveText(
        'Preview · Saved',
    );

    const iframe = page.locator(`${preview} iframe`);
    await expect(iframe).toHaveAttribute('sandbox', '');
    await expect(iframe).toHaveAttribute('referrerpolicy', 'no-referrer');
    await expect(iframe).toHaveAttribute('title', 'SoEditor content preview');
    const frame = page.frameLocator(`${preview} iframe`);
    await expect(frame.locator('article')).toHaveAttribute(
        'data-section',
        'Article',
    );
    await expect(frame.locator('product-card')).toHaveAttribute(
        'data-id',
        '123',
    );
    await expect(frame.locator('link[rel="stylesheet"]')).toHaveAttribute(
        'href',
        /data:text\/css/,
    );
    expect(
        await frame.locator('body').evaluate((body) => body.innerHTML),
    ).toContain('<!--CMS:block-->');
});

test('refreshes from canonical source and resolves relative URLs against the configured base', async ({
    page,
}) => {
    await setData(page, '<p><a href="page">New preview</a></p>');
    await page.locator(previewButton).click();
    const frame = page.frameLocator(`${preview} iframe`);
    expect(
        await frame
            .getByRole('link', { name: 'New preview' })
            .evaluate((link) => (link as HTMLAnchorElement).href),
    ).toBe('https://example.test/content/page');

    await setData(page, '<p>Externally changed</p>');
    await expect(frame.locator('body')).toContainText('Externally changed');
    await frame.locator('body').evaluate((body) => {
        body.textContent = 'tampered preview DOM';
    });
    await execute(page, 'preview.refresh');
    await expect(frame.locator('body')).toContainText('Externally changed');
    await expect(page.locator(source)).toHaveText('<p>Externally changed</p>');
});

test('prevents preserved executable source and source policies from taking control', async ({
    page,
}) => {
    await setData(
        page,
        '<meta http-equiv="refresh" content="0;url=https://attacker.invalid"><meta http-equiv="Content-Security-Policy" content="script-src *"><base href="https://attacker.invalid/"><p onclick="window.__soeditorExecuted=true">Safe text</p><script>window.__soeditorExecuted=true</script><iframe src="https://attacker.invalid/"></iframe>',
    );
    await page.locator(previewButton).click();
    const frame = page.frameLocator(`${preview} iframe`);
    await expect(frame.getByText('Safe text')).toBeVisible();
    await expect(frame.locator('meta[http-equiv="refresh"]')).toHaveCount(0);
    await expect(
        frame.locator('meta[http-equiv="Content-Security-Policy"]'),
    ).toHaveCount(1);
    await expect(frame.locator('base')).toHaveAttribute(
        'href',
        'https://example.test/content/',
    );
    expect(
        await frame
            .locator('html')
            .evaluate(() => Reflect.get(window, '__soeditorExecuted')),
    ).toBeUndefined();
    expect(
        await page.evaluate(() => Reflect.get(window, '__soeditorExecuted')),
    ).toBeUndefined();
    await expect(page.locator(source)).toContainText('<script>');
});

test('previews complete documents without nesting them in the fragment template', async ({
    page,
}) => {
    await setData(
        page,
        '<!doctype html><html lang="en"><head><title>Complete preview</title></head><body><main>Whole page</main></body></html>',
    );
    await page.locator(previewButton).click();
    const frame = page.frameLocator(`${preview} iframe`);
    await expect(frame.locator('main')).toHaveText('Whole page');
    await expect(frame.locator('article')).toHaveCount(0);
    await expect(frame.locator('html')).toHaveAttribute('lang', 'en');
    expect(await frame.locator('title').textContent()).toBe('Complete preview');
});

test('returns to the mode that opened preview', async ({ page }) => {
    await page.locator('[data-toolbar-item="source"]').click();
    await expect(page.locator('.soeditor-ui__status')).toHaveText(
        'Source · Saved',
    );
    await page.locator(previewButton).click();
    await expect(page.locator('.soeditor-ui__status')).toHaveText(
        'Preview · Saved',
    );
    await page.locator(previewButton).click();
    await expect(page.locator('.soeditor-ui__status')).toHaveText(
        'Source · Saved',
    );
    await expect(page.locator('[data-testid="source-editor"]')).toBeVisible();
});

test('rejects unsafe attachment and makes retained service terminal on destruction', async ({
    page,
}) => {
    const result = await page.evaluate(() => {
        const harness = (window as Window & { __soeditor?: PreviewHarness })
            .__soeditor;
        if (harness === undefined) {
            throw new Error('Playground preview was not exposed.');
        }
        const nonempty = document.createElement('div');
        nonempty.textContent = 'caller-owned';
        document.body.append(nonempty);
        let nonemptyError = '';
        let duplicateError = '';
        try {
            harness.createPreviewEngine({
                editor: harness.editor,
                element: nonempty,
            });
        } catch (error: unknown) {
            nonemptyError = error instanceof Error ? error.name : 'unknown';
        }
        const empty = document.createElement('div');
        document.body.append(empty);
        try {
            harness.createPreviewEngine({
                editor: harness.editor,
                element: empty,
            });
        } catch (error: unknown) {
            duplicateError = error instanceof Error ? error.name : 'unknown';
        }
        const service = harness.editor.services.get(
            harness.previewServiceToken,
        );
        harness.editor.execute('editor.preview');
        const disposeFailure = harness.editor.events.on('state:change', () => {
            throw new Error('cleanup listener failed');
        });
        let cleanupError = '';
        try {
            harness.previewEngine.destroy();
        } catch (error: unknown) {
            cleanupError = error instanceof Error ? error.name : 'unknown';
        }
        disposeFailure();
        harness.previewEngine.destroy();
        let terminalError = '';
        try {
            service.refresh();
        } catch (error: unknown) {
            terminalError = error instanceof Error ? error.name : 'unknown';
        }
        return {
            cleanupError,
            duplicateError,
            mode: harness.editor.state.mode,
            nonemptyError,
            nonemptyText: nonempty.textContent,
            terminalError,
        };
    });

    expect(result).toEqual({
        cleanupError: 'AggregateError',
        duplicateError: 'ServiceAlreadyRegisteredError',
        mode: 'visual',
        nonemptyError: 'PreviewHostNotEmptyError',
        nonemptyText: 'caller-owned',
        terminalError: 'PreviewEngineDestroyedError',
    });
    await expect(page.locator(`${preview} iframe`)).toHaveCount(0);
    await expect(page.locator(previewButton)).toBeDisabled();
});

async function setData(page: Page, value: string): Promise<void> {
    await page.evaluate((sourceValue) => {
        const harness = (window as Window & { __soeditor?: PreviewHarness })
            .__soeditor;
        if (harness === undefined) {
            throw new Error('Playground preview was not exposed.');
        }
        harness.editor.setData(sourceValue);
    }, value);
}

async function execute(page: Page, command: string): Promise<void> {
    await page.evaluate((commandId) => {
        const harness = (window as Window & { __soeditor?: PreviewHarness })
            .__soeditor;
        if (harness === undefined) {
            throw new Error('Playground preview was not exposed.');
        }
        harness.editor.execute(commandId);
    }, command);
}

interface PreviewHarness {
    readonly createPreviewEngine: (options: {
        editor: PreviewHarness['editor'];
        element: HTMLElement;
    }) => unknown;
    readonly editor: {
        readonly events: {
            on(event: string, listener: () => void): () => void;
        };
        readonly services: {
            get(token: unknown): { refresh(): void };
        };
        readonly state: { readonly mode: string };
        execute(command: string): unknown;
        setData(source: string): void;
    };
    readonly previewEngine: { destroy(): void };
    readonly previewServiceToken: unknown;
}
