import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.goto('/classic.html?test=1');
    await page.locator('body[data-ready="true"]').waitFor();
});

test('reuses one popup per editor and isolates popups across editor instances', async ({
    page,
}) => {
    const context = page.context();
    const previewButton = page.locator('[data-toolbar-item="popupPreview"]');
    const firstPopupEvent = context.waitForEvent('page');
    await previewButton.click();
    const firstPopup = await firstPopupEvent;
    const firstFrame = firstPopup.locator('iframe').contentFrame();
    const templatePicker = firstPopup.getByLabel('Preview template');

    await expect(firstFrame.getByText('Hello')).toBeVisible();
    await expect(templatePicker.locator('option')).toHaveText([
        'Web page',
        'Email newsletter',
        'Word document',
    ]);
    await page.evaluate(() =>
        globalThis.__classicDemo.editor.setData(
            '<table><tbody><tr><th>Header</th><td>Value</td></tr></tbody></table>',
        ),
    );
    await expect(firstFrame.locator('th', { hasText: 'Header' })).toHaveCSS(
        'font-weight',
        '600',
    );
    await templatePicker.selectOption('email');
    await expect(firstFrame.locator('.soeditor-email-preview')).toBeVisible();
    await templatePicker.selectOption('word');
    await expect(firstFrame.locator('.soeditor-word-preview')).toBeVisible();

    const pageCount = context.pages().length;
    await previewButton.click();
    await expect.poll(() => context.pages().length).toBe(pageCount);

    await page.evaluate(async () => {
        const host = document.createElement('textarea');
        host.id = 'second-preview-editor';
        document.body.append(host);
        const second = await globalThis.__classicDemo.create(host, {
            data: '<p>Second editor preview</p>',
            preview: {
                initialTemplateId: 'custom',
                templates: [
                    {
                        id: 'custom',
                        label: 'Custom site',
                        styles: ['.preview-shell { color: rgb(12, 34, 56); }'],
                        template:
                            '<!doctype html><html><body><article class="preview-shell"><header>Custom template</header>{{ content }}</article></body></html>',
                        title: 'Second preview',
                    },
                ],
            },
        });
        Reflect.set(globalThis, '__secondaryClassic', second);
    });
    const secondPopupEvent = context.waitForEvent('page');
    await page
        .locator('.soeditor-classic')
        .nth(1)
        .locator('[data-toolbar-item="popupPreview"]')
        .click();
    const secondPopup = await secondPopupEvent;
    const secondFrame = secondPopup.locator('iframe').contentFrame();
    await expect(secondFrame.getByText('Custom template')).toBeVisible();
    await expect(secondFrame.getByText('Second editor preview')).toHaveCSS(
        'color',
        'rgb(12, 34, 56)',
    );
    expect(secondPopup).not.toBe(firstPopup);

    await page.evaluate(async () => {
        const second: unknown = Reflect.get(globalThis, '__secondaryClassic');
        if (
            typeof second === 'object' &&
            second !== null &&
            'destroy' in second &&
            typeof second.destroy === 'function'
        ) {
            await second.destroy();
        }
    });
    await expect.poll(() => secondPopup.isClosed()).toBe(true);
});

test('keeps table header cells visually distinct from data cells', async ({
    page,
}) => {
    await page.goto('/classic.html');
    await page.locator('body[data-ready="true"]').waitFor();
    const visual = page.locator('.soeditor-classic__visual');
    const headerCell = visual.locator('th').first();
    const dataCell = visual.locator('td').first();

    await expect(headerCell).toHaveCSS('font-weight', '600');
    await expect(headerCell).toHaveCSS('text-align', 'center');
    await expect(dataCell).not.toHaveCSS('font-weight', '600');
});

test('shows the active table scope, block boundaries, and direct row and column resize handles', async ({
    page,
}) => {
    await page.goto('/classic.html');
    await page.locator('body[data-ready="true"]').waitFor();
    const editor = page.locator('.soeditor-classic');
    const visual = editor.locator('.soeditor-classic__visual');
    const cells = visual.locator('.soeditor-table-cell');
    const initialCellCount = await cells.count();

    await cells.nth(3).click();
    await expect
        .poll(() =>
            page.evaluate(() => globalThis.__classicDemo.editor.getData()),
        )
        .not.toMatch(/class="[^"]*soeditor-/u);
    const scope = page.locator('.soeditor-ui__status');
    await expect(scope).toContainText(/单元格.*R2 C1|Cell.*R2 C1/u);
    const tableTools = page.locator('.soeditor-ui__table-balloon');
    await expect(visual.locator('.soeditor-table-column-resize')).toHaveCount(
        3,
    );
    await expect(visual.locator('.soeditor-table-row-resize')).toHaveCount(4);
    await expect(
        tableTools.getByRole('button', { name: /表格属性|Table properties/u }),
    ).toBeVisible();
    await expect(
        tableTools.getByRole('button', { name: /单元格属性|Cell properties/u }),
    ).toBeVisible();
    await expect(
        page
            .locator('.soeditor-ui__table-balloon')
            .getByRole('button', { name: /选择表格|Select table/u }),
    ).toHaveCount(0);
    await tableTools
        .getByRole('button', { name: /表格属性|Table properties/u })
        .click();
    const tablePropertiesDialog = page.getByRole('dialog', {
        name: /表格属性|Table properties/u,
    });
    await expect(
        tablePropertiesDialog.getByText('表格高度', { exact: true }),
    ).toBeVisible();
    await expect(
        tablePropertiesDialog.getByText('边框大小', { exact: true }),
    ).toBeVisible();
    await expect(
        tablePropertiesDialog.getByText('单元格间距', { exact: true }),
    ).toBeVisible();
    await expect(
        tablePropertiesDialog.getByText('单元格内边距', { exact: true }),
    ).toBeVisible();
    await tablePropertiesDialog.getByRole('button', { name: '取消' }).click();

    await cells.first().click();
    await cells.nth(2).click({ modifiers: ['Shift'] });
    await expect(scope).toContainText(/单元格.*3 × 1|Cell.*3 × 1/u);
    await expect(
        tableTools.getByRole('button', { name: /单元格属性|Cell properties/u }),
    ).toBeHidden();
    await expect(
        tableTools.getByRole('button', { name: /表格标题|Table caption/u }),
    ).toBeHidden();
    await cells.first().click();
    const columnHandle = visual
        .locator('.soeditor-table-column-resize')
        .first();
    await expect(columnHandle).toBeVisible();
    const columnBox = await columnHandle.boundingBox();
    if (columnBox === null) throw new Error('Missing column resize handle.');
    await page.mouse.move(
        columnBox.x + columnBox.width / 2,
        columnBox.y + columnBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
        columnBox.x + columnBox.width / 2 + 24,
        columnBox.y + columnBox.height / 2,
    );
    const movingColumnBox = await columnHandle.boundingBox();
    if (movingColumnBox === null)
        throw new Error('Missing moving column handle.');
    expect(movingColumnBox.x + movingColumnBox.width / 2).toBeCloseTo(
        columnBox.x + columnBox.width / 2 + 24,
        0,
    );
    await page.mouse.up();
    await expect
        .poll(() =>
            page.evaluate(() => globalThis.__classicDemo.editor.getData()),
        )
        .toMatch(/<col width="\d+">/u);
    await expect(cells).toHaveCount(initialCellCount);

    await visual.locator('.soeditor-table-cell').first().click();
    const rowHandle = visual.locator('.soeditor-table-row-resize').first();
    await expect(rowHandle).toBeVisible();
    const rowBox = await rowHandle.boundingBox();
    if (rowBox === null) throw new Error('Missing row resize handle.');
    await page.mouse.move(
        rowBox.x + rowBox.width / 2,
        rowBox.y + rowBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
        rowBox.x + rowBox.width / 2,
        rowBox.y + rowBox.height / 2 + 18,
    );
    const movingRowBox = await rowHandle.boundingBox();
    if (movingRowBox === null) throw new Error('Missing moving row handle.');
    expect(movingRowBox.y + movingRowBox.height / 2).toBeCloseTo(
        rowBox.y + rowBox.height / 2 + 18,
        0,
    );
    await page.mouse.up();
    await expect
        .poll(() =>
            page.evaluate(() => globalThis.__classicDemo.editor.getData()),
        )
        .toMatch(/<tr[^>]*height="\d+"/u);
});

test('auto-formats Source after debounced WYSIWYG changes in split view', async ({
    page,
}) => {
    await page.goto('/classic.html');
    await page.locator('body[data-ready="true"]').waitFor();
    const editor = page.locator('.soeditor-classic');
    await editor
        .locator('[data-workspace-view="wysiwyg-source-vertical"]')
        .click();

    const heading = editor.locator('.soeditor-classic__visual h1');
    await heading.click();
    await page.keyboard.press('End');
    await page.keyboard.type('！');

    await expect(editor.locator('.cm-content')).toContainText(
        '用 SoEditor 构建现代内容体验！',
    );
    await expect
        .poll(() =>
            page.evaluate(() => globalThis.__classicDemo.editor.getData()),
        )
        .toMatch(/<\/h1>\n<p>/u);
});

test('clears stale list state before and during table cell selection', async ({
    page,
}) => {
    await page.goto('/classic.html');
    await page.locator('body[data-ready="true"]').waitFor();

    expect(
        await page.evaluate(() => {
            const editor = globalThis.__classicDemo.editor.editor;
            return {
                ordered: editor.commands.isActive('list.ordered'),
                unordered: editor.commands.isActive('list.unordered'),
            };
        }),
    ).toEqual({ ordered: false, unordered: false });

    const paragraph = page
        .locator('.soeditor-classic__visual')
        .getByText(/这是一段由 CMS/u);
    await paragraph.dblclick();
    await page.locator('[data-toolbar-item="unorderedList"]').click();
    await expect(
        page.locator('[data-toolbar-item="unorderedList"]'),
    ).toHaveAttribute('aria-pressed', 'true');

    for (const item of ['orderedList', 'unorderedList']) {
        const button = page.locator(`[data-toolbar-item="${item}"]`);
        if (item === 'unorderedList') continue;
        await expect(button).toHaveAttribute('aria-pressed', 'false');
    }

    const cells = page.locator('.soeditor-table-cell');
    await cells.nth(3).dispatchEvent('pointerdown', { button: 0 });
    await expect(
        page.locator('[data-toolbar-item="unorderedList"]'),
    ).toHaveAttribute('aria-pressed', 'false');
    await cells.nth(3).dispatchEvent('pointerup', { button: 0 });
    await cells.nth(3).click();

    for (const item of ['orderedList', 'unorderedList']) {
        const button = page.locator(`[data-toolbar-item="${item}"]`);
        await expect(button).toHaveAttribute('aria-pressed', 'false');
        await expect(button).not.toHaveClass(/is-active/u);
    }

    await cells.nth(4).click({ modifiers: ['Shift'] });
    await expect(
        page.locator('.soeditor-table-cell.is-structurally-selected'),
    ).toHaveCount(2);

    for (const item of ['orderedList', 'unorderedList']) {
        const button = page.locator(`[data-toolbar-item="${item}"]`);
        await expect(button).toBeDisabled();
        await expect(button).toHaveAttribute('aria-pressed', 'false');
        await expect(button).not.toHaveClass(/is-active/u);
    }

    await cells.nth(3).dblclick();
    for (const item of ['orderedList', 'unorderedList']) {
        const button = page.locator(`[data-toolbar-item="${item}"]`);
        await expect(button).toHaveAttribute('aria-pressed', 'false');
        await expect(button).not.toHaveClass(/is-active/u);
    }
});

test('reopens table tools after merge, cell editing, and external dismissal', async ({
    page,
}) => {
    await page.goto('/classic.html');
    await page.locator('body[data-ready="true"]').waitFor();

    const cells = page.locator('.soeditor-table-cell');
    await cells.nth(3).click();
    await cells.nth(4).click({ modifiers: ['Shift'] });
    const tableTools = page.locator('.soeditor-ui__table-balloon');
    await tableTools
        .getByRole('button', { name: /Merge cells|合并单元格/u })
        .click();
    await expect(tableTools).toBeVisible();

    const mergedCell = page.locator('.soeditor-table-cell').nth(3);
    await mergedCell.click();
    await mergedCell.fill('合并后编辑');
    await page.locator('#submit').focus();
    await expect(tableTools).toHaveCount(0);

    await mergedCell.click();
    await expect(tableTools).toBeVisible();
});

