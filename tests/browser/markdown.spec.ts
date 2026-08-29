import { expect, test } from '@playwright/test';

const markdownUrl = '/?format=markdown';
const markdownHost = '[data-testid="markdown-editor"]';
const previewButton = '[data-toolbar-item="preview"]';

test.beforeEach(async ({ page }) => {
    await page.goto(markdownUrl);
});

test('edits exact canonical Markdown in a dedicated CodeMirror surface', async ({
    page,
}) => {
    await expect(page.locator(markdownHost)).toBeVisible();
    await expect(page.locator('[data-testid="editor"]')).toBeHidden();
    await expect(page.locator('[data-testid="source-editor"]')).toBeHidden();
    await expect(page.locator(`${markdownHost} .cm-editor`)).toHaveCount(1);
    await expect(
        page.locator(`${markdownHost} .cm-content span`).first(),
    ).toBeVisible();
    await expect(page.locator('#state')).toContainText('"format": "markdown"');
    await expect(page.locator('#state')).toContainText('"mode": "markdown"');

    const content = page.locator(`${markdownHost} .cm-content`);
    await content.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.insertText('# Changed\n\nExact *Markdown* source.');
    await expect(page.locator('[data-testid="source"]')).toHaveText(
        '# Changed\n\nExact *Markdown* source.',
    );
    await expect(page.locator('.soeditor-ui__status')).toHaveText(
        'Markdown · Unsaved',
    );
});

test('uses shared Core history and synchronizes external source changes', async ({
    page,
}) => {
    const original = await page.locator('[data-testid="source"]').textContent();
    const content = page.locator(`${markdownHost} .cm-content`);
    await content.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.insertText('# Replacement');
    await page.locator('[data-toolbar-item="undo"]').click();
    await expect(page.locator('[data-testid="source"]')).toHaveText(
        original ?? '',
    );
    await page.locator('[data-toolbar-item="redo"]').click();
    await expect(page.locator('[data-testid="source"]')).toHaveText(
        '# Replacement',
    );

    await page.evaluate(() => {
        const harness = (window as Window & { __soeditor?: MarkdownHarness })
            .__soeditor;
        if (harness === undefined) {
            throw new Error('Playground Markdown harness was not exposed.');
        }
        harness.editor.setData('## External\n\nUpdate');
    });
    await expect(content).toContainText('External');
    await expect(content).toContainText('Update');
});

test('previews CommonMark and raw HTML in the isolated sandbox and returns to Markdown', async ({
    page,
}) => {
    await page.evaluate(() => {
        const harness = (window as Window & { __soeditor?: MarkdownHarness })
            .__soeditor;
        if (harness === undefined) {
            throw new Error('Playground Markdown harness was not exposed.');
        }
        harness.editor.setData(
            '# Preview heading\n\n- one\n- two\n\n<product-card data-id="9"></product-card>\n\n<script>window.__markdownExecuted=true</script>',
        );
    });
    await page.locator(previewButton).click();
    await expect(page.locator(markdownHost)).toBeHidden();
    const frame = page.frameLocator('[data-testid="preview"] iframe');
    await expect(
        frame.getByRole('heading', { name: 'Preview heading' }),
    ).toBeVisible();
    await expect(frame.locator('li')).toHaveCount(2);
    await expect(frame.locator('product-card')).toHaveAttribute('data-id', '9');
    expect(
        await frame
            .locator('html')
            .evaluate(() => Reflect.get(window, '__markdownExecuted')),
    ).toBeUndefined();
    expect(
        await page.evaluate(() => Reflect.get(window, '__markdownExecuted')),
    ).toBeUndefined();

    await page.locator(previewButton).click();
    await expect(page.locator(markdownHost)).toBeVisible();
    await expect(page.locator('.soeditor-ui__status')).toContainText(
        'Markdown',
    );
});

test('enforces readonly state in Markdown source editing', async ({ page }) => {
    await page.goto(`${markdownUrl}&readonly`);
    const content = page.locator(`${markdownHost} .cm-content`);
    await expect(content).toHaveAttribute('contenteditable', 'false');
    const source = await page.locator('[data-testid="source"]').textContent();
    await content.click();
    await page.keyboard.insertText('blocked');
    await expect(page.locator('[data-testid="source"]')).toHaveText(
        source ?? '',
    );
});

