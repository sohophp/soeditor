import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test('exposes the documented Classic, Developer, Markdown, and CMS examples', async ({
    page,
}) => {
    await page.goto('/?preset=classic');
    await expect(page.locator('body')).toHaveAttribute('data-demo', 'classic');
    await expect(page.locator('[data-toolbar-item="source"]')).toBeVisible();
    await expect(page.locator('[data-toolbar-item="problems"]')).toHaveCount(0);

    await page.goto('/?developer=1');
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
    await expect(
        page.locator(
            '[data-soeditor-structured-block="playground.product-card"]',
        ),
    ).toHaveAttribute('contenteditable', 'false');
    await expect(page.getByRole('navigation')).toContainText('Classic editor');
});

test('keeps CMS markers and custom elements through SoFinder image insertion and preview', async ({
    page,
}) => {
    await page.route('https://example.test/**', (route) =>
        route.fulfill({ status: 204 }),
    );
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
    await page.goto('/?developer=1');
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
    await expect(
        page.getByRole('log', { name: 'Editor notifications' }),
    ).toBeAttached();
    await expect(page.getByRole('textbox').first()).toHaveAttribute(
        'aria-multiline',
        'true',
    );
    await expect(page.getByRole('textbox').first()).toHaveAttribute(
        'aria-label',
        'Developer Visual editor',
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

test('has no automated WCAG A/AA violations across primary projections', async ({
    page,
}) => {
    for (const scenario of [
        { ready: '[data-testid="editor"]', url: '/?developer=1' },
        {
            ready: '[data-testid="markdown-editor"] .cm-content',
            url: '/?format=markdown',
        },
    ]) {
        await page.goto(scenario.url);
        await expect(page.locator(scenario.ready)).toBeVisible();
        await expectWcagScanToPass(page);
    }

    await page.goto('/?developer=1');
    await page.locator('[data-toolbar-item="problems"]').click();
    await expect(page.locator('.soeditor-ui__panel')).toHaveAttribute(
        'aria-label',
        'Problems',
    );
    await expectWcagScanToPass(page);

    await page.goto('/?developer=1');
    await page.locator('[data-toolbar-item="preview"]').click();
    await expect(page.locator('[data-testid="preview"] iframe')).toBeVisible();
    await expectWcagScanToPass(page, '[data-testid="preview"] iframe');
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
        const labeledHost = document.createElement('div');
        labeledHost.setAttribute('aria-label', 'CMS field');
        scratch.append(labeledHost);
        const labeledEditor = await harness.Editor.create({
            data: '<p>Accessible</p>',
            plugins: harness.minimalPreset.plugins,
        });
        const labeledVisual = harness.createVisualEditingEngine({
            ariaLabel: 'Article visual editor',
            editor: labeledEditor,
            element: labeledHost,
        });
        const mountedLabel = labeledHost.getAttribute('aria-label');
        labeledVisual.destroy();
        await labeledEditor.destroy();
        const restoredLabel = labeledHost.getAttribute('aria-label');
        labeledHost.remove();

        const invalidHost = document.createElement('div');
        scratch.append(invalidHost);
        const invalidEditor = await harness.Editor.create({
            data: '<p>Invalid label</p>',
            plugins: harness.minimalPreset.plugins,
        });
        let invalidLabelError = '';
        try {
            harness.createVisualEditingEngine({
                ariaLabel: ' ',
                editor: invalidEditor,
                element: invalidHost,
            });
        } catch (error: unknown) {
            invalidLabelError =
                error instanceof Error ? error.message : 'unknown';
        }
        await invalidEditor.destroy();
        invalidHost.remove();

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
        return {
            duration,
            invalidLabelError,
            mountedLabel,
            residue,
            restoredLabel,
        };
    });

    expect(result.mountedLabel).toBe('Article visual editor');
    expect(result.restoredLabel).toBe('CMS field');
    expect(result.invalidLabelError).toContain('must not be empty');
    expect(result.residue).toBe(0);
    expect(result.duration).toBeLessThan(6_000);
});

test('keeps large-document projection and input within integration budgets', async ({
    page,
}) => {
    await page.goto('/?preset=classic');
    const result = await page.evaluate(() => {
        const harness = (
            window as Window & {
                __soeditor?: {
                    editor: {
                        getData(): string;
                        setData(source: string): void;
                    };
                };
            }
        ).__soeditor;
        if (harness === undefined)
            throw new Error('Release harness is missing.');
        const source = Array.from(
            { length: 1_000 },
            (_, index) => `<p>Large row ${String(index)}</p>`,
        ).join('');
        const projectionStarted = performance.now();
        harness.editor.setData(source);
        const projectionDuration = performance.now() - projectionStarted;
        const host = document.querySelector<HTMLElement>(
            '[data-testid="editor"]',
        );
        const text = host?.querySelector('p')?.firstChild;
        if (host === null || host === undefined || !(text instanceof Text)) {
            throw new Error('Large document was not visually projected.');
        }
        host.focus();
        document.getSelection()?.setBaseAndExtent(text, 0, text, 0);
        const inputStarted = performance.now();
        host.dispatchEvent(
            new InputEvent('beforeinput', {
                bubbles: true,
                cancelable: true,
                data: 'X',
                inputType: 'insertText',
            }),
        );
        return {
            inputDuration: performance.now() - inputStarted,
            paragraphCount: host.querySelectorAll('p').length,
            projectedSource: harness.editor
                .getData()
                .startsWith('<p>XLarge row 0</p>'),
            projectionDuration,
        };
    });

    expect(result.paragraphCount).toBe(1_000);
    expect(result.projectedSource).toBe(true);
    expect(result.projectionDuration).toBeLessThan(4_000);
    expect(result.inputDuration).toBeLessThan(1_000);
});

function monitorPageErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
    });
    return errors;
}

async function expectWcagScanToPass(
    page: Page,
    excludedSelector?: string,
): Promise<void> {
    let builder = new AxeBuilder({ page }).withTags([
        'wcag2a',
        'wcag2aa',
        'wcag21a',
        'wcag21aa',
    ]);
    if (excludedSelector !== undefined) {
        builder = builder.exclude(excludedSelector);
    }
    const results = await builder.analyze();
    expect(
        results.violations.map((violation) => ({
            id: violation.id,
            impact: violation.impact,
            nodes: violation.nodes.map((node) => ({
                failureSummary: node.failureSummary,
                html: node.html,
                target: node.target,
            })),
        })),
    ).toEqual([]);
}
