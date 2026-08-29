import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const editorHost = '[data-testid="editor"]';

test.beforeEach(async ({ page }) => {
    await page.goto('/?comments=1');
});

test('creates a safe mapped comment without serializing review data', async ({
    page,
}) => {
    await selectText(page, 'p', 0, 5);
    await page.getByRole('button', { name: 'Open comments' }).click();
    const panel = page.getByRole('region', { name: 'Comments' });
    await panel
        .getByRole('textbox', { name: 'New comment' })
        .fill('<img src=x onerror=window.__commentExecuted=true>Review');
    await panel.getByRole('button', { name: 'Add comment' }).click();

    await expect(page.locator('mark[data-soeditor-decoration]')).toHaveText(
        'Hello',
    );
    await expect(panel).toContainText(
        '<img src=x onerror=window.__commentExecuted=true>Review',
    );
    await expect(panel.locator('img')).toHaveCount(0);
    expect(
        await page.evaluate(
            () =>
                (
                    globalThis as typeof globalThis & {
                        __commentExecuted?: boolean;
                    }
                ).__commentExecuted,
        ),
    ).toBeUndefined();
    await expect(page.locator('[data-testid="source"]')).not.toContainText(
        'comment',
    );

    const clipboard = await page.locator(editorHost).evaluate((host) => {
        const data = new DataTransfer();
        host.dispatchEvent(
            new ClipboardEvent('copy', {
                bubbles: true,
                cancelable: true,
                clipboardData: data,
            }),
        );
        return {
            html: data.getData('text/html'),
            text: data.getData('text/plain'),
        };
    });
    expect(clipboard.text).toBe('Hello');
    expect(clipboard.html).not.toContain('soeditor-decoration');
    expect(clipboard.html).not.toContain('comment');

    await page.locator(editorHost).evaluate((host, payload) => {
        const paragraph = host.querySelector('p');
        const walker = document.createTreeWalker(
            paragraph!,
            NodeFilter.SHOW_TEXT,
        );
        let text: Text | undefined;
        while (walker.nextNode() !== null) text = walker.currentNode as Text;
        if (text === undefined) throw new Error('No paste target text.');
        (host as HTMLElement).focus();
        document
            .getSelection()
            ?.setBaseAndExtent(text, text.length, text, text.length);
        const data = new DataTransfer();
        data.setData('text/html', payload.html);
        data.setData('text/plain', payload.text);
        host.dispatchEvent(
            new ClipboardEvent('paste', {
                bubbles: true,
                cancelable: true,
                clipboardData: data,
            }),
        );
    }, clipboard);
    await expect(page.locator('mark[data-soeditor-decoration]')).toHaveCount(1);

    await selectText(page, 'mark', 2, 2);
    await page.locator(editorHost).evaluate((host) => {
        host.dispatchEvent(
            new InputEvent('beforeinput', {
                bubbles: true,
                cancelable: true,
                data: 'X',
                inputType: 'insertText',
            }),
        );
    });
    await expect(page.locator('mark[data-soeditor-decoration]')).toHaveText(
        'HeXllo',
    );
    await page.keyboard.press('Control+z');
    await expect(page.locator('mark[data-soeditor-decoration]')).toHaveCount(0);
    await expect(panel.locator('[data-comment-state="unlinked"]')).toHaveCount(
        1,
    );
});

test('unlinks ambiguous Source replacement and decorates a whole widget', async ({
    page,
}) => {
    await selectText(page, 'p', 0, 5);
    await page.getByRole('button', { name: 'Open comments' }).click();
    const panel = page.getByRole('region', { name: 'Comments' });
    await panel.getByRole('textbox', { name: 'New comment' }).fill('Source');
    await panel.getByRole('button', { name: 'Add comment' }).click();
    await page.evaluate(() => {
        const harness = (
            globalThis as typeof globalThis & {
                __soeditor?: { editor: { setData(source: string): void } };
            }
        ).__soeditor;
        harness?.editor.setData('<p>Exact source replacement</p>');
    });
    await expect(panel.locator('[data-comment-state="unlinked"]')).toHaveCount(
        1,
    );

    await page.goto('/?example=cms&comments=1');
    const widget = page.locator(
        '[data-soeditor-structured-block="playground.product-card"]',
    );
    await widget.focus();
    await page.getByRole('button', { name: 'Open comments' }).click();
    const widgetPanel = page.getByRole('region', { name: 'Comments' });
    await widgetPanel
        .getByRole('textbox', { name: 'New comment' })
        .fill('Whole widget');
    await widgetPanel.getByRole('button', { name: 'Add comment' }).click();
    await expect(widget).toHaveAttribute('data-soeditor-decoration-count', '1');
    await expect(page.locator('[data-testid="source"]')).not.toContainText(
        'Whole widget',
    );

    await widgetPanel.getByRole('button', { name: 'Close Comments' }).click();
    await selectText(page, 'p', 0, 0);
    await page.evaluate(() => {
        const harness = (
            globalThis as typeof globalThis & {
                __soeditor?: {
                    editor: {
                        execute(
                            command: string,
                            ...args: readonly unknown[]
                        ): unknown;
                    };
                };
            }
        ).__soeditor;
        harness?.editor.execute('table.insert', { columns: 1, rows: 1 });
    });
    const table = page.locator(
        '[data-soeditor-structured-block="soeditor.table"]',
    );
    await table.focus();
    await page.getByRole('button', { name: /Open comments/u }).click();
    const tablePanel = page.getByRole('region', { name: 'Comments' });
    await tablePanel
        .getByRole('textbox', { name: 'New comment' })
        .fill('Whole table');
    await tablePanel.getByRole('button', { name: 'Add comment' }).click();
    await expect(table).toHaveAttribute('data-soeditor-decoration-count', '1');
});

test('supports permission-independent readonly review and accessible navigation', async ({
    page,
}) => {
    await page.goto('/?comments=1&readonly=1');
    await selectText(page, 'p', 0, 5);
    await page.getByRole('button', { name: 'Open comments' }).click();
    const panel = page.getByRole('region', { name: 'Comments' });
    await panel.getByRole('textbox', { name: 'New comment' }).fill('Readonly');
    await panel.getByRole('button', { name: 'Add comment' }).click();
    await expect(panel).toContainText('Readonly');

    await page.keyboard.press('Alt+Shift+ArrowDown');
    await expect(
        panel.locator('.soeditor-comments__thread[aria-current="true"]'),
    ).toHaveCount(1);
    const accessibility = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
    expect(accessibility.violations).toEqual([]);
});

async function selectText(
    page: Page,
    selector: string,
    from: number,
    to: number,
): Promise<void> {
    await page.locator(editorHost).evaluate(
        (host, options) => {
            const element = host.querySelector(options.selector);
            const text = element?.firstChild;
            if (!(text instanceof Text)) {
                throw new Error(`No text node found for ${options.selector}.`);
            }
            (host as HTMLElement).focus();
            document
                .getSelection()
                ?.setBaseAndExtent(text, options.from, text, options.to);
        },
        { from, selector, to },
    );
}