test('rejects incompatible and duplicate engines without mutating caller hosts', async ({
    page,
}) => {
    const result = await page.evaluate(() => {
        const harness = (window as Window & { __soeditor?: MarkdownHarness })
            .__soeditor;
        if (harness === undefined) {
            throw new Error('Playground Markdown harness was not exposed.');
        }
        const visual = document.createElement('div');
        visual.textContent = 'visual-owned';
        const source = document.createElement('div');
        source.textContent = 'source-owned';
        const duplicate = document.createElement('div');
        document.body.append(visual, source, duplicate);
        const readError = (run: () => void): string => {
            try {
                run();
                return '';
            } catch (error: unknown) {
                return error instanceof Error ? error.name : 'unknown';
            }
        };
        return {
            duplicate: readError(() => {
                harness.createMarkdownEditingEngine({
                    editor: harness.editor,
                    element: duplicate,
                });
            }),
            duplicateChildren: duplicate.childNodes.length,
            source: readError(() => {
                harness.createSourceEditingEngine({
                    editor: harness.editor,
                    element: source,
                });
            }),
            sourceText: source.textContent,
            visual: readError(() => {
                harness.createVisualEditingEngine({
                    editor: harness.editor,
                    element: visual,
                });
            }),
            visualText: visual.textContent,
        };
    });

    expect(result).toEqual({
        duplicate: 'ServiceAlreadyRegisteredError',
        duplicateChildren: 0,
        source: 'UnsupportedSourceDocumentFormatError',
        sourceText: 'source-owned',
        visual: 'UnsupportedVisualDocumentFormatError',
        visualText: 'visual-owned',
    });
});

test('fails an unsupported initial Preview before mutating its host or services', async ({
    page,
}) => {
    const result = await page.evaluate(async () => {
        const harness = (window as Window & { __soeditor?: MarkdownHarness })
            .__soeditor;
        if (harness === undefined) {
            throw new Error('Playground Markdown harness was not exposed.');
        }
        const editor = await harness.Editor.create({
            format: 'markdown',
            mode: 'preview',
        });
        const host = document.createElement('div');
        document.body.append(host);
        let errorName = '';
        try {
            harness.createPreviewEngine({ editor, element: host });
        } catch (error: unknown) {
            errorName = error instanceof Error ? error.name : 'unknown';
        }
        const result = {
            errorName,
            hostChildren: host.childNodes.length,
            serviceRegistered: editor.services.has(harness.previewServiceToken),
        };
        await editor.destroy();
        host.remove();
        return result;
    });

    expect(result).toEqual({
        errorName: 'UnsupportedPreviewDocumentFormatError',
        hostChildren: 0,
        serviceRegistered: false,
    });
});

test('makes retained Markdown services terminal after idempotent cleanup', async ({
    page,
}) => {
    const errorName = await page.evaluate(() => {
        const harness = (window as Window & { __soeditor?: MarkdownHarness })
            .__soeditor;
        if (harness === undefined) {
            throw new Error('Playground Markdown harness was not exposed.');
        }
        const service = harness.editor.services.get(
            harness.markdownEditingServiceToken,
        );
        harness.markdownEngine?.destroy();
        harness.markdownEngine?.destroy();
        try {
            service.focus();
            return '';
        } catch (error: unknown) {
            return error instanceof Error ? error.name : 'unknown';
        }
    });
    expect(errorName).toBe('MarkdownEditingEngineDestroyedError');
    await expect(page.locator(`${markdownHost} .cm-editor`)).toHaveCount(0);
});

interface MarkdownHarness {
    Editor: {
        create(options: {
            format: 'markdown';
            mode: 'preview';
        }): Promise<MarkdownHarness['editor']>;
    };
    createMarkdownEditingEngine(options: {
        editor: MarkdownHarness['editor'];
        element: HTMLElement;
    }): { destroy(): void };
    createSourceEditingEngine(options: {
        editor: MarkdownHarness['editor'];
        element: HTMLElement;
    }): { destroy(): void };
    createPreviewEngine(options: {
        editor: MarkdownHarness['editor'];
        element: HTMLElement;
    }): { destroy(): void };
    createVisualEditingEngine(options: {
        editor: MarkdownHarness['editor'];
        element: HTMLElement;
    }): { destroy(): void };
    editor: {
        getData(): string;
        services: {
            get(token: unknown): { focus(): void };
            has(token: unknown): boolean;
        };
        setData(source: string): void;
        destroy(): Promise<void>;
    };
    markdownEditingServiceToken: unknown;
    markdownEngine?: { destroy(): void };
    previewServiceToken: unknown;
}