test('presents the complete CMS showcase from the root URL', async ({
    page,
}) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    await page.locator('body[data-ready="true"]').waitFor();

    await expect(page).toHaveURL(/\/classic\.html$/u);
    await expect(
        page.getByRole('heading', {
            level: 1,
            name: '真正可操作的 CMS 富文本编辑器',
        }),
    ).toBeVisible();
    await expect(page.locator('.soeditor-classic')).toBeVisible();
    for (const item of [
        'pageBreak',
        'placeholder',
        'redo',
        'source',
        'sourceFind',
        'specialCharacter',
        'undo',
    ]) {
        await expect(page.locator(`[data-toolbar-item="${item}"]`)).toHaveCount(
            0,
        );
    }
    await expect(page.locator('[data-classic-action="save"]')).toHaveCount(0);
    const rightSide = page.locator('.soeditor-classic__toolbar-end');
    const rightSideOrder = await rightSide.evaluate((group) =>
        [...group.children].map(
            (element) =>
                (element as HTMLElement).dataset.toolbarItem ??
                (element as HTMLElement).dataset.classicAction ??
                '',
        ),
    );
    expect(rightSideOrder[0]).toBe('popupPreview');
    const rightAlignment = await rightSide.evaluate((group) => {
        const toolbar = group.parentElement;
        const groupRect = group.getBoundingClientRect();
        const toolbarRect = toolbar?.getBoundingClientRect();
        return {
            gap:
                toolbarRect === undefined
                    ? Number.POSITIVE_INFINITY
                    : toolbarRect.right - groupRect.right,
            position: getComputedStyle(group).position,
        };
    });
    expect(rightAlignment.position).toBe('static');
    expect(rightAlignment.gap).toBeLessThanOrEqual(12);
    const toolbarButtonStyles = await page
        .locator('.soeditor-classic [role="toolbar"] .soeditor-ui__button')
        .evaluateAll((buttons) =>
            buttons
                .filter((button) => !(button as HTMLElement).hidden)
                .map((button) => {
                    const rectangle = button.getBoundingClientRect();
                    const style = getComputedStyle(button);
                    return {
                        borderWidth: style.borderWidth,
                        height: rectangle.height,
                        shadow: style.boxShadow,
                        width: rectangle.width,
                    };
                }),
        );
    expect(
        toolbarButtonStyles.every(
            ({ borderWidth, height, shadow, width }) =>
                borderWidth === '0px' &&
                shadow === 'none' &&
                width <= 36.5 &&
                Math.abs(width - height) <= 0.5,
        ),
    ).toBe(true);
    await expect(
        page.locator('.soeditor-ui__toolbar-toggle'),
    ).not.toBeVisible();
    expect(
        await page
            .locator('.soeditor-classic [role="toolbar"] .soeditor-ui__button')
            .evaluateAll((buttons) =>
                buttons.every(
                    (button) =>
                        button.querySelector(
                            ':scope > svg.soeditor-ui__icon',
                        ) !== null,
                ),
            ),
    ).toBe(true);
    expect(
        await page
            .locator('.soeditor-classic [role="toolbar"] .soeditor-ui__icon')
            .evaluateAll((icons) =>
                icons.every((icon) =>
                    icon.classList.contains('soeditor-ui__icon--solid'),
                ),
            ),
    ).toBe(true);
    await expect(page.locator('[data-toolbar-item="bold"] svg')).toHaveCount(1);
    await expect(page.locator('[data-toolbar-item="bold"] svg')).toHaveClass(
        /soeditor-ui__icon--solid/u,
    );
    await expect(page.locator('[data-toolbar-item="link"] svg')).toHaveCount(1);
    await expect(page.locator('[data-toolbar-item="link"] svg')).toHaveClass(
        /soeditor-ui__icon--solid/u,
    );
    const colorIconPaths = await page
        .locator(
            '[data-toolbar-item="fontColor"] > summary > svg > path, [data-toolbar-item="fontBackgroundColor"] > summary > svg > path, [data-toolbar-item="highlight"] > summary > svg > path',
        )
        .evaluateAll((paths) => paths.map((path) => path.getAttribute('d')));
    expect(new Set(colorIconPaths).size).toBe(3);
    await expect(page.locator('[data-toolbar-item="table"] svg')).toHaveCount(
        1,
    );
    const imageActions = page.locator('[data-toolbar-item="image-actions"]');
    await expect(imageActions.locator('summary svg')).toHaveCount(1);
    await imageActions.locator('summary').click();
    await expect(imageActions.getByRole('menuitem')).toHaveText([
        'Upload from computer',
        'Insert with file manager',
        'Insert via URL',
    ]);
    await expect(imageActions.getByRole('menuitem').locator('svg')).toHaveCount(
        3,
    );
    await imageActions.locator('summary').click();
    const wysiwyg = page.locator('.soeditor-classic__visual');
    expect(
        await page
            .locator('[data-classic-action="workspace-view"] button')
            .evaluateAll((buttons) =>
                buttons.map((button) => button.getAttribute('aria-label')),
            ),
    ).toEqual([
        'WYSIWYG',
        '源码',
        '所见即所得 + 源码（左右）',
        '所见即所得 + 源码（上下）',
    ]);
    await expect(
        wysiwyg.locator('img[src="/demo-editor-cover.svg"]'),
    ).toHaveCount(1);
    await expect(wysiwyg.getByText('Edit HTML')).toHaveCount(0);
    await expect(wysiwyg.locator('.soeditor-opaque')).toHaveCount(0);
    await expect(page.getByLabel('Unsupported HTML display')).toHaveCount(0);
    await expect(wysiwyg.locator('.soeditor-table-widget')).toHaveCount(1);
    await expect(wysiwyg.locator('table.soeditor-table-widget')).toHaveCount(1);
    await expect(
        wysiwyg.locator('table.soeditor-table-widget'),
    ).toHaveJSProperty('isContentEditable', true);
    await expect(
        wysiwyg.locator('td > .soeditor-table-cell, th > .soeditor-table-cell'),
    ).toHaveCount(0);
    await expect(page.locator('[data-toolbar-item="format"]')).toBeHidden();
    await expect(
        wysiwyg.locator('.soeditor-table-widget').getByRole('button', {
            name: 'Add row',
        }),
    ).toHaveCount(0);
    await wysiwyg.locator('.soeditor-table-cell').nth(1).click();
    await expect(
        page
            .locator('.soeditor-ui__balloon')
            .getByRole('button', { name: 'Add row' })
            .locator('svg'),
    ).toHaveCount(1);
    const initialTableBalloon = page.locator('.soeditor-ui__table-balloon');
    await initialTableBalloon.evaluate((element) => {
        element.setAttribute('data-test-instance', 'stable');
    });
    await wysiwyg.locator('.soeditor-table-cell').nth(4).click();
    await expect(initialTableBalloon).toHaveAttribute(
        'data-test-instance',
        'stable',
    );
    await expect(wysiwyg.locator('.soeditor-table-cell').nth(4)).toHaveClass(
        /is-editing/u,
    );
    const tableRectangle = await wysiwyg
        .locator('.soeditor-table-widget')
        .boundingBox();
    if (tableRectangle === null) throw new Error('Missing table widget.');
    const placement = await initialTableBalloon.evaluate((element) => {
        const balloonRect = element.getBoundingClientRect();
        return {
            bottom: balloonRect.bottom,
            placement: element.getAttribute('data-placement'),
            top: balloonRect.top,
            viewportHeight: window.innerHeight,
        };
    });
    const tableBottom = tableRectangle.y + tableRectangle.height;
    expect(placement.bottom).toBeLessThanOrEqual(placement.viewportHeight);
    expect(tableBottom).toBeGreaterThan(tableRectangle.y);
    expect(['above', 'below']).toContain(placement.placement);
    expect(placement.top).toBeGreaterThanOrEqual(0);
    expect(placement.bottom).toBeLessThanOrEqual(placement.viewportHeight);
    if (placement.placement === 'above') {
        expect(placement.bottom).toBeLessThanOrEqual(tableRectangle.y);
    } else {
        expect(placement.top).toBeGreaterThanOrEqual(tableBottom);
    }
    await wysiwyg.locator('.soeditor-table-cell').nth(1).click();
    await wysiwyg
        .locator('.soeditor-table-cell')
        .nth(1)
        .fill('可直接编辑的单元格');
    await expect(page.locator('.soeditor-ui__notification')).toHaveCount(0);
    await expect(wysiwyg.locator('.soeditor-table-cell').nth(1)).toHaveText(
        '可直接编辑的单元格',
    );
    await expect(
        page.locator('[data-toolbar-item="tableProperties"]'),
    ).toHaveCount(0);
    await wysiwyg.locator('.soeditor-table-cell').first().click();
    const tableTools = page.locator('.soeditor-ui__table-balloon');
    await tableTools
        .getByRole('button', { name: /表格标题|Table caption/u })
        .click();
    const captionDialog = page.getByRole('dialog', { name: '表格标题' });
    await expect(captionDialog.getByLabel('标题文字')).toHaveValue(
        'CMS 功能交付状态',
    );
    await captionDialog.getByLabel('标题文字').fill('可配置的表格标题');
    await captionDialog.getByRole('button', { name: '保存标题' }).click();
    await captionDialog.getByRole('button', { name: '完成' }).click();
    await wysiwyg.locator('.soeditor-table-cell').first().click();
    await tableTools
        .getByRole('button', { name: /表格属性|Table properties/u })
        .click();
    const tableDialog = page.getByRole('dialog', {
        name: /表格属性|Table properties/u,
    });
    await expect(tableDialog.getByLabel(/标题|Caption/u)).toHaveCount(0);
    const tableWidth = tableDialog.getByRole('spinbutton', {
        name: /表格宽度|Table width/u,
    });
    await tableDialog
        .getByLabel(/表格宽度单位|Table width unit/u)
        .selectOption('px');
    await tableWidth.fill('10000');
    await expect(tableWidth).toHaveAttribute('aria-invalid', 'true');
    await expect(
        tableDialog.locator(
            '[data-table-field="width"] .soeditor-table-properties__feedback.is-error',
        ),
    ).toContainText(/1.*9999/u);
    await tableDialog.getByRole('button', { name: /应用|Apply/u }).click();
    await expect(tableDialog).toBeVisible();
    await expect(page.locator('#content')).toHaveValue(/可配置的表格标题/u);
    await tableWidth.fill('640');
    await expect(tableWidth).toHaveAttribute('aria-invalid', 'false');
    await tableDialog.getByLabel(/边框大小|Border size/u).fill('5');
    await tableDialog.getByLabel(/对齐方式|Alignment/u).selectOption('right');
    await tableDialog.getByText(/高级设置|Advanced settings/u).click();
    await tableDialog
        .getByLabel(/响应式类名|Responsive classes/u)
        .fill('cms-table responsive-table');
    await tableDialog
        .getByLabel(/无障碍标签|Accessible label/u)
        .fill('CMS 功能验证结果');
    await tableDialog.getByRole('button', { name: /应用|Apply/u }).click();
    await expect(page.locator('#content')).toHaveValue(/可配置的表格标题/u);
    await expect(
        wysiwyg.locator('table').first().locator('caption'),
    ).toHaveText('可配置的表格标题');
    await expect(wysiwyg.locator('table').first()).toHaveAttribute(
        'width',
        '640',
    );
    await expect(wysiwyg.locator('table').first()).toHaveCSS('width', '640px');
    await expect(wysiwyg.locator('table').first()).toHaveCSS(
        'border-top-width',
        '5px',
    );
    await expect(
        wysiwyg.locator('table').first().locator('td, th').first(),
    ).toHaveCSS('border-top-width', '5px');
    await expect(wysiwyg.locator('table').first()).toHaveAttribute(
        'style',
        /margin-inline-start: auto/u,
    );
    await expect(wysiwyg.locator('table').first()).toHaveClass(/cms-table/u);
    await expect(wysiwyg.locator('table').first()).toHaveAttribute(
        'aria-label',
        'CMS 功能验证结果',
    );
    await expect(page.locator('#content')).toHaveValue(/width="640"/u);
    await expect(page.locator('#content')).toHaveValue(/align="right"/u);
    await expect(page.locator('#content')).toHaveValue(
        /class="cms-table responsive-table"/u,
    );
    await expect(page.locator('#content')).not.toHaveValue(
        /<table[^>]*\sstyle=/u,
    );
    const secondRowSecondCell = wysiwyg.locator('.soeditor-table-cell').nth(4);
    await secondRowSecondCell.click();
    const tableBalloon = page.locator('.soeditor-ui__balloon');
    await expect(
        tableBalloon.getByRole('button', { name: 'Add row' }),
    ).toBeVisible();
    await expect(
        tableBalloon.getByRole('button', { name: 'Bold cell content' }),
    ).toHaveCount(0);
    await expect(
        tableBalloon.getByRole('button', { name: 'Link cell content' }),
    ).toHaveCount(0);
    await expect(
        tableBalloon.getByRole('button', { name: 'Insert image in cell' }),
    ).toHaveCount(0);
    await expect(tableBalloon.getByLabel('Column width')).toHaveCount(0);

    await secondRowSecondCell.dblclick();
    await expect
        .poll(() =>
            secondRowSecondCell.evaluate((cell) => cell.isContentEditable),
        )
        .toBe(true);
    await expect(tableBalloon).toHaveCount(1);
    await secondRowSecondCell.evaluate((cell) => {
        const text = cell.firstChild;
        if (!(text instanceof Text)) {
            throw new Error('Expected table cell text.');
        }
        document
            .getSelection()
            ?.setBaseAndExtent(text, 0, text, text.data.length);
    });
    await page.locator('[data-toolbar-item="bold"]').click();
    await expect(secondRowSecondCell.locator('strong')).toHaveCount(1);

    await imageActions.locator('summary').click();
    await imageActions
        .getByRole('menuitem', { name: 'Insert with file manager' })
        .click();
    const cellAssetManager = page.getByRole('dialog', {
        name: 'CMS asset manager',
    });
    await expect(cellAssetManager).toBeVisible();
    await expect
        .poll(() =>
            secondRowSecondCell.evaluate((cell) => cell.isContentEditable),
        )
        .toBe(true);
    await cellAssetManager.getByRole('button', { name: /编辑器封面/ }).click();
    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    globalThis.__classicDemo
                        .getData()
                        .match(/demo-editor-cover\.svg/gu)?.length ?? 0,
            ),
        )
        .toBe(2);
    await expect(secondRowSecondCell.locator('img')).toHaveAttribute(
        'src',
        /demo-editor-cover\.svg/u,
    );
    await wysiwyg
        .getByRole('heading', { level: 2, name: '本次发布重点' })
        .click();
    await expect(page.locator('#content')).toHaveValue(
        /demo-editor-cover\.svg/u,
    );
    await expect(page.locator('[data-demo-action]')).toHaveCount(12);
    await expect(page.locator('.demo-capability-grid article')).toHaveCount(12);

    await page.locator('[data-demo-action="table"]').click();
    await expect(wysiwyg.locator('.soeditor-table-widget')).toHaveCount(2);
    await expect(page.getByRole('status').last()).toContainText(
        '已通过 table.insert 命令插入 3 × 3 表格',
    );

    const accessibility = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();
    expect(accessibility.violations).toEqual([]);
    expect(errors).toEqual([]);
});

test('keeps native caret placement while switching between table cells', async ({
    page,
}) => {
    await page.goto('/');
    await page.locator('body[data-ready="true"]').waitFor();
    const visual = page.locator('.soeditor-classic__visual');
    let cells = visual.locator('.soeditor-table-cell');
    await cells.nth(1).fill('abc');
    await visual
        .getByRole('heading', { level: 2, name: '本次发布重点' })
        .click();
    await expect(page.locator('#content')).toHaveValue(/<th>abc<\/th>/u);

    const clickAtOffset = async (cellIndex: number, offset: number) => {
        cells = visual.locator('.soeditor-table-cell');
        const cell = cells.nth(cellIndex);
        await cell.scrollIntoViewIfNeeded();
        const point = await cell.evaluate((target, textOffset) => {
            const text = target.firstChild;
            if (!(text instanceof Text) || textOffset >= text.data.length) {
                throw new Error('Missing table cell text at the test offset.');
            }
            const range = document.createRange();
            range.setStart(text, textOffset);
            range.setEnd(text, textOffset + 1);
            const rect = range.getBoundingClientRect();
            return {
                x: rect.left + rect.width * 0.1,
                y: rect.top + rect.height / 2,
            };
        }, offset);
        await page.mouse.click(point.x, point.y);
        await expect
            .poll(() =>
                cell.evaluate((target) => {
                    const root = target.getRootNode();
                    const selection =
                        root instanceof ShadowRoot
                            ? root.getSelection()
                            : document.getSelection();
                    return selection !== null &&
                        selection.isCollapsed &&
                        selection.anchorNode === target.firstChild
                        ? selection.anchorOffset
                        : -1;
                }),
            )
            .toBe(offset);
    };

    await clickAtOffset(1, 2);
    await clickAtOffset(1, 1);
    await clickAtOffset(1, 2);
    await clickAtOffset(4, 1);
    await clickAtOffset(1, 1);
    await clickAtOffset(5, 1);
    await clickAtOffset(5, 4);
    await clickAtOffset(5, 6);
    await expect
        .poll(() => cells.nth(1).evaluate((cell) => cell.isContentEditable))
        .toBe(true);
    await expect
        .poll(() => cells.nth(4).evaluate((cell) => cell.isContentEditable))
        .toBe(true);

    cells = visual.locator('.soeditor-table-cell');
    await cells.nth(1).evaluate((cell) => {
        const text = cell.firstChild;
        if (!(text instanceof Text)) throw new Error('Missing cell text.');
        const range = document.createRange();
        range.setStart(text, 0);
        range.setEnd(text, text.data.length);
        const root = cell.getRootNode();
        const selection =
            root instanceof ShadowRoot
                ? root.getSelection()
                : document.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
    });
    const color = page.locator('[data-toolbar-item="fontColor"]');
    await color.locator('summary').click();
    await color.locator('[data-value="#dc2626"]').click();
    await expect(page.locator('#content')).toHaveValue(
        /<th><span style="color: #dc2626;">abc<\/span><\/th>/u,
    );
});

