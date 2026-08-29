import { expect, test, type Page } from '@playwright/test';

const visualHost = '[data-testid="editor"]';
const sourceHost = '[data-testid="source-editor"]';
const markdownHost = '[data-testid="markdown-editor"]';
const previewHost = '[data-testid="preview"]';
const canonicalSource = '[data-testid="source"]';

test('keeps persistent HTML projections synchronized with exactly one writer', async ({
    page,
}) => {
    await page.goto('/?projections=persistent');
    const original = await page.locator(canonicalSource).textContent();

    await execute(page, 'projection.show', 'source');
    await execute(page, 'projection.show', 'preview');

    await expect(page.locator(visualHost)).toBeVisible();
    await expect(page.locator(sourceHost)).toBeVisible();
    await expect(page.locator(previewHost)).toBeVisible();
    await expect(page.locator(visualHost)).toHaveAttribute(
        'contenteditable',
        'true',
    );
    await expect(page.locator(`${sourceHost} .cm-content`)).toHaveAttribute(
        'contenteditable',
        'false',
    );
    await expect(page.locator(`${previewHost} iframe`)).toHaveAttribute(
        'sandbox',
        '',
    );

    await page.evaluate(() => {
        const harness = (
            window as Window & {
                __soeditor?: ProjectionHarness;
            }
        ).__soeditor;
        if (harness === undefined) throw new Error('Harness unavailable.');
        harness.sourceEngine?.focus();
    });
    expect(await primary(page)).toBe('visual');

    await page.locator(visualHost).focus();
    await page.locator(`${sourceHost} .cm-content`).click();
    await expect(page.locator(visualHost)).toHaveAttribute(
        'contenteditable',
        'false',
    );
    await expect(page.locator(`${sourceHost} .cm-content`)).toHaveAttribute(
        'contenteditable',
        'true',
    );
    expect(await primary(page)).toBe('source');

    const exact = '<h1>Persistent</h1><p data-id="7">Exact source</p>';
    await replaceCodeMirror(page, sourceHost, exact);
    await expect(page.locator(canonicalSource)).toHaveText(exact);
    await expect(page.locator(`${visualHost} h1`)).toHaveText('Persistent');
    await expect(
        page.frameLocator(`${previewHost} iframe`).getByRole('heading', {
            name: 'Persistent',
        }),
    ).toBeVisible();

    await execute(page, 'editor.undo');
    await expect(page.locator(canonicalSource)).toHaveText(original ?? '');
    await execute(page, 'editor.redo');
    await expect(page.locator(canonicalSource)).toHaveText(exact);
});

test('preserves invalid source while locking the persistent visual projection', async ({
    page,
}) => {
    await page.goto('/?projections=persistent');
    await execute(page, 'projection.show', 'source');
    await execute(page, 'projection.activate', 'source');
    await replaceCodeMirror(page, sourceHost, '<p>Last valid</p>');

    const invalid = '<p id="same" id="same">Exact invalid</p>';
    await replaceCodeMirror(page, sourceHost, invalid);
    await expect(page.locator(canonicalSource)).toHaveText(invalid);
    await expect(page.locator(`${visualHost} p`)).toHaveText('Last valid');

    await execute(page, 'projection.activate', 'visual');
    await expect(page.locator(visualHost)).toHaveAttribute(
        'contenteditable',
        'false',
    );
    await page.locator(visualHost).click();
    await page.keyboard.insertText('blocked');
    await expect(page.locator(canonicalSource)).toHaveText(invalid);
});

test('keeps every persistent projection readonly under editor readonly policy', async ({
    page,
}) => {
    await page.goto('/?projections=persistent&readonly=1');
    await execute(page, 'projection.show', 'source');
    await execute(page, 'projection.show', 'preview');

    await expect(page.locator(visualHost)).toHaveAttribute(
        'contenteditable',
        'false',
    );
    await expect(page.locator(`${sourceHost} .cm-content`)).toHaveAttribute(
        'contenteditable',
        'false',
    );
    await expect(page.locator(previewHost)).toBeVisible();
});

