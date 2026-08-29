import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const root = '[data-testid="split-view"]';
const source = '[data-testid="source-editor"]';
const visual = '[data-testid="editor"]';
const preview = '[data-testid="preview"]';

test('provides accessible Visual and Source resizing, focus, collapse, and restore', async ({
    page,
}) => {
    await page.goto('/?split=visual-source');
    await expect(
        page.getByRole('region', { exact: true, name: 'Visual' }),
    ).toBeVisible();
    await expect(
        page.getByRole('region', { exact: true, name: 'HTML Source' }),
    ).toBeVisible();
    const separator = page.getByRole('separator', {
        name: 'Resize editor panes',
    });
    await expect(separator).toHaveAttribute('aria-valuenow', '50');
    await separator.focus();
    await page.keyboard.press('ArrowRight');
    await expect(separator).toHaveAttribute('aria-valuenow', '55');

    await page.getByRole('button', { name: 'Focus HTML Source' }).click();
    await expect(page.locator(visual)).toHaveAttribute(
        'contenteditable',
        'false',
    );
    await expect(page.locator(`${source} .cm-content`)).toHaveAttribute(
        'contenteditable',
        'true',
    );

    await page.getByRole('button', { name: 'Collapse Visual' }).click();
    await expect(
        page.getByRole('region', { exact: true, name: 'Visual' }),
    ).toBeHidden();
    await page.getByRole('button', { name: 'Restore split pane' }).click();
    await expect(
        page.getByRole('region', { exact: true, name: 'Visual' }),
    ).toBeVisible();

    const accessibility = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
    expect(accessibility.violations).toEqual([]);
});

test('uses reversible responsive orientation without changing requested state', async ({
    page,
}) => {
    await page.setViewportSize({ height: 800, width: 500 });
    await page.goto('/?split=visual-source');
    await expect(page.locator(root)).toHaveAttribute(
        'data-orientation',
        'vertical',
    );
    expect(await splitSnapshot(page)).toMatchObject({
        effectiveOrientation: 'vertical',
        orientation: 'horizontal',
        responsive: true,
    });

    await page.setViewportSize({ height: 800, width: 1200 });
    await expect(page.locator(root)).toHaveAttribute(
        'data-orientation',
        'horizontal',
    );
    expect(await splitSnapshot(page)).toMatchObject({
        orientation: 'horizontal',
        responsive: false,
    });
});

test('synchronizes Source and isolated Preview with Source as the only writer', async ({
    page,
}) => {
    await page.goto('/?split=source-preview');
    await expect(page.locator(source)).toBeVisible();
    await expect(page.locator(preview)).toBeVisible();
    await expect(page.locator(`${source} .cm-content`)).toHaveAttribute(
        'contenteditable',
        'true',
    );
    const exact = '<h1>Split Preview</h1><p>Canonical</p>';
    const content = page.locator(`${source} .cm-content`);
    await content.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.insertText(exact);
    await expect(
        page.frameLocator(`${preview} iframe`).getByRole('heading', {
            name: 'Split Preview',
        }),
    ).toBeVisible();
});

test('supports Markdown Preview and restores caller hosts on teardown', async ({
    page,
}) => {
    await page.goto('/?format=markdown&split=markdown-preview');
    await expect(
        page.getByRole('region', { exact: true, name: 'Markdown' }),
    ).toBeVisible();
    await expect(page.getByRole('region', { name: 'Preview' })).toBeVisible();

    const result = await page.evaluate(() => {
        const harness = (window as Window & { __soeditor?: SplitHarness })
            .__soeditor;
        if (harness === undefined) throw new Error('Harness unavailable.');
        harness.splitView?.destroy();
        return {
            markdownParent: document.querySelector(
                '[data-testid="markdown-editor"]',
            )?.parentElement?.id,
            previewParent: document.querySelector('[data-testid="preview"]')
                ?.parentElement?.id,
            rootChildren: document.querySelector('[data-testid="split-view"]')
                ?.childNodes.length,
        };
    });
    expect(result).toEqual({
        markdownParent: 'editor-ui',
        previewParent: 'editor-ui',
        rootChildren: 0,
    });
});

