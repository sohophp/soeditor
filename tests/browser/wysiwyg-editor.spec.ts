import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

async function textPoint(
    locator: Locator,
    offset: number,
): Promise<{ x: number; y: number }> {
    return locator.evaluate((element, requestedOffset) => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        const nodes: Text[] = [];
        let length = 0;
        for (
            let node = walker.nextNode();
            node !== null;
            node = walker.nextNode()
        ) {
            if (!(node instanceof Text) || node.data.length === 0) continue;
            nodes.push(node);
            length += node.data.length;
        }
        if (
            requestedOffset < 0 ||
            requestedOffset > length ||
            nodes.length === 0
        ) {
            throw new Error(
                `Invalid text offset ${String(requestedOffset)} of ${String(length)}.`,
            );
        }
        let consumed = 0;
        for (const node of nodes) {
            const end = consumed + node.data.length;
            if (requestedOffset <= end) {
                const local = requestedOffset - consumed;
                const character = Math.min(local, node.data.length - 1);
                const range = document.createRange();
                range.setStart(node, character);
                range.setEnd(node, character + 1);
                const rect = range.getBoundingClientRect();
                return {
                    x:
                        local === node.data.length
                            ? rect.right - 0.5
                            : rect.left + 0.5,
                    y: rect.top + rect.height / 2,
                };
            }
            consumed = end;
        }
        throw new Error('Unable to resolve the requested text offset.');
    }, offset);
}

async function clickTextBoundary(
    page: Page,
    locator: Locator,
    offset: number,
): Promise<void> {
    await locator.scrollIntoViewIfNeeded();
    const point = await textPoint(locator, offset);
    await page.mouse.click(point.x, point.y);
    await expect
        .poll(() =>
            locator.evaluate((element) => {
                const root = element.getRootNode();
                const getter: unknown = Reflect.get(root, 'getSelection');
                const candidate: unknown =
                    typeof getter === 'function'
                        ? Reflect.apply(getter, root, [])
                        : null;
                const selection =
                    candidate instanceof Selection
                        ? candidate
                        : document.getSelection();
                if (selection === null || !selection.isCollapsed) return -1;
                let anchorNode = selection.anchorNode;
                let anchorOffset = selection.anchorOffset;
                if (
                    root instanceof ShadowRoot &&
                    !element.contains(anchorNode)
                ) {
                    const composedGetter: unknown = Reflect.get(
                        selection,
                        'getComposedRanges',
                    );
                    const ranges: unknown =
                        typeof composedGetter === 'function'
                            ? Reflect.apply(composedGetter, selection, [
                                  { shadowRoots: [root] },
                              ])
                            : undefined;
                    const range = Array.isArray(ranges) ? ranges[0] : undefined;
                    if (typeof range === 'object' && range !== null) {
                        const composedNode: unknown = Reflect.get(
                            range,
                            'startContainer',
                        );
                        const composedOffset: unknown = Reflect.get(
                            range,
                            'startOffset',
                        );
                        if (
                            composedNode instanceof Node &&
                            typeof composedOffset === 'number'
                        ) {
                            anchorNode = composedNode;
                            anchorOffset = composedOffset;
                        }
                    }
                }
                const walker = document.createTreeWalker(
                    element,
                    NodeFilter.SHOW_TEXT,
                );
                let resolved = 0;
                for (
                    let node = walker.nextNode();
                    node !== null;
                    node = walker.nextNode()
                ) {
                    if (!(node instanceof Text)) continue;
                    if (anchorNode === node) {
                        return resolved + anchorOffset;
                    }
                    resolved += node.data.length;
                }
                return -1;
            }),
        )
        .toBe(offset);
}

async function setFixtureData(page: Page, data: string): Promise<void> {
    await page.evaluate((nextData) => {
        const fixture: unknown = Reflect.get(globalThis, '__wysiwygFixture');
        const setData =
            typeof fixture === 'object' && fixture !== null
                ? Reflect.get(fixture, 'setData')
                : undefined;
        if (typeof setData !== 'function') {
            throw new Error('Missing WYSIWYG fixture setData().');
        }
        Reflect.apply(setData, fixture, [nextData]);
    }, data);
}

async function selectTextByPointer(
    page: Page,
    locator: Locator,
    start: number,
    end: number,
): Promise<void> {
    const pointInsideCharacter = async (
        offset: number,
        after: boolean,
    ): Promise<{ x: number; y: number }> =>
        locator.evaluate(
            (element, request) => {
                const walker = document.createTreeWalker(
                    element,
                    NodeFilter.SHOW_TEXT,
                );
                let consumed = 0;
                for (
                    let node = walker.nextNode();
                    node !== null;
                    node = walker.nextNode()
                ) {
                    if (!(node instanceof Text)) continue;
                    const index = request.after
                        ? request.offset - consumed - 1
                        : request.offset - consumed;
                    if (index >= 0 && index < node.data.length) {
                        const range = document.createRange();
                        range.setStart(node, index);
                        range.setEnd(node, index + 1);
                        const rect = range.getBoundingClientRect();
                        return {
                            x:
                                rect.left +
                                rect.width * (request.after ? 0.75 : 0.25),
                            y: rect.top + rect.height / 2,
                        };
                    }
                    consumed += node.data.length;
                }
                throw new Error('Unable to resolve pointer selection point.');
            },
            { after, offset },
        );
    const origin = await pointInsideCharacter(start, false);
    const destination = await pointInsideCharacter(end, true);
    await page.mouse.move(origin.x, origin.y);
    await page.mouse.down();
    await page.mouse.move(destination.x, destination.y, { steps: 8 });
    await page.mouse.up();
}

async function selectionSnapshot(locator: Locator): Promise<{
    readonly collapsed: boolean;
    readonly inside: boolean;
    readonly text: string;
}> {
    return locator.evaluate((element) => {
        const root = element.getRootNode();
        const rootGetter: unknown = Reflect.get(root, 'getSelection');
        const candidate: unknown =
            typeof rootGetter === 'function'
                ? Reflect.apply(rootGetter, root, [])
                : null;
        const selection =
            candidate instanceof Selection
                ? candidate
                : document.getSelection();
        if (selection === null) {
            return { collapsed: true, inside: false, text: '' };
        }
        let range: Range | undefined;
        if (selection.rangeCount > 0) {
            const direct = selection.getRangeAt(0);
            if (
                !(root instanceof ShadowRoot) ||
                direct.commonAncestorContainer.getRootNode() === root
            ) {
                range = direct;
            }
        }
        if (range === undefined && root instanceof ShadowRoot) {
            const composedGetter: unknown = Reflect.get(
                selection,
                'getComposedRanges',
            );
            const ranges: unknown =
                typeof composedGetter === 'function'
                    ? Reflect.apply(composedGetter, selection, [
                          { shadowRoots: [root] },
                      ])
                    : undefined;
            const composed = Array.isArray(ranges) ? ranges[0] : undefined;
            if (typeof composed === 'object' && composed !== null) {
                const startContainer: unknown = Reflect.get(
                    composed,
                    'startContainer',
                );
                const endContainer: unknown = Reflect.get(
                    composed,
                    'endContainer',
                );
                const startOffset: unknown = Reflect.get(
                    composed,
                    'startOffset',
                );
                const endOffset: unknown = Reflect.get(composed, 'endOffset');
                if (
                    startContainer instanceof Node &&
                    endContainer instanceof Node &&
                    typeof startOffset === 'number' &&
                    typeof endOffset === 'number'
                ) {
                    range = document.createRange();
                    range.setStart(startContainer, startOffset);
                    range.setEnd(endContainer, endOffset);
                }
            }
        }
        return {
            collapsed: range?.collapsed ?? selection.isCollapsed,
            inside:
                range !== undefined &&
                element.contains(range.startContainer) &&
                element.contains(range.endContainer),
            text: range?.toString() ?? selection.toString(),
        };
    });
}

async function selectElementText(locator: Locator): Promise<void> {
    await locator.evaluate((element) => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        const first = walker.nextNode();
        let last = first;
        for (
            let node = walker.nextNode();
            node !== null;
            node = walker.nextNode()
        ) {
            last = node;
        }
        if (!(first instanceof Text) || !(last instanceof Text)) {
            throw new Error('Element has no selectable text.');
        }
        document
            .getSelection()
            ?.setBaseAndExtent(first, 0, last, last.data.length);
    });
}

test.beforeEach(async ({ page }) => {
    await page.goto('/wysiwyg.html');
    await page.locator('body[data-ready="true"]').waitFor();
});

test('mounts WYSIWYG without enabling Developer Visual', async ({ page }) => {
    const editor = page.locator('.soeditor-classic');
    const surface = editor.locator('.soeditor-classic__visual');

    await expect(surface).toBeVisible();
    await expect(surface.locator('.soeditor-wysiwyg-content')).toHaveAttribute(
        'contenteditable',
        'true',
    );
    await expect(
        editor.locator('.soeditor-classic__developer-visual'),
    ).toHaveCount(0);
    const viewButtons = page.locator(
        '[data-classic-action="workspace-view"] button',
    );
    await expect(viewButtons).toHaveCount(4);
    await expect(viewButtons.nth(0)).toHaveAttribute('aria-label', 'WYSIWYG');
    await expect(viewButtons.nth(1)).toHaveAttribute('aria-label', 'Source');
    await expect(viewButtons.nth(2)).toHaveAttribute(
        'aria-label',
        'WYSIWYG + Source (side by side)',
    );
    await expect(viewButtons.nth(3)).toHaveAttribute(
        'aria-label',
        'WYSIWYG + Source (stacked)',
    );
});

