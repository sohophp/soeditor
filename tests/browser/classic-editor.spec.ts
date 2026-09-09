import { fileURLToPath } from 'node:url';
import type * as ElementPathModule from '../../packages/ui/src/element-path.js';
import AxeBuilder from '@axe-core/playwright';
import type {
    ClassicEditor,
    CreateClassicEditorOptions,
} from '../../packages/soeditor/src/classic-editor.js';
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

    const showBlocks = editor.locator('[data-classic-action="show-blocks"]');
    await expect(showBlocks).toBeVisible();
    await expect(showBlocks).toHaveAccessibleName('显示区块边界');
    await showBlocks.click();
    await expect(showBlocks).toHaveAttribute('aria-pressed', 'true');
    const labelledParagraph = visual.locator('p').first();
    await expect
        .poll(() =>
            labelledParagraph.evaluate(
                (block) => getComputedStyle(block, '::before').content,
            ),
        )
        .toBe('"p"');
    await expect
        .poll(() =>
            page.evaluate(() => globalThis.__classicDemo.editor.getData()),
        )
        .not.toContain('data-soeditor-show-blocks');

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
    await tableTools.locator('[data-table-menu=properties]').click();
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
    const requested: string[] = [];
    page.on('request', (request) => requested.push(request.url()));
    await page.goto('/classic.html');
    await page.locator('body[data-ready="true"]').waitFor();
    const editor = page.locator('.soeditor-classic');
    await editor
        .locator('[data-workspace-view="wysiwyg-source-vertical"]')
        .click();

    const unchanged = await page.evaluate(() =>
        globalThis.__classicDemo.editor.getData(),
    );
    await expect(editor.locator('.cm-content')).toBeVisible();
    // Exceed the configured debounce: a view change alone must not format/save.
    await page.waitForTimeout(500);
    expect(
        await page.evaluate(() => globalThis.__classicDemo.editor.getData()),
    ).toBe(unchanged);

    expect(
        requested.filter((url) =>
            /\/packages\/html-tools\/src\/index\.ts/u.test(url),
        ),
    ).toHaveLength(0);

    let release: (() => void) | undefined;
    const held = new Promise<void>((resolve) => {
        release = resolve;
    });
    await page.route('**/packages/source/src/index.ts*', async (route) => {
        await held;
        await route.continue();
    });
    await page.goto('/classic.html');
    await page.locator('body[data-ready="true"]').waitFor();
    await editor
        .locator('[data-workspace-view="wysiwyg-source-vertical"]')
        .click();
    await expect(editor).toHaveAttribute(
        'data-soeditor-source-state',
        'loading',
    );

    const heading = editor.locator('.soeditor-classic__visual h1');
    await heading.click();
    await page.keyboard.press('End');
    await page.keyboard.type('！');
    release?.();

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
    await page.locator('[data-toolbar-item="unorderedList"] > button').click();
    await expect(
        page.locator('[data-toolbar-item="unorderedList"] > button'),
    ).toHaveAttribute('aria-pressed', 'true');

    for (const item of ['orderedList', 'unorderedList']) {
        const button = page
            .locator(`[data-toolbar-item="${item}"]`)
            .locator(
                item === 'orderedList' || item === 'unorderedList'
                    ? ':scope > button'
                    : ':scope',
            );
        if (item === 'unorderedList') continue;
        await expect(button).toHaveAttribute('aria-pressed', 'false');
    }

    const cells = page.locator('.soeditor-table-cell');
    await cells.nth(3).dispatchEvent('pointerdown', { button: 0 });
    await expect(
        page.locator('[data-toolbar-item="unorderedList"] > button'),
    ).toHaveAttribute('aria-pressed', 'false');
    await cells.nth(3).dispatchEvent('pointerup', { button: 0 });
    await cells.nth(3).click();

    for (const item of ['orderedList', 'unorderedList']) {
        const button = page
            .locator(`[data-toolbar-item="${item}"]`)
            .locator(
                item === 'orderedList' || item === 'unorderedList'
                    ? ':scope > button'
                    : ':scope',
            );
        await expect(button).toHaveAttribute('aria-pressed', 'false');
        await expect(button).not.toHaveClass(/is-active/u);
    }

    await cells.nth(4).click({ modifiers: ['Shift'] });
    await expect(
        page.locator('.soeditor-table-cell.is-structurally-selected'),
    ).toHaveCount(2);

    for (const item of ['orderedList', 'unorderedList']) {
        const button = page
            .locator(`[data-toolbar-item="${item}"]`)
            .locator(
                item === 'orderedList' || item === 'unorderedList'
                    ? ':scope > button'
                    : ':scope',
            );
        await expect(button).toBeDisabled();
        await expect(button).toHaveAttribute('aria-pressed', 'false');
        await expect(button).not.toHaveClass(/is-active/u);
    }

    await cells.nth(3).dblclick();
    for (const item of ['orderedList', 'unorderedList']) {
        const button = page
            .locator(`[data-toolbar-item="${item}"]`)
            .locator(
                item === 'orderedList' || item === 'unorderedList'
                    ? ':scope > button'
                    : ':scope',
            );
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
    await tableTools.locator('[data-table-menu=merge]').click();
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
    await page.locator('.soeditor-classic__visual p').first().click();
    await expect(
        page.locator('[data-toolbar-item="moreFormatting"]'),
    ).toHaveCount(0);
    for (const id of ['strike', 'subscript', 'superscript', 'removeFormat']) {
        const button = page.locator(`[data-toolbar-item="${id}"]`);
        await expect(button).toBeVisible();
        await expect(button.locator('svg')).toHaveCount(1);
        await expect(button.locator('xpath=ancestor::details')).toHaveCount(0);
    }

    await expect(
        page.getByRole('button', { name: '删除线', exact: true }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: '下标', exact: true }),
    ).toBeVisible();
    await page.keyboard.press('Escape');

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
                .filter(
                    (button) =>
                        !(button as HTMLElement).hidden &&
                        !button.matches(
                            '.soeditor-ui__format-control summary, .soeditor-ui__format-choice, .soeditor-ui__value-control',
                        ),
                )
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
                            ':scope > svg.soeditor-ui__icon, :scope > .soeditor-ui__list-preview, :scope > .soeditor-ui__format-arrow, :scope > .soeditor-ui__current-value',
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
    await expect(page.locator('[data-table-menu=row]')).toBeVisible();
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
    await tableTools.locator('[data-table-menu=properties]').click();
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
    await tableTools.locator('[data-table-menu=properties]').click();
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
    await expect(tableBalloon.locator('[data-table-menu=row]')).toBeVisible();
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