test('closes Preview without reverting a newer primary transfer', async ({
    page,
}) => {
    await page.goto('/?projections=persistent');
    await execute(page, 'editor.preview');
    await execute(page, 'projection.show', 'source');
    await execute(page, 'projection.activate', 'source');

    await execute(page, 'editor.preview.close');
    expect(await primary(page)).toBe('source');
    await expect(page.locator(previewHost)).toBeHidden();
    await expect(page.locator(visualHost)).toBeVisible();
    await expect(page.locator(sourceHost)).toBeVisible();
});

test('finishes surface cleanup when another projection listener fails', async ({
    page,
}) => {
    await page.goto('/?projections=persistent');
    const result = await page.evaluate(() => {
        const harness = (
            window as Window & {
                __soeditor?: ProjectionHarness;
            }
        ).__soeditor;
        if (harness === undefined) throw new Error('Harness unavailable.');
        const coordinator = harness.editor.services.get(
            harness.projectionCoordinatorServiceToken,
        );
        coordinator.subscribe?.(() => {
            throw new Error('listener cleanup failure');
        });
        let errorName = '';
        try {
            harness.sourceEngine?.destroy();
        } catch (error: unknown) {
            errorName = error instanceof Error ? error.name : 'unknown';
        }
        return {
            childCount: document.querySelector('[data-testid="source-editor"]')
                ?.childNodes.length,
            errorName,
        };
    });

    expect(result).toEqual({ childCount: 0, errorName: 'AggregateError' });
});

test('keeps Markdown writable beside a live isolated preview', async ({
    page,
}) => {
    await page.goto('/?format=markdown&projections=persistent');
    await execute(page, 'projection.show', 'preview');

    await expect(page.locator(markdownHost)).toBeVisible();
    await expect(page.locator(previewHost)).toBeVisible();
    await expect(page.locator(`${markdownHost} .cm-content`)).toHaveAttribute(
        'contenteditable',
        'true',
    );
    expect(await primary(page)).toBe('markdown');

    const exact = '# Persistent Markdown\n\nLive preview.';
    await replaceCodeMirror(page, markdownHost, exact);
    await expect(page.locator(canonicalSource)).toHaveText(exact);
    await expect(
        page.frameLocator(`${previewHost} iframe`).getByRole('heading', {
            name: 'Persistent Markdown',
        }),
    ).toBeVisible();
});

async function execute(
    page: Page,
    command: string,
    argument?: string,
): Promise<void> {
    await page.evaluate(
        ({ argument, command }) => {
            const harness = (
                window as Window & {
                    __soeditor?: ProjectionHarness;
                }
            ).__soeditor;
            if (harness === undefined) throw new Error('Harness unavailable.');
            const { editor } = harness;
            if (argument === undefined) {
                editor.execute(command);
            } else {
                editor.execute(command, argument);
            }
        },
        { argument, command },
    );
}

async function primary(page: Page): Promise<string> {
    return page.evaluate(() => {
        const harness = (
            window as Window & {
                __soeditor?: ProjectionHarness;
            }
        ).__soeditor;
        if (harness === undefined) throw new Error('Harness unavailable.');
        return harness.editor.services.get(
            harness.projectionCoordinatorServiceToken,
        ).snapshot.primary;
    });
}

async function replaceCodeMirror(
    page: Page,
    host: string,
    source: string,
): Promise<void> {
    const content = page.locator(`${host} .cm-content`);
    await content.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.insertText(source);
}

interface ProjectionHarness {
    editor: {
        execute(command: string, ...args: unknown[]): unknown;
        services: {
            get(token: unknown): {
                snapshot: { primary: string };
                subscribe?(listener: () => void): () => void;
            };
        };
    };
    projectionCoordinatorServiceToken: unknown;
    sourceEngine?: { destroy(): void; focus(): void };
}