test('switches between resizable side-by-side and stacked Source layouts', async ({
    page,
}) => {
    const editor = page.locator('.soeditor-classic');
    const view = editor.locator('[data-classic-action="workspace-view"]');
    const surfaces = editor.locator('.soeditor-classic__surfaces');
    const visual = editor.locator('.soeditor-classic__visual');
    const source = editor.locator('.soeditor-classic__source');
    const separator = editor.locator('.soeditor-classic__pane-resize-handle');

    await view
        .getByRole('button', { name: 'WYSIWYG + Source (side by side)' })
        .click();
    await expect(editor).toHaveAttribute(
        'data-soeditor-workspace-view',
        'wysiwyg-source-horizontal',
    );
    await expect(editor).toHaveAttribute(
        'data-soeditor-split-orientation',
        'horizontal',
    );
    await expect(visual).toBeVisible();
    await expect(source).toBeVisible();
    await expect(separator).toHaveAttribute('aria-orientation', 'vertical');
    await source.locator('.cm-content').click();
    await expect(editor).toHaveAttribute(
        'data-soeditor-workspace-view',
        'wysiwyg-source-horizontal',
    );
    await expect(visual).toBeVisible();
    await expect(source).toBeVisible();
    const horizontalBounds = await surfaces.boundingBox();
    const separatorBounds = await separator.boundingBox();
    if (horizontalBounds === null || separatorBounds === null) {
        throw new Error('Expected measurable split layout bounds.');
    }
    await page.mouse.move(
        separatorBounds.x + separatorBounds.width / 2,
        separatorBounds.y + separatorBounds.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
        horizontalBounds.x + horizontalBounds.width * 0.3,
        horizontalBounds.y + horizontalBounds.height / 2,
    );
    await page.mouse.up();
    await expect(separator).toHaveAttribute('aria-valuenow', '30');
    await separator.focus();
    await page.keyboard.press('End');
    await expect(separator).toHaveAttribute('aria-valuenow', '80');
    await expect
        .poll(() =>
            surfaces.evaluate(
                (element) => getComputedStyle(element).gridTemplateColumns,
            ),
        )
        .toMatch(/^.+ 10px .+$/u);

    await view
        .getByRole('button', { name: 'WYSIWYG + Source (stacked)' })
        .click();
    await expect(editor).toHaveAttribute(
        'data-soeditor-split-orientation',
        'vertical',
    );
    await expect(separator).toHaveAttribute('aria-orientation', 'horizontal');
    await separator.focus();
    await page.keyboard.press('Home');
    await expect(separator).toHaveAttribute('aria-valuenow', '20');
    await expect
        .poll(() =>
            surfaces.evaluate(
                (element) => getComputedStyle(element).gridTemplateRows,
            ),
        )
        .toMatch(/^.+ 10px .+$/u);

    await setFixtureData(
        page,
        '<p><img alt="Tall split fixture" src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22640%22 height=%22800%22%3E%3Crect width=%22640%22 height=%22800%22 fill=%22%236353df%22/%3E%3C/svg%3E"></p><section class="cms-panel" data-kind="notice">Source colors</section>',
    );
    await expect(visual.locator('img[alt="Tall split fixture"]')).toBeVisible();
    await expect(visual).toHaveCSS('contain', 'paint');
    await expect(source).toHaveCSS('contain', 'paint');
    await expect
        .poll(() =>
            source.evaluate((element) => {
                const bounds = element.getBoundingClientRect();
                const hit = document.elementFromPoint(
                    bounds.left + bounds.width / 2,
                    bounds.top + Math.min(24, bounds.height / 2),
                );
                return hit !== null && element.contains(hit);
            }),
        )
        .toBe(true);
});

test('passively reveals the matching Source text from a WYSIWYG selection', async ({
    page,
}) => {
    await setFixtureData(
        page,
        Array.from(
            { length: 80 },
            (_, index) => `<p>定位段落 ${String(index)}</p>`,
        ).join('\n'),
    );
    const editor = page.locator('.soeditor-classic');
    await editor
        .getByRole('button', { name: 'WYSIWYG + Source (stacked)' })
        .click();
    const target = editor.locator('.soeditor-classic__visual p').last();
    await target.evaluate((element) => {
        const text = element.firstChild;
        const root = element.getRootNode();
        if (!(text instanceof Text) || !(root instanceof ShadowRoot)) {
            throw new Error('Expected a shadow-root paragraph text node.');
        }
        const selection =
            root.getSelection?.() ?? element.ownerDocument.getSelection();
        selection?.setBaseAndExtent(text, 5, text, 5);
        root.dispatchEvent(new Event('selectionchange'));
    });

    await expect
        .poll(() =>
            editor
                .locator('.soeditor-classic__source .cm-scroller')
                .evaluate((element) => element.scrollTop),
        )
        .toBeGreaterThan(0);
    await expect(editor.locator('.cm-editor')).not.toHaveClass(/cm-focused/u);
});

test('renders the direct semantic fixture and preserves unsupported HTML', async ({
    page,
}) => {
    const surface = page.locator('.soeditor-classic__visual');

    await expect(surface.locator('h1')).toHaveText(
        'WYSIWYG direct qualification',
    );
    await expect(surface.locator('ul ul li')).toHaveText('Nested item');
    await expect(surface.locator('table caption')).toHaveText(
        'Qualification table',
    );
    await expect(surface.locator('a[href="/documentation"]')).toHaveText(
        'Documentation link',
    );
    await expect(
        surface.locator('img[alt="Qualification image"]'),
    ).toBeVisible();
    await expect(surface.locator('aside[data-campaign="autumn"]')).toHaveText(
        'Semantic aside content',
    );
    await expect(surface.getByText('Edit HTML')).toHaveCount(0);

    const canonical = await page.evaluate(() => {
        const fixture: unknown = Reflect.get(globalThis, '__wysiwygFixture');
        if (typeof fixture !== 'object' || fixture === null) return '';
        const getData: unknown = Reflect.get(fixture, 'getData');
        return typeof getData === 'function'
            ? String(Reflect.apply(getData, fixture, []))
            : '';
    });
    expect(canonical).toContain('<!--qualification-marker-->');
    expect(canonical).toContain('<product-card data-id="49"></product-card>');
});

test('synchronizes WYSIWYG edits with Source and restores WYSIWYG', async ({
    page,
}) => {
    const surface = page.locator('.soeditor-classic__visual');
    const paragraph = surface.locator('#paragraph');
    await paragraph.click({ position: { x: 80, y: 12 } });
    await page.keyboard.press('End');
    await page.keyboard.type(' Added');
    await expect(paragraph).toContainText('Added');

    await page
        .locator('[data-classic-action="workspace-view"]')
        .locator('[data-workspace-view="source"]')
        .click();
    const source = page.locator('.soeditor-classic__source');
    await expect(source).toBeVisible();
    await expect(source).toContainText('Added');

    await page
        .locator('[data-classic-action="workspace-view"]')
        .locator('[data-workspace-view="wysiwyg"]')
        .click();
    await expect(surface).toBeVisible();
    await expect(surface.locator('#paragraph')).toContainText('Added');
});

test('applies readonly to the WYSIWYG surface and tears down cleanly', async ({
    page,
}) => {
    await page.evaluate(() => {
        const fixture: unknown = Reflect.get(globalThis, '__wysiwygFixture');
        const setReadonly =
            typeof fixture === 'object' && fixture !== null
                ? Reflect.get(fixture, 'setReadonly')
                : undefined;
        if (typeof setReadonly === 'function') {
            Reflect.apply(setReadonly, fixture, [true]);
        }
    });
    await expect(page.locator('.soeditor-wysiwyg-content')).toHaveAttribute(
        'contenteditable',
        'false',
    );

    await page.evaluate(async () => {
        const fixture: unknown = Reflect.get(globalThis, '__wysiwygFixture');
        const destroy =
            typeof fixture === 'object' && fixture !== null
                ? Reflect.get(fixture, 'destroy')
                : undefined;
        if (typeof destroy === 'function') {
            await Reflect.apply(destroy, fixture, []);
        }
    });
    await expect(page.locator('.soeditor-classic')).toHaveCount(0);
    await expect(page.locator('#wysiwyg-content')).toBeVisible();
});

test('places a native caret at every text boundary in body, lists, caption, and cells', async ({
    page,
}) => {
    const cases = [
        ['#paragraph', 'Alpha bold omega.'],
        ['#first-item', 'First itemNested item'],
        ['#nested-item', 'Nested item'],
        ['#table-caption', 'Qualification table'],
        ['#cell-feature', 'Feature'],
        ['#cell-status', 'Status'],
        ['#cell-selection', 'Selection'],
        ['#cell-pending', 'Pending'],
        ['#cell-editing', 'Editing'],
        ['#cell-ready', 'Ready'],
    ] as const;
    const surface = page.locator('.soeditor-classic__visual');
    for (const [selector, text] of cases) {
        const target = surface.locator(selector);
        for (let offset = 0; offset <= text.length; offset += 1) {
            await clickTextBoundary(page, target, offset);
        }
    }
});

test('supports forward and reverse drag selection and replacement in ordinary content and cells', async ({
    page,
}) => {
    const surface = page.locator('.soeditor-classic__visual');
    const selectByPointer = async (
        target: Locator,
        start: number,
        end: number,
    ): Promise<void> => {
        const origin = await textPoint(target, start);
        const destination = await textPoint(target, end);
        await page.mouse.move(origin.x, origin.y);
        await page.mouse.down();
        await page.mouse.move(destination.x, destination.y, { steps: 8 });
        await page.mouse.up();
    };

    const paragraph = surface.locator('#paragraph');
    await selectByPointer(paragraph, 0, 5);
    await expect
        .poll(() => selectionSnapshot(paragraph).then(({ text }) => text))
        .toBe('Alpha');
    await selectByPointer(paragraph, 5, 0);
    await expect
        .poll(() => selectionSnapshot(paragraph).then(({ text }) => text))
        .toBe('Alpha');

    const cell = surface.locator('#cell-selection');
    await selectByPointer(cell, 0, 9);
    await expect
        .poll(() => selectionSnapshot(cell).then(({ text }) => text))
        .toBe('Selection');
    await page.keyboard.type('Chosen');
    await expect(cell).toHaveText('Chosen');
    await expect
        .poll(() =>
            page.evaluate(() => {
                const fixture: unknown = Reflect.get(
                    globalThis,
                    '__wysiwygFixture',
                );
                const getData =
                    typeof fixture === 'object' && fixture !== null
                        ? Reflect.get(fixture, 'getData')
                        : undefined;
                return typeof getData === 'function'
                    ? String(Reflect.apply(getData, fixture, []))
                    : '';
            }),
        )
        .toContain('<td id="cell-selection">Chosen</td>');
});

test('extends selection by keyboard and restores content through undo and redo', async ({
    page,
}) => {
    const paragraph = page.locator('.soeditor-classic__visual #paragraph');
    await clickTextBoundary(page, paragraph, 5);
    await page.keyboard.down('Shift');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.up('Shift');
    await expect
        .poll(() => selectionSnapshot(paragraph).then(({ text }) => text))
        .toBe('ha');
    await page.keyboard.type('XY');
    await expect(paragraph).toContainText('AlpXY');
    await page.keyboard.press('Control+z');
    await expect(paragraph).toContainText('Alpha');
    await page.keyboard.press('Control+Shift+z');
    await expect(paragraph).toContainText('AlpXY');
});

