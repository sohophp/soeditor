import { expect, test, type Page } from '@playwright/test';

const editor = '[data-testid="editor"]';
const source = '[data-testid="source"]';
const tableBoundary = '[data-soeditor-structured-block="soeditor.table"]';

test.beforeEach(async ({ page }) => {
    await page.goto('/?developer=1');
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
    await page.keyboard.press('Tab');
    await expect(cells.nth(1)).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(cells.nth(0)).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(cells.nth(0)).toBeFocused();
    await page.keyboard.press('Alt+Shift+ArrowDown');
    await expect(
        boundary.locator('.soeditor-table-cell[aria-pressed="true"]'),
    ).toHaveCount(2);

    await executeCommand(page, 'table.header.toggle');
    await expect(page.locator(source)).toContainText('<th>');
    await page.keyboard.press('Control+z');
    await expect(page.locator(source)).not.toContainText('<th>');

    await page.locator(`${tableBoundary} .soeditor-table-cell`).nth(0).click();
    await page.keyboard.press('Alt+Shift+ArrowDown');
    await page.keyboard.press('Alt+Shift+ArrowRight');
    await executeCommand(page, 'table.cells.merge');
    await expect(page.locator(source)).toContainText('rowspan="2"');
    await expect(page.locator(source)).toContainText('colspan="2"');

    const merged = page.locator(tableBoundary);
    await merged.locator('.soeditor-table-cell').first().click();
    await page.keyboard.press('Alt+Shift+ArrowDown');
    await page.keyboard.press('Alt+Shift+ArrowRight');
    await page.keyboard.press('Alt+Shift+ArrowRight');
    const mergedClipboard = await dispatchClipboard(
        merged.locator('.soeditor-table-cell').last(),
        'copy',
    );
    expect(mergedClipboard.html).toContain('rowspan="2"');
    expect(mergedClipboard.html).toContain('colspan="2"');
    expect(mergedClipboard.html.match(/<td/gu)).toHaveLength(3);

    await page.locator(`${tableBoundary} .soeditor-table-cell`).first().click();
    await executeCommand(page, 'table.cell.split');
    await expect(page.locator(source)).not.toContainText('rowspan=');
    await expect(page.locator(`${tableBoundary} td`)).toHaveCount(6);
});