test('replaces a native WYSIWYG selection and edits images on double click', async ({
    page,
}) => {
    const wysiwyg = page.locator('.soeditor-classic__visual');
    await page.evaluate(() => {
        globalThis.__classicDemo.editor.setData(
            '<p>Alpha bravo</p><p><img src="/demo-editor-cover.svg" alt="Cover" width="640" height="240"></p><aside data-soeditor-object="promo" data-campaign="summer" data-theme="violet"></aside>',
        );
    });
    await wysiwyg
        .locator('p')
        .first()
        .evaluate((paragraph) => {
            const text = paragraph.firstChild;
            if (!(text instanceof Text)) throw new Error('Missing text node.');
            const root = paragraph.getRootNode();
            const selection =
                root instanceof ShadowRoot
                    ? root.getSelection()
                    : document.getSelection();
            selection?.setBaseAndExtent(text, 1, text, 5);
        });
    await page.keyboard.type('X');
    await expect
        .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
        .toContain('<p>AX bravo</p>');

    const image = wysiwyg.locator('img');
    await image.dblclick();
    const dialog = page.getByRole('dialog', { name: 'Image properties' });
    await expect(dialog).toHaveClass(/soeditor-classic__image-dialog/u);
    await expect(dialog.locator('fieldset')).toHaveCount(3);
    await expect(dialog.getByLabel('Image title')).toBeVisible();
    await expect(dialog.getByLabel('Visible caption')).toBeVisible();
    await expect(dialog.getByLabel('Responsive CSS classes')).toBeHidden();
    await dialog.getByText('Responsive image settings').click();
    await expect(dialog.getByLabel('Responsive CSS classes')).toBeVisible();
    await expect(dialog.getByLabel('Image URL')).toHaveValue(
        '/demo-editor-cover.svg',
    );
    await dialog.getByLabel('Alternative text').fill('Updated cover');
    await dialog.getByLabel('Image title').fill('Campaign cover');
    await dialog.getByLabel('Link URL').fill('/campaign');
    await dialog.getByLabel('Link target').selectOption('_blank');
    await dialog.getByLabel('Lock aspect ratio').check();
    await dialog.getByLabel('Width').fill('480');
    await expect(dialog.getByLabel('Height')).toHaveValue('180');
    await dialog.getByLabel('Lock aspect ratio').uncheck();
    await dialog.getByRole('button', { name: 'Update image' }).click();
    await expect
        .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
        .toContain(
            '<img src="/demo-editor-cover.svg" alt="Updated cover" width="480" height="180" title="Campaign cover">',
        );
    await expect
        .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
        .toContain('<a href="/campaign" target="_blank"><img');

    await image.click();
    const handles = wysiwyg.locator('.soeditor-image-resize-handle');
    await expect(handles).toHaveCount(8);
    const east = wysiwyg.locator(
        '.soeditor-image-resize-handle[data-resize-direction="e"]',
    );
    const eastBox = await east.boundingBox();
    if (eastBox === null) throw new Error('Missing east image resize handle.');
    await page.mouse.move(
        eastBox.x + eastBox.width / 2,
        eastBox.y + eastBox.height / 2,
    );
    await page.mouse.down();
    await page.keyboard.down('Shift');
    await page.mouse.move(
        eastBox.x + eastBox.width / 2 + 40,
        eastBox.y + eastBox.height / 2,
    );
    await expect(
        wysiwyg.locator('.soeditor-image-resize-overlay'),
    ).toHaveAttribute('data-dimensions', '520 × 195');
    await page.mouse.up();
    await page.keyboard.up('Shift');
    await expect
        .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
        .toContain('width="520" height="195"');
    await page.keyboard.press('Control+z');
    await expect
        .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
        .toContain('width="480" height="180"');

    const aside = wysiwyg.locator('aside[data-soeditor-object="promo"]');
    await expect(aside).toHaveCount(1);
    await expect(aside).toHaveAttribute('data-campaign', 'summer');
    await expect(wysiwyg.getByText('Promotion')).toHaveCount(0);
    await expect(wysiwyg.getByText('campaign')).toHaveCount(0);
});

test('applies font family, colors, highlight, and size through native selections', async ({
    page,
}) => {
    const toolbar = page.locator('.soeditor-classic').getByRole('toolbar');
    await page.evaluate(() => {
        globalThis.__classicDemo.editor.setData(
            '<p>Color Background Highlight Family Size</p>',
        );
    });
    const apply = async (
        item:
            | 'fontBackgroundColor'
            | 'fontColor'
            | 'fontFamily'
            | 'fontSize'
            | 'highlight',
        start: number,
        end: number,
        value: string,
    ) => {
        await page.evaluate(
            ({ anchor, focus }) => {
                globalThis.__classicDemo.select({
                    anchor: { block: 0, offset: anchor },
                    focus: { block: 0, offset: focus },
                });
            },
            { anchor: start, focus: end },
        );
        const menu = toolbar.locator(`[data-toolbar-item="${item}"]`);
        await menu.locator('summary').click();
        await menu.locator(`[data-value="${value}"]`).click();
    };

    await apply('fontColor', 0, 5, '#dc2626');
    await apply('fontBackgroundColor', 6, 16, '#fef9c3');
    await apply('highlight', 17, 26, '#fef08a');
    await apply('fontFamily', 27, 33, 'georgia');
    await apply('fontSize', 34, 38, '24px');

    const wysiwyg = page.locator('.soeditor-classic__visual');
    await expect(wysiwyg.locator('span[style="color: #dc2626;"]')).toHaveText(
        'Color',
    );
    await expect(
        wysiwyg.locator('span[style="background-color: #fef9c3;"]'),
    ).toHaveText('Background');
    await expect(
        wysiwyg.locator(
            'mark[style="background: linear-gradient(transparent 60%, #fef08a 0);"]',
        ),
    ).toHaveText('Highlight');
    await expect(
        wysiwyg.locator('span[style="font-family: georgia;"]'),
    ).toHaveText('Family');
    await expect(wysiwyg.locator('span[style="font-size: 24px;"]')).toHaveText(
        'Size',
    );
    await expect
        .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
        .toContain('<span style="font-size: 24px;">Size</span>');
});