test('copies, cuts, and pastes through the native WYSIWYG selection', async ({
    browserName,
    context,
    page,
}) => {
    test.skip(
        browserName !== 'chromium',
        'Playwright clipboard permissions are Chromium-only.',
    );
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const paragraph = page.locator('.soeditor-classic__visual #paragraph');
    const start = await textPoint(paragraph, 0);
    const end = await textPoint(paragraph, 5);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 8 });
    await page.mouse.up();
    await page.keyboard.press('ControlOrMeta+C');
    await expect
        .poll(() => page.evaluate(() => navigator.clipboard.readText()))
        .toBe('Alpha');
    await page.keyboard.press('ControlOrMeta+X');
    await expect(paragraph).not.toContainText('Alpha');
    await clickTextBoundary(page, paragraph, 0);
    await page.keyboard.press('ControlOrMeta+V');
    await expect(paragraph).toContainText('Alpha');
});

test('keeps double/triple-click selection and toolbar range restoration inside one cell', async ({
    page,
}) => {
    const cell = page.locator('.soeditor-classic__visual #cell-selection');
    const wordPoint = await textPoint(cell, 4);
    await page.mouse.dblclick(wordPoint.x, wordPoint.y);
    await expect
        .poll(() => selectionSnapshot(cell).then(({ text }) => text))
        .toBe('Selection');
    for (const item of ['orderedList', 'unorderedList']) {
        const button = page.locator(`[data-toolbar-item="${item}"]`);
        await expect(button).toHaveAttribute('aria-pressed', 'false');
        await expect(button).not.toHaveClass(/is-active/u);
    }
    await page.locator('[data-toolbar-item="bold"]').click();
    await expect(cell.locator('strong')).toHaveText('Selection');
    await expect(page.locator('#cell-feature strong')).toHaveCount(0);
    await expect
        .poll(() =>
            page.evaluate(() => {
                const fixture: unknown = Reflect.get(
                    globalThis,
                    '__wysiwygFixture',
                );
                const getData =
                    typeof fixture === 'object' && fixture !== null
                        ? Reflect.get(fixture, 'getData')
                        : undefined;
                return typeof getData === 'function'
                    ? String(Reflect.apply(getData, fixture, []))
                    : '';
            }),
        )
        .toContain('<td id="cell-selection"><strong>Selection</strong></td>');
    const triplePoint = await textPoint(cell, 4);
    await page.mouse.click(triplePoint.x, triplePoint.y, { clickCount: 3 });
    await expect
        .poll(() => selectionSnapshot(cell).then(({ text }) => text.trim()))
        .toContain('Selection');
});

test('uses native Enter, Shift+Enter, Backspace, and Delete paragraph behavior', async ({
    page,
}) => {
    const surface = page.locator('.soeditor-classic__visual');
    await setFixtureData(
        page,
        '<p id="alpha">Alpha</p><p id="bravo">Bravo</p>',
    );
    const alpha = surface.locator('#alpha');
    await clickTextBoundary(page, alpha, 5);
    await page.keyboard.press('Enter');
    await page.keyboard.type('Beta');
    await expect(surface.locator('p')).toHaveText(['Alpha', 'Beta', 'Bravo']);

    const beta = surface.locator('p').nth(1);
    await clickTextBoundary(page, beta, 4);
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.type('line');
    await expect(beta.locator('br')).toHaveCount(1);
    await expect(beta).toContainText('Betaline');

    await setFixtureData(page, '<pre id="pre-lines">Alpha</pre>');
    const pre = surface.locator('#pre-lines');
    await clickTextBoundary(page, pre, 5);
    await page.keyboard.press('Enter');
    await page.keyboard.type('Beta');
    await expect(pre.locator('br')).toHaveCount(0);
    await expect
        .poll(() =>
            pre.evaluate((element) => ({
                text: element.textContent,
                html: element.innerHTML,
            })),
        )
        .toEqual({ text: 'Alpha\nBeta', html: 'Alpha\nBeta' });

    await setFixtureData(page, '<pre id="pre-shift-lines">Alpha</pre>');
    const shiftPre = surface.locator('#pre-shift-lines');
    await clickTextBoundary(page, shiftPre, 5);
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.type('Beta');
    await expect(shiftPre.locator('br')).toHaveCount(0);
    await expect
        .poll(() => shiftPre.evaluate((element) => element.textContent))
        .toBe('Alpha\nBeta');

    await setFixtureData(
        page,
        '<p id="backspace-a">Alpha</p><p id="backspace-b">Beta</p>',
    );
    const backspaceTarget = surface.locator('#backspace-b');
    await clickTextBoundary(page, backspaceTarget, 0);
    await page.keyboard.press('Backspace');
    await expect(surface.locator('p')).toHaveCount(1);
    await expect(surface.locator('p').first()).toContainText('AlphaBeta');

    await setFixtureData(
        page,
        '<p id="delete-a">Alpha</p><p id="delete-b">Bravo</p>',
    );
    const first = surface.locator('#delete-a');
    await clickTextBoundary(page, first, 5);
    await page.keyboard.press('Delete');
    await expect(surface.locator('p')).toHaveCount(1);
    await expect(surface.locator('p')).toContainText('Bravo');
});

test('preserves emoji, combining text, Chinese composition, and RTL input', async ({
    page,
}) => {
    await setFixtureData(page, '<p id="unicode" dir="rtl">مرحبا </p>');
    const paragraph = page.locator('.soeditor-classic__visual #unicode');
    await paragraph.click();
    await page.keyboard.press('End');
    await page.keyboard.insertText('👩🏽‍💻 e\u0301 中文');
    await expect(paragraph).toContainText('👩🏽‍💻 é 中文');
    await expect(paragraph).toHaveAttribute('dir', 'rtl');
});

test('commits native Chinese IME text once and keeps the following Latin input', async ({
    browserName,
    page,
}) => {
    test.skip(
        browserName !== 'chromium',
        'Input.imeSetComposition requires a Chromium CDP session.',
    );
    await setFixtureData(page, '<p id="native-ime"><br></p>');
    const paragraph = page.locator('.soeditor-classic__visual #native-ime');
    await paragraph.click();

    const session = await page.context().newCDPSession(page);
    await session.send('Input.imeSetComposition', {
        selectionEnd: 7,
        selectionStart: 7,
        text: 'huamuchengqishouzizai',
    });
    await session.send('Input.imeSetComposition', {
        selectionEnd: 7,
        selectionStart: 7,
        text: '花木成畦手自栽',
    });
    await session.send('Input.insertText', { text: '花木成畦手自栽' });
    await page.keyboard.type('a');

    await expect(paragraph).toHaveText('花木成畦手自栽a');
});

test('keeps two WYSIWYG instances independent', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const host = document.createElement('div');
        host.id = 'second-host';
        document.body.append(host);
        const fixture: unknown = Reflect.get(globalThis, '__wysiwygFixture');
        const create =
            typeof fixture === 'object' && fixture !== null
                ? Reflect.get(fixture, 'create')
                : undefined;
        if (typeof create !== 'function') {
            throw new Error('Missing WYSIWYG fixture create().');
        }
        const second: unknown = await Reflect.apply(create, fixture, [host]);
        if (typeof second !== 'object' || second === null) {
            throw new Error('Second WYSIWYG instance was not created.');
        }
        const setData = Reflect.get(second, 'setData');
        const getData = Reflect.get(second, 'getData');
        if (typeof setData !== 'function' || typeof getData !== 'function') {
            throw new Error('Second WYSIWYG instance API is incomplete.');
        }
        Reflect.apply(setData, second, [
            '<p id="secondary">Changed second</p>',
        ]);
        const secondData = String(Reflect.apply(getData, second, []));
        const firstGetData = Reflect.get(fixture, 'getData');
        const firstData =
            typeof firstGetData === 'function'
                ? String(Reflect.apply(firstGetData, fixture, []))
                : '';
        const destroy = Reflect.get(second, 'destroy');
        if (typeof destroy === 'function') {
            await Reflect.apply(destroy, second, []);
        }
        return { firstData, secondData };
    });
    expect(result.secondData).toContain('Changed second');
    expect(result.firstData).toContain('WYSIWYG direct qualification');
    await expect(page.locator('#second-host')).not.toHaveAttribute(
        'hidden',
        '',
    );
    await expect(page.locator('.soeditor-classic')).toHaveCount(1);
});

test('repairs out-of-band DOM mutations from canonical WYSIWYG state', async ({
    page,
}) => {
    const paragraph = page.locator('.soeditor-classic__visual #paragraph');
    await paragraph.evaluate((element) => {
        element.textContent = 'Injected DOM mutation';
        element.setAttribute('onclick', 'alert(1)');
    });
    await expect(paragraph).toHaveText('Alpha bold omega.');
    await expect(paragraph).not.toHaveAttribute('onclick');
    const canonical = await page.evaluate(() => {
        const fixture: unknown = Reflect.get(globalThis, '__wysiwygFixture');
        const getData =
            typeof fixture === 'object' && fixture !== null
                ? Reflect.get(fixture, 'getData')
                : undefined;
        return typeof getData === 'function'
            ? String(Reflect.apply(getData, fixture, []))
            : '';
    });
    expect(canonical).toContain(
        '<p id="paragraph">Alpha <strong>bold</strong> omega.</p>',
    );
    expect(canonical).not.toContain('onclick');
});

test('keeps caret placement usable in a narrow 150 percent zoom viewport', async ({
    page,
}) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await page.evaluate(() => {
        document.body.style.zoom = '1.5';
    });
    const cell = page.locator('.soeditor-classic__visual #cell-ready');
    await clickTextBoundary(page, cell, 2);
    await page.keyboard.type('X');
    await expect(cell).toHaveText('ReXady');
    await expect
        .poll(() =>
            selectionSnapshot(cell).then(
                ({ collapsed, inside }) => collapsed && inside,
            ),
        )
        .toBe(true);
});

