import { expect, test, type Page } from '@playwright/test';

const editor = '[data-testid="editor"]';
const source = '[data-testid="source"]';
const tableBoundary = '[data-soeditor-structured-block="soeditor.table"]';

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await placeCaret(page);
    await executeCommand(page, 'table.insert', { columns: 3, rows: 2 });
});

test('provides keyboard rectangular selection, merge/split, headers, and history', async ({
    page,
}) => {
    const boundary = page.locator(tableBoundary);
    const cells = boundary.locator('.soeditor-table-cell');
    await expect(cells).toHaveCount(6);
    await cells.nth(0).click();
    await page.keyboard.press('ArrowRight');
    await expect(cells.nth(1)).toBeFocused();
    await page.keyboard.press('Shift+ArrowDown');
    await expect(
        boundary.locator('.soeditor-table-cell[aria-pressed="true"]'),
    ).toHaveCount(2);

    await boundary.getByRole('button', { name: 'Toggle header' }).click();
    await expect(page.locator(source)).toContainText('<th>');
    await page.keyboard.press('Control+z');
    await expect(page.locator(source)).not.toContainText('<th>');

    await page.locator(`${tableBoundary} .soeditor-table-cell`).nth(0).click();
    await page
        .locator(`${tableBoundary} .soeditor-table-cell`)
        .nth(4)
        .click({ modifiers: ['Shift'] });
    await page
        .locator(tableBoundary)
        .getByRole('button', { name: 'Merge cells' })
        .click();
    await expect(page.locator(source)).toContainText('rowspan="2"');
    await expect(page.locator(source)).toContainText('colspan="2"');

    const merged = page.locator(tableBoundary);
    await merged.locator('.soeditor-table-cell').first().click();
    await merged
        .locator('.soeditor-table-cell')
        .last()
        .click({ modifiers: ['Shift'] });
    const mergedClipboard = await dispatchClipboard(
        merged.locator('.soeditor-table-cell').last(),
        'copy',
    );
    expect(mergedClipboard.html).toContain('rowspan="2"');
    expect(mergedClipboard.html).toContain('colspan="2"');
    expect(mergedClipboard.html.match(/<td/gu)).toHaveLength(3);

    await page.locator(`${tableBoundary} .soeditor-table-cell`).first().click();
    await page
        .locator(tableBoundary)
        .getByRole('button', { name: 'Split cell' })
        .click();
    await expect(page.locator(source)).not.toContainText('rowspan=');
    await expect(page.locator(`${tableBoundary} td`)).toHaveCount(6);
});

test('adds rows and columns and copies, cuts, and pastes semantic cell data', async ({
    page,
}) => {
    let boundary = page.locator(tableBoundary);
    await boundary.locator('.soeditor-table-cell').first().click();
    await boundary.getByRole('button', { name: 'Add row' }).click();
    boundary = page.locator(tableBoundary);
    await expect(boundary.locator('tr')).toHaveCount(3);
    await boundary.locator('.soeditor-table-cell').first().click();
    await boundary.getByRole('button', { name: 'Add column' }).click();
    boundary = page.locator(tableBoundary);
    await expect(boundary.locator('tr').first().locator('td')).toHaveCount(4);

    const first = boundary.locator('.soeditor-table-cell').first();
    await first.click();
    await executeCommand(page, 'table.cell.setText', 'Alpha');
    boundary = page.locator(tableBoundary);
    const second = boundary.locator('.soeditor-table-cell').nth(1);
    await second.click();
    await executeCommand(page, 'table.cell.setText', 'Beta');
    boundary = page.locator(tableBoundary);
    await boundary.locator('.soeditor-table-cell').first().click();
    await boundary
        .locator('.soeditor-table-cell')
        .nth(1)
        .click({ modifiers: ['Shift'] });

    const copied = await dispatchClipboard(
        boundary.locator('.soeditor-table-cell').nth(1),
        'copy',
    );
    expect(copied.text).toBe('Alpha\tBeta');
    expect(copied.html).toContain('<table>');
    expect(copied.html).toContain('<td>Alpha</td><td>Beta</td>');

    await dispatchClipboard(
        boundary.locator('.soeditor-table-cell').nth(1),
        'cut',
    );
    await expect(page.locator(source)).not.toContainText('Alpha');
    await page.keyboard.press('Control+z');
    await expect(page.locator(source)).toContainText('Alpha');

    boundary = page.locator(tableBoundary);
    await boundary.locator('.soeditor-table-cell').first().click();
    await dispatchPaste(
        boundary.locator('.soeditor-table-cell').first(),
        '',
        'One\tTwo\nThree\tFour',
    );
    await expect(page.locator(source)).toContainText('<td>One</td>');
    await expect(page.locator(source)).toContainText('<td>Two</td>');
});