test('accepts typed and picked colors and persists a shared recent-color history', async ({
    page,
}) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.evaluate(() => {
        localStorage.removeItem('soeditor.ui.recent-colors.v1');
        globalThis.__classicDemo.editor.setData('<p>Typed Recent Picked</p>');
    });
    const toolbar = page.locator('.soeditor-classic').getByRole('toolbar');
    const visual = page.locator('.soeditor-classic__visual');
    const selectedVisualText = () =>
        visual.evaluate((element) => {
            const root = element.getRootNode();
            return (
                (root instanceof ShadowRoot
                    ? root.getSelection()
                    : document.getSelection()
                )?.toString() ?? ''
            );
        });
    const select = async (start: number, end: number): Promise<void> => {
        await page.evaluate(
            ({ startOffset, endOffset }) => {
                globalThis.__classicDemo.select({
                    anchor: { block: 0, offset: startOffset },
                    focus: { block: 0, offset: endOffset },
                });
            },
            { endOffset: end, startOffset: start },
        );
    };

    await select(0, 5);
    const textColor = toolbar.locator('[data-toolbar-item="fontColor"]');
    await textColor.locator('summary').click();
    const textValue = textColor.getByLabel(/颜色值|Color value/u);
    const textValueBox = await textValue.boundingBox();
    expect(textValueBox?.width ?? 0).toBeGreaterThan(180);
    expect(textValueBox?.height ?? 0).toBeGreaterThanOrEqual(30);
    await textValue.fill('not a color!');
    await textColor
        .getByRole('button', { name: /应用颜色|Apply color/u })
        .click();
    await expect(textValue).toHaveAttribute('aria-invalid', 'true');
    await expect(textColor.getByRole('status')).toContainText(
        /颜色格式不正确|Invalid color/u,
    );
    await expect(textColor).toHaveAttribute('open', '');
    await textValue.fill('#123456');
    await expect(textValue).toHaveAttribute('aria-invalid', 'false');
    await expect
        .poll(() => page.locator('[data-soeditor-selection-highlight]').count())
        .toBe(1);
    await expect(textColor.locator('.soeditor-ui__native-color')).toHaveCSS(
        'background-color',
        'rgb(18, 52, 86)',
    );
    await textColor
        .locator('.soeditor-ui__color-section-label')
        .first()
        .click();
    await expect(textColor).not.toHaveAttribute('open', '');
    await expect.poll(selectedVisualText).toBe('Typed');
    await expect
        .poll(() => page.locator('[data-soeditor-selection-highlight]').count())
        .toBe(0);
    await textColor.locator('summary').click();
    await textValue.focus();
    await page
        .locator('.demo-workspace__bar')
        .click({ position: { x: 8, y: 8 } });
    await expect(textColor).not.toHaveAttribute('open', '');
    await expect.poll(selectedVisualText).toBe('Typed');
    await expect(visual.locator('span[style="color: #123456;"]')).toHaveCount(
        0,
    );
    await textColor.locator('summary').click();
    await textValue.evaluate((input) => {
        const visual = document.querySelector('.soeditor-classic__visual');
        const root = visual?.shadowRoot;
        const text = root?.querySelector('p')?.firstChild;
        if (!(text instanceof Text)) {
            throw new Error('Expected color test text.');
        }
        if (!(root instanceof ShadowRoot)) {
            throw new Error('Expected a shadow-root WYSIWYG surface.');
        }
        input.addEventListener(
            'pointerdown',
            () => {
                const selection = root.getSelection();
                if (selection === null) return;
                const prototype = Object.getPrototypeOf(selection) as object;
                const nativeGetRangeAt: unknown = Reflect.get(
                    prototype,
                    'getRangeAt',
                );
                Object.defineProperty(prototype, 'getRangeAt', {
                    configurable: true,
                    value: () => ({ commonAncestorContainer: {} }),
                });
                try {
                    root.dispatchEvent(new Event('selectionchange'));
                } finally {
                    Object.defineProperty(prototype, 'getRangeAt', {
                        configurable: true,
                        value: nativeGetRangeAt,
                    });
                }
            },
            { once: true },
        );
    });
    await textValue.click();
    await textColor
        .getByRole('button', { name: /应用颜色|Apply color/u })
        .click();
    await expect(visual.locator('span[style="color: #123456;"]')).toHaveText(
        'Typed',
    );

    await select(6, 12);
    const background = toolbar.locator(
        '[data-toolbar-item="fontBackgroundColor"]',
    );
    await background.locator('summary').click();
    await background
        .getByRole('button', { name: 'Recent color #123456' })
        .click();
    await expect(background).not.toHaveAttribute('open', '');
    await expect(
        visual.locator('span[style="background-color: #123456;"]'),
    ).toHaveText('Recent');

    await select(13, 19);
    const highlight = toolbar.locator('[data-toolbar-item="highlight"]');
    await highlight.locator('summary').click();
    const picker = highlight.getByLabel(/选择颜色|Choose color/u);
    await picker.evaluate((element) => {
        if (!(element instanceof HTMLInputElement)) {
            throw new Error('Expected a native color input.');
        }
        element.value = '#abcdef';
        element.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect(highlight.getByLabel(/颜色值|Color value/u)).toHaveValue(
        '#abcdef',
    );
    await expect(
        visual.locator(
            'mark[style="background: linear-gradient(transparent 60%, #abcdef 0);"]',
        ),
    ).toHaveCount(0);
    await highlight
        .getByRole('button', { name: /应用颜色|Apply color/u })
        .click();
    await expect(
        visual.locator(
            'mark[style="background: linear-gradient(transparent 60%, #abcdef 0);"]',
        ),
    ).toHaveText('Picked');

    await expect
        .poll(() =>
            page.evaluate(() =>
                JSON.parse(
                    localStorage.getItem('soeditor.ui.recent-colors.v1') ??
                        '[]',
                ),
            ),
        )
        .toEqual(['#abcdef', '#123456']);
    await page.evaluate(() => {
        localStorage.setItem(
            'soeditor.ui.recent-colors.v1',
            JSON.stringify([
                '#abcdef',
                '#123456',
                '#dc2626',
                '#fef08a',
                '#2563eb',
                '#16a34a',
                '#7c3aed',
                '#ffffff',
                '#344054',
                '#e11d48',
                '#d97706',
                '#65a30d',
                '#0d9488',
                '#4f46e5',
                '#0891b2',
                '#000000',
            ]),
        );
    });
    await page.reload();
    await page.locator('body[data-ready="true"]').waitFor();
    const reloadedColor = page.locator('[data-toolbar-item="fontColor"]');
    await reloadedColor.locator('summary').click();
    await expect(
        reloadedColor.getByRole('button', { name: 'Recent color #abcdef' }),
    ).toBeVisible();
    await expect(
        reloadedColor.getByRole('button', { name: 'Recent color #123456' }),
    ).toBeVisible();
    await expect
        .poll(() =>
            reloadedColor
                .locator('.soeditor-ui__preset-colors')
                .evaluate(
                    (element) =>
                        getComputedStyle(element).gridTemplateColumns.split(' ')
                            .length,
                ),
        )
        .toBe(8);
    await expect(
        reloadedColor.locator('.soeditor-ui__preset-colors > button'),
    ).toHaveCount(16);
    await expect
        .poll(() =>
            reloadedColor
                .locator('.soeditor-ui__recent-color-grid')
                .evaluate(
                    (element) =>
                        getComputedStyle(element).gridTemplateColumns.split(' ')
                            .length,
                ),
        )
        .toBe(8);
    await expect(
        reloadedColor.locator('.soeditor-ui__recent-color-grid > button'),
    ).toHaveCount(16);
    await reloadedColor.locator('summary').click();
    const reloadedBackground = page.locator(
        '[data-toolbar-item="fontBackgroundColor"]',
    );
    await reloadedBackground.locator('summary').click();
    const removeFits = await reloadedBackground.evaluate((element) => {
        const panel = element.querySelector('.soeditor-ui__color-panel');
        const remove = element.querySelector('.soeditor-ui__color-remove');
        if (!(panel instanceof HTMLElement) || !(remove instanceof HTMLElement))
            return false;
        const panelBox = panel.getBoundingClientRect();
        const removeBox = remove.getBoundingClientRect();
        return (
            remove.scrollWidth <= remove.clientWidth + 1 &&
            removeBox.left >= panelBox.left &&
            removeBox.right <= panelBox.right
        );
    });
    expect(removeFits).toBe(true);
    expect(pageErrors).not.toContainEqual(
        expect.stringContaining('Node.contains'),
    );
});

test('retains the author selection through repeated color-control focus transitions', async ({
    page,
}) => {
    const classic = page.locator('.soeditor-classic');
    const visual = classic.locator('.soeditor-classic__visual');
    const selectTarget = async (): Promise<void> =>
        page.evaluate(() => {
            globalThis.__classicDemo.select({
                anchor: { block: 0, offset: 0 },
                focus: { block: 0, offset: 6 },
            });
        });
    const cases = [
        {
            item: 'fontColor',
            selector: 'span[style="color: #dc2626;"]',
            value: '#dc2626',
        },
        {
            item: 'fontBackgroundColor',
            selector: 'span[style="background-color: #fef9c3;"]',
            value: '#fef9c3',
        },
        {
            item: 'highlight',
            selector:
                'mark[style="background: linear-gradient(transparent 60%, #fef08a 0);"]',
            value: '#fef08a',
        },
    ] as const;

    for (let iteration = 0; iteration < 3; iteration += 1) {
        for (const entry of cases) {
            await page.evaluate(() => {
                globalThis.__classicDemo.editor.setData(
                    '<p>Target remains selected</p>',
                );
            });
            await selectTarget();
            const menu = classic.locator(`[data-toolbar-item="${entry.item}"]`);
            await menu.locator('summary').click();
            await menu.locator(`[data-value="${entry.value}"]`).click();
            await expect(menu).not.toHaveAttribute('open', '');
            await expect(visual.locator(entry.selector)).toHaveText('Target');
        }
    }

    await page.evaluate(() => {
        globalThis.__classicDemo.editor.setData(
            '<p><span style="color: red; background-color: yellow;">Target</span> remains selected</p>',
        );
        globalThis.__classicDemo.select({
            anchor: { block: 0, offset: 0 },
            focus: { block: 0, offset: 6 },
        });
    });
    const textColor = classic.locator('[data-toolbar-item="fontColor"]');
    await textColor.locator('summary').click();
    await textColor
        .getByRole('button', { name: /清除文字颜色|Remove text color/u })
        .click();
    await expect
        .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
        .toBe(
            '<p><span style="background-color: yellow;">Target</span> remains selected</p>',
        );

    await page.evaluate(() => {
        globalThis.__classicDemo.select({
            anchor: { block: 0, offset: 0 },
            focus: { block: 0, offset: 6 },
        });
    });
    const background = classic.locator(
        '[data-toolbar-item="fontBackgroundColor"]',
    );
    await background.locator('summary').click();
    await background
        .getByRole('button', {
            name: /清除背景颜色|Remove background color/u,
        })
        .click();
    await expect
        .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
        .toBe('<p>Target remains selected</p>');

    await page.evaluate(() => {
        globalThis.__classicDemo.editor.setData(
            '<p><span style="background-color: #fef08a;">Target</span> remains selected</p>',
        );
        globalThis.__classicDemo.select({
            anchor: { block: 0, offset: 0 },
            focus: { block: 0, offset: 6 },
        });
    });
    const highlight = classic.locator('[data-toolbar-item="highlight"]');
    await highlight.locator('summary').click();
    await highlight
        .getByRole('button', { name: /清除荧光|Remove highlight/u })
        .click();
    await expect
        .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
        .toBe('<p>Target remains selected</p>');
});

test('previews font families and applies one to a browser-selected range', async ({
    page,
}) => {
    await page.evaluate(() => {
        globalThis.__classicDemo.editor.setData('<p>Family Test</p>');
    });
    await page.evaluate(() => {
        globalThis.__classicDemo.select({
            anchor: { block: 0, offset: 0 },
            focus: { block: 0, offset: 6 },
        });
    });
    const paragraph = page.locator('.soeditor-classic__visual p');
    await expect
        .poll(() =>
            paragraph.evaluate((element) => {
                const root = element.getRootNode();
                return (
                    (root instanceof ShadowRoot
                        ? root.getSelection()
                        : document.getSelection()
                    )?.toString() ?? ''
                );
            }),
        )
        .toBe('Family');

    const menu = page.locator('[data-toolbar-item="fontFamily"]');
    await menu.locator('summary').click();
    await expect
        .poll(() =>
            paragraph.evaluate((element) => {
                const root = element.getRootNode();
                return (
                    (root instanceof ShadowRoot
                        ? root.getSelection()
                        : document.getSelection()
                    )?.toString() ?? ''
                );
            }),
        )
        .toBe('Family');
    const previews = await menu.locator('[data-value]').evaluateAll((buttons) =>
        buttons.map((button) => ({
            fontFamily: (button as HTMLElement).style.fontFamily,
            value: (button as HTMLElement).dataset.value,
        })),
    );
    expect(previews).toEqual([
        { fontFamily: 'inherit', value: 'inherit' },
        { fontFamily: 'arial', value: 'arial' },
        { fontFamily: '"courier new"', value: 'courier new' },
        { fontFamily: 'georgia', value: 'georgia' },
        {
            fontFamily: '"lucida sans unicode"',
            value: 'lucida sans unicode',
        },
        { fontFamily: 'tahoma', value: 'tahoma' },
        { fontFamily: '"times new roman"', value: 'times new roman' },
        { fontFamily: '"trebuchet ms"', value: 'trebuchet ms' },
        { fontFamily: 'verdana', value: 'verdana' },
    ]);
    await menu.locator('[data-value="georgia"]').click();

    const styled = paragraph.locator('span[style="font-family: georgia;"]');
    await expect(styled).toHaveText('Family');
    await expect(styled).toHaveCSS('font-family', 'georgia');
    await expect
        .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
        .toBe('<p><span style="font-family: georgia;">Family</span> Test</p>');

    await menu.locator('summary').click();
    await menu.locator('[data-value="arial"]').click();
    await expect(paragraph.locator('span')).toHaveCount(1);
    await expect(paragraph.locator('span span')).toHaveCount(0);
    await expect(paragraph.locator('span')).toHaveCSS('font-family', 'arial');

    const combinedSizeMenu = page.locator('[data-toolbar-item="fontSize"]');
    await combinedSizeMenu.locator('summary').click();
    await combinedSizeMenu.locator('[data-value="24px"]').click();
    await expect(paragraph.locator('span')).toHaveCount(1);
    await expect(paragraph.locator('span span')).toHaveCount(0);
    await expect(paragraph.locator('span')).toHaveCSS('font-family', 'arial');
    await expect(paragraph.locator('span')).toHaveCSS('font-size', '24px');
    await expect
        .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
        .not.toContain('<span style="font-size: 24px;"><span');

    await page.evaluate(() => {
        globalThis.__classicDemo.editor.setData('<p>Size Test</p>');
    });
    await paragraph.evaluate((element) => {
        const text = element.firstChild;
        if (!(text instanceof Text)) throw new Error('Missing text node.');
        const root = element.getRootNode();
        const selection =
            root instanceof ShadowRoot
                ? root.getSelection()
                : document.getSelection();
        selection?.setBaseAndExtent(text, 0, text, 4);
        root.dispatchEvent(new Event('selectionchange'));
    });
    const sizeMenu = page.locator('[data-toolbar-item="fontSize"]');
    await sizeMenu.locator('summary').click();
    await expect
        .poll(() =>
            paragraph.evaluate((element) => {
                const root = element.getRootNode();
                return (
                    (root instanceof ShadowRoot
                        ? root.getSelection()
                        : document.getSelection()
                    )?.toString() ?? ''
                );
            }),
        )
        .toBe('Size');
    await sizeMenu.locator('[data-value="24px"]').click();
    await expect
        .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
        .toBe('<p><span style="font-size: 24px;">Size</span> Test</p>');

    await page.evaluate(() => {
        globalThis.__classicDemo.editor.setData(
            '<p><span style="font-family: georgia;">Family</span> Test</p>',
        );
    });
    const styledFamily = paragraph.locator('span').first();
    await styledFamily.evaluate((element) => {
        const text = element.firstChild;
        if (!(text instanceof Text)) throw new Error('Missing text node.');
        const root = element.getRootNode();
        const selection =
            root instanceof ShadowRoot
                ? root.getSelection()
                : document.getSelection();
        selection?.setBaseAndExtent(text, 2, text, 5);
        root.dispatchEvent(new Event('selectionchange'));
    });
    await menu.locator('summary').click();
    await menu.locator('[data-value="arial"]').click();
    await expect(paragraph.locator('span span')).toHaveCount(0);
    await expect(paragraph.locator('span')).toHaveCount(3);
    await expect(paragraph.locator('span').nth(0)).toHaveText('Fa');
    await expect(paragraph.locator('span').nth(0)).toHaveCSS(
        'font-family',
        'georgia',
    );
    await expect(paragraph.locator('span').nth(1)).toHaveText('mil');
    await expect(paragraph.locator('span').nth(1)).toHaveCSS(
        'font-family',
        'arial',
    );
    await expect(paragraph.locator('span').nth(2)).toHaveText('y');
});

test('keeps the text selection while switching a block from H1 to H2', async ({
    page,
}) => {
    await page.evaluate(() => {
        globalThis.__classicDemo.editor.setData('<p>Heading text</p>');
    });
    const visual = page.locator('.soeditor-classic__visual');
    await visual.locator('p').evaluate((element) => {
        const text = element.firstChild;
        if (!(text instanceof Text)) throw new Error('Missing text node.');
        const root = element.getRootNode();
        const selection =
            root instanceof ShadowRoot
                ? root.getSelection()
                : document.getSelection();
        selection?.setBaseAndExtent(text, 0, text, 7);
        root.dispatchEvent(new Event('selectionchange'));
    });
    const selectedText = () =>
        visual.evaluate((element) => {
            const root = element.getRootNode();
            return (
                (root instanceof ShadowRoot
                    ? root.getSelection()
                    : document.getSelection()
                )?.toString() ?? ''
            );
        });
    const heading = page.locator('[data-toolbar-item="heading"]');

    await heading.locator('summary').click();
    await expect.poll(selectedText).toBe('Heading');
    await heading.getByRole('button', { name: 'Heading 1' }).click();
    await expect(visual.locator('h1')).toHaveText('Heading text');
    await expect.poll(selectedText).toBe('Heading');

    await heading.locator('summary').click();
    await expect.poll(selectedText).toBe('Heading');
    await heading.getByRole('button', { name: 'Heading 2' }).click();
    await expect(visual.locator('h2')).toHaveText('Heading text');
    await expect.poll(selectedText).toBe('Heading');
});

test('preserves the editing selection across toolbar menus and structural commands', async ({
    page,
}) => {
    const visual = page.locator('.soeditor-classic__visual');
    const selectText = async (html: string, length: number): Promise<void> => {
        await page.evaluate((value) => {
            globalThis.__classicDemo.editor.setData(value);
        }, html);
        const paragraph = visual.locator('p');
        await expect(paragraph).toHaveText('Selected text');
        await paragraph.evaluate((element, selectedLength) => {
            const root = element.getRootNode();
            const selection =
                root instanceof ShadowRoot
                    ? root.getSelection()
                    : document.getSelection();
            const walker = document.createTreeWalker(
                element,
                NodeFilter.SHOW_TEXT,
            );
            const text = walker.nextNode();
            if (!(text instanceof Text)) {
                throw new Error('Missing editable text node.');
            }
            selection?.setBaseAndExtent(text, 0, text, selectedLength);
            root.dispatchEvent(new Event('selectionchange'));
        }, length);
    };
    const selectedText = () =>
        visual.evaluate((element) => {
            const root = element.getRootNode();
            return (
                (root instanceof ShadowRoot
                    ? root.getSelection()
                    : document.getSelection()
                )?.toString() ?? ''
            );
        });

    for (const item of [
        'heading',
        'fontFamily',
        'fontSize',
        'fontColor',
        'fontBackgroundColor',
        'highlight',
        'image-actions',
    ]) {
        await selectText('<p>Selected text</p>', 8);
        const summary = page.locator(`[data-toolbar-item="${item}"] summary`);
        await summary.click();
        await expect.poll(selectedText).toBe('Selected');
        await summary.click();
        await expect.poll(selectedText).toBe('Selected');
    }

    await selectText('<p>Selected text</p>', 8);
    await page.locator('[data-toolbar-item="bold"]').click();
    await expect.poll(selectedText).toBe('Selected');
    await expect(visual.locator('strong')).toHaveText('Selected');

    await selectText('<p>Selected text</p>', 8);
    await page.locator('[data-toolbar-item="unorderedList"]').click();
    await expect(visual.locator('ul > li')).toHaveText('Selected text');
    await expect.poll(selectedText).toBe('Selected');
    await page.locator('[data-toolbar-item="unorderedList"]').click();
    await expect(visual.locator('p')).toHaveText('Selected text');
    await expect.poll(selectedText).toBe('Selected');
});

test('keeps the editing range across dialog, balloon, and nested popup controls', async ({
    page,
}) => {
    const classic = page.locator('.soeditor-classic');
    const visual = classic.locator('.soeditor-classic__visual');
    const selectText = async (): Promise<void> => {
        await page.evaluate(() => {
            globalThis.__classicDemo.editor.setData('<p>Popup selection</p>');
            globalThis.__classicDemo.select({
                anchor: { block: 0, offset: 0 },
                focus: { block: 0, offset: 5 },
            });
        });
    };
    const selectionHighlightCount = () =>
        page.locator('[data-soeditor-selection-highlight]').count();

    await selectText();
    await classic.locator('[data-toolbar-item="link"]').click();
    const linkDialog = page.getByRole('dialog', { name: 'Link', exact: true });
    await linkDialog.getByLabel('Link URL').fill('/popup-selection');
    await linkDialog.getByText('Advanced settings').click();
    await linkDialog.getByLabel('Title').fill('Preserved selection');
    await expect.poll(selectionHighlightCount).toBe(1);
    await linkDialog.getByRole('button', { name: 'Cancel' }).click();
    await classic.locator('[data-toolbar-item="bold"]').click();
    await expect(visual.locator('strong')).toHaveText('Popup');

    await selectText();
    const imageMenu = classic.locator('[data-toolbar-item="image-actions"]');
    await imageMenu.locator('summary').click();
    await imageMenu.getByRole('menuitem', { name: 'Insert via URL' }).click();
    const imageDialog = page.getByRole('dialog', {
        name: 'Insert image via URL',
    });
    await imageDialog.getByLabel('Image URL').fill('/preserved.png');
    await imageDialog.getByLabel('Alternative text').fill('Preserved');
    await expect.poll(selectionHighlightCount).toBe(1);
    await imageDialog.getByRole('button', { name: 'Cancel' }).click();
    await classic.locator('[data-toolbar-item="italic"]').click();
    await expect(visual.locator('em')).toHaveText('Popup');
});

test('applies bold to paragraph, list-item, and table-cell ranges without changing structure', async ({
    page,
}) => {
    const bold = page.locator('[data-toolbar-item="bold"]');
    const selectText = async (
        selector: string,
        start = 0,
        end?: number,
    ): Promise<void> => {
        const target = page.locator(selector);
        await target.click();
        await target.evaluate(
            (element, offsets) => {
                const text = Array.from(element.childNodes).find(
                    (node): node is Text => node instanceof Text,
                );
                if (text === undefined) {
                    throw new Error('Expected a direct text node.');
                }
                document
                    .getSelection()
                    ?.setBaseAndExtent(
                        text,
                        offsets.start,
                        text,
                        offsets.end ?? text.data.length,
                    );
            },
            { end, start },
        );
    };

    await page.evaluate(() => {
        globalThis.__classicDemo.editor.setData('<p>Paragraph</p>');
    });
    await selectText('.soeditor-classic__visual p', 0, 9);
    await bold.click();
    await expect(page.locator('.soeditor-classic__visual p strong')).toHaveText(
        'Paragraph',
    );

    await page.evaluate(() => {
        globalThis.__classicDemo.editor.setData('<p>abc</p>');
    });
    await selectText('.soeditor-classic__visual p', 1, 1);
    await bold.click();
    await page.keyboard.insertText('X');
    await expect
        .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
        .toBe('<p>a<strong>X</strong>bc</p>');

    await page.evaluate(() => {
        globalThis.__classicDemo.editor.setData(
            '<ul><li>Outer<ul><li>Alpha</li></ul></li></ul><ol><li>Bravo</li></ol>',
        );
    });
    await selectText('.soeditor-classic__visual ul ul li');
    await bold.click();
    await selectText('.soeditor-classic__visual ol li');
    await bold.click();
    const wysiwyg = page.locator('.soeditor-classic__visual');
    await expect(wysiwyg.locator('li')).toHaveCount(3);
    await expect(wysiwyg.locator('ul ul li strong')).toHaveText('Alpha');
    await expect(wysiwyg.locator('ol li strong')).toHaveText('Bravo');

    await page.evaluate(() => {
        globalThis.__classicDemo.editor.setData(
            '<table><tbody><tr><td>Cell text</td></tr></tbody></table>',
        );
    });
    await selectText('.soeditor-classic__visual td');
    await bold.click();
    await expect(wysiwyg.locator('td strong')).toHaveText('Cell text');
    await expect
        .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
        .toBe(
            '<table><tbody><tr><td><strong>Cell text</strong></td></tr></tbody></table>',
        );
});

test('keeps Unicode word and character counts visible in WYSIWYG and Source', async ({
    page,
}) => {
    const status = page.locator('.soeditor-ui__document-status');
    await page.evaluate(() => {
        globalThis.__classicDemo.editor.setData('<p>Hello 世界</p>');
    });
    await expect(status).toHaveAttribute('data-words', '2');
    await expect(status).toHaveAttribute('data-characters', '8');
    await expect(status).toHaveAttribute('data-source-characters', '15');
    await expect(status).toHaveAttribute('data-editor-mode', 'wysiwyg');

    const view = page.locator('[data-classic-action="workspace-view"]');
    const sourceView = view.locator('[data-workspace-view="source"]');
    const wysiwygView = view.locator('[data-workspace-view="wysiwyg"]');
    await expect(sourceView).toHaveAttribute('aria-pressed', 'false');
    await sourceView.click();
    await expect(status).toHaveAttribute('data-editor-mode', 'source');
    await expect(sourceView).toHaveAttribute('aria-pressed', 'true');
    await expect(wysiwygView).toHaveAttribute('aria-pressed', 'false');
    await expect(status).toHaveAttribute('data-words', '2');
    await expect(status).toHaveAttribute('data-characters', '8');
    await expect(status).toHaveAttribute('data-source-characters', '15');
});

test('presents whole-document HTML formatting only in Source mode', async ({
    page,
}) => {
    const format = page.locator('[data-toolbar-item="format"]');
    const minify = page.locator('[data-toolbar-item="minify"]');
    await expect(format).toBeHidden();
    await expect(minify).toBeHidden();
    await page.locator('[data-workspace-view="source"]').first().click();
    await expect(format).toBeVisible();
    await expect(format).toBeEnabled();
    await expect(format).toHaveAttribute('title', 'Format source HTML');
    await page.evaluate(() => {
        globalThis.__classicDemo.editor.setData(
            '<p><span class="cms-lead">这是一段 <strong>CMS 语义</strong><strong>式控制的</strong><strong>导语</strong>。 </span><u><em><strong> 编辑者可以使用熟</strong></em></u>悉的工具栏，同时保留开发者需要的 <strong>HTML</strong> 自由。</p>',
        );
    });
    await format.click();
    await expect
        .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
        .not.toMatch(/\r?\n[ \t]*>/u);
    await expect(minify).toBeVisible();
    await expect(minify).toBeEnabled();
    await expect(minify).toHaveAttribute('title', 'Minify source HTML');
    const source = page.locator('.soeditor-classic__source .cm-content');
    await source.click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.insertText(
        '<main>\n  <h1>Compact</h1>\n  <p>HTML</p>\n</main>',
    );
    await minify.click();
    await expect
        .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
        .toBe('<main><h1>Compact</h1><p>HTML</p></main>');
});

test('keeps table cells interactive after source formatting and minification', async ({
    page,
}) => {
    const sourceView = page.locator('[data-workspace-view="source"]').first();
    const wysiwygView = page.locator('[data-workspace-view="wysiwyg"]').first();
    const visual = page.locator('.soeditor-classic__visual');
    for (const command of ['format', 'minify'] as const) {
        await page.evaluate(() => {
            globalThis.__classicDemo.editor.setData(
                '<table><tbody><tr><td id="before-source-a">A</td><td id="before-source-b">B</td><td>C</td></tr><tr><td id="after-source-a">D</td><td id="after-source-b">E</td><td>F</td></tr></tbody></table>',
            );
        });
        await visual.locator('#before-source-a').click();
        await visual
            .locator('#before-source-b')
            .click({ modifiers: ['Shift'] });
        await page
            .locator('.soeditor-ui__table-balloon')
            .getByRole('button', { name: 'Merge cells' })
            .click();
        await expect(visual.locator('#before-source-a')).toHaveAttribute(
            'colspan',
            '2',
        );
        await expect
            .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
            .not.toContain('is-structurally-selected');
        await sourceView.click();
        const transform = page.locator(`[data-toolbar-item="${command}"]`);
        await transform.click();
        if (command === 'format') {
            await expect(transform).toHaveAttribute('aria-busy', 'true');
        }
        const data = expect.poll(() =>
            page.evaluate(() => globalThis.__classicDemo.getData()),
        );
        if (command === 'format') await data.toContain('\n  <tbody>');
        else {
            await data.toContain('<td id="before-source-a" colspan="2">');
        }
        await expect(transform).not.toHaveAttribute('aria-busy', 'true');
        await wysiwygView.click();
        await expect(wysiwygView).toHaveAttribute('aria-pressed', 'true');
        await expect(
            visual.locator('.soeditor-table-cell.is-structurally-selected'),
        ).toHaveCount(0);
        await expect(
            visual.locator('.soeditor-wysiwyg-content'),
        ).toHaveJSProperty('isContentEditable', true);
        await visual.locator('#after-source-a').click();
        await expect(visual.locator('#after-source-a')).toHaveClass(
            /is-editing/,
        );
        await visual.locator('#after-source-b').click({ modifiers: ['Shift'] });
        await expect(
            visual.locator('.soeditor-table-cell.is-structurally-selected'),
        ).toHaveCount(2);
        await expect(
            page
                .locator('.soeditor-ui__table-balloon')
                .getByRole('button', { name: 'Merge cells' }),
        ).toBeEnabled();
        const contextMerge = page
            .locator('.soeditor-ui__table-balloon')
            .getByRole('button', {
                name: 'Merge cells',
            });
        await expect(contextMerge).toBeVisible();
        await contextMerge.click();
        await expect(visual.locator('#after-source-a')).toHaveAttribute(
            'colspan',
            '2',
        );
    }
});

test('formats large source in a worker without freezing the editor', async ({
    page,
}) => {
    await page.locator('[data-workspace-view="source"]').first().click();
    const responsiveness = await page.evaluate(async () => {
        const demo = globalThis.__classicDemo;
        demo.editor.setData(
            `<main>${'<p>worker formatting</p>'.repeat(10_000)}</main>`,
        );
        const gaps: number[] = [];
        let previous = performance.now();
        const timer = window.setInterval(() => {
            const current = performance.now();
            gaps.push(current - previous);
            previous = current;
        }, 25);
        try {
            await demo.execute('document.format');
        } finally {
            window.clearInterval(timer);
        }
        return {
            maximumMainThreadGap: Math.max(0, ...gaps),
            ticks: gaps.length,
        };
    });

    expect(responsiveness.ticks).toBeGreaterThan(20);
    expect(responsiveness.maximumMainThreadGap).toBeLessThan(500);
    await expect(page.locator('#content')).toHaveValue(/\n\s+<p>/u);
});

test('validates large formatting input in the worker without freezing the editor', async ({
    page,
}) => {
    await page.locator('[data-workspace-view="source"]').first().click();
    const responsiveness = await page.evaluate(async () => {
        const demo = globalThis.__classicDemo;
        const source = `<main>${'<p id="one" id="two">invalid</p>'.repeat(20_000)}</main>`;
        demo.editor.setData(source);
        // Let CodeMirror finish its independent lint pass before measuring the
        // formatter's parser-error gate.
        await new Promise((resolve) => window.setTimeout(resolve, 500));
        const gaps: number[] = [];
        let previous = performance.now();
        const timer = window.setInterval(() => {
            const current = performance.now();
            gaps.push(current - previous);
            previous = current;
        }, 25);
        let errorName = '';
        try {
            await demo.execute('document.format');
        } catch (error: unknown) {
            errorName = error instanceof Error ? error.name : String(error);
        } finally {
            window.clearInterval(timer);
        }
        return {
            errorName,
            maximumMainThreadGap: Math.max(0, ...gaps),
            ticks: gaps.length,
        };
    });

    expect(responsiveness.errorName).toBe('InvalidHtmlFormattingSourceError');
    expect(responsiveness.ticks).toBeGreaterThan(0);
    expect(responsiveness.maximumMainThreadGap).toBeLessThan(200);
});

test('formats the CMS showcase without entering a WYSIWYG mutation repair loop', async ({
    page,
}) => {
    await page.goto('/');
    await page.locator('body[data-ready="true"]').waitFor();
    const view = page.locator('[data-classic-action="workspace-view"]');
    await view.locator('[data-workspace-view="source"]').click();
    await page.locator('[data-toolbar-item="format"]').click();

    // The previous failure began after the click handler returned: the hidden
    // WYSIWYG projection observed its own render and synchronously re-rendered
    // forever. A browser timer verifies that the following task can run.
    await page.waitForTimeout(1_000);
    const formatted = await page.evaluate(() =>
        globalThis.__classicDemo.getData(),
    );
    expect(formatted).toMatch(/\n\s+<(?:p|blockquote|h2|ul|table)>/u);

    await view.locator('[data-workspace-view="wysiwyg"]').click();
    await expect(page.locator('.soeditor-classic__visual')).toBeVisible();
    await expect(page.locator('[data-toolbar-item="format"]')).toBeHidden();
});

test('keeps table resize handles after fullscreen split source formatting', async ({
    page,
}) => {
    await page.goto('/classic.html');
    await page.locator('body[data-ready="true"]').waitFor();
    const classic = page.locator('.soeditor-classic');
    await classic
        .locator('.soeditor-classic__visual .soeditor-table-cell')
        .first()
        .click();
    await expect(classic.locator('.soeditor-ui__table-balloon')).toBeVisible();
    await classic
        .getByRole('button', { name: /最大化编辑器|Maximize editor/u })
        .click();
    await classic
        .getByLabel(/编辑视图|Editing view/u)
        .locator('[data-workspace-view="wysiwyg-source-horizontal"]')
        .click();
    await classic.locator('.soeditor-classic__source .cm-content').click();
    await classic.locator('[data-toolbar-item="format"]').click();

    // In split mode the visual pane is paint-contained. The resize overlay
    // must still sit on the same viewport boundary as the projected table.
    const splitVisual = classic.locator('.soeditor-classic__visual');
    const splitHandle = splitVisual
        .locator('.soeditor-table-column-resize')
        .first();
    await expect(splitHandle).toBeVisible();
    let splitBox = await splitHandle.boundingBox();
    await expect
        .poll(async () => {
            splitBox = await splitHandle.boundingBox();
            return splitBox !== null;
        })
        .toBe(true);
    if (splitBox === null) throw new Error('Missing split column handle.');
    const splitCell = splitVisual
        .locator('table tr')
        .first()
        .locator('th,td')
        .first();
    await expect.poll(() => splitCell.boundingBox()).not.toBeNull();
    const splitCellBox = await splitCell.boundingBox();
    if (splitCellBox === null)
        throw new Error('Missing split table cell boundary.');
    expect(splitBox.x + splitBox.width / 2).toBeCloseTo(
        splitCellBox.x + splitCellBox.width - 4,
        0,
    );

    await classic
        .getByLabel(/编辑视图|Editing view/u)
        .locator('[data-workspace-view="wysiwyg"]')
        .click();
    const visual = classic.locator('.soeditor-classic__visual');
    const handle = visual.locator('.soeditor-table-column-resize').first();
    await expect(handle).toBeVisible();
    let box = await handle.boundingBox();
    await expect
        .poll(async () => {
            box = await handle.boundingBox();
            return box !== null;
        })
        .toBe(true);
    if (box === null) throw new Error('Missing column resize handle.');
    const cell = visual.locator('table tr').first().locator('th,td').first();
    await expect.poll(() => cell.boundingBox()).not.toBeNull();
    const cellBox = await cell.boundingBox();
    if (cellBox === null) throw new Error('Missing table cell boundary.');
    expect(box.x + box.width / 2).toBeCloseTo(cellBox.x + cellBox.width - 4, 0);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2);
    const moving = await handle.boundingBox();
    if (moving === null) throw new Error('Missing moving resize handle.');
    expect(moving.x + moving.width / 2).toBeCloseTo(
        box.x + box.width / 2 + 20,
        0,
    );
    await page.mouse.up();
    await expect
        .poll(() =>
            page.evaluate(() => globalThis.__classicDemo.editor.getData()),
        )
        .toMatch(/<col width="\d+">/u);
});