test('adds rows and columns and copies, cuts, and pastes semantic cell data', async ({
    page,
}) => {
    let boundary = page.locator(tableBoundary);
    await boundary.locator('.soeditor-table-cell').first().click();
    await executeCommand(page, 'table.row.insertAfter');
    boundary = page.locator(tableBoundary);
    await expect(boundary.locator('tr')).toHaveCount(3);
    await boundary.locator('.soeditor-table-cell').first().click();
    await executeCommand(page, 'table.column.insertAfter');
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
    await page.keyboard.press('Alt+Shift+ArrowRight');

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
    await page.keyboard.press('Alt+Shift+ArrowRight');
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
    const readonlyBoundary = page.locator(tableBoundary);
    await expect(readonlyBoundary).toHaveAttribute('aria-disabled', 'true');
    const readonlyButtons = readonlyBoundary.getByRole('button');
    await expect(readonlyButtons).toHaveCount(1);
    await expect(readonlyButtons.first()).toHaveAttribute('tabindex', '-1');
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

test('edits CMS table properties and resizes columns by accessible controls', async ({
    page,
}) => {
    let boundary = page.locator(tableBoundary);
    await boundary.locator('.soeditor-table-cell').first().click();
    await executeCommand(page, 'table.properties', {
        alignment: 'center',
        ariaLabel: 'Results table',
        caption: 'Quarterly results',
        responsiveClass: 'cms-table responsive',
        width: '80%',
    });
    await executeCommand(page, 'table.row.properties', {
        className: 'header-row',
        height: 48,
        section: 'head',
    });
    await executeCommand(page, 'table.header.toggle');
    await executeCommand(page, 'table.cell.properties', {
        horizontalAlignment: 'right',
        scope: 'col',
        verticalAlignment: 'middle',
    });

    boundary = page.locator(tableBoundary);
    await executeCommand(page, 'table.column.resize', { width: 240 });
    await expect(page.locator(source)).toContainText(
        'data-soeditor-width="240"',
    );
    await expect(boundary.locator('caption')).toHaveText('Quarterly results');
    await expect(boundary.locator('table')).toHaveAttribute(
        'aria-label',
        'Results table',
    );
    await expect(boundary.locator('table')).toHaveAttribute(
        'style',
        /width: 80%/u,
    );
    await expect(boundary.locator('thead')).toHaveCount(1);
    await expect(boundary.locator('th').first()).toHaveCSS(
        'text-align',
        'right',
    );
    await expect(page.locator(source)).toContainText(
        'data-soeditor-responsive-class="cms-table responsive"',
    );

    await page.keyboard.press('Control+z');
    await expect(page.locator(source)).not.toContainText(
        'data-soeditor-width="240"',
    );
});

test('sanitizes external matrix paste and completes list split/exit behavior', async ({
    page,
}) => {
    const boundary = page.locator(tableBoundary);
    await boundary.locator('.soeditor-table-cell').first().click();
    await dispatchPaste(
        boundary.locator('.soeditor-table-cell').first(),
        '<table><tbody><tr><td onclick="window.__matrixExecuted=true"><strong>Safe</strong><script>window.__matrixExecuted=true</script><a href="javascript:window.__matrixExecuted=true">Link</a></td><td><img src="x" onerror="window.__matrixExecuted=true">Two</td></tr></tbody></table>',
        'Safe Link\tTwo',
    );
    await expect(page.locator(source)).toContainText('<strong>Safe</strong>');
    await expect(page.locator(source)).toContainText('<a>Link</a>');
    await expect(page.locator(source)).not.toContainText('<script>');
    await expect(page.locator(source)).not.toContainText('javascript:');
    await expect(page.locator(source)).not.toContainText('onerror=');
    await expect(page.locator(source)).toContainText('<img src="x">');
    expect(
        await page.evaluate(
            () =>
                (window as Window & { __matrixExecuted?: boolean })
                    .__matrixExecuted,
        ),
    ).toBeUndefined();

    await setData(page, '<ul><li>One</li><li></li><li>Two</li></ul>');
    await setListCaret(page, 1);
    await page.keyboard.press('Enter');
    await expect(page.locator(source)).toHaveText(
        '<ul><li>One</li></ul><p></p><ul><li>Two</li></ul>',
    );
    await page.keyboard.press('Control+z');
    await expect(page.locator(source)).toHaveText(
        '<ul><li>One</li><li></li><li>Two</li></ul>',
    );

    await setListCaret(page, 0);
    await page.keyboard.press('Backspace');
    await expect(page.locator(source)).toHaveText(
        '<p>One</p><ul><li></li><li>Two</li></ul>',
    );

    await setData(page, '<ul><li>One<ul><li></li></ul></li><li>Two</li></ul>');
    await setListCaret(page, 1);
    await page.keyboard.press('Enter');
    await expect(page.locator(source)).toHaveText(
        '<ul><li>One</li><li></li><li>Two</li></ul>',
    );
});

test('directly edits a cell and preserves safe rich single-cell paste', async ({
    page,
}) => {
    const firstCell = page
        .locator(`${tableBoundary} .soeditor-table-cell`)
        .first();
    let cell = page.locator(`${tableBoundary} .soeditor-table-cell`).nth(4);
    await cell.click();
    await executeCommand(page, 'table.cell.setText', 'Alpha Bravo Charlie');
    cell = page.locator(`${tableBoundary} .soeditor-table-cell`).nth(4);
    const pointBeforeCharlie = await cell.evaluate((target) => {
        const text = target.firstChild;
        if (!(text instanceof Text)) {
            throw new Error('Missing direct cell text for caret testing.');
        }
        const range = document.createRange();
        range.setStart(text, 12);
        range.setEnd(text, 13);
        const rect = range.getBoundingClientRect();
        return {
            x: rect.left + rect.width * 0.1,
            y: rect.top + rect.height / 2,
        };
    });
    await page.mouse.click(pointBeforeCharlie.x, pointBeforeCharlie.y);
    await expect(cell).toHaveAttribute('contenteditable', 'true');
    await expect
        .poll(() =>
            cell.evaluate((target) => {
                const selection = document.getSelection();
                return selection !== null &&
                    selection.isCollapsed &&
                    selection.anchorNode === target.firstChild
                    ? selection.anchorOffset
                    : -1;
            }),
        )
        .toBe(12);
    await dragAcrossEditingCellText(page, 0, 11);
    const dragged = await selectedTextInsideCell(page);
    expect(dragged.inside).toBe(true);
    expect(dragged.text.length).toBeGreaterThan(5);
    await expect(cell).toHaveAttribute('contenteditable', 'true');
    await expect(cell).toHaveAttribute('role', 'textbox');

    const clipboardEvents = await cell.evaluate((target) => {
        const results: boolean[] = [];
        for (const type of ['copy', 'cut']) {
            const event = new ClipboardEvent(type, {
                bubbles: true,
                cancelable: true,
                clipboardData: new DataTransfer(),
            });
            target.dispatchEvent(event);
            results.push(event.defaultPrevented);
        }
        return results;
    });
    expect(clipboardEvents).toEqual([false, false]);
    const nativeEvents = await cell.evaluate((target) => {
        const data = new DataTransfer();
        data.setData('text/html', '<strong>Native paste</strong>');
        data.setData('text/plain', 'Native paste');
        const paste = new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            clipboardData: data,
        });
        target.dispatchEvent(paste);
        const keys = ['ArrowLeft', 'Escape', 'Enter', 'Tab'].map((key) => {
            const event = new KeyboardEvent('keydown', {
                bubbles: true,
                cancelable: true,
                key,
            });
            target.dispatchEvent(event);
            return event.defaultPrevented;
        });
        return { keys, paste: paste.defaultPrevented };
    });
    expect(nativeEvents).toEqual({
        keys: [false, false, false, false],
        paste: false,
    });

    await cell.fill('Direct cell editing');
    await expect(cell).toHaveText('Direct cell editing');
    await page.waitForTimeout(450);
    await expect(cell).toHaveAttribute('contenteditable', 'true');
    await expect(cell).toBeFocused();
    await expect(firstCell).not.toBeFocused();
    expect((await selectedTextInsideCell(page)).inside).toBe(true);
    await page.keyboard.press('Tab');
    await leaveTable(page);
    await expect(page.locator(source)).toContainText('Direct cell editing');
    await expect(firstCell).not.toContainText('Direct cell editing');

    cell = page.locator(`${tableBoundary} .soeditor-table-cell`).nth(4);
    await cell.dblclick();
    await dispatchPaste(
        cell,
        '<p><strong>Rich</strong> <a href="/safe">Link</a><img src="cell.png" alt="Cell image" onerror="alert(1)"></p>',
        'Rich Link',
    );
    await expect(cell).toContainText('Rich Link');
    await page.keyboard.press('Tab');
    await leaveTable(page);
    await expect(page.locator(source)).toContainText('<strong>Rich</strong>');
    await expect(page.locator(source)).toContainText(
        '<a href="/safe">Link</a>',
    );
    await expect(page.locator(source)).toContainText(
        '<img src="cell.png" alt="Cell image">',
    );
    await expect(page.locator(source)).not.toContainText('onerror');
});