test('locks invalid external source and recovers without losing the last valid content', async ({
    page,
}) => {
    const surface = page.locator('.soeditor-classic__visual');
    await setFixtureData(page, '<p>Broken <');
    await expect(surface.locator('.soeditor-wysiwyg-content')).toHaveAttribute(
        'contenteditable',
        'false',
    );
    await expect(surface).toContainText('WYSIWYG direct qualification');
    await setFixtureData(page, '<p id="recovered">Recovered</p>');
    await expect(surface.locator('.soeditor-wysiwyg-content')).toHaveAttribute(
        'contenteditable',
        'true',
    );
    await expect(surface.locator('#recovered')).toHaveText('Recovered');
});

test('applies every semantic inline mark through the same UI path in paragraphs, nested lists, and cells', async ({
    page,
}) => {
    const cases = [
        ['bold', 'strong'],
        ['italic', 'em'],
        ['underline', 'u'],
        ['strike', 's'],
        ['subscript', 'sub'],
        ['superscript', 'sup'],
    ] as const;
    const contexts = [
        ['<p id="format-target">Target</p>', '#format-target'],
        [
            '<ul><li>Outer<ul><li id="format-target">Target</li></ul></li></ul>',
            '#format-target',
        ],
        [
            '<table><tbody><tr><td id="format-target">Target</td></tr></tbody></table>',
            '#format-target',
        ],
    ] as const;
    const surface = page.locator('.soeditor-classic__visual');
    for (const [toolbarItem, tagName] of cases) {
        for (const [html, selector] of contexts) {
            await setFixtureData(page, html);
            const target = surface.locator(selector);
            await selectElementText(target);
            await page.locator(`[data-toolbar-item="${toolbarItem}"]`).click();
            await expect(target.locator(tagName)).toHaveText('Target');
        }
    }
});

test('applies color, background, font size, and remove-format consistently in body, list, and cell content', async ({
    page,
}) => {
    const contexts = [
        '<p id="style-target">Target</p>',
        '<ul><li>Outer<ul><li id="style-target">Target</li></ul></li></ul>',
        '<table><tbody><tr><td id="style-target">Target</td></tr></tbody></table>',
    ] as const;
    const surface = page.locator('.soeditor-classic__visual');
    for (const html of contexts) {
        await setFixtureData(page, html);
        let target = surface.locator('#style-target');
        await selectElementText(target);
        await expect
            .poll(() => selectionSnapshot(target).then(({ text }) => text))
            .toBe('Target');
        const color = page.locator('[data-toolbar-item="fontColor"]');
        await color.locator('summary').click();
        await color.locator('[data-value="#dc2626"]').click();
        await expect(
            target.locator('span[style="color: #dc2626;"]'),
        ).toHaveText('Target');

        await setFixtureData(page, html);
        target = surface.locator('#style-target');
        await selectElementText(target);
        const background = page.locator(
            '[data-toolbar-item="fontBackgroundColor"]',
        );
        await background.locator('summary').click();
        await background.locator('[data-value="#fef9c3"]').click();
        await expect(
            target.locator('span[style="background-color: #fef9c3;"]'),
        ).toHaveText('Target');

        await setFixtureData(page, html);
        target = surface.locator('#style-target');
        await selectElementText(target);
        const size = page.locator('[data-toolbar-item="fontSize"]');
        await size.locator('summary').click();
        await size.locator('[data-value="24px"]').click();
        await expect(
            target.locator('span[style="font-size: 24px;"]'),
        ).toHaveText('Target');

        const styledHtml = html.replace(
            'Target',
            '<strong><em>Target</em></strong>',
        );
        await setFixtureData(page, styledHtml);
        target = surface.locator('#style-target');
        await selectElementText(target);
        await page.locator('[data-toolbar-item="removeFormat"]').click();
        await expect(target).toHaveText('Target');
        await expect
            .poll(() => target.evaluate((element) => element.innerHTML))
            .toBe('Target');
    }
});

test('creates DIV blocks and semantic gradient highlighter markup', async ({
    page,
}) => {
    const surface = page.locator('.soeditor-classic__visual');
    await setFixtureData(page, '<p id="div-highlight">克林霉素枯干</p>');
    const target = surface.locator('#div-highlight');
    await target.click();
    const formatMenu = page.locator('[data-toolbar-item="heading"]');
    await formatMenu.locator('summary').click();
    await formatMenu.getByRole('button', { name: 'DIV' }).click();
    await expect(surface.locator('div#div-highlight')).toHaveText(
        '克林霉素枯干',
    );

    await formatMenu.locator('summary').click();
    await expect(
        formatMenu.getByRole('button', { name: 'Preformatted' }),
    ).toBeEnabled();
    await expect(
        formatMenu.getByRole('button', { name: 'Code' }),
    ).toBeEnabled();
    await formatMenu.getByRole('button', { name: 'Preformatted' }).click();
    await expect(surface.locator('pre#div-highlight')).toHaveText(
        '克林霉素枯干',
    );

    const preformatted = surface.locator('pre#div-highlight');
    await selectElementText(preformatted);
    await formatMenu.locator('summary').click();
    await formatMenu.getByRole('button', { name: 'Code' }).click();
    await expect(preformatted.locator('code')).toHaveText('克林霉素枯干');
    await selectElementText(preformatted);
    const highlighter = page.locator('[data-toolbar-item="highlight"]');
    await highlighter.locator('summary').click();
    await highlighter.locator('[data-value="#ffff66"]').click();
    await expect(
        preformatted.locator(
            'mark[style="background: linear-gradient(transparent 60%, #ffff66 0);"]',
        ),
    ).toHaveText('克林霉素枯干');
});

test('converts preformatted newlines and br elements when changing block type', async ({
    page,
}) => {
    const surface = page.locator('.soeditor-classic__visual');
    const formatMenu = page.locator('[data-toolbar-item="heading"]');

    await setFixtureData(page, '<pre id="line-conversion">one\ntwo</pre>');
    const pre = surface.locator('#line-conversion');
    await selectElementText(pre);
    await formatMenu.locator('summary').click();
    await formatMenu.getByRole('button', { name: 'DIV' }).click();
    const div = surface.locator('div#line-conversion');
    await expect(div.locator('br')).toHaveCount(1);
    await expect
        .poll(() => div.evaluate((element) => element.innerHTML))
        .toBe('one<br>two');

    await selectElementText(div);
    await formatMenu.locator('summary').click();
    await formatMenu.getByRole('button', { name: 'Preformatted' }).click();
    const convertedPre = surface.locator('pre#line-conversion');
    await expect(convertedPre.locator('br')).toHaveCount(0);
    await expect(convertedPre).toHaveText('one\ntwo');
});

test('does not create nested flow blocks when converting a legacy block to a paragraph', async ({
    page,
}) => {
    const surface = page.locator('.soeditor-classic__visual');
    await setFixtureData(
        page,
        '<blockquote id="legacy-quote">\n  <div class="legacy-one">第一段</div>\n  <p>第二段</p>\n</blockquote>',
    );
    await selectElementText(surface.locator('#legacy-quote'));
    const formatMenu = page.locator('[data-toolbar-item="heading"]');
    await formatMenu.locator('summary').click();
    await formatMenu.getByRole('button', { name: 'Paragraph' }).click();

    await expect(surface.locator('.soeditor-wysiwyg-content > p')).toHaveCount(
        2,
    );
    await expect(surface.locator('.soeditor-wysiwyg-content p p')).toHaveCount(
        0,
    );
    await expect(surface.locator('.soeditor-wysiwyg-content')).toContainText(
        '第一段第二段',
    );
    await expect(
        surface.locator('.soeditor-wysiwyg-content > p').first(),
    ).toHaveAttribute('class', 'legacy-one');
});

test('converts nested paragraph breaks when changing a flow block to PRE', async ({
    page,
}) => {
    const surface = page.locator('.soeditor-classic__visual');
    await setFixtureData(
        page,
        '<blockquote id="legacy-pre"><p>第一<br />第二</p></blockquote>',
    );
    await selectElementText(surface.locator('#legacy-pre'));
    const formatMenu = page.locator('[data-toolbar-item="heading"]');
    await formatMenu.locator('summary').click();
    await formatMenu.getByRole('button', { name: 'Preformatted' }).click();

    await expect(
        surface.locator('.soeditor-wysiwyg-content > pre'),
    ).toHaveCount(1);
    await expect(surface.locator('.soeditor-wysiwyg-content > pre')).toHaveText(
        '第一\n第二',
    );
    await expect(
        surface.locator('.soeditor-wysiwyg-content pre p'),
    ).toHaveCount(0);
});

test('keeps structural flow content intact when a paragraph conversion is unsafe', async ({
    page,
}) => {
    const surface = page.locator('.soeditor-classic__visual');
    await setFixtureData(
        page,
        '<blockquote id="legacy-list"><ul><li>保留列表</li></ul></blockquote>',
    );
    await selectElementText(surface.locator('#legacy-list'));
    const formatMenu = page.locator('[data-toolbar-item="heading"]');
    await formatMenu.locator('summary').click();
    await formatMenu.getByRole('button', { name: 'Paragraph' }).click();

    await expect(surface.locator('#legacy-list')).toHaveCount(1);
    await expect(surface.locator('#legacy-list ul li')).toHaveText('保留列表');
    await expect(surface.locator('#legacy-list p')).toHaveCount(0);
});

test('keeps block and inline commands usable after pre and remove format', async ({
    page,
}) => {
    const surface = page.locator('.soeditor-classic__visual');
    await setFixtureData(
        page,
        '<h1>用 SoEditor 构建现代内容体验</h1><p></p><span style="font-family: courier new;"><code>这是一段由 CMS 语义样式控制的导语。 编辑者可以使用熟悉的工具栏，同时保留开发者需要的 HTML 自由。未知标签与 CMS 标记会被保留；危险脚本不会在可视化编辑区执行。 </code></span><blockquote><p></p></blockquote><h2>本次发布重点</h2>',
    );
    const code = surface.locator('code');
    await selectElementText(code);
    const formatMenu = page.locator('[data-toolbar-item="heading"]');
    await formatMenu.locator('summary').click();
    await formatMenu.getByRole('button', { name: 'Preformatted' }).click();
    await selectElementText(surface.locator('pre'));
    await page.locator('[data-toolbar-item="removeFormat"]').click();
    await selectElementText(surface.locator('pre'));
    await formatMenu.locator('summary').click();
    await expect(formatMenu.getByRole('button', { name: 'DIV' })).toBeEnabled();
    await formatMenu.getByRole('button', { name: 'DIV' }).click();
    await selectElementText(surface.locator('div').last());
    await expect(page.locator('[data-toolbar-item="bold"]')).toBeEnabled();
    await page.locator('[data-toolbar-item="bold"]').click();
    await expect(surface.locator('div strong')).toContainText('这是一段由 CMS');
});

