import { expect, test, type Page } from '@playwright/test';

const editor = '[data-testid="editor"]';
const source = '[data-testid="source"]';
const productCard =
    '[data-soeditor-structured-block="playground.product-card"]';

test.beforeEach(async ({ page }) => {
    await page.goto('/?example=cms');
});

test('mounts an accessible host-scoped product-card node view and updates it by command', async ({
    page,
}) => {
    const boundary = page.locator(productCard);
    await expect(boundary).toHaveAttribute('contenteditable', 'false');
    await expect(boundary).toHaveAttribute('role', 'group');
    await expect(boundary.locator('.demo-product-card')).toContainText(
        'Product #123',
    );

    await boundary.focus();
    await expect(boundary).toHaveAttribute('aria-selected', 'true');
    const toggle = boundary.getByRole('button', { name: '切换推荐状态' });
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator(source)).toContainText('data-featured="true"');
    await expect(boundary.locator('.demo-product-card')).toContainText(
        '推荐商品',
    );

    await page.keyboard.press('Control+z');
    await expect(page.locator(source)).not.toContainText('data-featured');
    await page.keyboard.press('Control+Shift+z');
    await expect(page.locator(source)).toContainText('data-featured="true"');
});

test('copies, navigates from, deletes, restores, and pastes an atomic node view', async ({
    page,
}) => {
    const boundary = page.locator(productCard);
    await page.locator(editor).evaluate((host) => {
        const paragraph = host.querySelector('p');
        const text = paragraph?.firstChild;
        if (text === null || text === undefined) {
            throw new Error('Adjacent paragraph was not projected.');
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
    await page.keyboard.press('ArrowRight');
    await expect(boundary).toHaveAttribute('aria-selected', 'true');

    await boundary.focus();
    expect(await dispatchClipboard(page, 'copy')).toEqual({
        html: '<product-card data-id="123"></product-card>',
        text: '',
    });

    await page.keyboard.press('ArrowLeft');
    await expect(boundary).toHaveAttribute('aria-selected', 'false');
    expect(
        await page.evaluate(
            () =>
                document.getSelection()?.anchorNode?.parentElement?.closest('p')
                    ?.textContent,
        ),
    ).toBe('Edit me safely.');

    await boundary.focus();
    await page.keyboard.press('Delete');
    await expect(boundary).toHaveCount(0);
    await page.keyboard.press('Control+z');
    await expect(page.locator(productCard)).toHaveCount(1);

    await page.locator(productCard).focus();
    await dispatchPaste(
        page,
        '<product-card data-id="999"></product-card>',
        '<product-card data-id="999"></product-card>',
    );
    await expect(page.locator(source)).toContainText('data-id="999"');
    await expect(page.locator(productCard)).toContainText('Product #999');
});

test('keeps node-view controls inert in readonly mode', async ({ page }) => {
    await page.goto('/?example=cms&readonly=1');
    const boundary = page.locator(productCard);
    await expect(
        boundary.getByRole('button', { name: '切换推荐状态' }),
    ).toBeDisabled();
    await boundary.focus();
    await page.keyboard.press('Delete');
    await expect(page.locator(source)).toContainText('data-id="123"');
});

test('moves a widget within one editor and accepts external semantic HTML drops', async ({
    page,
}) => {
    await page.locator(editor).evaluate((host) => {
        const card = host.querySelector<HTMLElement>(
            '[data-soeditor-structured-block="playground.product-card"]',
        );
        const heading = host.querySelector<HTMLElement>('h1');
        if (card === null || heading === null) {
            throw new Error('Drag fixtures were not projected.');
        }
        const transfer = new DataTransfer();
        card.dispatchEvent(
            new DragEvent('dragstart', {
                bubbles: true,
                cancelable: true,
                dataTransfer: transfer,
            }),
        );
        heading.dispatchEvent(
            new DragEvent('drop', {
                bubbles: true,
                cancelable: true,
                clientY: heading.getBoundingClientRect().top,
                dataTransfer: transfer,
            }),
        );
    });
    await expect(page.locator(source)).toContainText(
        '<!--CMS:block:42--><product-card data-id="123"></product-card><h1>',
    );
    await page.keyboard.press('Control+z');
    await expect(page.locator(source)).toContainText(
        '<p>Edit me safely.</p><product-card data-id="123"></product-card>',
    );

    await page.locator(editor).evaluate((host) => {
        const paragraph = host.querySelector<HTMLElement>('p');
        if (paragraph === null) {
            throw new Error('Drop paragraph was not projected.');
        }
        const transfer = new DataTransfer();
        transfer.setData(
            'text/html',
            '<product-card data-id="external"></product-card>',
        );
        paragraph.dispatchEvent(
            new DragEvent('drop', {
                bubbles: true,
                cancelable: true,
                clientY: paragraph.getBoundingClientRect().bottom,
                dataTransfer: transfer,
            }),
        );
    });
    await expect(page.locator(source)).toContainText('data-id="external"');
    await expect(page.locator(productCard)).toHaveCount(2);
});

async function dispatchClipboard(
    page: Page,
    type: 'copy' | 'cut',
): Promise<{ readonly html: string; readonly text: string }> {
    return page.locator(editor).evaluate((host, eventType) => {
        const data = new DataTransfer();
        host.dispatchEvent(
            new ClipboardEvent(eventType, {
                bubbles: true,
                cancelable: true,
                clipboardData: data,
            }),
        );
        return {
            html: data.getData('text/html'),
            text: data.getData('text/plain'),
        };
    }, type);
}

async function dispatchPaste(
    page: Page,
    html: string,
    text: string,
): Promise<void> {
    await page.locator(editor).evaluate(
        (host, data) => {
            const clipboard = new DataTransfer();
            clipboard.setData('text/html', data.html);
            clipboard.setData('text/plain', data.text);
            host.dispatchEvent(
                new ClipboardEvent('paste', {
                    bubbles: true,
                    cancelable: true,
                    clipboardData: clipboard,
                }),
            );
        },
        { html, text },
    );
}