test('resizes by pointer and switches pairs without leaving an off-layout projection visible', async ({
    page,
}) => {
    await page.goto('/?split=visual-source');
    const separator = page.getByRole('separator', {
        name: 'Resize editor panes',
    });
    const box = await separator.boundingBox();
    const layoutBox = await page.locator(root).boundingBox();
    if (box === null || layoutBox === null)
        throw new Error('Layout unavailable.');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(layoutBox.x + layoutBox.width * 0.7, box.y);
    await page.mouse.up();
    await expect(separator).toHaveAttribute('aria-valuenow', '70');

    await execute(page, 'layout.split.open', 'source-preview');
    await expect(page.locator(visual)).toBeHidden();
    await expect(page.locator(source)).toBeVisible();
    await expect(page.locator(preview)).toBeVisible();
});

test('keeps readonly and invalid-source authority rules inside split layouts', async ({
    page,
}) => {
    await page.goto('/?split=visual-source&readonly=1');
    await expect(page.locator(visual)).toHaveAttribute(
        'contenteditable',
        'false',
    );
    await expect(page.locator(`${source} .cm-content`)).toHaveAttribute(
        'contenteditable',
        'false',
    );

    await page.goto('/?split=visual-source');
    await page.getByRole('button', { name: 'Focus HTML Source' }).click();
    const invalid = '<p id="same" id="same">Exact invalid</p>';
    const content = page.locator(`${source} .cm-content`);
    await content.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.insertText(invalid);
    await page.getByRole('button', { name: 'Focus Visual' }).click();
    await expect(page.locator(visual)).toHaveAttribute(
        'contenteditable',
        'false',
    );
    await expect(page.locator('[data-testid="source"]')).toHaveText(invalid);
});

test('supports repeated layout attachment without taking ownership of engines', async ({
    page,
}) => {
    await page.goto('/?split=visual-source');
    const result = await page.evaluate(() => {
        const harness = (window as Window & { __soeditor?: SplitHarness })
            .__soeditor;
        if (harness === undefined) throw new Error('Harness unavailable.');
        harness.splitView?.destroy();
        const root = document.querySelector<HTMLElement>(
            '[data-testid="split-view"]',
        );
        const visual = document.querySelector<HTMLElement>(
            '[data-testid="editor"]',
        );
        const source = document.querySelector<HTMLElement>(
            '[data-testid="source-editor"]',
        );
        if (root === null || visual === null || source === null) {
            throw new Error('Hosts unavailable.');
        }
        root.setAttribute('role', 'application');
        root.classList.add('caller-root');
        root.style.setProperty('--soeditor-split-ratio', '33%');
        const second = harness.createSplitViewLayout?.({
            editor: harness.editor,
            element: root,
            hosts: { source, visual },
            initialPair: 'visual-source',
            ratio: 63,
        });
        const initialRatio = harness.editor.services.get(
            harness.splitViewServiceToken,
        ).snapshot.ratio;
        second?.destroy();
        return {
            initialRatio,
            rootChildren: root.childNodes.length,
            rootClass: root.className,
            rootRatio: root.style.getPropertyValue('--soeditor-split-ratio'),
            rootRole: root.getAttribute('role'),
            sourceParent: source.parentElement?.id,
            visualParent: visual.parentElement?.id,
        };
    });
    expect(result).toEqual({
        initialRatio: 63,
        rootChildren: 0,
        rootClass: 'caller-root',
        rootRatio: '33%',
        rootRole: 'application',
        sourceParent: 'editor-ui',
        visualParent: 'editor-ui',
    });
});

async function execute(
    page: Page,
    command: string,
    argument: string,
): Promise<void> {
    await page.evaluate(
        ({ argument, command }) => {
            const harness = (
                window as Window & {
                    __soeditor?: SplitHarness;
                }
            ).__soeditor;
            if (harness === undefined) throw new Error('Harness unavailable.');
            harness.editor.execute?.(command, argument);
        },
        { argument, command },
    );
}

async function splitSnapshot(page: Page): Promise<Record<string, unknown>> {
    return page.evaluate(() => {
        const harness = (window as Window & { __soeditor?: SplitHarness })
            .__soeditor;
        if (harness === undefined) throw new Error('Harness unavailable.');
        return harness.editor.services.get(harness.splitViewServiceToken)
            .snapshot;
    });
}

interface SplitHarness {
    editor: {
        execute?(command: string, ...args: unknown[]): unknown;
        services: {
            get(token: unknown): { snapshot: Record<string, unknown> };
        };
    };
    createSplitViewLayout?(options: {
        editor: SplitHarness['editor'];
        element: HTMLElement;
        hosts: Record<string, HTMLElement>;
        initialPair: string;
        ratio?: number;
    }): { destroy(): void };
    splitView?: { destroy(): void };
    splitViewServiceToken: unknown;
}