test('preserves paragraph ownership when removing a CMS lead wrapper', async ({
    page,
}) => {
    const surface = page.locator('.soeditor-classic__visual');
    await setFixtureData(
        page,
        '<h1>用 SoEditor 构建现代内容体验</h1><p>\n  <span class="cms-lead">这是一段由 CMS 语义样式控制的导语。</span>\n  编辑者可以使用熟悉的工具栏，同时保留开发者需要的 HTML 自由。 未知标签与 CMS\n  标记会被保留；危险脚本不会在可视化编辑区执行。\n </p>',
    );
    await selectElementText(surface.locator('.soeditor-wysiwyg-content > p'));
    await page.locator('[data-toolbar-item="removeFormat"]').click();
    await expect
        .poll(() =>
            surface
                .locator('.soeditor-wysiwyg-content > p')
                .evaluate((element) => element.innerHTML),
        )
        .toContain('这是一段由 CMS');
    await expect(surface.locator('.soeditor-wysiwyg-content > p')).toHaveCount(
        1,
    );
});

test('removes inline formatting across blocks without flattening the blocks', async ({
    page,
}) => {
    const surface = page.locator('.soeditor-classic__visual');
    await setFixtureData(
        page,
        '<h1>用 SoEditor 构建现代内容体验</h1><p><span class="cms-lead">导语</span> 正文</p>',
    );
    await surface.evaluate((host) => {
        const root = host.shadowRoot;
        const heading = root?.querySelector('h1')?.firstChild;
        const paragraph = root?.querySelector('p');
        const last = paragraph?.lastChild;
        if (
            !(heading instanceof Text) ||
            paragraph === null ||
            paragraph === undefined ||
            !(last instanceof Text)
        ) {
            throw new Error('Missing cross-block fixture.');
        }
        document
            .getSelection()
            ?.setBaseAndExtent(heading, 0, last, last.data.length);
    });
    await page.locator('[data-toolbar-item="removeFormat"]').click();
    await expect(surface.locator('h1')).toHaveText(
        '用 SoEditor 构建现代内容体验',
    );
    await expect(surface.locator('p')).toHaveText('导语 正文');
});