async function dragAcrossEditingCellText(
    page: Page,
    startOffset: number,
    endOffset: number,
): Promise<void> {
    const points = await page.evaluate(
        ({ end, start }) => {
            const cell = document.querySelector(
                '.soeditor-table-cell.is-editing',
            );
            const text = cell?.firstChild;
            if (!(text instanceof Text)) {
                throw new Error('Missing direct cell text for pointer drag.');
            }
            const pointAt = (offset: number): { x: number; y: number } => {
                const range = document.createRange();
                range.setStart(text, offset);
                range.setEnd(text, Math.min(offset + 1, text.data.length));
                const rect = range.getBoundingClientRect();
                return { x: rect.left + 1, y: rect.top + rect.height / 2 };
            };
            return { end: pointAt(end), start: pointAt(start) };
        },
        { end: endOffset, start: startOffset },
    );
    await page.mouse.move(points.start.x, points.start.y);
    await page.mouse.down();
    await page.mouse.move(points.end.x, points.end.y, { steps: 8 });
    await page.mouse.up();
}

async function selectedTextInsideCell(
    page: Page,
): Promise<{ readonly inside: boolean; readonly text: string }> {
    return page.evaluate(() => {
        const cell = document.querySelector('.soeditor-table-cell.is-editing');
        const selection = document.getSelection();
        return {
            inside:
                cell !== null &&
                selection !== null &&
                selection.anchorNode !== null &&
                selection.focusNode !== null &&
                cell.contains(selection.anchorNode) &&
                cell.contains(selection.focusNode),
            text: selection?.toString() ?? '',
        };
    });
}

async function leaveTable(page: Page): Promise<void> {
    await page.locator(source).click({ position: { x: 2, y: 2 } });
    await page.locator(source).evaluate((element) => {
        element.setAttribute('tabindex', '-1');
        (element as HTMLElement).focus({ preventScroll: true });
    });
}

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

async function setData(page: Page, data: string): Promise<void> {
    await page.evaluate((sourceData) => {
        const harness = (
            window as Window & {
                __soeditor?: { editor: { setData(source: string): void } };
            }
        ).__soeditor;
        if (harness === undefined) throw new Error('Missing editor harness.');
        harness.editor.setData(sourceData);
    }, data);
}

async function setListCaret(page: Page, itemIndex: number): Promise<void> {
    await page.locator(editor).evaluate((host, index) => {
        const item = host.querySelectorAll('li')[index];
        if (item === undefined) throw new Error('List item was not projected.');
        document.getSelection()?.setBaseAndExtent(item, 0, item, 0);
        (host as HTMLElement).focus();
    }, itemIndex);
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
