import { expect, test, type Page } from '@playwright/test';

const editorSelector = '[data-testid="editor"]';
const sourceSelector = '[data-testid="source"]';
const browseSelector = '[data-toolbar-item="image-browse"]';

test('inserts through a custom FileManager without changing ImagePlugin', async ({
    page,
}) => {
    await openEditableEditor(page, '/?developer=1');
    await setCaret(page);
    await page.locator(browseSelector).click();

    await expect(page.locator(sourceSelector)).toContainText(
        '<img src="/custom-manager-image.png" alt="Custom manager image">',
    );
});

test('uses the same image workflow through SoFinderAdapter', async ({
    page,
}) => {
    await openEditableEditor(page, '/?files=sofinder');
    await setCaret(page);
    await page.locator(browseSelector).click();

    await expect(page.locator(sourceSelector)).toContainText(
        '<img src="/sofinder-image.png" alt="sofinder-image.png" width="640" height="480">',
    );
});

test('uses the latest author selection after the caret moves', async ({
    page,
}) => {
    await openEditableEditor(page, '/?developer=1');
    await page.evaluate(() => {
        const harness = (
            window as Window & {
                __soeditor?: { editor: { setData(html: string): void } };
            }
        ).__soeditor;
        if (harness === undefined) {
            throw new Error('Playground editor was not exposed.');
        }
        harness.editor.setData('<p>Alpha</p><p>Omega</p>');
    });
    await setCaret(page, 0, 0);
    await setCaret(page, 1, 5);
    await page.locator(browseSelector).click();

    await expect(page.locator(sourceSelector)).toContainText(
        '<p>Alpha</p><p>Omega<img src="/custom-manager-image.png" alt="Custom manager image"></p>',
    );
});

test('keeps cancellation inert and reports an unsafe manager result', async ({
    page,
}) => {
    await openEditableEditor(page, '/?developer=1');
    await replaceManager(page, 'cancel');
    await setCaret(page);
    const before = await page.locator(sourceSelector).textContent();
    await page.locator(browseSelector).click();
    await expect(page.locator(sourceSelector)).toHaveText(before ?? '');

    await replaceManager(page, 'unsafe');
    await setCaret(page);
    await page.locator(browseSelector).click();
    await expect(
        page.locator('.soeditor-ui__notification').last(),
    ).toContainText('forbidden scheme');
    await expect(page.locator(sourceSelector)).toHaveText(before ?? '');
});

test('disables browsing for a readonly editor', async ({ page }) => {
    await page.goto('/?readonly');
    await expect(page.locator(editorSelector)).toHaveAttribute(
        'contenteditable',
        'false',
    );
    await expect(page.locator(browseSelector)).toBeDisabled();
});

async function openEditableEditor(page: Page, url: string): Promise<void> {
    await page.goto(url);
    await expect(page.locator(editorSelector)).toHaveAttribute(
        'contenteditable',
        'true',
    );
}

async function setCaret(
    page: Page,
    paragraphIndex = 0,
    offset = 0,
): Promise<void> {
    await page.locator(editorSelector).evaluate(
        (host, selection) => {
            const paragraph = host
                .querySelectorAll('p')
                .item(selection.paragraphIndex);
            const text = paragraph?.firstChild;
            if (paragraph === null || text === null || text === undefined) {
                throw new Error('Editable paragraph was not found.');
            }
            (host as HTMLElement).focus();
            document
                .getSelection()
                ?.setBaseAndExtent(
                    text,
                    selection.offset,
                    text,
                    selection.offset,
                );
        },
        { offset, paragraphIndex },
    );
}

async function replaceManager(
    page: Page,
    behavior: 'cancel' | 'unsafe',
): Promise<void> {
    await page.evaluate((managerBehavior) => {
        const harness = (
            window as Window & {
                __soeditor?: {
                    editor: {
                        services: {
                            register(token: unknown, service: unknown): void;
                            unregister(token: unknown): void;
                        };
                    };
                    fileManagerServiceToken: unknown;
                };
            }
        ).__soeditor;
        if (harness === undefined) {
            throw new Error('Playground file manager was not exposed.');
        }
        harness.editor.services.unregister(harness.fileManagerServiceToken);
        harness.editor.services.register(harness.fileManagerServiceToken, {
            open: () =>
                Promise.resolve(
                    managerBehavior === 'cancel'
                        ? null
                        : { url: 'javascript:alert(1)' },
                ),
        });
    }, behavior);
}