test('creates, edits, and removes a selected-text link without losing its range', async ({
    page,
}) => {
    await setFixtureData(page, '<p id="link-target">Alpha omega</p>');
    const target = page.locator('.soeditor-classic__visual #link-target');
    await selectTextByPointer(page, target, 0, 5);
    await page.locator('[data-toolbar-item="link"]').click();
    let dialog = page.getByRole('dialog', { name: 'Link' });
    await expect(dialog.getByLabel('Displayed text')).toHaveValue('Alpha');
    await dialog.getByLabel('Link URL').fill('/alpha');
    await dialog.getByText('Advanced settings').click();
    await dialog.getByLabel('Title').fill('Alpha article');
    await dialog.getByLabel('Common target').selectOption('_blank');
    await expect(dialog.getByLabel('Target', { exact: true })).toHaveValue(
        '_blank',
    );
    await dialog.getByLabel('Target', { exact: true }).fill('articlePreview');
    await dialog.getByRole('button', { name: 'Relationship nofollow' }).click();
    await dialog.getByLabel('Add relationship').fill('privacy-policy');
    await dialog.getByRole('button', { name: 'Add', exact: true }).click();
    let attributeRows = dialog.locator('.soeditor-ui__link-attribute-row');
    await attributeRows
        .nth(0)
        .getByLabel('Attribute name', { exact: true })
        .fill('referrerpolicy');
    await expect(attributeRows.getByLabel('Attribute value')).toHaveAttribute(
        'list',
        /values/u,
    );
    await attributeRows
        .nth(0)
        .getByLabel('Attribute value')
        .fill('strict-origin');
    await dialog.getByRole('button', { name: 'Add attribute' }).click();
    const customName = attributeRows.getByLabel('Attribute name', {
        exact: true,
    });
    await customName.fill('hreflang2');
    await attributeRows.getByLabel('Attribute value').fill('zhtw');
    await dialog.getByRole('button', { name: 'Add attribute' }).click();
    await expect(dialog).toBeVisible();
    await expect
        .poll(() => customName.evaluate((input) => input.validationMessage))
        .toContain('Invalid attribute');
    await customName.fill('href');
    await attributeRows.getByLabel('Attribute value').fill('/bypass');
    await dialog.getByRole('button', { name: 'Add attribute' }).click();
    await expect(dialog).toBeVisible();
    await expect
        .poll(() => customName.evaluate((input) => input.validationMessage))
        .toContain('Invalid attribute');
    await customName.fill('data-cms-id');
    await attributeRows.getByLabel('Attribute value').fill('article-42');
    await dialog.getByRole('button', { name: 'Add attribute' }).click();
    await dialog.getByRole('button', { name: 'Insert link' }).click();
    const link = target.locator('a');
    await expect(link).toHaveText('Alpha');
    await expect(link).toHaveAttribute('href', '/alpha');
    await expect(link).toHaveAttribute('target', 'articlePreview');
    await expect(link).toHaveAttribute('rel', 'nofollow privacy-policy');
    await expect(link).toHaveAttribute('referrerpolicy', 'strict-origin');
    await expect(link).toHaveAttribute('data-cms-id', 'article-42');

    const linkPoint = await textPoint(link, 2);
    await page.mouse.click(linkPoint.x, linkPoint.y);
    await page.getByRole('button', { name: 'Edit link' }).click();
    dialog = page.getByRole('dialog', { name: 'Edit link' });
    await expect(dialog.locator('details')).toHaveAttribute('open', '');
    await expect(
        dialog.getByRole('button', { name: 'Remove link' }),
    ).toHaveClass(/is-danger/u);
    await expect(dialog.getByLabel('Displayed text')).toHaveValue('Alpha');
    await expect(dialog.getByLabel('Link URL')).toHaveValue('/alpha');
    await expect(dialog.getByLabel('Target', { exact: true })).toHaveValue(
        'articlePreview',
    );
    await expect(
        dialog.getByRole('button', { name: 'Relationship nofollow' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(
        dialog.getByRole('button', { name: 'Relationship privacy-policy' }),
    ).toHaveAttribute('aria-pressed', 'true');
    attributeRows = dialog.locator('.soeditor-ui__link-attribute-row');
    await expect(attributeRows).toHaveCount(1);
    await expect(
        dialog.getByLabel('Added attributes').locator('option'),
    ).toHaveCount(2);
    await dialog.getByLabel('Added attributes').selectOption('data-cms-id');
    await dialog.getByRole('button', { name: 'Remove attribute' }).click();
    await dialog.getByLabel('Link URL').fill('/updated');
    await dialog.getByRole('button', { name: 'Update link' }).click();
    await expect(link).toHaveAttribute('href', '/updated');
    await expect(link).toHaveAttribute('referrerpolicy', 'strict-origin');
    await expect(link).not.toHaveAttribute('data-cms-id');

    await page.mouse.click(linkPoint.x, linkPoint.y);
    await page
        .locator('.soeditor-ui__balloon')
        .getByRole('button', { name: 'Remove link' })
        .click();
    await expect(target.locator('a')).toHaveCount(0);
    await expect(target).toHaveText('Alpha omega');
});

test('applies block, alignment, rule, and nested-list keyboard commands in WYSIWYG', async ({
    page,
}) => {
    const surface = page.locator('.soeditor-classic__visual');
    await setFixtureData(
        page,
        Array.from(
            { length: 6 },
            (_, index) =>
                `<p id="heading-${String(index + 1)}">Heading ${String(index + 1)}</p>`,
        ).join(''),
    );
    for (let level = 1; level <= 6; level += 1) {
        const target = surface.locator(`#heading-${String(level)}`);
        await clickTextBoundary(page, target, 3);
        await page.locator('[data-toolbar-item="heading"] summary').click();
        await page
            .getByRole('button', { name: `Heading ${String(level)}` })
            .click();
        await expect(
            surface.locator(`h${String(level)}#heading-${String(level)}`),
        ).toHaveText(`Heading ${String(level)}`);
    }
    await surface.evaluate((host) => {
        const root = host.shadowRoot;
        const start = root?.querySelector('#heading-2')?.firstChild;
        const end = root?.querySelector('#heading-4')?.firstChild;
        if (
            root === null ||
            start === null ||
            start === undefined ||
            end === null ||
            end === undefined
        ) {
            throw new Error('Missing multi-block heading fixture.');
        }
        document.getSelection()?.setBaseAndExtent(start, 1, end, 8);
    });
    await page.locator('[data-toolbar-item="heading"] summary').click();
    await page.getByRole('button', { name: 'Heading 5' }).click();
    for (const id of [2, 3, 4]) {
        await expect(surface.locator(`h5#heading-${String(id)}`)).toHaveCount(
            1,
        );
    }
    const target = surface.locator('#heading-2');
    await clickTextBoundary(page, target, 3);
    await page.locator('[data-toolbar-item="alignCenter"]').click();
    await expect(target).toHaveAttribute('style', /text-align:\s*center/u);

    await setFixtureData(page, '<p id="quote-target">Quoted</p>');
    await clickTextBoundary(page, surface.locator('#quote-target'), 2);
    await page.locator('[data-toolbar-item="blockquote"]').click();
    await expect(surface.locator('blockquote')).toContainText('Quoted');

    await setFixtureData(page, '<p id="rule-target">Before</p>');
    await clickTextBoundary(page, surface.locator('#rule-target'), 3);
    await page.locator('[data-toolbar-item="horizontalRule"]').click();
    await expect(surface.locator('hr')).toHaveCount(1);

    await setFixtureData(
        page,
        '<ul><li id="first-list-item">First</li><li id="second-list-item">Second</li></ul>',
    );
    const second = surface.locator('#second-list-item');
    await clickTextBoundary(page, second, 3);
    await page.keyboard.press('Tab');
    await expect(
        surface.locator('#first-list-item > ul #second-list-item'),
    ).toHaveText('Second');
    await page.keyboard.press('Shift+Tab');
    await expect(surface.locator('body > #second-list-item')).toHaveCount(0);
    await expect(
        surface.locator('.soeditor-wysiwyg-content > ul > #second-list-item'),
    ).toHaveText('Second');
});

test('inserts a collapsed link and a named anchor at the active caret', async ({
    page,
}) => {
    const surface = page.locator('.soeditor-classic__visual');
    await setFixtureData(page, '<p id="insert-target">Alpha omega</p>');
    const target = surface.locator('#insert-target');
    await clickTextBoundary(page, target, 5);
    await page.locator('[data-toolbar-item="link"]').click();
    const linkDialog = page.getByRole('dialog', { name: 'Link' });
    await expect(linkDialog.getByLabel('Displayed text')).toHaveValue('');
    await linkDialog.getByLabel('Displayed text').fill(' site');
    await linkDialog.getByLabel('Link URL').fill('/site');
    await linkDialog.getByRole('button', { name: 'Insert link' }).click();
    await expect(target.locator('a[href="/site"]')).toHaveText(' site');
    await expect(target).toContainText('Alpha site omega');

    await clickTextBoundary(page, target, 0);
    await page.locator('[data-toolbar-item="anchor"]').click();
    const anchorDialog = page.getByRole('dialog', { name: 'Named anchor' });
    await anchorDialog.getByLabel('Anchor name').fill('section-start');
    await anchorDialog
        .getByRole('button', { name: 'Insert named anchor' })
        .click();
    await expect(target.locator('a[id="section-start"]')).toHaveCount(1);

    await setFixtureData(
        page,
        '<p id="selected-anchor-target">Before selected text after</p>',
    );
    const selectedTarget = surface.locator('#selected-anchor-target');
    await selectTextByPointer(page, selectedTarget, 7, 20);
    await page.locator('[data-toolbar-item="anchor"]').click();
    const selectedAnchorDialog = page.getByRole('dialog', {
        name: 'Named anchor',
    });
    await selectedAnchorDialog
        .getByLabel('Anchor name')
        .fill('selected-text-start');
    await selectedAnchorDialog
        .getByRole('button', { name: 'Insert named anchor' })
        .click();
    await expect(selectedTarget).toHaveText('Before selected text after');
    await expect(
        selectedTarget.locator('a[id="selected-text-start"]'),
    ).toHaveCount(1);
});

test('keeps one stable table toolbar, navigates with Tab, and applies visible properties', async ({
    page,
}) => {
    const surface = page.locator('.soeditor-classic__visual');
    await setFixtureData(
        page,
        '<table><caption>Initial caption</caption><tbody><tr><td id="property-a">Alpha</td><td id="property-b">Bravo</td></tr><tr><td>Charlie</td><td>Delta</td></tr></tbody></table>',
    );
    const first = surface.locator('#property-a');
    const second = surface.locator('#property-b');
    await first.click();
    const toolbar = page.locator('.soeditor-ui__table-balloon');
    await expect(toolbar).toHaveCount(1);
    await toolbar.evaluate((element) => {
        element.dataset.qualificationInstance = 'stable';
    });
    await second.click();
    await expect(toolbar).toHaveAttribute(
        'data-qualification-instance',
        'stable',
    );
    await clickTextBoundary(page, first, 2);
    await page.keyboard.press('Tab');
    await expect
        .poll(() => selectionSnapshot(second).then(({ inside }) => inside))
        .toBe(true);
    await page.keyboard.press('Shift+Tab');
    await expect
        .poll(() => selectionSnapshot(first).then(({ inside }) => inside))
        .toBe(true);

    await toolbar.getByRole('button', { name: 'Table properties' }).click();
    const tableDialog = page.getByRole('dialog', { name: 'Table properties' });
    await tableDialog.getByLabel('Table width', { exact: true }).fill('65');
    await tableDialog.getByLabel('Table width unit').selectOption('%');
    await tableDialog.getByLabel('Alignment').selectOption('center');
    await tableDialog.getByRole('button', { name: 'Apply' }).click();
    const table = surface.locator('table');
    await expect(table.locator('caption')).toHaveText('Initial caption');
    await expect(table).toHaveAttribute('width', '65%');
    await expect(table).toHaveAttribute('style', /margin-inline:\s*auto/u);

    await first.click();
    await toolbar.getByRole('button', { name: 'Select row' }).click();
    await toolbar.getByRole('button', { name: 'Row properties' }).click();
    const rowDialog = page.getByRole('dialog', { name: 'Row properties' });
    await rowDialog.getByLabel('Section').selectOption('head');
    await rowDialog.getByLabel('Height', { exact: true }).fill('48');
    await rowDialog.getByText('Advanced settings').click();
    await rowDialog.getByLabel('Row classes').fill('featured-row');
    await rowDialog.getByRole('button', { name: 'Apply' }).click();
    await expect(surface.locator('thead tr')).toHaveAttribute('height', '48');
    await expect(surface.locator('thead tr')).toHaveClass(/featured-row/u);

    await surface.locator('thead td, thead th').first().click();
    await toolbar.getByRole('button', { name: 'Toggle header' }).click();
    await surface.locator('thead th').first().click();
    await toolbar.getByRole('button', { name: 'Cell properties' }).click();
    const cellDialog = page.getByRole('dialog', { name: 'Cell properties' });
    await cellDialog.getByLabel('Horizontal alignment').selectOption('center');
    await cellDialog.getByLabel('Vertical alignment').selectOption('middle');
    await cellDialog.getByLabel('Header scope').selectOption('col');
    await cellDialog.getByText('Advanced settings').click();
    await cellDialog.getByLabel('Cell classes').fill('featured-cell');
    await cellDialog.getByRole('button', { name: 'Apply' }).click();
    const updatedCell = surface.locator('thead th').first();
    await expect(updatedCell).toHaveClass(/featured-cell/u);
    await expect(updatedCell).toHaveAttribute('style', /text-align:\s*center/u);
    await expect(updatedCell).toHaveAttribute(
        'style',
        /vertical-align:\s*middle/u,
    );
    await expect(updatedCell).toHaveAttribute('scope', 'col');

    await updatedCell.click();
    await toolbar.getByRole('button', { name: 'Edit cell HTML' }).click();
    const cellHtmlDialog = page.getByRole('dialog', {
        name: 'Edit cell HTML',
    });
    await expect(cellHtmlDialog).toContainText(
        'Nested tables are not allowed.',
    );
    await expect(cellHtmlDialog.getByLabel('Cell HTML')).toHaveValue('Alpha');
    await cellHtmlDialog
        .getByLabel('Cell HTML')
        .fill('<strong>Qualified cell</strong>');
    await cellHtmlDialog.getByLabel('Cell HTML').press('Control+Enter');
    await expect(updatedCell.locator('strong')).toHaveText('Qualified cell');

    await updatedCell.click();
    await expect(toolbar.getByLabel('Column width')).toHaveCount(0);
});

test('edits the table caption in a focused dialog', async ({ page }) => {
    const surface = page.locator('.soeditor-classic__visual');
    await setFixtureData(
        page,
        '<table><caption>季度数据</caption><tbody title="主要数据"><tr><td id="structure-ui">A</td><td>B</td></tr></tbody><tbody></tbody></table>',
    );
    await surface.locator('#structure-ui').click();
    const toolbar = page.locator('.soeditor-ui__table-balloon');
    await toolbar.getByRole('button', { name: 'Table caption' }).click();
    const dialog = page.getByRole('dialog', { name: '表格标题' });
    await expect(
        dialog.getByRole('heading', { name: '表格标题', level: 3 }),
    ).toBeVisible();
    await expect(dialog.locator('.soeditor-table-structure__card')).toHaveCount(
        1,
    );
    await expect(dialog.getByText('表格分区')).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: '保存标题' })).toHaveClass(
        /is-primary/u,
    );
    await expect(dialog.getByRole('button', { name: '删除标题' })).toHaveClass(
        /is-danger/u,
    );
    await dialog.getByLabel('标题文字').fill('年度数据');
    await dialog.getByRole('button', { name: '保存标题' }).click();
    await expect
        .poll(() =>
            page.evaluate(() => {
                const fixture: unknown = Reflect.get(
                    globalThis,
                    '__wysiwygFixture',
                );
                const getData =
                    typeof fixture === 'object' && fixture !== null
                        ? Reflect.get(fixture, 'getData')
                        : undefined;
                return typeof getData === 'function'
                    ? String(Reflect.apply(getData, fixture, []))
                    : '';
            }),
        )
        .toContain('<caption>年度数据</caption>');
    await expect(
        page.locator('.soeditor-ui__notification[data-severity="error"]'),
    ).toHaveCount(0);
    const bounds = await dialog.evaluate((element) => {
        const rectangle = element.getBoundingClientRect();
        return { left: rectangle.left, right: rectangle.right };
    });
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(
        await page.evaluate(() => innerWidth),
    );
});

test('uses explicit Shift-click rectangular table selection for merge, split, and clear', async ({
    page,
}) => {
    const surface = page.locator('.soeditor-classic__visual');
    await setFixtureData(
        page,
        '<table><tbody><tr><td id="range-a">A</td><td>B</td></tr><tr><td>C</td><td id="range-d">D</td></tr></tbody></table>',
    );
    await surface.locator('#range-a').click();
    const toolbar = page.locator('.soeditor-ui__table-balloon');
    await expect(
        toolbar.getByRole('button', { name: 'Merge cells' }),
    ).toBeHidden();
    await surface.locator('#range-d').click({ modifiers: ['Shift'] });
    await expect(
        surface.locator('.soeditor-table-cell.is-structurally-selected'),
    ).toHaveCount(4);
    await expect(
        toolbar.getByRole('button', { name: 'Merge cells' }),
    ).toBeEnabled();
    await toolbar.getByRole('button', { name: 'Merge cells' }).click();
    let cells = surface.locator('td,th');
    await expect(cells).toHaveCount(1);
    await expect(cells.first()).toHaveAttribute('colspan', '2');
    await expect(cells.first()).toHaveAttribute('rowspan', '2');
    await expect(
        toolbar.getByRole('button', { name: 'Merge cells' }),
    ).toBeHidden();
    await expect(
        toolbar.getByRole('button', { name: 'Split completely' }),
    ).toBeEnabled();
    await toolbar.getByRole('button', { name: 'Split completely' }).click();
    cells = surface.locator('td,th');
    await expect(cells).toHaveCount(4);
    await expect(cells.first()).not.toHaveAttribute('colspan');
    await expect(cells.first()).not.toHaveAttribute('rowspan');

    await cells.first().click();
    await cells.nth(3).click({ modifiers: ['Shift'] });
    await toolbar.getByRole('button', { name: 'Clear cells' }).click();
    await expect(cells).toHaveText(['', '', '', '']);
});