test('preserves unsupported table source inertly and enforces readonly controls', async ({
    page,
}) => {
    await page.evaluate(() => {
        const harness = (
            window as Window & {
                __soeditor?: { editor: { setData(source: string): void } };
            }
        ).__soeditor;
        harness?.editor.setData(
            '<table data-cms="kept"><tbody><tr><td>A</td></tr><script>window.__tableExecuted=true</script></tbody></table>',
        );
    });
    await expect(page.locator(tableBoundary)).toContainText(
        'Unsupported table preserved',
    );
    await expect(page.locator(source)).toContainText('data-cms="kept"');
    await expect(page.locator(source)).toContainText('<script>');
    expect(
        await page.evaluate(
            () =>
                (window as Window & { __tableExecuted?: boolean })
                    .__tableExecuted,
        ),
    ).toBeUndefined();

    await page.goto('/?readonly=1');
    await expect(page.locator(tableBoundary)).toHaveCount(0);
    await page.evaluate(() => {
        const harness = (
            window as Window & {
                __soeditor?: { editor: { setData(source: string): void } };
            }
        ).__soeditor;
        harness?.editor.setData(
            '<table><tbody><tr><td>Readonly</td></tr></tbody></table>',
        );
    });
    const readonlyButtons = page.locator(`${tableBoundary} button`);
    await expect(readonlyButtons).toHaveCount(6);
    await expect(readonlyButtons.first()).toBeDisabled();
});

test('renders a bounded 400-cell table within budget without losing source structure', async ({
    page,
}) => {
    await page.keyboard.press('Control+z');
    await placeCaret(page);
    const duration = await page.evaluate(() => {
        const harness = (
            window as Window & {
                __soeditor?: {
                    editor: {
                        execute(id: string, value: unknown): unknown;
                    };
                };
            }
        ).__soeditor;
        const started = performance.now();
        harness?.editor.execute('table.insert', { columns: 20, rows: 20 });
        return performance.now() - started;
    });
    await expect(
        page.locator(`${tableBoundary} .soeditor-table-cell`),
    ).toHaveCount(400);
    await expect(page.locator(source)).toContainText('<tbody>');
    expect(duration).toBeLessThan(4_000);
});

async function placeCaret(page: Page): Promise<void> {
    await page.locator(editor).evaluate((host) => {
        const text = host.querySelector('p')?.firstChild;
        if (text === null || text === undefined) {
            throw new Error('Editable paragraph was not projected.');
        }
        document.getSelection()?.setBaseAndExtent(text, 0, text, 0);
        (host as HTMLElement).focus();
    });
}

async function executeCommand(
    page: Page,
    id: string,
    ...args: readonly unknown[]
): Promise<void> {
    await page.evaluate(
        ({ args: commandArgs, id: commandId }) => {
            const harness = (
                window as Window & {
                    __soeditor?: {
                        editor: {
                            execute(
                                id: string,
                                ...args: readonly unknown[]
                            ): unknown;
                        };
                    };
                }
            ).__soeditor;
            harness?.editor.execute(commandId, ...commandArgs);
        },
        { args, id },
    );
}

async function dispatchClipboard(
    target: ReturnType<Page['locator']>,
    type: 'copy' | 'cut',
): Promise<{ readonly html: string; readonly text: string }> {
    return target.evaluate((node, eventType) => {
        const data = new DataTransfer();
        node.dispatchEvent(
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
    target: ReturnType<Page['locator']>,
    html: string,
    text: string,
): Promise<void> {
    await target.evaluate(
        (node, value) => {
            const data = new DataTransfer();
            data.setData('text/html', value.html);
            data.setData('text/plain', value.text);
            node.dispatchEvent(
                new ClipboardEvent('paste', {
                    bubbles: true,
                    cancelable: true,
                    clipboardData: data,
                }),
            );
        },
        { html, text },
    );
}