test('keeps row resize handles after fullscreen source formatting', async ({
    page,
}) => {
    await page.goto('/classic.html');
    await page.locator('body[data-ready="true"]').waitFor();
    const classic = page.locator('.soeditor-classic');
    await classic
        .locator('.soeditor-classic__visual .soeditor-table-cell')
        .first()
        .click();
    await expect(classic.locator('.soeditor-ui__table-balloon')).toBeVisible();
    await classic
        .getByRole('button', { name: /最大化编辑器|Maximize editor/u })
        .click();
    await classic
        .getByLabel(/编辑视图|Editing view/u)
        .locator('[data-workspace-view="wysiwyg-source-horizontal"]')
        .click();
    await classic.locator('.soeditor-classic__source .cm-content').click();
    await classic.locator('[data-toolbar-item="format"]').click();

    const splitVisual = classic.locator('.soeditor-classic__visual');
    const splitHandle = splitVisual
        .locator('.soeditor-table-row-resize')
        .first();
    await expect(splitHandle).toBeVisible();
    let splitBox = await splitHandle.boundingBox();
    await expect
        .poll(async () => {
            splitBox = await splitHandle.boundingBox();
            return splitBox !== null;
        })
        .toBe(true);
    if (splitBox === null) throw new Error('Missing split row handle.');
    const splitRow = splitVisual.locator('table tr').first();
    await expect.poll(() => splitRow.boundingBox()).not.toBeNull();
    const splitRowBox = await splitRow.boundingBox();
    if (splitRowBox === null)
        throw new Error('Missing split table row boundary.');
    expect(splitBox.y + splitBox.height / 2).toBeCloseTo(
        splitRowBox.y + splitRowBox.height,
        0,
    );

    await classic
        .getByLabel(/编辑视图|Editing view/u)
        .locator('[data-workspace-view="wysiwyg"]')
        .click();
    const visual = classic.locator('.soeditor-classic__visual');
    const handle = visual.locator('.soeditor-table-row-resize').first();
    await expect(handle).toBeVisible();
    const box = await handle.boundingBox();
    if (box === null) throw new Error('Missing row resize handle.');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 20);
    const moving = await handle.boundingBox();
    if (moving === null) throw new Error('Missing moving row handle.');
    expect(moving.y + moving.height / 2).toBeCloseTo(
        box.y + box.height / 2 + 20,
        0,
    );
    await page.mouse.up();
    await expect
        .poll(() =>
            page.evaluate(() => globalThis.__classicDemo.editor.getData()),
        )
        .toMatch(/<tr[^>]*height="\d+"/u);
});