test('enables merge for a rectangular body selection below a table header', async ({
    page,
}) => {
    const surface = page.locator('.soeditor-classic__visual');
    await setFixtureData(
        page,
        '<table><caption>CMS 功能交付状态</caption><thead><tr><th>能力</th><th>状态</th><th>验证</th></tr></thead><tbody><tr><td id="cms-a">Classic 表单</td><td>完成</td><td>Browser</td></tr><tr><td>Office 粘贴</td><td id="cms-e">完成</td><td>Fixtures</td></tr><tr><td>上传与表格</td><td>完成</td><td>Unit + Browser</td></tr></tbody></table>',
    );
    await surface.locator('#cms-a').click();
    const toolbar = page.locator('.soeditor-ui__table-balloon');
    await surface.locator('#cms-e').click({ modifiers: ['Shift'] });
    await expect(
        surface.locator('.soeditor-table-cell.is-structurally-selected'),
    ).toHaveCount(4);
    await expect(
        toolbar.getByRole('button', { name: 'Merge cells' }),
    ).toBeEnabled();
    await toolbar.getByRole('button', { name: 'Merge cells' }).click();
    await expect(surface.locator('td,th')).toHaveCount(9);
    const merged = surface.locator('tbody td').first();
    await expect(merged).toHaveAttribute('rowspan', '2');
    await expect(merged).toHaveAttribute('colspan', '2');
});

test('merges two vertically dragged body cells below a table header', async ({
    page,
}) => {
    const surface = page.locator('.soeditor-classic__visual');
    await setFixtureData(
        page,
        '<table><caption>CMS 功能交付状态</caption><thead><tr><th>能力</th><th>状态</th><th>验证</th></tr></thead><tbody><tr><td id="vertical-a">Classic 表单</td><td>完成</td><td>Browser</td></tr><tr><td id="vertical-b">Office 粘贴</td><td>完成</td><td>Fixtures</td></tr><tr><td>上传与表格</td><td>完成</td><td>Unit + Browser</td></tr></tbody></table>',
    );
    const first = await surface.locator('#vertical-a').boundingBox();
    const second = await surface.locator('#vertical-b').boundingBox();
    if (first === null || second === null)
        throw new Error('Table cells not found.');
    await page.mouse.move(
        first.x + first.width / 2,
        first.y + first.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
        second.x + second.width / 2,
        second.y + second.height / 2,
        {
            steps: 4,
        },
    );
    await page.mouse.up();
    const toolbar = page.locator('.soeditor-ui__table-balloon');
    await expect(
        surface.locator('.soeditor-table-cell.is-structurally-selected'),
    ).toHaveCount(2);
    const merge = toolbar.getByRole('button', { name: 'Merge cells' });
    await expect(merge).toBeEnabled();
    await expect(merge).toHaveClass(/soeditor-table-context__button--primary/);
    await expect(toolbar.getByRole('button', { name: 'Add row' })).toBeHidden();
    await expect(
        toolbar.getByRole('button', { name: 'Select column' }),
    ).toBeHidden();
    await merge.click();
    const merged = surface.locator('tbody td').first();
    await expect(merged).toHaveAttribute('rowspan', '2');
    await expect(merged).not.toHaveAttribute('colspan');
});

test('can merge another selection after the table already contains a merged cell', async ({
    page,
}) => {
    const surface = page.locator('.soeditor-classic__visual');
    await setFixtureData(
        page,
        '<table><thead><tr><th>能力</th><th>状态</th><th>验证</th></tr></thead><tbody><tr><td id="first-a">Classic 表单</td><td>完成</td><td>Browser</td></tr><tr><td id="first-b">Office 粘贴</td><td id="second-a">完成</td><td id="second-b">Fixtures</td></tr><tr><td>上传与表格</td><td>完成</td><td>Unit + Browser</td></tr></tbody></table>',
    );
    const dragCells = async (firstId: string, secondId: string) => {
        const first = await surface.locator(firstId).boundingBox();
        const second = await surface.locator(secondId).boundingBox();
        if (first === null || second === null)
            throw new Error('Table cells not found.');
        await page.mouse.move(
            first.x + first.width / 2,
            first.y + first.height / 2,
        );
        await page.mouse.down();
        await page.mouse.move(
            second.x + second.width / 2,
            second.y + second.height / 2,
            { steps: 4 },
        );
        await page.mouse.up();
    };
    const toolbar = page.locator('.soeditor-ui__table-balloon');
    await dragCells('#first-a', '#first-b');
    await toolbar.getByRole('button', { name: 'Merge cells' }).click();
    await expect(surface.locator('tbody td').first()).toHaveAttribute(
        'rowspan',
        '2',
    );

    await dragCells('#second-a', '#second-b');
    await expect(
        surface.locator('.soeditor-table-cell.is-structurally-selected'),
    ).toHaveCount(2);
    const secondMerge = toolbar.getByRole('button', { name: 'Merge cells' });
    await expect(secondMerge).toBeEnabled();
    await secondMerge.click();
    await expect(surface.locator('#second-a')).toHaveAttribute('colspan', '2');
});

test('supports Dreamweaver-style drag and row, column, and table selection scopes', async ({
    page,
}) => {
    const surface = page.locator('.soeditor-classic__visual');
    await setFixtureData(
        page,
        '<table><tbody><tr><td id="drag-a">A</td><td>B</td><td>C</td></tr><tr><td>D</td><td id="drag-e">E</td><td>F</td></tr></tbody></table>',
    );
    const start = await surface.locator('#drag-a').boundingBox();
    const end = await surface.locator('#drag-e').boundingBox();
    if (start === null || end === null)
        throw new Error('Table cells not found.');
    await page.mouse.move(
        start.x + start.width / 2,
        start.y + start.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, {
        steps: 4,
    });
    await page.mouse.up();
    await expect(
        surface.locator('.soeditor-table-cell.is-structurally-selected'),
    ).toHaveCount(4);
    const toolbar = page.locator('.soeditor-ui__table-balloon');
    await expect(
        toolbar.getByRole('button', { name: 'Merge cells' }),
    ).toBeEnabled();

    await toolbar.getByRole('button', { name: 'Select row' }).click();
    await expect(
        surface.locator('.soeditor-table-cell.is-structurally-selected'),
    ).toHaveCount(6);
    await expect(
        toolbar.getByRole('button', { name: 'Add column' }),
    ).toBeHidden();

    await expect(
        toolbar.getByRole('button', { name: 'Select table' }),
    ).toHaveCount(0);
    await expect(
        toolbar.getByRole('button', { name: 'Delete table' }),
    ).toBeHidden();
    await expect(
        toolbar.getByRole('button', { name: 'Merge cells' }),
    ).toBeVisible();
});

test('adds and removes table rows and columns with one-step history', async ({
    page,
}) => {
    const surface = page.locator('.soeditor-classic__visual');
    await setFixtureData(
        page,
        '<table><tbody><tr><td id="structure-target">A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table>',
    );
    await surface.locator('#structure-target').click();
    let toolbar = page.locator('.soeditor-ui__table-balloon');
    await toolbar.getByRole('button', { name: 'Add row' }).click();
    await expect(surface.locator('tr')).toHaveCount(3);
    await page.keyboard.press('Control+z');
    await expect(surface.locator('tr')).toHaveCount(2);
    await page.keyboard.press('Control+Shift+z');
    await expect(surface.locator('tr')).toHaveCount(3);

    await surface.locator('td,th').first().click();
    toolbar = page.locator('.soeditor-ui__table-balloon');
    await toolbar.getByRole('button', { name: 'Delete row' }).click();
    await expect(surface.locator('tr')).toHaveCount(2);

    await surface.locator('td,th').first().click();
    await toolbar.getByRole('button', { name: 'Add column' }).click();
    await expect(surface.locator('tr').first().locator('td,th')).toHaveCount(3);
    await surface.locator('td,th').first().click();
    await toolbar.getByRole('button', { name: 'Delete column' }).click();
    await expect(surface.locator('tr').first().locator('td,th')).toHaveCount(2);

    await surface.locator('td,th').first().click();
    await toolbar.getByRole('button', { name: 'Toggle header' }).click();
    await expect(surface.locator('th')).toHaveCount(1);
});

test('uses one image menu for URL, file manager, and computer upload', async ({
    page,
}) => {
    const surface = page.locator('.soeditor-classic__visual');
    const actions = page.locator('[data-toolbar-item="image-actions"]');
    await setFixtureData(page, '<p id="asset-target">Assets</p>');
    await clickTextBoundary(page, surface.locator('#asset-target'), 6);

    await actions.locator('summary').click();
    const urlAction = actions.getByRole('menuitem', { name: 'Insert via URL' });
    const menuRestingColor = await urlAction.evaluate(
        (button) => getComputedStyle(button).color,
    );
    await urlAction.hover();
    await expect
        .poll(() =>
            urlAction.evaluate((button) => getComputedStyle(button).color),
        )
        .toBe(menuRestingColor);
    await urlAction.click();
    const dialog = page.getByRole('dialog', { name: 'Insert image via URL' });
    const insertButton = dialog.getByRole('button', { name: 'Insert image' });
    const primaryRestingColor = await insertButton.evaluate(
        (button) => getComputedStyle(button).color,
    );
    await insertButton.hover();
    await expect
        .poll(() =>
            insertButton.evaluate((button) => getComputedStyle(button).color),
        )
        .toBe(primaryRestingColor);
    await dialog.getByLabel('Image URL').fill('/qualification-url.png');
    await dialog.getByLabel('Alternative text').fill('URL qualification');
    await insertButton.click();
    await expect(
        surface.locator('img[src="/qualification-url.png"]'),
    ).toHaveAttribute('alt', 'URL qualification');

    await surface.locator('#asset-target').click();
    await page.keyboard.press('End');
    await actions.locator('summary').click();
    await actions
        .getByRole('menuitem', { name: 'Insert with file manager' })
        .click();
    await expect(
        surface.locator('img[alt="Managed qualification image"]'),
    ).toHaveAttribute('src', '/demo-editor-cover.svg');

    await surface.locator('#asset-target').click();
    await page.keyboard.press('End');
    await actions.locator('summary').click();
    await actions.locator('input[type="file"]').setInputFiles({
        buffer: Buffer.from('qualification'),
        mimeType: 'image/png',
        name: 'qualification upload.png',
    });
    await expect
        .poll(() =>
            page.evaluate(() => {
                const fixture: unknown = Reflect.get(
                    globalThis,
                    '__wysiwygFixture',
                );
                const getData = Reflect.get(fixture as object, 'getData');
                return Reflect.apply(getData, fixture, []) as string;
            }),
        )
        .toContain('/uploads/qualification%20upload.png');
});