test('keeps image properties usable while moving and resizing within the viewport', async ({
    page,
}) => {
    await page.setViewportSize({ width: 600, height: 480 });
    const visual = page.locator('.soeditor-classic__visual');
    await page.evaluate(() => {
        globalThis.__classicDemo.editor.setData(
            '<p><img src="/demo-editor-cover.svg" alt="Cover" width="640" height="240"></p>',
        );
    });
    await visual.locator('img').dblclick();

    const dialog = page.getByRole('dialog', { name: 'Image properties' });
    const title = dialog.locator('.soeditor-ui__dialog-title');
    const body = dialog.locator('.soeditor-ui__dialog-body');
    const footer = dialog.locator('.soeditor-ui__dialog-actions');
    const resize = dialog.getByRole('button', { name: 'Resize dialog' });
    await expect(dialog).toBeVisible();
    await expect(resize).toBeVisible();
    await expect(title).toBeVisible();
    await expect(footer).toBeVisible();
    await expect(dialog).toHaveCSS('overflow', 'hidden');
    await expect
        .poll(() =>
            body.evaluate(
                (element) => element.scrollHeight > element.clientHeight,
            ),
        )
        .toBe(true);

    const titleBox = await title.boundingBox();
    if (titleBox === null) throw new Error('Missing image dialog title.');
    await page.mouse.move(
        titleBox.x + titleBox.width / 2,
        titleBox.y + titleBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(-500, -500);
    await page.mouse.up();
    const movedBox = await dialog.boundingBox();
    if (movedBox === null) throw new Error('Missing moved image dialog.');
    expect(movedBox.x).toBeGreaterThanOrEqual(7);
    expect(movedBox.y).toBeGreaterThanOrEqual(7);

    await resize.focus();
    const beforeKeyboardResize = await dialog.boundingBox();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowUp');
    const afterKeyboardResize = await dialog.boundingBox();
    if (beforeKeyboardResize === null || afterKeyboardResize === null) {
        throw new Error('Missing keyboard-resized image dialog.');
    }
    expect(afterKeyboardResize.width).toBeLessThan(beforeKeyboardResize.width);
    expect(afterKeyboardResize.height).toBeLessThan(
        beforeKeyboardResize.height,
    );

    const resizeBox = await resize.boundingBox();
    if (resizeBox === null) throw new Error('Missing dialog resize handle.');
    await page.mouse.move(
        resizeBox.x + resizeBox.width / 2,
        resizeBox.y + resizeBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(2_000, 2_000);
    await page.mouse.up();
    const boundedBox = await dialog.boundingBox();
    if (boundedBox === null) throw new Error('Missing resized image dialog.');
    expect(boundedBox.x).toBeGreaterThanOrEqual(7);
    expect(boundedBox.y).toBeGreaterThanOrEqual(7);
    expect(boundedBox.x + boundedBox.width).toBeLessThanOrEqual(593);
    expect(boundedBox.y + boundedBox.height).toBeLessThanOrEqual(473);
    await expect(title).toBeVisible();
    await expect(footer).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
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
    await dialog
        .getByLabel('Alignment', { exact: true })
        .selectOption('center');
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

test('image alignment renders stored figures and survives Source round trips', async ({
    page,
}) => {
    const wysiwyg = page.locator('.soeditor-classic__visual');
    // Check rendered geometry, not only the persisted data-align attribute.
    // The same contract applies to linked and CSS block-level CMS images.
    for (const display of ['', ' style="display:block"']) {
        for (const alignment of ['left', 'center', 'right']) {
            const html = `<figure data-soeditor-media="image" data-align="${alignment}"><a href="/photo"><img src="/demo-editor-cover.svg" width="200" height="80"${display}></a><figcaption>Caption</figcaption></figure>`;
            await page.evaluate(
                (html) => globalThis.__classicDemo.editor.setData(html),
                html,
            );
            const assertAlignment = async () => {
                await expect
                    .poll(() =>
                        wysiwyg
                            .locator('figure')
                            .evaluate((figure, alignment) => {
                                const image = figure.querySelector('img');
                                if (image === null)
                                    throw new Error('Missing image.');
                                const frame = figure.getBoundingClientRect();
                                const picture = image.getBoundingClientRect();
                                return Math.abs(
                                    alignment === 'left'
                                        ? picture.left - frame.left
                                        : alignment === 'right'
                                          ? picture.right - frame.right
                                          : picture.left +
                                            picture.width / 2 -
                                            frame.left -
                                            frame.width / 2,
                                );
                            }, alignment),
                    )
                    .toBeLessThan(1);
            };
            await assertAlignment();
            await page.evaluate(async () => {
                await globalThis.__classicDemo.editor.setWorkspaceView(
                    'source',
                );
                await globalThis.__classicDemo.editor.setWorkspaceView(
                    'wysiwyg',
                );
            });
            await assertAlignment();
            expect(
                await page.evaluate(() => globalThis.__classicDemo.getData()),
            ).toBe(html);
        }
    }
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
    // A reopened menu reflects the applied selection color, not a discarded draft.
    await expect(textValue).toHaveValue('rgb(0, 0, 0)');
    await textColor.locator('summary').click();
    await expect(textColor.locator('summary')).toHaveAttribute(
        'aria-expanded',
        'false',
    );
    // Input in the opening task must survive the queued native toggle task.
    await textColor.evaluate(async (element) => {
        if (!(element instanceof HTMLDetailsElement))
            throw new Error('Expected color menu.');
        const input = element.querySelector('input[type="text"]');
        if (!(input instanceof HTMLInputElement))
            throw new Error('Expected color input.');
        const toggled = new Promise<void>((resolve) =>
            element.addEventListener('toggle', () => resolve(), { once: true }),
        );
        element.open = true;
        input.focus();
        input.value = '#123456';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await toggled;
    });
    await expect(textValue).toHaveValue('#123456');
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
    await page.locator('.soeditor-classic__visual p').first().click();
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
    await page.locator('[data-toolbar-item="unorderedList"] > button').click();
    await expect(visual.locator('ul > li')).toHaveText('Selected text');
    await expect.poll(selectedText).toBe('Selected');
    await page.locator('[data-toolbar-item="unorderedList"] > button').click();
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

test('element path follows WYSIWYG selection without exposing Source chrome', async ({
    page,
}) => {
    const path = page.locator('.soeditor-ui__element-path');
    const visual = page.locator('.soeditor-classic__visual');
    const html =
        '<section><ul><li><strong>Nested text</strong></li></ul><p>Other text</p></section>';
    await page.evaluate(
        (html) => globalThis.__classicDemo.editor.setData(html),
        html,
    );
    await visual.locator('strong').click();
    await expect(path).toHaveText('section › ul › li › strong');
    await visual.locator('p').click();
    await expect(path).toHaveText('section › p');
    await page.evaluate(async () =>
        globalThis.__classicDemo.editor.setWorkspaceView(
            'wysiwyg-source-horizontal',
        ),
    );
    await visual.locator('strong').click();
    await expect(path).toHaveText('section › ul › li › strong');
    await page.locator('.soeditor-classic__source .cm-content').click();
    await expect(path).toBeHidden();
    await visual.locator('strong').click();
    await expect(path).toBeVisible();
    await expect(path).toHaveText('section › ul › li › strong');
    expect(await page.evaluate(() => globalThis.__classicDemo.getData())).toBe(
        html,
    );
    await page.evaluate(() =>
        globalThis.__classicDemo.editor.setData('<p>Replacement</p>'),
    );
    await expect(path).not.toHaveText('section › ul › li › strong');
    await visual.locator('p').click();
    await expect(path).toHaveText('p');
    await page.evaluate(() =>
        globalThis.__classicDemo.editor.setData(
            '<figure><img src="/demo-editor-cover.svg" width="200"></figure>',
        ),
    );
    await visual.locator('img').click();
    await expect(path).toHaveText('figure › img');

    await page.evaluate(async () => {
        const host = document.createElement('textarea');
        host.id = 'path-second-host';
        document.body.append(host);
        const second = await globalThis.__classicDemo.create(host, {
            data: '<blockquote><p>Second instance</p></blockquote>',
        });
        second.element.id = 'path-second-editor';
    });
    const second = page.locator('#path-second-editor');
    await second.locator('.soeditor-classic__visual p').click();
    await expect(second.locator('.soeditor-ui__element-path')).toHaveText(
        'blockquote › p',
    );
    await expect(
        page
            .locator('.soeditor-classic')
            .first()
            .locator('.soeditor-ui__element-path'),
    ).toBeHidden();

    const modulePath = `/@fs${fileURLToPath(
        new URL('../../packages/ui/src/element-path.ts', import.meta.url),
    )}`;
    const scheduling = await page.evaluate(async (modulePath) => {
        const module: typeof ElementPathModule = await import(modulePath);
        let reads = 0;
        let mutations = 0;
        const component = module.createElementPath(document, () => {
            reads += 1;
            return ['section', 'p'];
        });
        document.body.append(component.element);
        const observer = new MutationObserver((records) => {
            mutations += records.length;
        });
        observer.observe(component.element, { childList: true });
        for (let index = 0; index < 1000; index += 1) component.update();
        await new Promise(requestAnimationFrame);
        const firstReads = reads;
        for (let index = 0; index < 1000; index += 1) component.update();
        await new Promise(requestAnimationFrame);
        const secondReads = reads;
        component.update();
        component.destroy();
        await new Promise(requestAnimationFrame);
        observer.disconnect();
        return {
            firstReads,
            secondReads,
            finalReads: reads,
            mutations,
            connected: component.element.isConnected,
        };
    }, modulePath);
    expect(scheduling).toEqual({
        firstReads: 1,
        secondReads: 2,
        finalReads: 2,
        mutations: 1,
        connected: false,
    });
});

test('keeps Unicode word and character counts visible in WYSIWYG and Source', async ({
    page,
}) => {
    const status = page.locator('.soeditor-ui__document-status');
    for (const html of [
        '<h1><br></h1>\n<aside data-soeditor-object="promo" data-campaign="summer" data-theme="violet"></aside>\n<!--CMS:block--><product-card data-id="42"></product-card>\n',
        '<p>&nbsp; </p>\n<p><br></p>',
    ]) {
        await page.evaluate(
            (html) => globalThis.__classicDemo.editor.setData(html),
            html,
        );
        await expect(status).toHaveAttribute('data-words', '0');
        await expect(status).toHaveAttribute('data-characters', '0');
        await expect(status).toHaveAttribute(
            'data-source-characters',
            String(html.length),
        );
        expect(
            await page.evaluate(() => globalThis.__classicDemo.getData()),
        ).toBe(html);
    }
    await page.evaluate(() => {
        globalThis.__classicDemo.editor.setData('<p>Hello 世界</p>');
    });
    await expect(status).toHaveAttribute('data-words', '3');
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
    await expect(status).toHaveAttribute('data-words', '3');
    await expect(status).toHaveAttribute('data-characters', '8');
    await expect(status).toHaveAttribute('data-source-characters', '15');

    // Same-length Source edits must invalidate counts; undo restores them.
    const source = page.locator('.soeditor-classic__source .cm-content');
    await source.click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.insertText('<p>Hi World</p>');
    await expect(status).toHaveAttribute('data-words', '2');
    await expect(status).toHaveAttribute('data-characters', '8');
    await expect(status).toHaveAttribute('data-source-characters', '15');
    await page.evaluate(async () => {
        await globalThis.__classicDemo.editor.editor.execute('editor.undo');
    });
    await expect(status).toHaveAttribute('data-words', '3');
    await page.evaluate(() => {
        const classic = globalThis.__classicDemo.editor;
        classic.setReadonly(true);
        classic.setReadonly(false);
        classic.setData('<p>😀 e\u0301 &amp;</p>');
    });
    await expect(status).toHaveAttribute('data-characters', '6');
    await expect(status).toHaveAttribute('data-words', '1');
    await expect(status).toHaveAttribute('data-source-characters', '17');

    const immediate = await page.evaluate(() => {
        const classic = globalThis.__classicDemo.editor;
        classic.setData('<p>First burst</p>');
        classic.setData('<p>Second burst</p>');
        classic.setData('<p>Final 😀</p>');
        return { html: classic.getData(), dirty: classic.editor.state.dirty };
    });
    expect(immediate).toEqual({ html: '<p>Final 😀</p>', dirty: true });
    await expect(status).toHaveAttribute('data-characters', '7');
    await expect(status).toHaveAttribute('data-source-characters', '14');
    // A scheduled count must not touch a detached UI after teardown.
    const detached = await page.evaluate(async () => {
        const host = document.createElement('textarea');
        document.body.append(host);
        const classic = await globalThis.__classicDemo.create(host, {
            data: '<p>Old</p>',
        });
        const status = classic.element.querySelector(
            '.soeditor-ui__document-status',
        );
        const before = status?.textContent;
        classic.setData('<p>Pending statistics</p>');
        await classic.destroy();
        await new Promise((resolve) => setTimeout(resolve, 180));
        host.remove();
        return { before, after: status?.textContent };
    });
    expect(detached.after).toBe(detached.before);
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
        await page.locator('[data-table-menu=merge]').click();
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
        await page.locator('[data-table-menu=merge]').click();
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
    await expect(page.locator('.cm-content')).toBeVisible();
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
    await expect(page.locator('.cm-content')).toBeVisible();
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
    await expect(
        classic.locator('[data-toolbar-item="format"]'),
    ).not.toHaveAttribute('aria-busy', 'true');

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
        splitCellBox.x + splitCellBox.width,
        0,
    );

    await splitCell.scrollIntoViewIfNeeded();
    await splitVisual.evaluate((host) => {
        host.scrollTop += 40;
    });
    await expect
        .poll(() => splitVisual.evaluate((host) => host.scrollTop))
        .toBeGreaterThan(0);
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    await expect
        .poll(async () => {
            const handle = await splitHandle.boundingBox();
            const table = await splitVisual
                .locator('table')
                .first()
                .boundingBox();
            return Math.abs((handle?.y ?? -1000) - (table?.y ?? 0));
        })
        .toBeLessThan(2);
    const visibleCell = await splitCell.boundingBox();
    if (visibleCell === null) throw new Error('Missing visible split cell');
    const dragX = visibleCell.x + visibleCell.width;
    const dragY = visibleCell.y + visibleCell.height / 2;
    await page.mouse.move(dragX, dragY);
    await page.mouse.down();
    await page.mouse.move(dragX + 30, dragY, { steps: 4 });
    await page.mouse.up();
    await expect
        .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
        .toMatch(/<col width="\d+">/u);
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
    expect(box.x + box.width / 2).toBeCloseTo(cellBox.x + cellBox.width, 0);
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
        .toMatch(/<col width="\d+(?:px)?">/u);
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
    await expect(
        classic.locator('[data-toolbar-item="format"]'),
    ).not.toHaveAttribute('aria-busy', 'true');

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

    await splitRow.scrollIntoViewIfNeeded();
    await splitVisual.evaluate((host) => {
        host.scrollTop += 40;
    });
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    const visibleRow = await splitRow.boundingBox();
    if (visibleRow === null) throw new Error('Missing visible split row');
    await expect
        .poll(async () => {
            const bounds = await splitHandle.boundingBox();
            return Math.abs(
                (bounds === null ? -1000 : bounds.y + bounds.height / 2) -
                    (visibleRow.y + visibleRow.height),
            );
        })
        .toBeLessThan(2);
    const rowX = visibleRow.x + visibleRow.width - 12;
    const rowY = visibleRow.y + visibleRow.height;
    await page.mouse.move(rowX, rowY);
    await page.mouse.down();
    await page.mouse.move(rowX, rowY + 25, { steps: 4 });
    await page.mouse.up();
    await expect(splitRow).toHaveAttribute('height', /\d+/u);
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

test('optionally synchronizes proportional scrolling in split Source view', async ({
    page,
}) => {
    const paragraphs = Array.from(
        { length: 80 },
        (_value, index) =>
            `<p${index === 0 ? ' id="scroll-sync-marker"' : ''}>Paragraph ${String(index)} ${'content '.repeat(8)}</p>`,
    ).join('\n');
    await page.evaluate(async (data) => {
        const host = document.createElement('textarea');
        host.id = 'scroll-sync-host';
        document.body.append(host);
        const fixture: unknown = Reflect.get(globalThis, '__classicDemo');
        const create = Reflect.get(fixture as object, 'create');
        const editor = (await Reflect.apply(create, fixture, [
            host,
            {
                data,
                editingModes: ['wysiwyg', 'source'],
                initialHeight: 220,
                maxHeight: 220,
                minHeight: 220,
                source: { scrollSync: true },
            },
        ])) as {
            destroy(): Promise<void>;
            setWorkspaceView(view: string): void | Promise<void>;
        };
        await editor.setWorkspaceView('wysiwyg-source-horizontal');
        Reflect.set(globalThis, '__scrollSyncEditor', editor);
    }, paragraphs);

    const classic = page.locator('.soeditor-classic:has(#scroll-sync-marker)');
    const visual = classic.locator('.soeditor-classic__visual');
    const source = classic.locator('.soeditor-classic__source .cm-scroller');
    await visual.evaluate((element) => {
        element.scrollTop = element.scrollHeight - element.clientHeight;
        element.dispatchEvent(new Event('scroll'));
    });
    await expect
        .poll(() => source.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(0);

    await source.evaluate((element) => {
        element.scrollTop = 0;
        element.dispatchEvent(new Event('scroll'));
    });
    await expect
        .poll(() => visual.evaluate((element) => element.scrollTop))
        .toBeLessThan(1);
    await page.evaluate(async () => {
        const editor = Reflect.get(globalThis, '__scrollSyncEditor') as {
            destroy(): Promise<void>;
        };
        await editor.destroy();
    });
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
        body.style.zoom = '200%';
        body.style.overflow = 'auto';
    });
    const classic = page.locator('.soeditor-classic');
    const toolbar = classic.getByRole('toolbar');
    await expect(toolbar).toHaveAttribute('data-overflow', 'wrap');
    await expect(
        classic.locator('.soeditor-ui__document-status'),
    ).toBeVisible();
    await classic.locator('.soeditor-wysiwyg-content p').first().click();
    const alignment = toolbar.locator(
        '[data-toolbar-item="alignment"] summary',
    );
    await alignment.focus();
    await page.keyboard.press('ArrowDown');
    const choices = toolbar.locator(
        '[data-toolbar-item="alignment"] .soeditor-ui__menu-items',
    );
    await expect(choices).toBeVisible();
    await expect
        .poll(async () => {
            const box = await choices.boundingBox();
            return (
                box !== null &&
                box.x >= 0 &&
                box.y >= 0 &&
                box.x + box.width <= 360 &&
                box.y + box.height <= 720
            );
        })
        .toBe(true);
    await page.keyboard.press('End');
    await expect(choices.locator('button').last()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(alignment).toBeFocused();

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
        .toContain('<li>One<ol type="A"><li>Two</li></ol></li>');
    await page.keyboard.press('Shift+Tab');
    await expect
        .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
        .toContain('<li>One</li><li>Two</li>');

    await page.evaluate(() => globalThis.__classicDemo.execute('editor.undo'));
    await expect
        .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
        .toContain('<li>One<ol type="A"><li>Two</li></ol></li>');
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
    const pendingRow = page
        .locator('[data-upload-id]')
        .filter({ hasText: 'hero.png' });
    const cancel = pendingRow.getByRole('button', {
        name: 'Cancel: hero.png',
        exact: true,
    });
    await cancel.focus();
    await page.evaluate(() =>
        globalThis.__classicDemo.reportUploadProgress(0.5),
    );
    await expect(cancel).toBeFocused();
    expect(
        await pendingRow
            .getByRole('progressbar')
            .evaluate(
                (element: HTMLProgressElement) => element.value / element.max,
            ),
    ).toBeGreaterThanOrEqual(0.5);
    expect(await page.evaluate(() => globalThis.__classicDemo.getData())).toBe(
        '<p>Upload target</p>',
    );
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

    await page.evaluate(async () => {
        const harness = globalThis.__classicDemo;
        harness.setUploadMode('fail');
        try {
            await harness.upload('retry.png');
        } catch {
            /* Expected adapter failure. */
        }
        harness.setUploadMode('success');
    });
    const failedRow = page
        .locator('[data-upload-id]')
        .filter({ hasText: 'retry.png' });
    await expect(failedRow).toContainText('Upload failed');
    await expect(failedRow).toContainText('Demo upload failed.');
    await failedRow
        .getByRole('button', { name: 'Retry: retry.png', exact: true })
        .click();
    await expect(failedRow).toHaveAttribute('data-upload-state', 'succeeded');
    await expect(failedRow).toContainText('Upload complete');
    await expect
        .poll(() =>
            page.evaluate(
                () => globalThis.__classicDemo.uploadRecords().at(-1)?.attempt,
            ),
        )
        .toBe(2);
    await failedRow
        .getByRole('button', { name: 'Close: retry.png', exact: true })
        .click();
    await expect(failedRow).toHaveCount(0);

    const beforeCancel = await page.evaluate(() => {
        const harness = globalThis.__classicDemo;
        harness.setUploadMode('manual');
        void harness.upload('cancel.png');
        return harness.getData();
    });
    const cancelRow = page
        .locator('[data-upload-id]')
        .filter({ hasText: 'cancel.png' });
    await expect(cancelRow.getByRole('progressbar')).toBeVisible();
    await cancelRow
        .getByRole('button', { name: 'Cancel: cancel.png', exact: true })
        .click();
    await expect(cancelRow).toContainText('Upload cancelled');
    await expect
        .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
        .toBe(beforeCancel);

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
    const beforeRejectedPaste = await page.evaluate(() => {
        const harness = globalThis.__classicDemo;
        harness.editor.setData('<p>Keep this article</p>');
        harness.select({
            anchor: { block: 0, offset: 17 },
            focus: { block: 0, offset: 17 },
        });
        harness.setUploadMode('manual');
        const transfer = new DataTransfer();
        for (let index = 0; index < 5; index += 1) {
            transfer.items.add(
                new File(['image'], `batch-${index}.png`, {
                    type: 'image/png',
                }),
            );
        }
        const before = harness.uploadRecords().length;
        document
            .querySelector('.soeditor-classic__visual')
            ?.shadowRoot?.querySelector('.soeditor-wysiwyg-content')
            ?.dispatchEvent(
                new ClipboardEvent('paste', {
                    bubbles: true,
                    cancelable: true,
                    clipboardData: transfer,
                }),
            );
        return before;
    });
    await expect(
        page
            .locator('.soeditor-ui__notification')
            .filter({ hasText: 'At most 4 uploads' }),
    ).toBeVisible();
    expect(
        await page.evaluate(
            () => globalThis.__classicDemo.uploadRecords().length,
        ),
    ).toBe(beforeRejectedPaste);
    expect(await page.evaluate(() => globalThis.__classicDemo.getData())).toBe(
        '<p>Keep this article</p>',
    );

    await page.setViewportSize({ width: 375, height: 720 });
    await page.goto('/classic.html');
    await page.locator('body[data-ready="true"]').waitFor();
    await page.evaluate(async () => {
        const harness = globalThis.__classicDemo;
        harness.editor.setData('<p>上传位置</p>');
        harness.select({
            anchor: { block: 0, offset: 4 },
            focus: { block: 0, offset: 4 },
        });
        harness.setUploadMode('fail');
        try {
            await harness.upload('中文图片.png');
        } catch {
            /* Expected failure. */
        }
    });
    const localizedRow = page
        .locator('[data-upload-id]')
        .filter({ hasText: '中文图片.png' });
    await expect(localizedRow).toContainText('上传失败');
    const retry = localizedRow.getByRole('button', {
        name: '重试: 中文图片.png',
        exact: true,
    });
    await page.evaluate(() =>
        globalThis.__classicDemo.editor.setReadonly(true),
    );
    await expect(retry).toBeDisabled();
    await page.evaluate(() =>
        globalThis.__classicDemo.editor.setReadonly(false),
    );
    await expect(retry).toBeEnabled();
    await retry.focus();
    await expect(retry).toBeFocused();
    await localizedRow.scrollIntoViewIfNeeded();
    const box = await localizedRow.boundingBox();
    if (!box) throw new Error('Missing upload feedback');
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(375);
    await page.screenshot({ path: '/tmp/soeditor-ux-stage7-upload-375.png' });
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
    readonly editor: ClassicEditor;
    create(
        host: HTMLElement,
        options?: CreateClassicEditorOptions,
    ): Promise<ClassicEditor>;
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
    reportUploadProgress(fraction: number): void;
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

test('loads Source, formatting and Preview only when each is first used', async ({
    page,
}) => {
    const requested: string[] = [];
    page.on('request', (request) => requested.push(request.url()));
    await page.goto('/classic.html?test=1');
    await page.locator('body[data-ready="true"]').waitFor();
    const sourceRequests = () =>
        requested.filter((url) =>
            /\/packages\/source\/src\/index\.ts/u.test(url),
        );
    const formattingRequests = () =>
        requested.filter((url) =>
            /\/packages\/html-tools\/src\/index\.ts/u.test(url),
        );
    const previewRequests = () =>
        requested.filter((url) =>
            /\/packages\/preview\/src\/index\.ts/u.test(url),
        );
    expect(requested.some((url) => url.includes('soeditor-retry='))).toBe(
        false,
    );
    expect(sourceRequests()).toHaveLength(0);
    expect(formattingRequests()).toHaveLength(0);
    expect(previewRequests()).toHaveLength(0);
    await expect(page.locator('.cm-editor')).toHaveCount(0);
    await page.locator('[data-workspace-view="source"]').click();
    await expect(page.locator('.cm-content')).toBeVisible();
    expect(sourceRequests()).toHaveLength(1);
    expect(formattingRequests()).toHaveLength(0);
    expect(previewRequests()).toHaveLength(0);
    await page.locator('[data-workspace-view="wysiwyg"]').click();
    await page
        .locator('[data-workspace-view="wysiwyg-source-horizontal"]')
        .click();
    await expect(page.locator('.cm-content')).toBeVisible();
    expect(sourceRequests()).toHaveLength(1);
    await page.locator('[data-workspace-view="source"]').click();
    await page.evaluate(async () => {
        await globalThis.__classicDemo.editor.editor.execute('document.format');
    });
    expect(formattingRequests()).toHaveLength(1);
    expect(previewRequests()).toHaveLength(0);
    await page.locator('[data-workspace-view="wysiwyg"]').click();
    const popupEvent = page.context().waitForEvent('page');
    await page.locator('[data-toolbar-item="popupPreview"]').click();
    const popup = await popupEvent;
    await expect(
        popup.locator('iframe').contentFrame().getByText('Hello'),
    ).toBeVisible();
    expect(previewRequests()).toHaveLength(1);
});

test('keeps the latest view and data while Source loads and never attaches after destroy', async ({
    page,
}) => {
    let release: (() => void) | undefined;
    const held = new Promise<void>((resolve) => {
        release = resolve;
    });
    let started = false;
    await page.route('**/packages/source/src/index.ts*', async (route) => {
        started = true;
        await held;
        await route.continue();
    });
    await page.goto('/classic.html?test=1');
    await page.locator('body[data-ready="true"]').waitFor();
    await page.locator('[data-workspace-view="source"]').click();
    await expect.poll(() => started).toBe(true);
    await expect(page.locator('.soeditor-classic')).toHaveAttribute(
        'aria-busy',
        'true',
    );
    await page.evaluate(() => {
        const editor = globalThis.__classicDemo.editor;
        editor.setData('<p>Changed during loading</p>');
        editor.setReadonly(true);
        editor.setWorkspaceView('wysiwyg');
    });
    release?.();
    await expect(page.locator('.soeditor-classic')).toHaveAttribute(
        'data-soeditor-source-state',
        'ready',
    );
    await expect(
        page.locator('[data-workspace-view="wysiwyg"]'),
    ).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-workspace-view="source"]').click();
    await expect(page.locator('.cm-content')).toHaveText(
        '<p>Changed during loading</p>',
    );
    await expect(page.locator('.cm-content')).toHaveAttribute(
        'contenteditable',
        'false',
    );

    let releaseSecond: (() => void) | undefined;
    const secondHeld = new Promise<void>((resolve) => {
        releaseSecond = resolve;
    });
    await page.unroute('**/packages/source/src/index.ts*');
    await page.route('**/packages/source/src/index.ts*', async (route) => {
        await secondHeld;
        await route.continue();
    });
    await page.goto('/classic.html?test=1');
    await page.locator('body[data-ready="true"]').waitFor();
    await page.locator('[data-workspace-view="source"]').click();
    await expect(page.locator('.soeditor-classic')).toHaveAttribute(
        'aria-busy',
        'true',
    );
    await page.evaluate(() => globalThis.__classicDemo.editor.destroy());
    releaseSecond?.();
    await expect(page.locator('.soeditor-classic')).toHaveCount(0);
    await expect(page.locator('.cm-editor')).toHaveCount(0);
    await expect(page.locator('textarea#content')).toBeVisible();
});

test('retries a failed Source request without losing the WYSIWYG document', async ({
    page,
}) => {
    let attempts = 0;
    const recoveryRequests: string[] = [];
    await page.route('**/*soeditor-retry=*', async (route) => {
        recoveryRequests.push(route.request().url());
        if (recoveryRequests.length === 1) await route.abort('failed');
        else await route.continue();
    });
    await page.route('**/packages/source/src/index.ts*', async (route) => {
        ++attempts;
        if (attempts === 1) await route.abort('failed');
        else await route.continue();
    });
    await page.goto('/classic.html?test=1');
    await page.locator('body[data-ready="true"]').waitFor();
    await page.locator('[data-workspace-view="source"]').click();
    await expect(page.locator('.soeditor-classic')).toHaveAttribute(
        'data-soeditor-source-state',
        'failed',
    );
    await page.evaluate(() =>
        globalThis.__classicDemo.editor.setData('<p>Retry preserves this</p>'),
    );
    await page.locator('[data-workspace-view="source"]').click();
    await expect(page.locator('.soeditor-classic')).toHaveAttribute(
        'data-soeditor-source-state',
        'failed',
    );
    await page.locator('[data-workspace-view="source"]').click();
    await expect(page.locator('.cm-content')).toBeVisible();
    await expect(page.locator('.cm-content')).toHaveText(
        '<p>Retry preserves this</p>',
    );
    expect(attempts).toBe(1);
    expect(recoveryRequests).toHaveLength(2);
    expect(recoveryRequests[0]).not.toBe(recoveryRequests[1]);
    await page.evaluate(() => globalThis.__classicDemo.editor.editor.destroy());
    await expect(page.locator('.soeditor-classic')).toHaveCount(0);
});

test('retains invalid Source drafts and prevents both form and adapter submission', async ({
    page,
}) => {
    const result = await page.evaluate(async () => {
        const form = document.createElement('form');
        const host = document.createElement('textarea');
        form.append(host);
        document.body.append(form);
        let writes = 0;
        const errors: string[] = [];
        const editor = await globalThis.__classicDemo.create(host, {
            data: '<p>Valid content</p>',
            editingModes: ['wysiwyg', 'source'],
            initialEditingMode: 'source',
            onError: (error) => {
                errors.push(
                    error instanceof Error ? error.name : String(error),
                );
            },
            save: {
                adapter: {
                    save: async () => {
                        ++writes;
                        return { status: 'saved' };
                    },
                },
            },
        });
        const draft = '<p id="a" id="b">Unfinished source</p>';
        editor.setData(draft);
        const submitted = form.dispatchEvent(
            new Event('submit', { bubbles: true, cancelable: true }),
        );
        let saveError = '';
        try {
            await editor.save();
        } catch (error) {
            saveError = error instanceof Error ? error.name : String(error);
        }
        await editor.setWorkspaceView('wysiwyg');
        const visual = editor.element.querySelector(
            '.soeditor-classic__visual',
        );
        const visualText =
            visual?.shadowRoot?.textContent ?? visual?.textContent;
        const data = editor.getData();
        const textarea = host.value;
        editor.setData('<p>Repaired</p>');
        await editor.save();
        await editor.destroy();
        form.remove();
        return {
            submitted,
            writes,
            errors,
            saveError,
            data,
            textarea,
            draft,
            visualText,
        };
    });
    expect(result.submitted).toBe(false);
    expect(result.saveError).toBe('ClassicInvalidSourceError');
    expect(result.errors).toContain('ClassicInvalidSourceError');
    expect(result.data).toBe(result.draft);
    expect(result.textarea).toBe(result.draft);
    expect(result.writes).toBe(1);
});

test('uses compact table dropdowns for headers, insertion, directional merge and ordinary splits', async ({
    page,
}) => {
    await page.evaluate(() =>
        globalThis.__classicDemo.editor.setData(
            '<p>Table tools</p><table><tbody><tr><td id="a">A</td><td id="b">B</td></tr><tr><td id="c">C</td><td id="d">D</td></tr></tbody></table>',
        ),
    );
    const visual = page.locator('.soeditor-classic__visual');
    const tools = page.locator('.soeditor-ui__table-balloon');
    await visual.locator('#a').click();
    await visual.locator('#b').click({ modifiers: ['Shift'] });
    await tools.locator('[data-table-menu=merge]').click();
    await expect(visual.locator('.is-structurally-selected')).toHaveCount(2);
    await expect(
        tools.getByRole('button', {
            name: 'Split cell horizontally',
            exact: true,
        }),
    ).toHaveAttribute('title', 'Select one cell to split.');
    await expect(
        tools.getByRole('button', { name: 'Merge cell up', exact: true }),
    ).toHaveAttribute('title', 'Select one cell to merge with its neighbor.');

    await tools
        .getByRole('button', { name: 'Merge cells', exact: true })
        .focus();
    await page.keyboard.press('ArrowLeft');
    await expect(tools.locator('[data-table-menu=row]')).toHaveAttribute(
        'aria-expanded',
        'true',
    );
    await expect(tools.locator('[data-table-menu=merge]')).toHaveAttribute(
        'aria-expanded',
        'false',
    );
    await expect(visual.locator('.is-structurally-selected')).toHaveCount(2);
    await page.keyboard.press('ArrowRight');
    await expect(tools.locator('[data-table-menu=merge]')).toHaveAttribute(
        'aria-expanded',
        'true',
    );
    await tools.locator('[data-table-menu=merge]').press('Escape');
    await expect(visual.locator('.is-structurally-selected')).toHaveCount(2);
    await visual.getByText('Table tools', { exact: true }).click();
    await expect(visual.locator('.is-structurally-selected')).toHaveCount(0);
    await expect(visual.locator('.soeditor-table-cell.is-editing')).toHaveCount(
        0,
    );
    await visual.locator('#a').click();
    await tools.locator('[data-table-menu=column]').click();
    await expect(
        tools.getByRole('switch', { name: 'Header column' }),
    ).toHaveAttribute('aria-checked', 'false');
    await tools.getByRole('switch', { name: 'Header column' }).click();
    await expect(visual.locator('th')).toHaveCount(2);
    await visual.locator('#a').click();
    await tools.locator('[data-table-menu=column]').click();
    await expect(
        tools.getByRole('switch', { name: 'Header column' }),
    ).toHaveAttribute('aria-checked', 'true');
    await tools.getByRole('switch', { name: 'Header column' }).click();
    await expect(visual.locator('th')).toHaveCount(0);
    await visual.locator('#a').click();
    await tools.locator('[data-table-menu=merge]').focus();
    await page.keyboard.press('ArrowDown');
    await expect(
        tools.getByRole('button', { name: 'Merge cell up', exact: true }),
    ).toBeDisabled();
    await expect(
        tools.getByRole('button', { name: 'Merge cell left', exact: true }),
    ).toBeDisabled();
    await expect(
        tools.getByRole('button', { name: 'Merge cell right', exact: true }),
    ).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(tools.locator('[data-table-menu=merge]')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(tools.locator('[data-table-menu=properties]')).toBeFocused();
    await expect(
        tools.locator('.soeditor-table-context__menu:not([hidden])'),
    ).toHaveCount(0);
    await page.keyboard.press('ArrowLeft');
    await expect(tools.locator('[data-table-menu=merge]')).toBeFocused();

    await tools.evaluate((element) => {
        element.dir = 'rtl';
    });
    await page.keyboard.press('ArrowRight');
    await expect(tools.locator('[data-table-menu=row]')).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(tools.locator('[data-table-menu=merge]')).toBeFocused();
    await tools.evaluate((element) => element.removeAttribute('dir'));
    await tools.locator('[data-table-merge]').focus();
    await page.keyboard.press('ArrowDown');
    await expect(
        tools.getByRole('button', { name: 'Merge cell right', exact: true }),
    ).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(tools.locator('[data-table-merge]')).toBeFocused();
    await tools.locator('[data-table-menu=merge]').click();
    await tools
        .getByRole('button', { name: 'Merge cell right', exact: true })
        .click();
    await expect(visual.locator('#a')).toHaveAttribute('colspan', '2');
    await expect(visual.locator('#a')).toContainText('AB');
    await visual.locator('#c').click();
    await tools.locator('[data-table-menu=merge]').click();
    await tools
        .getByRole('button', { name: 'Split cell horizontally' })
        .click();
    await expect(visual.locator('tr')).toHaveCount(3);
    await expect(visual.locator('#d')).toHaveAttribute('rowspan', '2');
    const html = await page.evaluate(() => globalThis.__classicDemo.getData());
    expect(html).not.toContain('soeditor-');
    expect(html.match(/id="c"/gu)).toHaveLength(1);
    await page.evaluate(() => globalThis.__classicDemo.execute('editor.undo'));
    await expect(visual.locator('tr')).toHaveCount(2);
    await visual.locator('#c').click();
    await tools.locator('[data-table-menu=merge]').click();
    await page.screenshot({ path: '/tmp/soeditor-table-dropdowns.png' });
    await page.setViewportSize({ width: 390, height: 700 });
    await visual.locator('#c').click();
    await tools.locator('[data-table-menu=column]').click();
    const bounds = await tools
        .locator('.soeditor-table-context__menu:not([hidden])')
        .boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(700);
    await page.evaluate(() =>
        globalThis.__classicDemo.editor.setData(
            '<table><tbody><tr><td id="insert">A</td><td>B</td></tr></tbody></table>',
        ),
    );
    await visual.locator('#insert').click();
    await tools.locator('[data-table-menu=column]').click();
    await tools.getByRole('button', { name: 'Insert column left' }).click();
    await expect(visual.locator('td')).toHaveCount(3);
    await visual.locator('#insert').click();
    await tools.locator('[data-table-menu=row]').click();
    await tools.getByRole('button', { name: 'Insert row below' }).click();
    await expect(visual.locator('tr')).toHaveCount(2);
});

test('keeps logical table selections and header intersections through span edits and source round trips', async ({
    page,
}) => {
    const visual = page.locator('.soeditor-classic__visual');
    const toolbar = page.locator('.soeditor-ui__table-balloon');
    const menu = async (kind: string) => {
        const trigger = toolbar.locator(`[data-table-menu="${kind}"]`);
        if ((await trigger.getAttribute('aria-expanded')) !== 'true')
            await trigger.click();
    };
    // Headers outside the first column remain editable; complete spanned
    // rectangles merge through the primary tool without opening its menu.
    await page.evaluate(() =>
        globalThis.__classicDemo.editor.setData(
            '<table style="width:600px"><colgroup><col><col span="2" data-track="kept"></colgroup><tbody><tr><td>A</td><th id="late-header" colspan="2" scope="col"><p>Header</p></th></tr><tr><td>B</td><th id="lower-header" colspan="2"><p>Lower</p></th></tr></tbody></table>',
        ),
    );
    await visual.locator('#late-header').click();
    await menu('properties');
    await toolbar
        .getByRole('button', { name: 'Toggle header cell', exact: true })
        .click();
    await expect(visual.locator('td#late-header')).toBeVisible();
    await expect(visual.locator('#late-header')).not.toHaveAttribute('scope');
    await visual.locator('#late-header').click();
    await visual.locator('#lower-header').click({ modifiers: ['Shift'] });
    await toolbar.locator('[data-table-merge]').click();
    await expect(visual.locator('#late-header')).toHaveAttribute(
        'rowspan',
        '2',
    );
    await expect(visual.locator('#late-header')).toHaveAttribute(
        'colspan',
        '2',
    );
    await expect(visual.locator('#late-header')).toContainText('Lower');
    await page.evaluate(() => globalThis.__classicDemo.execute('editor.undo'));
    await visual.locator('#lower-header').click();
    await menu('merge');
    await expect(
        toolbar.getByRole('button', { name: 'Merge cell up', exact: true }),
    ).toBeEnabled();
    await toolbar
        .getByRole('button', { name: 'Merge cell up', exact: true })
        .click();
    await expect(visual.locator('#late-header')).toHaveAttribute(
        'rowspan',
        '2',
    );
    await visual.locator('#late-header').click();
    await expect(visual.locator('.soeditor-table-column-resize')).toHaveCount(
        3,
    );
    const drag = async (selector: string, dx: number, dy: number) => {
        const handle = visual.locator(selector);
        const box = await handle.boundingBox();
        if (box === null) throw new Error('Missing resize handle');
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + dx, y + dy, { steps: 4 });
        await page.mouse.up();
    };
    const originalWidth = await visual
        .locator('#late-header')
        .evaluate((cell) => cell.getBoundingClientRect().width);
    await drag('[data-resize-column="2"]', 30, 0);
    await expect
        .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
        .toMatch(/<col data-track="kept" width="\d+px">/u);
    await expect
        .poll(() =>
            visual
                .locator('#late-header')
                .evaluate((cell) => cell.getBoundingClientRect().width),
        )
        .toBeGreaterThan(originalWidth);
    await visual.locator('#late-header').click();
    const originalHeight = await visual
        .locator('tr')
        .nth(1)
        .evaluate((row) => row.getBoundingClientRect().height);
    await drag('[data-resize-row="1"]', 0, 30);
    await expect
        .poll(() =>
            visual
                .locator('tr')
                .nth(1)
                .evaluate((row) => row.getBoundingClientRect().height),
        )
        .toBeGreaterThan(originalHeight);
    await expect(visual.locator('tr').nth(1)).toHaveAttribute('height', /\d+/u);
    await page.evaluate(() =>
        globalThis.__classicDemo.editor.setData(
            '<table><tbody><tr><td id="height-clear" height="120">A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table>',
        ),
    );
    await page
        .locator('[data-workspace-view="wysiwyg-source-horizontal"]')
        .first()
        .click();
    await visual.locator('#height-clear').click();
    await menu('properties');
    await toolbar
        .getByRole('button', { name: 'Cell properties', exact: true })
        .click();
    const heightDialog = page.getByRole('dialog', { name: 'Cell properties' });
    await heightDialog.getByLabel('Cell height', { exact: true }).fill('');
    await heightDialog
        .getByRole('button', { name: 'Apply', exact: true })
        .click();
    await expect(visual.locator('#height-clear')).not.toHaveAttribute('height');
    const beforeHeightClearDrag = await page.evaluate(() =>
        globalThis.__classicDemo.getData(),
    );
    const widthBefore = await visual
        .locator('#height-clear')
        .evaluate((cell) => cell.getBoundingClientRect().width);
    await drag('[data-resize-column="0"]', 35, 0);
    await expect
        .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
        .not.toBe(beforeHeightClearDrag);
    await expect
        .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
        .toMatch(/<col width="\d+">/u);
    await expect(visual.locator('tr[height]')).toHaveCount(0);
    await expect
        .poll(() =>
            visual
                .locator('#height-clear')
                .evaluate((cell) => cell.getBoundingClientRect().width),
        )
        .toBeGreaterThan(widthBefore);
    await page.evaluate(() => globalThis.__classicDemo.execute('editor.undo'));
    await expect
        .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
        .toBe(beforeHeightClearDrag);
    await visual.locator('#height-clear').click();
    const crossColumn = await visual
        .locator('[data-resize-column="0"]')
        .boundingBox();
    const crossRow = await visual
        .locator('[data-resize-row="0"]')
        .boundingBox();
    if (crossColumn === null || crossRow === null)
        throw new Error('Missing crossing handles');
    const crossX = crossColumn.x + crossColumn.width / 2;
    const crossY = crossRow.y + crossRow.height / 2;
    await page.mouse.click(crossX, crossY);
    expect(await page.evaluate(() => globalThis.__classicDemo.getData())).toBe(
        beforeHeightClearDrag,
    );
    await page.mouse.move(crossX, crossY);
    await page.mouse.down();
    await page.mouse.move(crossX, crossY + 30, { steps: 4 });
    await page.mouse.up();
    await expect(visual.locator('tr').first()).toHaveAttribute(
        'height',
        /\d+/u,
    );
    await expect(visual.locator('col')).toHaveCount(0);
    await page.locator('[data-workspace-view="wysiwyg"]').first().click();
    await page.evaluate(() =>
        globalThis.__classicDemo.editor.setData(
            '<table><tbody><tr><td id="span-a" rowspan="2">A</td><td id="span-b" colspan="2">B</td></tr><tr><td id="span-d">D</td><td id="span-e">E</td></tr><tr><td>F</td><td>G</td><td>H</td></tr></tbody></table>',
        ),
    );
    await visual.locator('#span-d').click();
    await menu('row');
    await toolbar.getByRole('button', { name: 'Insert row above' }).click();
    await expect(visual.locator('#span-a')).toHaveAttribute('rowspan', '3');
    await visual.locator('tr').nth(1).locator('td').first().click();
    await menu('row');
    await toolbar
        .getByRole('button', { name: 'Delete row', exact: true })
        .click();
    await expect(visual.locator('#span-a')).toHaveAttribute('rowspan', '2');
    await visual.locator('#span-b').click();
    await menu('column');
    await toolbar.getByRole('button', { name: 'Insert column left' }).click();
    await visual.locator('#span-d').click();
    await visual.locator('#span-e').click({ modifiers: ['Shift'] });
    await menu('merge');
    await toolbar
        .getByRole('button', { name: 'Merge cells', exact: true })
        .click();
    await expect(visual.locator('#span-d')).toHaveAttribute('colspan', '2');
    await expect(visual.locator('#span-b')).toHaveText('B');
    await visual.locator('#span-b').click();
    await menu('row');
    await toolbar
        .getByRole('button', { name: 'Delete row', exact: true })
        .click();
    await expect(visual.locator('#span-a')).not.toHaveAttribute('rowspan');
    await expect(visual.locator('#span-a')).toHaveText('A');
    await page.evaluate(() => globalThis.__classicDemo.execute('editor.undo'));
    await expect(visual.locator('#span-a')).toHaveAttribute('rowspan', '2');
    await page.locator('[data-workspace-view=source]').first().click();
    await page.locator('[data-toolbar-item=format]').click();
    await expect(
        page.locator('[data-toolbar-item=format]'),
    ).not.toHaveAttribute('aria-busy', 'true');
    await page.locator('[data-workspace-view=wysiwyg]').first().click();
    await visual.locator('#span-d').click();
    await menu('column');
    await toolbar
        .getByRole('button', { name: 'Delete column', exact: true })
        .click();
    await expect(visual.locator('#span-d')).not.toHaveAttribute('colspan');
    await expect(visual.locator('#span-d')).toContainText('DE');
    await expect
        .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
        .not.toContain('soeditor-');

    await page.evaluate(() =>
        globalThis.__classicDemo.editor.setData(
            '<table><tbody><tr><td id="corner">A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table>',
        ),
    );
    const toggle = async (axis: 'row' | 'column') => {
        await visual.locator('#corner').click();
        await menu(axis);
        await toolbar
            .getByRole('switch', {
                name: axis === 'row' ? 'Header row' : 'Header column',
            })
            .click();
    };
    await toggle('row');
    await toggle('column');
    await toggle('row');
    await expect(visual.locator('th')).toHaveCount(2);
    await expect(visual.locator('#corner')).toHaveAttribute('scope', 'row');
    await visual.locator('#corner').click();
    await menu('column');
    await expect(
        toolbar.getByRole('switch', { name: 'Header column' }),
    ).toHaveAttribute('aria-checked', 'true');
    await toggle('column');
    await expect(visual.locator('th')).toHaveCount(0);
    await expect(visual.locator('td[scope]')).toHaveCount(0);
});

test('keeps resize transactions on the selected table through cancellation, split view and history', async ({
    page,
}) => {
    const visual = page.locator('.soeditor-classic__visual');
    await page.evaluate(() =>
        globalThis.__classicDemo.editor.setData(
            '<table data-name="first"><tbody><tr><td>First A</td><td>First B</td></tr></tbody></table><p>Between tables</p><table data-name="second"><tbody><tr><td height="80">Second A</td><td>Second B</td></tr><tr><td>Second C</td><td>Second D</td></tr></tbody></table>',
        ),
    );
    const html = () => page.evaluate(() => globalThis.__classicDemo.getData());
    const firstHtml = () =>
        page.evaluate(() =>
            new DOMParser()
                .parseFromString(
                    globalThis.__classicDemo.getData(),
                    'text/html',
                )
                .querySelector('table')
                ?.outerHTML.replace(/>\s+</gu, '><'),
        );
    const firstOriginal = await firstHtml();
    await page
        .locator('[data-workspace-view="wysiwyg-source-horizontal"]')
        .first()
        .click();
    const second = visual.locator('table[data-name="second"]');
    await second.locator('td').first().click();
    const tools = page.locator('.soeditor-ui__table-balloon');
    await tools.locator('[data-table-menu=properties]').click();
    await tools
        .getByRole('button', { name: 'Cell properties', exact: true })
        .click();
    const dialog = page.getByRole('dialog', { name: 'Cell properties' });
    await dialog.getByLabel('Cell height', { exact: true }).fill('90');
    await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
    let baseline = await html();
    const column = visual.locator('[data-resize-column="0"]');
    const point = async () => {
        await second.scrollIntoViewIfNeeded();
        const box = await column.boundingBox();
        const cell = await second.locator('td').first().boundingBox();
        if (box === null || cell === null)
            throw new Error('Missing second table handle');
        expect(box.x + box.width / 2).toBeCloseTo(cell.x + cell.width, 0);
        expect(Math.abs(box.y - cell.y)).toBeLessThan(1);
        return { x: box.x + box.width / 2, y: cell.y + cell.height / 2 };
    };
    let at = await point();
    await page.mouse.click(at.x, at.y);
    expect(await html()).toBe(baseline);
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await page.mouse.move(at.x + 30, at.y);
    await expect(visual.locator('[data-resize-feedback]')).toContainText(
        'Column width',
    );
    await page.keyboard.press('Escape');
    await page.mouse.up();
    expect(await html()).toBe(baseline);
    await expect(visual.locator('[data-resize-feedback]')).toHaveCount(0);
    at = await point();
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await page.mouse.move(at.x + 20, at.y);
    await page.mouse.move(at.x, at.y);
    await page.mouse.up();
    expect(await html()).toBe(baseline);
    await column.evaluate((element) =>
        element.addEventListener(
            'gotpointercapture',
            (event) => {
                Reflect.set(element, 'testPointer', event.pointerId);
            },
            { once: true },
        ),
    );
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await page.mouse.move(at.x + 20, at.y);
    await column.evaluate((element) => {
        const id: unknown = Reflect.get(element, 'testPointer');
        if (typeof id !== 'number') throw new Error('Missing captured pointer');
        element.releasePointerCapture(id);
    });
    await page.mouse.move(at.x + 25, at.y);
    await page.mouse.up();
    expect(await html()).toBe(baseline);
    await expect(visual.locator('[data-resize-feedback]')).toHaveCount(0);
    at = await point();
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await page.mouse.move(at.x + 25, at.y);
    baseline = baseline.replace('Second A', 'Second revised');
    await page.evaluate(
        (source) => globalThis.__classicDemo.editor.setData(source),
        baseline,
    );
    await expect(visual.locator('[data-resize-feedback]')).toHaveCount(0);
    await page.mouse.up();
    expect(await html()).toBe(baseline);
    at = await point();
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await page.mouse.move(at.x + 45, at.y, { steps: 4 });
    await page.mouse.up();
    await expect.poll(html).not.toBe(baseline);
    expect(await firstHtml()).toBe(firstOriginal);
    await expect(second.locator('col')).toHaveCount(2);
    const resized = await html();
    await page.evaluate(() => globalThis.__classicDemo.execute('editor.undo'));
    await expect.poll(html).toBe(baseline);
    await page.evaluate(() => globalThis.__classicDemo.execute('editor.redo'));
    await expect.poll(html).toBe(resized);
    await page.locator('.soeditor-classic__source .cm-content').click();
    await page.locator('[data-toolbar-item=format]').click();
    await expect(
        page.locator('[data-toolbar-item=format]'),
    ).not.toHaveAttribute('aria-busy', 'true');
    await second.locator('td').first().click();
    const row = visual.locator('[data-resize-row="0"]');
    const rowBox = await row.boundingBox();
    if (rowBox === null) throw new Error('Missing second table row handle');
    await page.mouse.move(
        rowBox.x + rowBox.width - 12,
        rowBox.y + rowBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
        rowBox.x + rowBox.width - 12,
        rowBox.y + rowBox.height / 2 + 30,
    );
    await expect(visual.locator('[data-resize-feedback]')).toContainText(
        'Row height',
    );
    await page.mouse.up();
    await expect(second.locator('tr').first()).toHaveAttribute(
        'height',
        /\d+/u,
    );
    expect(await firstHtml()).toBe(firstOriginal);
    expect(await html()).not.toContain('soeditor-');
    await page.evaluate(
        (first) => globalThis.__classicDemo.editor.setData(first ?? ''),
        firstOriginal,
    );
    await expect(visual.locator('.soeditor-table-resize-overlay')).toHaveCount(
        0,
    );
});

test('disables table splits at logical limits and clamps resize previews', async ({
    page,
}) => {
    const visual = page.locator('.soeditor-classic__visual');
    await page.evaluate(() =>
        globalThis.__classicDemo.editor.setData(
            '<table><tbody><tr>' +
                Array.from({ length: 100 }, (_, i) => `<td>${i}</td>`).join(
                    '',
                ) +
                '</tr></tbody></table>',
        ),
    );
    await visual.locator('td').first().click();
    const tools = page.locator('.soeditor-ui__table-balloon');
    await tools.locator('[data-table-menu=merge]').click();
    await expect(
        tools.getByRole('button', {
            name: 'Split cell vertically',
            exact: true,
        }),
    ).toBeDisabled();
    await expect(
        tools.getByRole('button', {
            name: 'Split cell vertically',
            exact: true,
        }),
    ).toHaveAttribute('title', 'Splitting would exceed table limits.');
    await expect(
        tools.getByRole('button', {
            name: 'Split cell horizontally',
            exact: true,
        }),
    ).toBeEnabled();
    await page.evaluate(() =>
        globalThis.__classicDemo.editor.setData(
            '<table><tbody><tr><td>Limit</td></tr></tbody></table>',
        ),
    );
    await visual.locator('td').click();
    const handle = visual.locator('[data-resize-column="0"]');
    const box = await handle.boundingBox();
    if (box === null) throw new Error('Missing limit handle');
    const startWidth = await visual
        .locator('td')
        .evaluate((cell) => cell.getBoundingClientRect().width);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 2000, box.y + box.height / 2);
    await expect(visual.locator('[data-resize-feedback]')).toContainText(
        '1200 px · Limit reached',
    );
    await expect
        .poll(() => handle.boundingBox().then((rect) => rect?.x))
        .toBeCloseTo(box.x + 1200 - startWidth, 0);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(visual.locator('col')).toHaveCount(0);
});

test('honors table cellpadding and cellspacing in source split view', async ({
    page,
}) => {
    await page.evaluate(() =>
        globalThis.__classicDemo.editor.setData(
            '<table cellpadding="12" cellspacing="8"><tbody><tr><td>A</td><td style="padding: 3px">B</td></tr></tbody></table>',
        ),
    );
    await page
        .locator('[data-workspace-view="wysiwyg-source-horizontal"]')
        .first()
        .click();
    const table = page.locator('.soeditor-classic__visual table');
    await expect(table).toHaveCSS('border-collapse', 'separate');
    await expect(table).toHaveCSS('border-spacing', '8px');
    await expect(table.locator('td').first()).toHaveCSS('padding', '12px');
    await expect(table.locator('td').nth(1)).toHaveCSS('padding', '3px');
    const html = await page.evaluate(() => globalThis.__classicDemo.getData());
    expect(html).toContain('cellpadding="12"');
    expect(html).toContain('cellspacing="8"');
    expect(html).not.toContain('soeditor-');
    await page.evaluate(() =>
        globalThis.__classicDemo.editor.setData(
            '<table cellpadding="0" cellspacing="0" style="border-collapse: collapse"><tbody><tr><td>A</td></tr></tbody></table>',
        ),
    );
    await expect(table).toHaveCSS('border-collapse', 'collapse');
    await expect(table).toHaveCSS('border-spacing', '0px');
    await expect(table.locator('td')).toHaveCSS('padding', '0px');
});

test('image drag preserves ratio by default, keeps the opposite corner steady and commits once', async ({
    page,
}, testInfo) => {
    const visual = page.locator('.soeditor-wysiwyg-content');
    const surface = page.locator('.soeditor-classic__visual');
    const source =
        '<p>Before</p><figure class="cms-photo"><a href="/photo"><img src="/demo-editor-cover.svg" width="400" height="150" alt="Cover"></a><figcaption>Caption</figcaption></figure><p>After</p>';
    await page.evaluate(
        (html) => globalThis.__classicDemo.editor.setData(html),
        source,
    );
    const image = visual.locator('img');
    await image.click();
    const overlay = surface.locator('.soeditor-image-resize-overlay');
    const handle = surface.locator('[data-resize-direction="nw"]');
    await testInfo.attach('selected-image-controls', {
        body: await surface.screenshot(),
        contentType: 'image/png',
    });
    const start = await overlay.boundingBox();
    const grip = await handle.boundingBox();
    if (start === null || grip === null)
        throw new Error('Missing resize controls.');
    await page.evaluate(() => {
        const intervals: number[] = [];
        let previous = performance.now();
        let running = true;
        const sample = (now: number): void => {
            intervals.push(now - previous);
            previous = now;
            if (running) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
        let changes = 0;
        const dispose = globalThis.__classicDemo.editor.editor.events.on(
            'document:change',
            () => {
                changes += 1;
            },
        );
        Reflect.set(globalThis, '__imageDragMetrics', () => {
            running = false;
            dispose();
            return { changes, intervals };
        });
    });
    const x = grip.x + grip.width / 2;
    const y = grip.y + grip.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 80, y + 30, { steps: 60 });
    await expect(overlay).toHaveAttribute('data-dimensions', '320 × 120');
    await testInfo.attach('image-drag-preview', {
        body: await surface.screenshot(),
        contentType: 'image/png',
    });
    const preview = await overlay.boundingBox();
    if (preview === null) throw new Error('Missing drag preview.');
    expect(preview.x + preview.width).toBeCloseTo(start.x + start.width, 0);
    expect(preview.y + preview.height).toBeCloseTo(start.y + start.height, 0);
    expect(await page.evaluate(() => globalThis.__classicDemo.getData())).toBe(
        source,
    );
    await page.mouse.up();
    const metrics = await page.evaluate(() => {
        const read: unknown = Reflect.get(globalThis, '__imageDragMetrics');
        if (typeof read !== 'function')
            throw new Error('Missing drag metrics.');
        return Reflect.apply(read, undefined, []) as {
            changes: number;
            intervals: number[];
        };
    });
    expect(metrics.changes).toBe(1);
    const sorted = metrics.intervals.slice(2).sort((a, b) => a - b);
    await testInfo.attach('image-drag-frame-timing', {
        body: JSON.stringify({
            changes: metrics.changes,
            frames: sorted.length,
            p95: sorted[Math.floor(sorted.length * 0.95)],
            max: sorted.at(-1),
        }),
        contentType: 'application/json',
    });
    await expect(image).toHaveAttribute('width', '320');
    await expect(image).toHaveAttribute('height', '120');
    await expect(visual.locator('figcaption')).toHaveText('Caption');
    expect(
        await page.evaluate(() => globalThis.__classicDemo.getData()),
    ).not.toContain('soeditor-');
    await page.keyboard.press('Control+z');
    await expect
        .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
        .toBe(source);
    await page.keyboard.press('Control+Shift+z');
    await expect(image).toHaveAttribute('width', '320');
    await page.evaluate(() =>
        globalThis.__classicDemo.editor.setWorkspaceView(
            'wysiwyg-source-horizontal',
        ),
    );
    await image.click();
    const splitImage = await image.boundingBox();
    const splitOverlay = await overlay.boundingBox();
    if (splitImage === null || splitOverlay === null)
        throw new Error('Missing split-view image.');
    expect(splitOverlay.x).toBeCloseTo(splitImage.x, 0);
    expect(splitOverlay.y).toBeCloseTo(splitImage.y, 0);
    await page
        .getByRole('button', { name: 'Insert paragraph after this block' })
        .click();
    await page.keyboard.type('Split paragraph');
    await expect(visual.locator('figure + p')).toHaveText('Split paragraph');
});

test('image resize cancels cleanly and handles keyboard, readonly and source replacement', async ({
    page,
}) => {
    const surface = page.locator('.soeditor-classic__visual');
    const visual = page.locator('.soeditor-wysiwyg-content');
    const source =
        '<p><img src="/demo-editor-cover.svg" width="400" height="150" alt="Cover"></p>';
    await page.evaluate(
        (html) => globalThis.__classicDemo.editor.setData(html),
        source,
    );
    await visual.locator('img').click();
    const handle = surface.locator('[data-resize-direction="se"]');
    const box = await handle.boundingBox();
    if (box === null) throw new Error('Missing resize handle.');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 60, box.y + 20, { steps: 8 });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    expect(await page.evaluate(() => globalThis.__classicDemo.getData())).toBe(
        source,
    );
    await expect(surface.locator('.is-resizing')).toHaveCount(0);
    await visual.locator('img').click();
    await handle.focus();
    await page.keyboard.press('Shift+ArrowRight');
    await expect(visual.locator('img')).toHaveAttribute('width', '410');
    await expect(visual.locator('img')).toHaveAttribute('height', '154');
    await page.evaluate(() =>
        globalThis.__classicDemo.editor.setReadonly(true),
    );
    await expect(surface.locator('.soeditor-image-resize-overlay')).toHaveCount(
        0,
    );
    await expect(surface.locator('.soeditor-block-paragraph')).toHaveCount(0);
    await page.evaluate(() =>
        globalThis.__classicDemo.editor.setReadonly(false),
    );
    await visual.locator('img').click();
    await expect(handle).toBeVisible();
    await page.evaluate(() =>
        globalThis.__classicDemo.editor.setData('<p>Replacement</p>'),
    );
    await expect(surface.locator('.soeditor-image-resize-overlay')).toHaveCount(
        0,
    );
    await expect(surface.locator('.soeditor-block-paragraph')).toHaveCount(0);
    await page.evaluate(() =>
        globalThis.__classicDemo.editor.setData(
            '<p><img src="/demo-editor-cover.svg" alt="Styled" style="width:400px;height:150px;border-radius:8px"></p>',
        ),
    );
    await visual.locator('img').click();
    await handle.focus();
    await page.keyboard.press('Shift+ArrowLeft');
    await expect(visual.locator('img')).toHaveCSS('width', '390px');
    await expect(visual.locator('img')).toHaveCSS('height', '146px');
    await expect(visual.locator('img')).toHaveCSS('border-radius', '8px');
});

test('image type-around inserts outside the caption and linked inline paragraph with one undo step', async ({
    page,
    browser,
    browserName,
}) => {
    const visual = page.locator('.soeditor-wysiwyg-content');
    const before = page.getByRole('button', {
        name: 'Insert paragraph before this block',
    });
    const after = page.getByRole('button', {
        name: 'Insert paragraph after this block',
    });
    const source =
        '<figure class="cms-photo" data-id="photo"><a href="/photo"><img src="/demo-editor-cover.svg" width="400" height="150" alt="Cover"></a><figcaption>Rich <strong>caption</strong></figcaption></figure>';
    await page.evaluate(
        (html) => globalThis.__classicDemo.editor.setData(html),
        source,
    );
    let resumeTools: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
        resumeTools = resolve;
    });
    await page.route(/classic-block-paragraph/u, async (route) => {
        await gate;
        await route.continue();
    });
    const loadedTools = page.waitForResponse(/classic-block-paragraph/u);
    await visual.locator('img').hover();
    const pendingFigure = await visual.locator('figure').boundingBox();
    if (pendingFigure === null) throw new Error('Missing pending figure.');
    await visual
        .locator('figure')
        .hover({ position: { x: pendingFigure.width - 2, y: 20 } });
    resumeTools?.();
    await (await loadedTools).finished();
    await page.evaluate(
        () =>
            new Promise<void>((resolve) =>
                requestAnimationFrame(() => resolve()),
            ),
    );
    await expect(page.locator('.soeditor-block-paragraph')).toHaveCount(0);
    await visual.locator('img').hover();
    await expect(page.locator('.soeditor-image-resize-overlay')).toHaveCount(0);
    const controls = page.locator('.soeditor-block-paragraph');
    await expect(controls).toHaveCSS('opacity', '1');
    expect(await page.evaluate(() => globalThis.__classicDemo.getData())).toBe(
        source,
    );
    await page.mouse.move(1, 1);
    expect(
        await controls.evaluate((node) => getComputedStyle(node).opacity),
    ).toBe('0');
    await expect(before).toHaveCSS('pointer-events', 'none');
    await before.focus();
    await expect(controls).toHaveCSS('opacity', '1');
    await visual.locator('img').click();
    const figure = visual.locator('figure');
    const figureBox = await figure.boundingBox();
    if (figureBox === null) throw new Error('Missing figure.');
    await figure.hover({ position: { x: figureBox.width - 2, y: 20 } });
    expect(
        await controls.evaluate((node) => getComputedStyle(node).opacity),
    ).toBe('0');
    await visual.locator('img').hover();
    await before.focus();
    await page.mouse.move(1, 1);
    expect(
        await controls.evaluate((node) => getComputedStyle(node).opacity),
    ).toBe('0');
    await page.keyboard.press('Tab');
    await expect(after).toBeFocused();
    await expect(controls).toHaveCSS('opacity', '1');
    await visual.locator('img').click();
    await before.hover();
    await expect(controls).toHaveCSS('opacity', '1');
    await before.click();
    await expect(visual.locator(':scope > p + figure')).toHaveCount(1);
    await page.keyboard.type('Before image');
    await expect(visual.locator(':scope > p')).toHaveText('Before image');
    await visual.locator('img').click();
    await after.focus();
    await page.keyboard.press('Enter');
    await expect(visual.locator(':scope > figure + p')).toHaveCount(1);
    await page.keyboard.type('After image');
    await expect(visual.locator(':scope > figure + p')).toHaveText(
        'After image',
    );
    await expect(visual.locator('figcaption')).toHaveText('Rich caption');
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+z');
    await expect(visual.locator(':scope > figure + p')).toHaveCount(0);
    await page.keyboard.press('Control+Shift+z');
    await expect(visual.locator(':scope > figure + p')).toHaveCount(1);
    const html = await page.evaluate(() => globalThis.__classicDemo.getData());
    expect(html).toContain('data-id="photo" class="cms-photo"');
    expect(html).toContain(
        '<figcaption>Rich <strong>caption</strong></figcaption>',
    );
    expect(html).not.toContain('soeditor-');
    // A resized inline image must anchor the controls, even when its block
    // also contains text or another image. Insertion still uses the block.
    await page.evaluate(() =>
        globalThis.__classicDemo.editor.setData(
            '<h2>Article <img src="/demo-editor-cover.svg" width="200" height="75" alt="First"> <img src="/demo-editor-cover.svg" width="120" height="60" alt="Second"></h2>',
        ),
    );
    const assertImageAnchor = async (index: number): Promise<void> => {
        await expect
            .poll(async () => {
                const [overlayBox, imageBox] = await Promise.all([
                    controls.boundingBox(),
                    visual.locator('img').nth(index).boundingBox(),
                ]);
                if (overlayBox === null || imageBox === null) return null;
                return (['x', 'y', 'width', 'height'] as const).map((axis) => {
                    return Math.round(
                        Math.abs(overlayBox[axis] - imageBox[axis]),
                    );
                });
            })
            .toEqual([0, 0, 0, 0]);
    };
    await visual.locator('img').first().click();
    await assertImageAnchor(0);
    const resizeHandle = page.locator('[data-resize-direction="se"]');
    await resizeHandle.focus();
    await resizeHandle.press('ArrowRight');
    await expect(visual.locator('img').first()).toHaveAttribute('width', '201');
    await resizeHandle.press('ArrowDown');
    await expect(visual.locator('img').first()).toHaveAttribute('height', '76');
    const resizeBox = await resizeHandle.boundingBox();
    if (resizeBox === null) throw new Error('Missing inline resize handle.');
    await page.mouse.move(
        resizeBox.x + resizeBox.width / 2,
        resizeBox.y + resizeBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(resizeBox.x + 45, resizeBox.y + 35, { steps: 5 });
    await page.mouse.up();
    await expect
        .poll(async () =>
            Number(await visual.locator('img').first().getAttribute('width')),
        )
        .toBeGreaterThan(201);
    await visual.locator('img').first().hover();
    await assertImageAnchor(0);
    await visual.locator('img').nth(1).hover();
    await assertImageAnchor(1);
    await after.click();
    await expect(visual.locator(':scope > h2 + p')).toHaveCount(1);
    await expect(visual.locator('h2 img')).toHaveCount(2);
    await page.keyboard.press('Control+z');
    await expect(visual.locator(':scope > h2 + p')).toHaveCount(0);
    await page.evaluate(() =>
        globalThis.__classicDemo.editor.setData(
            '<p>Lead <a href="/photo"><img src="/demo-editor-cover.svg" width="200" height="75" alt="Inline"></a> tail</p>',
        ),
    );
    await visual.locator('img').click();
    await after.click();
    await page.keyboard.type('New block');
    await expect(visual.locator(':scope > p')).toHaveText([
        'Lead  tail',
        'New block',
    ]);
    if (browserName === 'chromium') {
        const touchContext = await browser.newContext({
            hasTouch: true,
            isMobile: true,
        });
        try {
            const touchPage = await touchContext.newPage();
            await touchPage.goto(page.url());
            await touchPage.locator('body[data-ready="true"]').waitFor();
            await touchPage.evaluate(
                (html) => globalThis.__classicDemo.editor.setData(html),
                source,
            );
            const touchImage = touchPage.locator(
                '.soeditor-wysiwyg-content img',
            );
            await touchImage.tap();
            const touchControls = touchPage.locator(
                '.soeditor-block-paragraph',
            );
            await expect(touchControls).toHaveCSS('opacity', '1');
            await touchImage.hover();
            await touchPage.mouse.move(1, 1);
            expect(
                await touchControls.evaluate(
                    (node) => getComputedStyle(node).opacity,
                ),
            ).toBe('0');
        } finally {
            await touchContext.close();
        }
    }
});

test('table type-around inserts outside the table, preserves cells and supports undo and readonly', async ({
    page,
}) => {
    const visual = page.locator('.soeditor-wysiwyg-content');
    const source =
        '<table class="cms-table"><caption>Data</caption><tbody><tr><td>A</td><td>B</td></tr></tbody></table>';
    await page.evaluate(
        (html) => globalThis.__classicDemo.editor.setData(html),
        source,
    );
    await visual.locator('td').first().hover();
    const controls = page.locator('.soeditor-block-paragraph');
    await expect(controls).toHaveCSS('opacity', '1');
    const assertPlacement = async (): Promise<void> => {
        await expect
            .poll(async () => {
                const table = await visual
                    .locator('table')
                    .first()
                    .boundingBox();
                const before = await controls
                    .locator('[data-insert-paragraph="before"]')
                    .boundingBox();
                const after = await controls
                    .locator('[data-insert-paragraph="after"]')
                    .boundingBox();
                return (
                    table !== null &&
                    before !== null &&
                    after !== null &&
                    Math.abs(before.y + before.height - table.y) <= 1 &&
                    Math.abs(after.y - table.y - table.height) <= 1 &&
                    before.x >= table.x &&
                    after.x + after.width <= table.x + table.width
                );
            })
            .toBe(true);
    };
    const clickControl = async (side: 'before' | 'after'): Promise<void> => {
        await visual.locator('td').first().hover();
        const button = controls.locator(`[data-insert-paragraph="${side}"]`);
        const box = await button.boundingBox();
        if (box === null) throw new Error('Missing paragraph control.');
        // Cross the circular button's transparent corner slowly, as a real pointer does.
        await page.mouse.move(box.x + 1, box.y + box.height - 1, { steps: 20 });
        await page.waitForTimeout(150);
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
            steps: 10,
        });
        await expect(controls).toHaveCSS('opacity', '1');
        await expect(button).toHaveCSS('pointer-events', 'auto');
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    };
    await assertPlacement();
    for (const zoom of ['0.8', '1.25', '1']) {
        await page.locator('.soeditor-classic').evaluate((host, zoom) => {
            host.style.zoom = zoom;
        }, zoom);
        await assertPlacement();
    }
    expect(await page.evaluate(() => globalThis.__classicDemo.getData())).toBe(
        source,
    );
    for (const view of [
        'wysiwyg-source-horizontal',
        'wysiwyg-source-vertical',
        'wysiwyg',
    ] as const) {
        await page.evaluate(
            (view) => globalThis.__classicDemo.editor.setWorkspaceView(view),
            view,
        );
        await visual.locator('td').first().hover();
        await assertPlacement();
    }
    const visualHost = page.locator('.soeditor-classic__visual');
    await visualHost.evaluate((host) => {
        host.style.height = '200px';
        host.style.overflow = 'auto';
    });
    await visual.evaluate((content) => {
        content.style.paddingTop = '80px';
        content.style.minHeight = '800px';
    });
    await visual.locator('td').first().hover();
    await assertPlacement();
    await visualHost.evaluate((host) => {
        host.scrollTop = 40;
    });
    await expect
        .poll(() => visualHost.evaluate((host) => host.scrollTop))
        .toBe(40);
    await assertPlacement();
    await visualHost.evaluate((host) => {
        host.scrollTop = 0;
        host.style.removeProperty('height');
        host.style.removeProperty('overflow');
    });
    await visual.evaluate((content) => {
        content.style.removeProperty('padding-top');
        content.style.removeProperty('min-height');
    });
    await assertPlacement();
    await page.mouse.move(1, 1);
    expect(
        await controls.evaluate((node) => getComputedStyle(node).opacity),
    ).toBe('0');
    await visual.locator('td').last().hover();
    await expect(controls).toHaveCSS('opacity', '1');
    await visual.locator('td').first().hover();
    await expect(controls).toHaveCSS('opacity', '1');
    await clickControl('before');
    await page.keyboard.type('Before table');
    await expect(visual.locator(':scope > p + table')).toHaveCount(1);
    await expect(visual.locator(':scope > p')).toHaveText('Before table');
    await visual.locator('td').last().click();
    await clickControl('after');
    await page.keyboard.type('After table');
    await expect(visual.locator(':scope > table + p')).toHaveText(
        'After table',
    );
    await expect(visual.locator('td')).toHaveText(['A', 'B']);
    expect(
        await page.evaluate(() => globalThis.__classicDemo.getData()),
    ).toContain(source);
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+z');
    await expect(visual.locator(':scope > table + p')).toHaveCount(0);
    await page.keyboard.press('Control+Shift+z');
    await expect(visual.locator(':scope > table + p')).toHaveCount(1);
    await visual.locator('td').first().click();
    await page.evaluate(() =>
        globalThis.__classicDemo.editor.setReadonly(true),
    );
    await expect(page.locator('.soeditor-block-paragraph')).toHaveCount(0);
    await page.evaluate(() => {
        globalThis.__classicDemo.editor.setReadonly(false);
        globalThis.__classicDemo.editor.setData(
            '<table><tbody><tr><td><p><img src="/demo-editor-cover.svg" width="200" height="75" alt="Cell image"></p></td></tr></tbody></table>',
        );
    });
    await visual.locator('img').click();
    await expect(page.locator('.soeditor-block-paragraph')).toHaveCount(1);
    await expect(page.locator('.soeditor-block-paragraph')).toHaveAttribute(
        'data-block-kind',
        'image',
    );
    await page
        .getByRole('button', { name: 'Insert paragraph after this block' })
        .click();
    await page.keyboard.type('Inside cell');
    await expect(visual.locator('td > p').last()).toHaveText('Inside cell');
    await expect(visual.locator(':scope > p')).toHaveCount(0);
});

test('keeps Source selection and find state through repeated external history updates', async ({
    page,
}) => {
    for (const padding of ['', `<!--${'x'.repeat(70_000)}-->`]) {
        await page.evaluate(async (padding) => {
            const classic = globalThis.__classicDemo.editor;
            classic.setData('<p>Alpha Beta</p>' + padding);
            await classic.setWorkspaceView('source');
        }, padding);
        const content = page.locator('.soeditor-classic__source .cm-content');
        await content.click();
        await page.keyboard.press('ControlOrMeta+f');
        const find = page.locator('.cm-search input[name="search"]');
        await find.fill('Alpha');
        await content.click();
        await page.keyboard.press('ControlOrMeta+Home');
        for (let index = 0; index < 9; index += 1)
            await page.keyboard.press('ArrowRight');
        for (let index = 0; index < 4; index += 1)
            await page.keyboard.press('Shift+ArrowRight');
        await expect
            .poll(() =>
                page.evaluate(() => globalThis.getSelection()?.toString()),
            )
            .toBe('Beta');
        for (let index = 1; index <= 12; index += 1) {
            const html = `<p>${'P'.repeat(index)}Alpha Beta</p>${padding}`;
            await page.evaluate(
                (html) => globalThis.__classicDemo.editor.setData(html),
                html,
            );
            await expect
                .poll(() =>
                    page.evaluate(() => globalThis.getSelection()?.toString()),
                )
                .toBe('Beta');
            await page.evaluate(async () => {
                const editor = globalThis.__classicDemo.editor.editor;
                await editor.execute('editor.undo');
                await editor.execute('editor.redo');
            });
            await expect(content).toContainText(
                `${'P'.repeat(index)}Alpha Beta`,
            );
            expect(
                await page.evaluate(() => globalThis.__classicDemo.getData()),
            ).toBe(html);
            await expect
                .poll(() =>
                    page.evaluate(() => globalThis.getSelection()?.toString()),
                )
                .toBe('Beta');
            await expect(find).toHaveValue('Alpha');
        }
    }
});

test('counts semantic body text without source indentation or hidden content', async ({
    page,
}) => {
    const status = page.locator('.soeditor-ui__document-status');
    const cases = [
        { html: '<p>Hello</p>\n  <p>world</p>', words: 2, characters: 10 },
        {
            html: '<p>Hello <strong>world</strong></p>',
            words: 2,
            characters: 11,
        },
        { html: '<p>Hello<br>world</p>', words: 2, characters: 10 },
        {
            html: '<table><tr><td>A</td><td>B</td></tr></table>',
            words: 2,
            characters: 2,
        },
        { html: '<p>A&nbsp;&nbsp;B</p>', words: 2, characters: 4 },
        { html: '<pre> A\n  B </pre>', words: 2, characters: 7 },
        { html: '<p>Hello世界</p>', words: 3, characters: 7 },
        {
            html: '<p>Visible<span hidden>secret</span></p><script>secret()</script><style>secret{}</style><template>secret</template><p style="display:none">secret</p><p style="visibility:hidden">secret</p><!--secret-->',
            words: 1,
            characters: 7,
        },
    ];
    for (const { html, words, characters } of cases) {
        await page.evaluate(
            (html) => globalThis.__classicDemo.editor.setData(html),
            html,
        );
        await expect(status).toHaveAttribute('data-words', String(words));
        await expect(status).toHaveAttribute(
            'data-characters',
            String(characters),
        );
        await expect(status).toHaveAttribute(
            'data-source-characters',
            String(html.length),
        );
        expect(
            await page.evaluate(() => globalThis.__classicDemo.getData()),
        ).toBe(html);
    }
    await page.evaluate(() =>
        globalThis.__classicDemo.editor.setData('<p>Delete all text</p>'),
    );
    await page.locator('.soeditor-classic__visual p').click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.press('Backspace');
    await expect(status).toHaveAttribute('data-words', '0');
    await expect(status).toHaveAttribute('data-characters', '0');
    await page.evaluate(async () =>
        globalThis.__classicDemo.editor.setWorkspaceView(
            'wysiwyg-source-vertical',
        ),
    );
    await expect(status).toHaveAttribute('data-characters', '0');
});

test('keeps the declared Classic toolbar controls present and localized', async ({
    page,
}) => {
    const toolbar = page.locator('.soeditor-ui__toolbar');
    const expected = [
        'heading',
        'fontFamily',
        'fontSize',
        'bold',
        'italic',
        'underline',
        'fontColor',
        'fontBackgroundColor',
        'highlight',
        'strike',
        'subscript',
        'superscript',
        'removeFormat',
        'alignment',
        'orderedList',
        'unorderedList',
        'outdent',
        'indent',
        'blockquote',
        'link',
        'unlink',
        'link-internal',
        'file-link',
        'image-actions',
        'table',
        'horizontalRule',
        'anchor',
        'showBlocks',
        'format',
        'minify',
        'popupPreview',
    ];
    for (const item of expected) {
        const control = toolbar.locator(`[data-toolbar-item="${item}"]`);
        await expect(control).toHaveCount(1);
        if (item !== 'format' && item !== 'minify') {
            await expect(control).toBeVisible();
        }
        const button = control.locator('button, summary').first();
        const target = (await control.evaluate((el) =>
            el.matches('button, summary'),
        ))
            ? control
            : button;
        await expect(target).toHaveAttribute('aria-label', /\S/u);
    }
    const blocks = toolbar.locator('[data-classic-action="show-blocks"]');
    await blocks.focus();
    await page.keyboard.press('Enter');
    await expect(blocks).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Enter');
    await expect(blocks).toHaveAttribute('aria-pressed', 'false');
    await page.evaluate(async () => {
        const host = document.createElement('textarea');
        host.id = 'drawer-configuration';
        document.body.append(host);
        const editor = await globalThis.__classicDemo.create(host, {
            data: '<p>Drawer text</p>',
            locale: 'zh-CN',
            toolbar: [
                'bold',
                {
                    id: 'extraActions',
                    label: '其他工具',
                    items: ['strike', 'link', 'horizontalRule'],
                },
            ],
        });
        host.addEventListener('test:readonly', () => editor.setReadonly(true));
        host.addEventListener('test:destroy', () => {
            void editor.destroy();
        });
    });
    const custom = page.locator('.soeditor-classic').last();
    const drawer = custom.locator('[data-toolbar-item="extraActions"]');
    const summary = drawer.locator('summary');
    await expect(summary).toHaveAccessibleName('其他工具');
    await expect(custom.locator('[data-toolbar-item="bold"] svg')).toHaveCount(
        1,
    );
    await custom.locator('.soeditor-wysiwyg-content p').click();
    await page.keyboard.press('ControlOrMeta+a');
    // Transfer focus in the same task as selection, before selectionchange fires.
    await custom.evaluate((host) => {
        const surface = host
            .querySelector('.soeditor-classic__visual')
            ?.shadowRoot?.querySelector<HTMLElement>(
                '.soeditor-wysiwyg-content',
            );
        if (surface === null || surface === undefined)
            throw new Error('Missing editing surface');
        surface.focus();
        const range = document.createRange();
        range.selectNodeContents(surface.querySelector('p')!);
        const selection = document.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        host.querySelector<HTMLElement>(
            '[data-toolbar-item="extraActions"] summary',
        )!.focus();
    });
    await page.keyboard.press('ArrowDown');
    const strike = drawer.locator('[data-toolbar-item="strike"]');
    await expect(strike).toBeFocused();
    await expect(strike).toHaveText('删除线');
    await page.keyboard.press('Enter');
    await expect(drawer).not.toHaveAttribute('open');
    await expect(custom.locator('s')).toHaveText('Drawer text');
    // Read active state at an explicit caret inside the newly formatted text.
    await custom.locator('s').click();
    await summary.click();
    await expect(strike).toHaveAttribute('aria-pressed', 'true');
    await drawer.locator('[data-toolbar-item="link"]').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page
        .locator('#drawer-configuration')
        .evaluate((host) => host.dispatchEvent(new Event('test:readonly')));
    await expect(summary).toHaveAttribute('aria-disabled', 'true');
    await page
        .locator('#drawer-configuration')
        .evaluate((host) => host.dispatchEvent(new Event('test:destroy')));
    await expect(drawer).toHaveCount(0);
    await page.goto('/classic.html');
    await page.locator('body[data-ready="true"]').waitFor();
    await expect(
        page.locator('[data-classic-action="show-blocks"]'),
    ).toHaveAccessibleName('显示区块边界');
});