test('switches editing layouts with distinct icon buttons', async ({
    page,
}) => {
    const classic = page.locator('.soeditor-classic');
    const view = classic.getByLabel('Editing view');

    const layouts = [
        ['wysiwyg', 'wysiwyg'],
        ['source', 'source'],
        ['wysiwyg-source-horizontal', 'wysiwyg source'],
        ['wysiwyg-source-vertical', 'wysiwyg source'],
    ] as const;
    for (const [value, projections] of layouts) {
        const button = view.locator(`[data-workspace-view="${value}"]`);
        await button.click();
        await expect(classic).toHaveAttribute(
            'data-soeditor-workspace-view',
            value,
        );
        await expect(classic).toHaveAttribute(
            'data-soeditor-projections',
            projections,
        );
        await expect(button).toHaveAttribute('aria-pressed', 'true');
    }

    await view
        .locator('[data-workspace-view="wysiwyg-source-horizontal"]')
        .click();
    await expect(classic).toHaveAttribute('data-soeditor-pane-count', '2');
    await expect(classic.locator('.soeditor-classic__visual')).toBeVisible();
    await expect(classic.locator('.soeditor-classic__source')).toBeVisible();
    await classic.locator('.soeditor-classic__source .cm-content').click();
    await expect(
        view.locator('[data-workspace-view="wysiwyg-source-horizontal"]'),
    ).toHaveAttribute('aria-pressed', 'true');
    await classic.locator('.soeditor-classic__visual p').first().dblclick();
    await expect(
        view.locator('[data-workspace-view="wysiwyg-source-horizontal"]'),
    ).toHaveAttribute('aria-pressed', 'true');
});

test('keeps preserved HTML out of the WYSIWYG authoring surface', async ({
    page,
}) => {
    await page.evaluate(() => {
        globalThis.__classicDemo.select({
            anchor: { block: 0, offset: 5 },
            focus: { block: 0, offset: 5 },
        });
    });
    await page.evaluate(() => {
        globalThis.__classicDemo.execute('specialCharacter.insert', '©');
    });
    await expect(page.locator('#content')).toHaveValue(/Hello©/u);

    const wysiwyg = page.locator('.soeditor-classic__visual');
    await expect(wysiwyg.locator('.soeditor-opaque')).toHaveCount(0);
    await expect(wysiwyg.getByText('Edit HTML')).toHaveCount(0);
    await expect(wysiwyg.getByText('Continue editing')).toHaveCount(0);
    await expect(wysiwyg.getByText('product-card')).toHaveCount(0);
    await expect(page.locator('#content')).toHaveValue(
        /<!--CMS:block--><product-card data-id="42"><\/product-card>/u,
    );
});

test('keeps legacy Developer Visual query flags on the WYSIWYG path', async ({
    page,
}) => {
    await page.goto('/classic.html?test=1&mode=visual');
    await page.locator('body[data-ready="true"]').waitFor();
    await expect(
        page.locator('.soeditor-classic__developer-visual'),
    ).toHaveCount(0);
    await expect(page.locator('.soeditor-classic__visual')).toBeVisible();
    await expect(page.getByLabel('Unsupported HTML display')).toHaveCount(0);
});

test('exposes the replaceable CMS asset manager for existing images and files', async ({
    page,
}) => {
    const classic = page.locator('.soeditor-classic');
    await page.evaluate(() => {
        globalThis.__classicDemo.editor.setData('<p>Asset target</p>');
        globalThis.__classicDemo.select({
            anchor: { block: 0, offset: 12 },
            focus: { block: 0, offset: 12 },
        });
    });
    const imageActions = classic.locator('[data-toolbar-item="image-actions"]');
    await imageActions.locator('summary').click();
    await imageActions
        .getByRole('menuitem', { name: 'Insert with file manager' })
        .click();
    const manager = page.getByRole('dialog', { name: 'CMS asset manager' });
    await expect(manager).toBeVisible();
    await expect(manager).toContainText('IMAGE · image/*');
    await manager.getByRole('button', { name: /编辑器封面/ }).click();
    await expect
        .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
        .toContain('/demo-editor-cover.svg');

    await page.evaluate(() => {
        globalThis.__classicDemo.editor.setData('<p>URL target</p>');
        globalThis.__classicDemo.select({
            anchor: { block: 0, offset: 10 },
            focus: { block: 0, offset: 10 },
        });
    });
    await imageActions.locator('summary').click();
    await imageActions
        .getByRole('menuitem', { name: 'Insert via URL' })
        .click();
    const urlDialog = page.getByRole('dialog', {
        name: 'Insert image via URL',
    });
    await urlDialog.getByLabel('Image URL').fill('/images/product.png');
    await urlDialog.getByLabel('Alternative text').fill('Product image');
    await urlDialog.getByRole('button', { name: 'Insert image' }).click();
    await expect
        .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
        .toContain('<img src="/images/product.png" alt="Product image">');
});

test('prefills selected link text and edits or removes a clicked link', async ({
    page,
}) => {
    const classic = page.locator('.soeditor-classic');
    const visual = classic.locator('.soeditor-classic__visual');
    await page.evaluate(() => {
        globalThis.__classicDemo.editor.setData('<p>Select this text</p>');
        globalThis.__classicDemo.select({
            anchor: { block: 0, offset: 0 },
            focus: { block: 0, offset: 16 },
        });
    });
    await classic.locator('[data-toolbar-item="link"]').click();
    let dialog = page.getByRole('dialog', { name: 'Link', exact: true });
    await expect(dialog.getByLabel('Displayed text')).toHaveValue(
        'Select this text',
    );
    await dialog.getByLabel('Displayed text').fill('Linked article');
    await dialog.getByLabel('Link URL').fill('/articles/first');
    await dialog.getByText('Advanced settings').click();
    const customAttribute = dialog.locator('.soeditor-ui__link-attribute-row');
    await customAttribute
        .getByLabel('Attribute name', { exact: true })
        .fill('data-cms-id');
    await customAttribute.getByLabel('Attribute value').fill('article-42');
    await dialog.getByRole('button', { name: 'Add attribute' }).click();
    await dialog.getByRole('button', { name: 'Insert link' }).click();
    let projectedLink = visual.locator('a[href="/articles/first"]');
    await expect(projectedLink).toHaveText('Linked article');
    await expect
        .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
        .toContain(
            '<a href="/articles/first" data-cms-id="article-42">Linked article</a>',
        );

    await projectedLink.click();
    const actions = page.getByRole('dialog', { name: 'Link actions' });
    await expect(actions).toContainText('/articles/first');
    await actions.getByRole('button', { name: 'Edit link' }).click();
    dialog = page.getByRole('dialog', { name: 'Edit link' });
    await expect(dialog.getByLabel('Displayed text')).toHaveValue(
        'Linked article',
    );
    await expect(dialog.getByLabel('Link URL')).toHaveValue('/articles/first');
    await expect(
        dialog
            .getByLabel('Added attributes')
            .locator('option[value="data-cms-id"]'),
    ).toContainText('data-cms-id = article-42');
    const addedAttributes = dialog.getByLabel('Added attributes');
    const removeAttribute = dialog.getByRole('button', {
        name: 'Remove attribute',
    });
    const [selectBox, removeBox] = await Promise.all([
        addedAttributes.boundingBox(),
        removeAttribute.boundingBox(),
    ]);
    if (selectBox === null || removeBox === null) {
        throw new Error('Link attribute controls must be visible.');
    }
    expect(
        Math.abs(
            selectBox.y + selectBox.height - (removeBox.y + removeBox.height),
        ),
    ).toBeLessThanOrEqual(1);
    await addedAttributes.click();
    await expect(addedAttributes).toBeFocused();
    await expect(dialog.getByLabel('Attribute name')).toHaveValue(
        'data-cms-id',
    );
    await expect(dialog.getByLabel('Attribute value')).toHaveValue(
        'article-42',
    );
    await dialog.getByLabel('Link URL').fill('/articles/updated');
    await dialog.getByRole('button', { name: 'Update link' }).click();
    projectedLink = visual.locator('a[href="/articles/updated"]');
    await expect(projectedLink).toHaveText('Linked article');
    await expect(projectedLink).toHaveAttribute('data-cms-id', 'article-42');
    await expect
        .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
        .toContain(
            '<a href="/articles/updated" data-cms-id="article-42">Linked article</a>',
        );

    await projectedLink.click();
    await page
        .getByRole('dialog', { name: 'Link actions' })
        .getByRole('button', { name: 'Remove link' })
        .click();
    await expect(visual.locator('a[href]')).toHaveCount(0);
    await expect(visual).toContainText('Linked article');
});

test('replaces a named textarea and synchronizes native form submission', async ({
    page,
}) => {
    const textarea = page.locator('#content');
    const classic = page.locator('.soeditor-classic');
    const visual = page.locator('.soeditor-classic__visual');
    const content = visual.locator('.soeditor-wysiwyg-content');

    await expect(textarea).toBeHidden();
    await expect(classic.getByRole('toolbar')).toBeVisible();
    await expect(content).toHaveAttribute('aria-label', 'Article editor');
    await expect(visual).toContainText('Hello CMS');
    await expect(visual.getByText('product-card')).toHaveCount(0);
    await expect(textarea).toHaveValue(
        /<!--CMS:block--><product-card data-id="42"><\/product-card>/u,
    );
    expect(
        await visual.evaluate(
            (element) => element.getBoundingClientRect().height,
        ),
    ).toBeGreaterThanOrEqual(192);
    await expect(visual).toHaveCSS('min-height', '160px');
    await expect(visual).toHaveCSS('max-height', '480px');

    await content.evaluate((host) => {
        const text = host.querySelector('p')?.firstChild;
        if (!(text instanceof Text)) throw new Error('Missing article text.');
        host.focus();
        const root = host.getRootNode();
        const selection =
            root instanceof ShadowRoot
                ? root.getSelection()
                : document.getSelection();
        selection?.setBaseAndExtent(text, 5, text, 5);
    });
    await page.keyboard.type('!');
    await expect(textarea).toHaveValue(
        /Hello!(?: |&nbsp;)<strong>CMS<\/strong>/,
    );
    await expect
        .poll(() =>
            page.evaluate(() => globalThis.__classicDemo.events().latestChange),
        )
        .toMatchObject({ origin: 'user' });

    await page.evaluate(() => {
        globalThis.__classicDemo.editor.setData(
            '<p>Submitted article</p><!--CMS:block--><product-card data-id="42"></product-card>',
        );
    });
    await expect(textarea).toHaveValue(
        '<p>Submitted article</p><!--CMS:block--><product-card data-id="42"></product-card>',
    );
    await page.getByRole('button', { name: 'Save article' }).click();
    await expect(page.getByLabel('Submitted source')).toHaveText(
        '<p>Submitted article</p><!--CMS:block--><product-card data-id="42"></product-card>',
    );

    await classic.locator('[data-workspace-view="source"]').click();
    await expect(classic).toHaveAttribute('data-soeditor-mode', 'source');
    await expect(classic.locator('.cm-content')).toContainText(
        'Submitted article',
    );
    await expect(classic.locator('[data-toolbar-item="bold"]')).toBeHidden();
    await expect(
        classic.locator('[data-toolbar-item="sourceFind"]'),
    ).toHaveCount(0);
    await expect(classic.locator('[data-toolbar-item="format"]')).toHaveCount(
        1,
    );
    await expect
        .poll(() =>
            classic.evaluate((element) => {
                const host = element.querySelector('.soeditor-classic__source');
                const codeMirror = host?.querySelector('.cm-editor');
                if (
                    !(host instanceof HTMLElement) ||
                    !(codeMirror instanceof HTMLElement)
                ) {
                    return Number.POSITIVE_INFINITY;
                }
                return Math.abs(
                    host.getBoundingClientRect().height -
                        codeMirror.getBoundingClientRect().height,
                );
            }),
        )
        .toBeLessThan(1);
});

test('restores reset data and the exact caller host on idempotent destruction', async ({
    page,
}) => {
    const textarea = page.locator('#content');
    const initial = await textarea.inputValue();
    await page.evaluate(() => {
        globalThis.__classicDemo.editor.setData('<p>Changed</p>');
    });
    await expect(textarea).toHaveValue('<p>Changed</p>');
    await page.getByRole('button', { name: 'Reset article' }).click();
    await expect(textarea).toHaveValue(initial);
    await expect(page.locator('.soeditor-classic__visual')).toContainText(
        'Hello CMS',
    );

    const result = await page.evaluate(async () => {
        const handle = globalThis.__classicDemo.editor;
        await Promise.all([handle.destroy(), handle.destroy()]);
        let terminal = false;
        try {
            handle.setData('<p>Too late</p>');
        } catch {
            terminal = true;
        }
        return { destroyed: handle.destroyed, terminal };
    });
    expect(result).toEqual({ destroyed: true, terminal: true });
    await expect(page.locator('.soeditor-classic')).toHaveCount(0);
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveValue(initial);
});

test('bounds automatic growth for long CMS content', async ({ page }) => {
    await page.evaluate(() => {
        globalThis.__classicDemo.editor.setData(
            Array.from(
                { length: 80 },
                (_, index) => `<p>Paragraph ${String(index)}</p>`,
            ).join(''),
        );
    });
    await expect(page.locator('.soeditor-classic__visual')).toHaveCSS(
        'height',
        '480px',
    );
    await expect(page.locator('.soeditor-classic__source')).toHaveCSS(
        'height',
        '480px',
    );
});

test('provides responsive toolbar navigation, status, resize, and maximize restoration', async ({
    page,
}) => {
    const classic = page.locator('.soeditor-classic');
    const visual = page.locator('.soeditor-classic__visual');
    const toolbar = classic.getByRole('toolbar');

    await expect(
        classic.locator('.soeditor-ui__document-status'),
    ).toContainText('words');
    await page.evaluate(() => {
        globalThis.__classicDemo.select({
            anchor: { block: 0, offset: 1 },
            focus: { block: 0, offset: 1 },
        });
    });
    const undo = toolbar.locator('[data-toolbar-item="undo"]');
    await toolbar.locator('[data-toolbar-item="bold"]').focus();
    await page.keyboard.press('ArrowRight');
    await expect(toolbar.locator('[data-toolbar-item="italic"]')).toBeFocused();

    await expect(
        classic.getByRole('button', { name: 'Collapse editor toolbar' }),
    ).not.toBeVisible();
    await expect(toolbar).toHaveAttribute('data-expanded', 'true');
    await expect(undo).toHaveCount(0);

    const before = await visual.evaluate(
        (element) => element.getBoundingClientRect().height,
    );
    await classic
        .getByRole('separator', { name: 'Resize editor height' })
        .focus();
    await page.keyboard.press('ArrowDown');
    await expect
        .poll(() =>
            visual.evaluate(
                (element) => element.getBoundingClientRect().height,
            ),
        )
        .toBeGreaterThan(before);
    const afterKeyboard = await visual.evaluate(
        (element) => element.getBoundingClientRect().height,
    );
    const resizeHandle = classic.getByRole('separator', {
        name: 'Resize editor height',
    });
    const resizeBox = await resizeHandle.boundingBox();
    if (resizeBox === null) throw new Error('Missing resize handle bounds.');
    await page.mouse.move(
        resizeBox.x + resizeBox.width / 2,
        resizeBox.y + resizeBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
        resizeBox.x + resizeBox.width / 2,
        resizeBox.y + resizeBox.height / 2 + 20,
    );
    await page.mouse.up();
    await expect
        .poll(() =>
            visual.evaluate(
                (element) => element.getBoundingClientRect().height,
            ),
        )
        .toBeGreaterThan(afterKeyboard);

    const bodyOverflow = await page
        .locator('body')
        .evaluate((element) => element.style.overflow);
    await classic.getByRole('button', { name: 'Maximize editor' }).click();
    await expect(classic).toHaveClass(/is-maximized/);
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
    await classic.getByRole('button', { name: 'Restore editor size' }).click();
    await expect(classic).not.toHaveClass(/is-maximized/);
    await expect
        .poll(() =>
            page.locator('body').evaluate((element) => element.style.overflow),
        )
        .toBe(bodyOverflow);
});