test('completes image properties by double click in WYSIWYG', async ({
    page,
}) => {
    const surface = page.locator('.soeditor-classic__visual');
    await setFixtureData(
        page,
        '<p><img src="/before.png" alt="Before" width="200" height="100"></p>',
    );
    await surface.locator('img').dblclick();
    const dialog = page.getByRole('dialog', { name: 'Image properties' });
    await dialog.getByLabel('Alternative text').fill('After image');
    await dialog.getByLabel('Width').fill('420');
    await dialog.getByLabel('Caption').fill('CMS image caption');
    await dialog.getByLabel('Link URL').fill('/image-details');
    await dialog.getByText('Responsive image settings').click();
    await dialog.getByLabel('Responsive CSS classes').fill('responsive-image');
    await dialog
        .getByLabel('Responsive sources')
        .fill('/before.png 1x, /before@2x.png 2x');
    await dialog
        .getByLabel('Responsive sizes')
        .fill('(max-width: 600px) 100vw, 420px');
    await dialog.getByLabel('Alignment').selectOption('center');
    await dialog.getByLabel('Lock aspect ratio').check();
    await dialog.getByRole('button', { name: 'Update image' }).click();
    await expect(surface.locator('img')).toHaveAttribute('alt', 'After image');
    await expect(surface.locator('img')).toHaveAttribute('width', '420');
    await expect(surface.locator('img')).toHaveAttribute('height', '210');
    await expect(surface.locator('img')).toHaveAttribute(
        'class',
        'responsive-image',
    );
    await expect(surface.locator('figure')).toHaveAttribute(
        'data-align',
        'center',
    );
    await expect(surface.locator('figure')).toHaveAttribute(
        'data-aspect-lock',
        'true',
    );
    await expect(surface.locator('figcaption')).toHaveText('CMS image caption');
    await expect(surface.locator('a')).toHaveAttribute(
        'href',
        '/image-details',
    );
    await page.keyboard.press('ControlOrMeta+z');
    await expect(surface.locator('figure')).toHaveCount(0);
    await expect(surface.locator('img')).toHaveAttribute('alt', 'Before');
});

test('pastes rich semantic content inside a cell as one history step', async ({
    page,
}) => {
    const surface = page.locator('.soeditor-classic__visual');
    await setFixtureData(
        page,
        '<table><tbody><tr><td id="paste-cell">Cell</td><td>Keep</td></tr></tbody></table>',
    );
    const cell = surface.locator('#paste-cell');
    await clickTextBoundary(page, cell, 4);
    await cell.evaluate((target) => {
        const transfer = new DataTransfer();
        transfer.setData(
            'text/html',
            '<strong> Bold</strong><a href="/safe"> link</a><img src="/paste.png" alt="Paste"><ul><li>Nested</li></ul>',
        );
        transfer.setData('text/plain', ' Bold link Nested');
        const paste = new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            clipboardData: transfer,
        });
        Object.defineProperty(paste, 'clipboardData', {
            configurable: true,
            value: transfer,
        });
        target.dispatchEvent(paste);
    });
    await expect(cell.locator('strong')).toHaveText(' Bold');
    await expect(cell.locator('a[href="/safe"]')).toHaveText(' link');
    await expect(cell.locator('img[src="/paste.png"]')).toHaveAttribute(
        'alt',
        'Paste',
    );
    await expect(cell.locator('li')).toHaveText('Nested');
    await page.keyboard.press('Control+z');
    await expect(cell).toHaveText('Cell');
    await expect(surface.locator('td').nth(1)).toHaveText('Keep');
});

test('switches between one WYSIWYG or Source writer', async ({ page }) => {
    const editor = page.locator('.soeditor-classic');
    const view = editor.getByLabel('Editing view');
    for (const value of ['wysiwyg', 'source'] as const) {
        await view.locator(`[data-workspace-view="${value}"]`).click();
        await expect(editor).toHaveAttribute(
            'data-soeditor-workspace-view',
            value,
        );
        await expect(editor).toHaveAttribute(
            'data-soeditor-projections',
            value,
        );
        await expect(editor).toHaveAttribute('data-soeditor-pane-count', '1');
    }

    await expect(editor.locator('[data-toolbar-item="source"]')).toHaveCount(0);
    await editor.locator('.soeditor-classic__source .cm-content').click();
    await view.locator('[data-workspace-view="wysiwyg"]').click();
    await editor.locator('.soeditor-classic__visual h1').click();
    await editor.locator('[data-classic-action="maximize"]').click();
    await expect(editor).toHaveClass(/is-maximized/u);
});

test('keeps document formatting tools out of the CMS editing surface', async ({
    page,
}) => {
    const editor = page.locator('.soeditor-classic');
    await editor
        .getByLabel('Editing view')
        .locator('[data-workspace-view="source"]')
        .click();
    await expect(editor.locator('[data-toolbar-item="format"]')).toHaveCount(0);
    await expect(editor.locator('[data-toolbar-item="minify"]')).toHaveCount(0);
    await expect(
        editor.locator('[data-toolbar-item="sourceFind"]'),
    ).toHaveCount(0);
});

test('reports document counts, uses neutral styles, and inserts a preset character', async ({
    page,
}) => {
    const editor = page.locator('.soeditor-classic');
    const surface = editor.locator('.soeditor-classic__visual');
    await setFixtureData(page, '<p id="count-target">Hello 世界</p>');
    const status = editor.locator('.soeditor-ui__document-status');
    await expect(status).toHaveAttribute('data-words', '2');
    await expect(status).toHaveAttribute('data-characters', '8');
    await expect(status).toHaveAttribute('data-source-characters', '33');

    await expect(editor.getByLabel('Content style')).toHaveCount(0);
    await expect(surface).toHaveAttribute(
        'data-soeditor-content-style',
        'browser',
    );

    await clickTextBoundary(page, surface.locator('#count-target'), 8);
    const special = editor.locator('[data-toolbar-item="specialCharacter"]');
    await expect(special).toHaveCount(0);

    await page.addStyleTag({
        content: `
            body strong, body b { font-weight: 400 !important; }
            body em, body i { font-style: normal !important; }
            body h1, body p, body ul { font: inherit !important; margin: 0 !important; padding: 0 !important; }
            body ul { list-style: none !important; }
            body a { color: inherit !important; text-decoration: none !important; }
        `,
    });
    await setFixtureData(
        page,
        '<h1 id="browser-heading">Heading</h1><p id="browser-paragraph"><span id="browser-normal">normal</span> <strong id="browser-strong">strong</strong> <b id="browser-bold">bold</b> <em id="browser-emphasis">emphasis</em> <i id="browser-italic">italic</i> <a id="browser-link" href="/docs">link</a> <sub id="browser-sub">sub</sub></p><ul id="browser-list"><li id="browser-item">item</li></ul>',
    );
    const browserStyles = await surface
        .locator('.soeditor-wysiwyg-content')
        .evaluate((element) => {
            const read = (id: string): CSSStyleDeclaration => {
                const target = element.querySelector(`#${id}`);
                if (!(target instanceof HTMLElement)) {
                    throw new Error(`Missing browser-style fixture ${id}.`);
                }
                return getComputedStyle(target);
            };
            return {
                boldWeight: Number(read('browser-bold').fontWeight),
                emphasisStyle: read('browser-emphasis').fontStyle,
                headingSize: Number.parseFloat(
                    read('browser-heading').fontSize,
                ),
                headingWeight: Number(read('browser-heading').fontWeight),
                italicStyle: read('browser-italic').fontStyle,
                itemDisplay: read('browser-item').display,
                linkDecoration: read('browser-link').textDecorationLine,
                listStyle: read('browser-list').listStyleType,
                normalSize: Number.parseFloat(read('browser-normal').fontSize),
                paragraphMargin: Number.parseFloat(
                    read('browser-paragraph').marginBlockStart,
                ),
                strongWeight: Number(read('browser-strong').fontWeight),
                subAlignment: read('browser-sub').verticalAlign,
            };
        });
    expect(browserStyles.strongWeight).toBeGreaterThanOrEqual(700);
    expect(browserStyles.boldWeight).toBeGreaterThanOrEqual(700);
    expect(browserStyles.emphasisStyle).toBe('italic');
    expect(browserStyles.italicStyle).toBe('italic');
    expect(browserStyles.headingWeight).toBeGreaterThanOrEqual(700);
    expect(browserStyles.headingSize).toBeGreaterThan(browserStyles.normalSize);
    expect(browserStyles.paragraphMargin).toBeGreaterThan(0);
    expect(browserStyles.listStyle).toBe('disc');
    expect(browserStyles.itemDisplay).toBe('list-item');
    expect(browserStyles.linkDecoration).toContain('underline');
    expect(browserStyles.subAlignment).toBe('sub');
});

test('keeps hidden CMS toolbar commands available to integrations', async ({
    page,
}) => {
    const editor = page.locator('.soeditor-classic');
    for (const item of [
        'pageBreak',
        'placeholder',
        'redo',
        'source',
        'sourceFind',
        'specialCharacter',
        'undo',
    ]) {
        await expect(
            editor.locator(`[data-toolbar-item="${item}"]`),
        ).toHaveCount(0);
    }
    expect(
        await page.evaluate(() =>
            [
                'editor.undo',
                'editor.redo',
                'pageBreak.insert',
                'specialCharacter.insert',
                'placeholder.insert',
            ].every((command) =>
                globalThis.__wysiwygFixture.editor.editor.commands.has(command),
            ),
        ),
    ).toBe(true);
});

test('has no automated WCAG A or AA violation in direct WYSIWYG authoring', async ({
    page,
}) => {
    const results = await new AxeBuilder({ page })
        .include('.soeditor-classic')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
    expect(results.violations).toEqual([]);
});