test('opens command-backed link actions without content mutation', async ({
    page,
}) => {
    await page.evaluate(() => {
        globalThis.__classicDemo.editor.setData(
            '<p><a href="/article">Linked text</a></p>',
        );
        globalThis.__classicDemo.select({
            anchor: { block: 0, offset: 0 },
            focus: { block: 0, offset: 11 },
        });
    });
    const link = page.locator('.soeditor-classic__visual a');
    await link.click();
    const actions = page.getByRole('dialog', { name: 'Link actions' });
    const remove = actions.getByRole('button', { name: 'Remove link' });
    await expect(remove).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(remove).toBeHidden();
    await expect(
        page.locator('.soeditor-classic__visual .soeditor-wysiwyg-content'),
    ).toBeFocused();
    await link.click();
    await expect(remove).toBeVisible();
    await remove.click();
    await expect
        .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
        .toBe('<p>Linked text</p>');
});

test('keeps narrow, zoomed, forced-color chrome operable and restores global layout on destroy', async ({
    page,
}) => {
    await page.setViewportSize({ height: 720, width: 360 });
    await page.emulateMedia({ forcedColors: 'active' });
    await page.locator('body').evaluate((body) => {
        body.style.zoom = '150%';
        body.style.overflow = 'auto';
    });
    const classic = page.locator('.soeditor-classic');
    const toolbar = classic.getByRole('toolbar');
    await expect(toolbar).toHaveAttribute('data-overflow', 'wrap');
    await expect(
        classic.locator('.soeditor-ui__document-status'),
    ).toBeVisible();

    await page.evaluate(() => {
        globalThis.__classicDemo.editor.maximize(true);
    });
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
    await page.evaluate(async () => {
        await globalThis.__classicDemo.editor.destroy();
    });
    await expect(page.locator('body')).toHaveCSS('overflow', 'auto');
    await expect(page.locator('#content')).toBeVisible();
    await expect(classic).toHaveCount(0);
});

test('isolates Simplified Chinese, Traditional Chinese, and RTL chrome per instance', async ({
    page,
}) => {
    await page.evaluate(async () => {
        const createHost = (id: string): HTMLTextAreaElement => {
            const host = document.createElement('textarea');
            host.id = id;
            host.value = '<p>Localized content</p>';
            document.body.append(host);
            return host;
        };
        const simplified = await globalThis.__classicDemo.create(
            createHost('locale-cn'),
            {
                locale: 'zh-CN',
                maximizable: false,
                resizable: false,
                toolbar: ['bold'],
            },
        );
        const traditional = await globalThis.__classicDemo.create(
            createHost('locale-tw'),
            {
                locale: 'zh-TW',
                maximizable: false,
                resizable: false,
                toolbar: ['bold'],
            },
        );
        const rtl = await globalThis.__classicDemo.create(
            createHost('locale-rtl'),
            {
                locale: 'ar',
                maximizable: false,
                resizable: false,
                toolbar: ['bold'],
                translations: [
                    {
                        direction: 'rtl',
                        locale: 'ar',
                        messages: {
                            Bold: 'عريض',
                            'Editor toolbar': 'شريط أدوات المحرر',
                        },
                    },
                ],
            },
        );
        Reflect.set(globalThis, '__phase45Editors', [
            simplified,
            traditional,
            rtl,
        ]);
    });

    const simplified = page.locator('.soeditor-ui__chrome[lang="zh-CN"]');
    const traditional = page.locator('.soeditor-ui__chrome[lang="zh-TW"]');
    const rtl = page.locator('.soeditor-ui__chrome[lang="ar"]');
    await expect(simplified.getByRole('button', { name: '源码' })).toHaveCount(
        0,
    );
    await expect(
        simplified
            .locator('xpath=..')
            .locator('[data-workspace-view="source"]'),
    ).toHaveCount(0);
    const help = simplified.getByRole('button', { name: '无障碍帮助' });
    await help.click();
    const helpDialog = simplified.getByRole('dialog', {
        name: '无障碍帮助',
    });
    await expect(helpDialog).toContainText('使用 Tab 进入控件');
    await expect(helpDialog).toContainText(
        '段内换行（不新建段落）：Shift 加 Enter',
    );
    await expect(helpDialog).toContainText(
        '多选表格单元格：按住 Shift 再单击另一个单元格',
    );
    await expect(helpDialog).toContainText(
        '重做：Control 或 Command 加 Shift 加 Z',
    );
    await page.keyboard.press('Escape');
    await expect(helpDialog).toBeHidden();
    await expect(help).toBeFocused();
    await expect(
        traditional
            .locator('xpath=..')
            .locator('[data-workspace-view="source"]'),
    ).toHaveCount(0);
    await expect(rtl).toHaveAttribute('dir', 'rtl');
    await expect(
        rtl.getByRole('toolbar', { name: 'شريط أدوات المحرر' }),
    ).toBeVisible();
    await expect(rtl.getByRole('button', { name: 'عريض' })).toBeVisible();
    await expect(
        rtl.locator('xpath=..').locator('.soeditor-classic__visual'),
    ).toHaveCSS('direction', 'ltr');
    await expect(
        page
            .locator('.soeditor-classic')
            .first()
            .locator('[data-workspace-view="source"]'),
    ).toBeVisible();

    await page.evaluate(async () => {
        const handles = Reflect.get(
            globalThis,
            '__phase45Editors',
        ) as readonly {
            destroy(): Promise<void>;
        }[];
        await Promise.all(handles.map((handle) => handle.destroy()));
    });
    await expect(page.locator('#locale-cn')).toBeVisible();
    await expect(page.locator('#locale-tw')).toBeVisible();
    await expect(page.locator('#locale-rtl')).toBeVisible();
});

test('scopes safe SVG icons and chrome theme variables without changing content', async ({
    page,
}) => {
    await page.evaluate(async () => {
        const themedHost = document.createElement('textarea');
        themedHost.id = 'themed-editor';
        themedHost.value = '<p>Theme-safe content</p>';
        themedHost.style.setProperty('--soeditor-accent', '#123456');
        const defaultHost = document.createElement('textarea');
        defaultHost.id = 'default-theme-editor';
        defaultHost.value = '<p>Independent content</p>';
        document.body.append(themedHost, defaultHost);
        const themed = await globalThis.__classicDemo.create(themedHost, {
            icons: { 'format.bold': '<b>', 'link.set': '🔗' },
            maximizable: false,
            resizable: false,
            themeVariables: {
                accent: 'rgb(1, 2, 3)',
                controlSize: '3rem',
                focusRing: 'CanvasText',
            },
            toolbar: ['bold', 'link'],
        });
        const independent = await globalThis.__classicDemo.create(defaultHost, {
            maximizable: false,
            resizable: false,
            toolbar: ['bold'],
        });
        Reflect.set(globalThis, '__phase47Editors', { independent, themed });
    });

    const editors = page.locator('.soeditor-classic');
    const themed = editors.nth(1);
    const independent = editors.nth(2);
    const icon = themed.locator('[data-toolbar-item="bold"]');
    await expect(icon).toHaveRole('button', { name: 'Bold' });
    await expect(icon).toHaveText('<b>');
    await expect(icon.locator('svg')).toHaveCount(1);
    await expect(icon.locator('b')).toHaveCount(0);
    await expect(themed.locator('[data-toolbar-item="link"]')).toHaveText('🔗');
    await expect(themed.locator('[data-toolbar-item="link"] svg')).toHaveCount(
        1,
    );
    await expect(icon).toHaveCSS('min-height', '48px');
    await expect(icon).toHaveCSS('border-top-width', '0px');
    const independentBold = independent.getByRole('button', { name: 'Bold' });
    await expect(independentBold).toHaveText('');
    await expect(independentBold.locator('svg')).toHaveAttribute(
        'viewBox',
        '0 0 1792 1792',
    );
    await expect
        .poll(() =>
            page.evaluate(() => {
                const handles = Reflect.get(globalThis, '__phase47Editors') as {
                    themed: { getData(): string };
                };
                return handles.themed.getData();
            }),
        )
        .toBe('<p>Theme-safe content</p>');

    await page.evaluate(async () => {
        const handles = Reflect.get(globalThis, '__phase47Editors') as {
            independent: { destroy(): Promise<void> };
            themed: { destroy(): Promise<void> };
        };
        await Promise.all([
            handles.themed.destroy(),
            handles.independent.destroy(),
        ]);
    });
    await expect(page.locator('#themed-editor')).toBeVisible();
    await expect
        .poll(() =>
            page
                .locator('#themed-editor')
                .evaluate((element) =>
                    (element as HTMLElement).style.getPropertyValue(
                        '--soeditor-accent',
                    ),
                ),
        )
        .toBe('#123456');
});

test('saves canonical source with conflict retry and owned leave protection', async ({
    page,
}) => {
    await page.evaluate(async () => {
        const host = document.createElement('textarea');
        host.id = 'save-editor';
        host.value = '<p>Save initial</p>';
        document.body.append(host);
        let mode: 'conflict' | 'saved' = 'saved';
        const requests: string[] = [];
        const handle = await globalThis.__classicDemo.create(host, {
            save: {
                adapter: {
                    save: async ({ source }: { source: string }) => {
                        requests.push(source);
                        return mode === 'conflict'
                            ? {
                                  message: 'Server changed',
                                  revisionToken: 'server-v2',
                                  status: 'conflict' as const,
                              }
                            : {
                                  revisionToken: 'saved-v2',
                                  status: 'saved' as const,
                              };
                    },
                },
                initialRevisionToken: 'server-v1',
                leavePageProtection: true,
            },
            toolbar: ['bold'],
        } as never);
        handle.setData('<p>Exact canonical save</p>');
        const secondaryHost = document.createElement('textarea');
        secondaryHost.id = 'save-editor-secondary';
        document.body.append(secondaryHost);
        const secondary = await globalThis.__classicDemo.create(secondaryHost, {
            save: {
                adapter: { save: async () => ({ status: 'saved' }) },
                leavePageProtection: true,
            },
            toolbar: ['bold'],
        } as never);
        secondary.setData('<p>Secondary dirty</p>');
        Reflect.set(globalThis, '__phase46Save', {
            handle,
            leaveWasPrevented: () =>
                !window.dispatchEvent(
                    new Event('beforeunload', { cancelable: true }),
                ),
            requests,
            secondary,
            setMode: (value: 'conflict' | 'saved') => {
                mode = value;
            },
        });
    });

    const classic = page.locator('#save-editor + .soeditor-classic');
    await expect(
        classic.getByRole('button', { name: 'Save', exact: true }),
    ).toHaveCount(0);
    expect(
        await page.evaluate(() =>
            Reflect.get(globalThis, '__phase46Save').leaveWasPrevented(),
        ),
    ).toBe(true);
    await page.evaluate(() =>
        Reflect.get(globalThis, '__phase46Save').handle.editor.execute(
            'editor.save',
        ),
    );
    await expect(classic.getByText('Changes saved')).toBeVisible();
    expect(
        await page.evaluate(
            () => Reflect.get(globalThis, '__phase46Save').requests,
        ),
    ).toEqual(['<p>Exact canonical save</p>']);

    await page.evaluate(() => {
        const value = Reflect.get(globalThis, '__phase46Save');
        value.setMode('conflict');
        value.handle.setData('<p>Conflicting source</p>');
    });
    await page.evaluate(() =>
        Reflect.get(globalThis, '__phase46Save').handle.editor.execute(
            'editor.save',
        ),
    );
    await expect(classic.getByText('Save conflict')).toBeVisible();
    await page.evaluate(() =>
        Reflect.get(globalThis, '__phase46Save').setMode('saved'),
    );
    await page.evaluate(() =>
        Reflect.get(globalThis, '__phase46Save').handle.editor.execute(
            'editor.save',
        ),
    );
    await expect(classic.getByText('Changes saved').last()).toBeVisible();

    expect(
        await page.evaluate(async () => {
            const value = Reflect.get(globalThis, '__phase46Save');
            await value.handle.destroy();
            const protectedBySecondary = value.leaveWasPrevented();
            await value.secondary.destroy();
            return {
                cleared: !value.leaveWasPrevented(),
                protectedBySecondary,
            };
        }),
    ).toEqual({ cleared: true, protectedBySecondary: true });
    await expect(page.locator('#save-editor')).toBeVisible();
    await expect(page.locator('#save-editor-secondary')).toBeVisible();
});

test('applies multi-block CMS formatting and nested-list keyboard commands transactionally', async ({
    page,
}) => {
    const source = await page.evaluate(() => {
        const harness = globalThis.__classicDemo;
        harness.editor.setData(
            '<p>Alpha</p><p>Beta</p><ol start="3" type="A"><li>One</li><li>Two</li></ol>',
        );
        harness.select({
            anchor: { block: 0, offset: 1 },
            focus: { block: 1, offset: 3 },
        });
        harness.execute('format.superscript');
        harness.execute('style.lead');
        harness.execute('format.alignment', 'center');
        return harness.getData();
    });
    expect(source).toContain('<sup>');
    expect(source).toContain('<span class="cms-lead">');
    expect(source).toContain('text-align: center');

    await page.evaluate(() => {
        globalThis.__classicDemo.select({
            anchor: { block: 3, offset: 0 },
            focus: { block: 3, offset: 0 },
        });
    });
    await page.keyboard.press('Tab');
    await expect
        .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
        .toContain('<li>One<ol><li>Two</li></ol></li>');
    await page.keyboard.press('Shift+Tab');
    await expect
        .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
        .toContain('<li>One</li><li>Two</li>');

    await page.evaluate(() => globalThis.__classicDemo.execute('editor.undo'));
    await expect
        .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
        .toContain('<li>One<ol><li>Two</li></ol></li>');
});

test('classifies and cleans external paste/drop while retaining internal clipboard fidelity', async ({
    page,
}) => {
    const original = '<p>BeforeAfter</p>';
    const external = await page.evaluate((initial) => {
        const harness = globalThis.__classicDemo;
        harness.editor.setData(initial);
        harness.select({
            anchor: { block: 0, offset: 6 },
            focus: { block: 0, offset: 6 },
        });
        const transfer = new DataTransfer();
        transfer.setData(
            'text/html',
            '<h2 style="mso-x:1;color:red" onclick="run()">Office</h2><p><b>Bold</b> <a href="javascript:run()">bad link</a></p><script>run()</script>',
        );
        transfer.setData('text/plain', 'Office\nBold bad link');
        document
            .querySelector<HTMLElement>('.soeditor-classic__visual')
            ?.shadowRoot?.querySelector<HTMLElement>(
                '.soeditor-wysiwyg-content',
            )
            ?.dispatchEvent(
                new ClipboardEvent('paste', {
                    bubbles: true,
                    cancelable: true,
                    clipboardData: transfer,
                }),
            );
        return harness.getData();
    }, original);
    expect(external).toContain('<h2>Office</h2>');
    expect(external).toContain('<strong>Bold</strong>');
    expect(external).not.toMatch(/(?:mso-|onclick|javascript:|<script)/iu);

    await page.evaluate(() => globalThis.__classicDemo.execute('editor.undo'));
    await expect
        .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
        .toBe(original);

    const internal = await page.evaluate(() => {
        const harness = globalThis.__classicDemo;
        harness.select({
            anchor: { block: 0, offset: 6 },
            focus: { block: 0, offset: 6 },
        });
        const transfer = new DataTransfer();
        transfer.setData('text/html', '<p>Wrong external fallback</p>');
        transfer.setData('text/plain', 'Internal');
        transfer.setData(
            'application/x-soeditor-html',
            'soeditor/1\n<strong>Internal</strong>',
        );
        document
            .querySelector<HTMLElement>('.soeditor-classic__visual')
            ?.shadowRoot?.querySelector<HTMLElement>(
                '.soeditor-wysiwyg-content',
            )
            ?.dispatchEvent(
                new ClipboardEvent('paste', {
                    bubbles: true,
                    cancelable: true,
                    clipboardData: transfer,
                }),
            );
        return harness.getData();
    });
    expect(internal).toContain('<strong>Internal</strong>');
    expect(internal).not.toContain('Wrong external fallback');

    const dropped = await page.evaluate(() => {
        const harness = globalThis.__classicDemo;
        harness.editor.setData('<p>Drop target</p>');
        const paragraph = document
            .querySelector<HTMLElement>('.soeditor-classic__visual')
            ?.shadowRoot?.querySelector<HTMLElement>(
                '.soeditor-wysiwyg-content p',
            );
        if (paragraph === null || paragraph === undefined) {
            throw new Error('Missing drop paragraph.');
        }
        const transfer = new DataTransfer();
        transfer.setData('text/html', '<p onclick="run()"><i>Dropped</i></p>');
        transfer.setData('text/plain', 'Dropped');
        paragraph.dispatchEvent(
            new DragEvent('drop', {
                bubbles: true,
                cancelable: true,
                clientY: paragraph.getBoundingClientRect().bottom,
                dataTransfer: transfer,
            }),
        );
        return harness.getData();
    });
    expect(dropped).toContain('<em>Dropped</em>');
    expect(dropped).not.toContain('onclick');

    const rejected = await page.evaluate(() => {
        const harness = globalThis.__classicDemo;
        const before = harness.getData();
        const transfer = new DataTransfer();
        transfer.items.add(
            new File(['file'], 'file.pdf', { type: 'application/pdf' }),
        );
        document
            .querySelector<HTMLElement>('.soeditor-classic__visual')
            ?.shadowRoot?.querySelector<HTMLElement>(
                '.soeditor-wysiwyg-content',
            )
            ?.dispatchEvent(
                new ClipboardEvent('paste', {
                    bubbles: true,
                    cancelable: true,
                    clipboardData: transfer,
                }),
            );
        return {
            after: harness.getData(),
            before,
            diagnostics: harness.pasteDiagnostics(),
        };
    });
    expect(rejected.after).toBe(rejected.before);
    expect(rejected.diagnostics).toContain('processor-failed');
    await expect(page.locator('.soeditor-ui__notification')).toContainText(
        'Paste was not applied',
    );
});

test('uploads images with temporary previews, retry, cancellation, and unsafe-result rejection', async ({
    page,
}) => {
    await page.evaluate(() => {
        const harness = globalThis.__classicDemo;
        harness.editor.setData('<p>Upload target</p>');
        harness.select({
            anchor: { block: 0, offset: 13 },
            focus: { block: 0, offset: 13 },
        });
        harness.setUploadMode('manual');
        void harness.upload('hero.png');
    });
    await expect
        .poll(() =>
            page.evaluate(() => {
                const record = globalThis.__classicDemo.uploadRecords()[0];
                return {
                    canonical: globalThis.__classicDemo.getData(),
                    preview: record?.previewUrl?.startsWith('blob:'),
                    status: record?.status,
                };
            }),
        )
        .toEqual({
            canonical: '<p>Upload target</p>',
            preview: true,
            status: 'pending',
        });
    await page.evaluate(() => globalThis.__classicDemo.resolveUploads());
    await expect
        .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
        .toContain('/uploads/hero.png');
    await expect
        .poll(() =>
            page.evaluate(
                () => globalThis.__classicDemo.uploadRecords()[0]?.previewUrl,
            ),
        )
        .toBeUndefined();

    await page.evaluate(() => {
        const harness = globalThis.__classicDemo;
        harness.editor.setData('<p>Clipboard target</p>');
        harness.select({
            anchor: { block: 0, offset: 16 },
            focus: { block: 0, offset: 16 },
        });
        harness.setUploadMode('success');
        const transfer = new DataTransfer();
        transfer.items.add(
            new File(['clipboard'], 'clipboard.png', { type: 'image/png' }),
        );
        document
            .querySelector<HTMLElement>('.soeditor-classic__visual')
            ?.shadowRoot?.querySelector<HTMLElement>(
                '.soeditor-wysiwyg-content',
            )
            ?.dispatchEvent(
                new ClipboardEvent('paste', {
                    bubbles: true,
                    cancelable: true,
                    clipboardData: transfer,
                }),
            );
    });
    await expect
        .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
        .toContain('/uploads/clipboard.png');

    await page.evaluate(() => {
        const harness = globalThis.__classicDemo;
        harness.editor.setData('<p>Drop upload target</p>');
        const paragraph = document
            .querySelector<HTMLElement>('.soeditor-classic__visual')
            ?.shadowRoot?.querySelector<HTMLElement>(
                '.soeditor-wysiwyg-content p',
            );
        if (paragraph === null || paragraph === undefined) {
            throw new Error('Missing upload drop target.');
        }
        const transfer = new DataTransfer();
        transfer.items.add(
            new File(['drop'], 'dropped.png', { type: 'image/png' }),
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
    await expect
        .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
        .toContain('/uploads/dropped.png');

    const failureAndRetry = await page.evaluate(async () => {
        const harness = globalThis.__classicDemo;
        harness.setUploadMode('fail');
        let failed = false;
        try {
            await harness.upload('retry.png');
        } catch {
            failed = true;
        }
        const failedRecord = harness.uploadRecords().at(-1);
        harness.setUploadMode('success');
        if (failedRecord !== undefined) {
            await harness.uploadRetry(failedRecord.id);
        }
        return {
            attempt: harness.uploadRecords().at(-1)?.attempt,
            failed,
            status: harness.uploadRecords().at(-1)?.status,
        };
    });
    expect(failureAndRetry).toEqual({
        attempt: 2,
        failed: true,
        status: 'succeeded',
    });

    const cancellation = await page.evaluate(() => {
        const harness = globalThis.__classicDemo;
        harness.setUploadMode('manual');
        void harness.upload('cancel.png');
        const record = harness.uploadRecords().at(-1);
        return {
            cancelled:
                record === undefined ? false : harness.uploadCancel(record.id),
            id: record?.id,
        };
    });
    expect(cancellation.cancelled).toBe(true);
    await expect
        .poll(() =>
            page.evaluate(
                () => globalThis.__classicDemo.uploadRecords().at(-1)?.status,
            ),
        )
        .toBe('cancelled');

    const beforeUnsafe = await page.evaluate(() =>
        globalThis.__classicDemo.getData(),
    );
    const unsafeRejected = await page.evaluate(async () => {
        const harness = globalThis.__classicDemo;
        harness.setUploadMode('unsafe');
        try {
            await harness.upload('unsafe.png');
            return false;
        } catch {
            return true;
        }
    });
    expect(unsafeRejected).toBe(true);
    expect(await page.evaluate(() => globalThis.__classicDemo.getData())).toBe(
        beforeUnsafe,
    );
});

test('edits safe links and inserts bounded CMS content objects', async ({
    page,
}) => {
    const result = await page.evaluate(async () => {
        const harness = globalThis.__classicDemo;
        harness.editor.setData('<p>Article link</p>');
        harness.select({
            anchor: { block: 0, offset: 0 },
            focus: { block: 0, offset: 7 },
        });
        harness.execute('link.set', {
            href: 'https://example.test/article',
            rel: 'nofollow',
            target: '_blank',
            title: 'Article',
        });
        const linked = harness.getData();
        const inspected = harness.execute('link.inspect');
        harness.execute('link.remove');
        const unlinked = harness.getData();
        await Promise.resolve(harness.execute('link.pick', 'internal'));
        const picked = harness.getData();
        let unsafeLinkRejected = false;
        try {
            harness.execute('link.set', { href: 'javascript:alert(1)' });
        } catch {
            unsafeLinkRejected = true;
        }

        harness.editor.setData('<p>CMS</p>');
        harness.select({
            anchor: { block: 0, offset: 3 },
            focus: { block: 0, offset: 3 },
        });
        harness.execute('specialCharacter.insert', '©');
        harness.execute('anchor.insert', 'story-end');
        harness.execute('placeholder.insert', 'customer.name');
        harness.execute('pageBreak.insert');
        harness.execute('cmsObject.promo.insert', {
            campaign: 'autumn',
            theme: 'dark',
        });
        await Promise.resolve(
            harness.execute(
                'embed.insert',
                'https://video.example.test/watch/42',
            ),
        );
        const objects = harness.getData();
        harness.execute('editor.undo');
        const afterUndo = harness.getData();
        let unsafeEmbedRejected = false;
        try {
            await Promise.resolve(
                harness.execute(
                    'embed.insert',
                    'https://video.example.test/unsafe',
                ),
            );
        } catch {
            unsafeEmbedRejected = true;
        }
        return {
            afterUndo,
            inspected,
            linked,
            objects,
            picked,
            unlinked,
            unsafeEmbedRejected,
            unsafeLinkRejected,
        };
    });

    expect(result.linked).toContain('target="_blank"');
    expect(result.linked).toContain('rel="nofollow noopener noreferrer"');
    expect(result.inspected).toMatchObject({
        href: 'https://example.test/article',
        rel: 'nofollow noopener noreferrer',
        target: '_blank',
        title: 'Article',
    });
    expect(result.unlinked).toBe('<p>Article link</p>');
    expect(result.picked).toContain('href="/articles/42"');
    expect(result.unsafeLinkRejected).toBe(true);
    expect(result.objects).toContain('©');
    expect(result.objects).toContain('<a id="story-end"></a>');
    expect(result.objects).toContain(
        'data-soeditor-placeholder="customer.name"',
    );
    expect(result.objects).toContain('data-page-break="true"');
    expect(result.objects).toContain('data-soeditor-object="promo"');
    expect(result.objects).toContain('data-soeditor-embed="demo-video"');
    expect(result.afterUndo).not.toContain('data-soeditor-embed="demo-video"');
    expect(result.afterUndo).toContain('data-soeditor-object="promo"');
    expect(result.objects).not.toContain('iframe');
    expect(result.unsafeEmbedRejected).toBe(true);
});

test('supports callbacks, readonly, element hosts, duplicate rejection, and startup cleanup', async ({
    page,
}) => {
    const visual = page.locator('.soeditor-classic__visual');
    await visual.click();
    await page.getByRole('button', { name: 'Save article' }).focus();
    await expect
        .poll(async () =>
            page.evaluate(() => {
                const events = globalThis.__classicDemo.events();
                return {
                    blurCount: events.blurCount,
                    focusCount: events.focusCount,
                    readyCount: events.readyCount,
                };
            }),
        )
        .toEqual({ blurCount: 1, focusCount: 1, readyCount: 1 });

    await page.evaluate(() =>
        globalThis.__classicDemo.editor.setReadonly(true),
    );
    const content = visual.locator('.soeditor-wysiwyg-content');
    await expect(content).toHaveAttribute('contenteditable', 'false');
    await page.evaluate(() =>
        globalThis.__classicDemo.editor.setReadonly(false),
    );
    await expect(content).toHaveAttribute('contenteditable', 'true');

    const result = await page.evaluate(async () => {
        const harness = globalThis.__classicDemo;
        const primaryHost = document.querySelector<HTMLElement>('#content');
        const elementHost =
            document.querySelector<HTMLElement>('#element-host');
        if (primaryHost === null || elementHost === null) {
            throw new Error('Missing classic test hosts.');
        }
        let duplicate = false;
        try {
            await harness.create(primaryHost);
        } catch {
            duplicate = true;
        }
        const original = elementHost.innerHTML;
        const secondary = await harness.create(elementHost, {
            data: '<p>Secondary</p>',
            toolbar: ['undo', 'redo'],
        });
        secondary.setData('<p>Secondary changed</p>');
        const secondarySource = secondary.getData();
        await secondary.destroy();

        const failing = document.createElement('div');
        failing.id = 'failing-host';
        failing.innerHTML = '<p>Untouched</p>';
        document.body.append(failing);
        let failed = false;
        try {
            await harness.create(failing, { toolbar: ['not-registered'] });
        } catch {
            failed = true;
        }
        const failingTextarea = document.createElement('textarea');
        failingTextarea.value = 'Original textarea';
        document.body.append(failingTextarea);
        try {
            await harness.create(failingTextarea, {
                data: '<p>Temporary</p>',
                toolbar: ['not-registered'],
            });
        } catch {
            // Expected initialization failure must restore its original value.
        }
        return {
            duplicate,
            failed,
            failingHidden: failing.hidden,
            failingHtml: failing.innerHTML,
            failingTextareaHidden: failingTextarea.hidden,
            failingTextareaValue: failingTextarea.value,
            original,
            restoredHidden: elementHost.hidden,
            restoredHtml: elementHost.innerHTML,
            secondarySource,
        };
    });

    expect(result).toEqual({
        duplicate: true,
        failed: true,
        failingHidden: false,
        failingHtml: '<p>Untouched</p>',
        failingTextareaHidden: false,
        failingTextareaValue: 'Original textarea',
        original: '<p>Element initial</p>',
        restoredHidden: false,
        restoredHtml: '<p>Element initial</p>',
        secondarySource: '<p>Secondary changed</p>',
    });
    await expect(page.locator('.soeditor-classic')).toHaveCount(1);
});

interface ClassicHarness {
    readonly editor: {
        readonly destroyed: boolean;
        destroy(): Promise<void>;
        setData(source: string): void;
        setReadonly(readonly: boolean): void;
    };
    create(
        host: HTMLElement,
        options?: {
            readonly data?: string;
            readonly preview?:
                | boolean
                | {
                      readonly styles?: readonly string[];
                      readonly template?: string;
                      readonly initialTemplateId?: string;
                      readonly templates?: readonly {
                          readonly id: string;
                          readonly label: string;
                          readonly styles?: readonly string[];
                          readonly template?: string;
                          readonly title?: string;
                      }[];
                      readonly title?: string;
                  };
            readonly toolbar?: readonly string[];
        },
    ): Promise<{
        destroy(): Promise<void>;
        getData(): string;
        setData(source: string): void;
    }>;
    events(): {
        readonly blurCount: number;
        readonly changeCount: number;
        readonly focusCount: number;
        readonly latestChange?: { readonly origin: string };
        readonly readyCount: number;
    };
    execute(commandId: string, ...args: readonly unknown[]): unknown;
    getData(): string;
    pasteDiagnostics(): readonly string[];
    resolveUploads(): void;
    select(selection: {
        readonly anchor: { readonly block: number; readonly offset: number };
        readonly focus: { readonly block: number; readonly offset: number };
    }): boolean;
    setUploadMode(mode: 'fail' | 'manual' | 'success' | 'unsafe'): void;
    upload(name: string): Promise<unknown>;
    uploadCancel(id: string): boolean;
    uploadRecords(): readonly {
        readonly attempt: number;
        readonly id: string;
        readonly previewUrl?: string;
        readonly status: string;
    }[];
    uploadRetry(id: string): Promise<unknown>;
}

declare global {
    var __classicDemo: ClassicHarness;
}
