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
    await expect(
        page.locator('[data-classic-action="workspace-view"] option'),
    ).toHaveText([
        'WYSIWYG',
        'Source',
        'WYSIWYG + Source',
        'WYSIWYG + Preview',
        'Source + Preview',
        'WYSIWYG + Source + Preview',
        'Preview',
    ]);
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
        .selectOption('source');
    const source = page.locator('.soeditor-classic__source');
    await expect(source).toBeVisible();
    await expect(source).toContainText('Added');

    await page
        .locator('[data-classic-action="workspace-view"]')
        .selectOption('wysiwyg');
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
    await page.locator('[data-toolbar-item="undo"]').click();
    await expect(paragraph).toContainText('Alpha');
    await page.locator('[data-toolbar-item="redo"]').click();
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
        await color.getByRole('button', { name: 'Apply color' }).click();
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
        await background.getByRole('button', { name: 'Apply color' }).click();
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
    await dialog.getByLabel('Title').fill('Alpha article');
    await dialog.getByLabel('Common target').selectOption('_blank');
    await expect(dialog.getByLabel('Target', { exact: true })).toHaveValue(
        '_blank',
    );
    await dialog.getByLabel('Target', { exact: true }).fill('articlePreview');
    await dialog.getByRole('button', { name: 'Relationship nofollow' }).click();
    await dialog.getByLabel('Add relationship').fill('privacy-policy');
    await dialog.getByRole('button', { name: 'Add', exact: true }).click();
    await dialog.getByRole('button', { name: 'Insert link' }).click();
    const link = target.locator('a');
    await expect(link).toHaveText('Alpha');
    await expect(link).toHaveAttribute('href', '/alpha');
    await expect(link).toHaveAttribute('target', 'articlePreview');
    await expect(link).toHaveAttribute('rel', 'nofollow privacy-policy');

    const linkPoint = await textPoint(link, 2);
    await page.mouse.click(linkPoint.x, linkPoint.y);
    await page.getByRole('button', { name: 'Edit link' }).click();
    dialog = page.getByRole('dialog', { name: 'Edit link' });
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
    await dialog.getByLabel('Link URL').fill('/updated');
    await dialog.getByRole('button', { name: 'Update link' }).click();
    await expect(link).toHaveAttribute('href', '/updated');

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
    await expect(tableDialog.getByLabel('Caption')).toHaveValue(
        'Initial caption',
    );
    await tableDialog.getByLabel('Caption').fill('Qualified caption');
    await tableDialog.getByLabel('Width (px or %)').fill('65%');
    await tableDialog.getByLabel('Alignment').selectOption('center');
    await tableDialog.getByRole('button', { name: 'Apply' }).click();
    const table = surface.locator('table');
    await expect(table.locator('caption')).toHaveText('Qualified caption');
    await expect(table).toHaveAttribute('style', /width:\s*65%/u);
    await expect(table).toHaveAttribute('style', /margin-inline:\s*auto/u);

    await first.click();
    await toolbar.getByRole('button', { name: 'Row properties' }).click();
    const rowDialog = page.getByRole('dialog', { name: 'Row properties' });
    await rowDialog.getByLabel('Section').selectOption('head');
    await rowDialog.getByLabel('Height').fill('48');
    await rowDialog.getByLabel('Row classes').fill('featured-row');
    await rowDialog.getByRole('button', { name: 'Apply' }).click();
    await expect(surface.locator('thead tr')).toHaveAttribute(
        'style',
        /height:\s*48px/u,
    );
    await expect(surface.locator('thead tr')).toHaveClass(/featured-row/u);

    await surface.locator('thead td, thead th').first().click();
    await toolbar.getByRole('button', { name: 'Toggle header' }).click();
    await surface.locator('thead th').first().click();
    await toolbar.getByRole('button', { name: 'Cell properties' }).click();
    const cellDialog = page.getByRole('dialog', { name: 'Cell properties' });
    await cellDialog.getByLabel('Horizontal alignment').selectOption('center');
    await cellDialog.getByLabel('Vertical alignment').selectOption('middle');
    await cellDialog.getByLabel('Header scope').selectOption('col');
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
    await toolbar.getByLabel('Column width').fill('240');
    await expect(surface.locator('col').first()).toHaveAttribute(
        'style',
        /width:\s*240px/u,
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
    await surface.locator('#range-d').click({ modifiers: ['Shift'] });
    await expect(
        surface.locator('.soeditor-table-cell.is-structurally-selected'),
    ).toHaveCount(4);
    const toolbar = page.locator('.soeditor-ui__table-balloon');
    await toolbar.getByRole('button', { name: 'Merge cells' }).click();
    let cells = surface.locator('td,th');
    await expect(cells).toHaveCount(1);
    await expect(cells.first()).toHaveAttribute('colspan', '2');
    await expect(cells.first()).toHaveAttribute('rowspan', '2');

    await cells.first().click();
    await toolbar.getByRole('button', { name: 'Split cell' }).click();
    cells = surface.locator('td,th');
    await expect(cells).toHaveCount(4);
    await expect(cells.first()).not.toHaveAttribute('colspan');
    await expect(cells.first()).not.toHaveAttribute('rowspan');

    await cells.first().click();
    await cells.nth(3).click({ modifiers: ['Shift'] });
    await toolbar.getByRole('button', { name: 'Clear cells' }).click();
    await expect(cells).toHaveText(['', '', '', '']);
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
    await page.locator('[data-toolbar-item="undo"]').click();
    await expect(surface.locator('tr')).toHaveCount(2);
    await page.locator('[data-toolbar-item="redo"]').click();
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

test('edits inserted images and videos by double click in WYSIWYG', async ({
    page,
}) => {
    const surface = page.locator('.soeditor-classic__visual');
    await setFixtureData(
        page,
        '<p><img src="/before.png" alt="Before"></p><video src="/before.mp4" title="Before video"></video>',
    );
    await surface.locator('img').dblclick();
    let dialog = page.getByRole('dialog', { name: 'Image properties' });
    await dialog.getByLabel('Alternative text').fill('After image');
    await dialog.getByLabel('Width').fill('420');
    await dialog.getByRole('button', { name: 'Update image' }).click();
    await expect(surface.locator('img')).toHaveAttribute('alt', 'After image');
    await expect(surface.locator('img')).toHaveAttribute('width', '420');

    const video = surface.locator('video');
    await video.dblclick({ position: { x: 2, y: 2 } });
    dialog = page.getByRole('dialog', { name: 'Video properties' });
    await expect(dialog.getByLabel('Video URL')).toHaveValue('/before.mp4');
    await dialog.getByLabel('Video URL').fill('/after.mp4');
    await dialog.getByLabel('Poster URL').fill('/poster.png');
    await dialog.getByLabel('Title').fill('After video');
    await dialog.getByRole('button', { name: 'Update video' }).click();
    await expect(video).toHaveAttribute('src', '/after.mp4');
    await expect(video).toHaveAttribute('poster', '/poster.png');
    await expect(video).toHaveAttribute('title', 'After video');
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
    await page.locator('[data-toolbar-item="undo"]').click();
    await expect(cell).toHaveText('Cell');
    await expect(surface.locator('td').nth(1)).toHaveText('Keep');
});

test('presents all seven explicit WYSIWYG, Source, and Preview layouts', async ({
    page,
}) => {
    const editor = page.locator('.soeditor-classic');
    const view = editor.getByLabel('Editing view');
    const layouts = [
        ['wysiwyg', 'wysiwyg', 1],
        ['source', 'source', 1],
        ['wysiwyg-source', 'wysiwyg source', 2],
        ['wysiwyg-preview', 'wysiwyg preview', 2],
        ['source-preview', 'source preview', 2],
        ['wysiwyg-source-preview', 'wysiwyg source preview', 3],
        ['preview', 'preview', 1],
    ] as const;
    for (const [value, projections, panes] of layouts) {
        await view.selectOption(value);
        await expect(editor).toHaveAttribute(
            'data-soeditor-workspace-view',
            value,
        );
        await expect(editor).toHaveAttribute(
            'data-soeditor-projections',
            projections,
        );
        await expect(editor).toHaveAttribute(
            'data-soeditor-pane-count',
            String(panes),
        );
    }

    await view.selectOption('wysiwyg-source');
    const toggle = editor.locator('[data-toolbar-item="source"]');
    await editor.locator('.soeditor-classic__source .cm-content').click();
    await expect(toggle).toHaveAttribute('data-switch-target', 'wysiwyg');
    await editor.locator('.soeditor-classic__visual h1').dblclick();
    await expect(toggle).toHaveAttribute('data-switch-target', 'source');

    await view.selectOption('preview');
    const frame = editor.locator('iframe').contentFrame();
    await expect(frame.getByText('Direct WYSIWYG preview')).toBeVisible();
    await editor.locator('[data-classic-action="maximize"]').click();
    await expect(editor).toHaveClass(/is-maximized/u);
    await expect(editor.locator('.soeditor-classic__preview')).toBeVisible();
});

test('formats and minifies only Source while preserving inert unsupported HTML', async ({
    page,
}) => {
    const editor = page.locator('.soeditor-classic');
    await setFixtureData(
        page,
        '<main><h1>Source</h1><p>Text <strong>bold</strong></p><!--marker--><product-card data-id="7"></product-card><script>parent.__unsafeExecuted=true</script></main>',
    );
    await editor.getByLabel('Editing view').selectOption('source');
    const format = editor.locator('[data-toolbar-item="format"]');
    const minify = editor.locator('[data-toolbar-item="minify"]');
    await expect(format).toBeVisible();
    await expect(minify).toBeVisible();
    await format.click();
    const readData = () =>
        page.evaluate(() => {
            const fixture = Reflect.get(globalThis, '__wysiwygFixture') as {
                getData(): string;
            };
            return fixture.getData();
        });
    await expect.poll(readData).toContain('\n');
    const formatted = await readData();
    expect(formatted).toContain('\n');
    expect(formatted).not.toMatch(/\r?\n[ \t]*>/u);
    expect(formatted).toContain('<!--marker-->');
    expect(formatted).toContain('<product-card data-id="7">');

    await editor.getByLabel('Editing view').selectOption('preview');
    await expect(
        editor.locator('iframe').contentFrame().getByRole('heading', {
            name: 'Source',
        }),
    ).toBeVisible();
    expect(
        await page.evaluate(() => Reflect.get(globalThis, '__unsafeExecuted')),
    ).toBeUndefined();

    await editor.getByLabel('Editing view').selectOption('source');
    await setFixtureData(
        page,
        '<main>\n  <h1>Compact</h1>\n  <p>HTML</p>\n</main>',
    );
    await expect(minify).toBeEnabled();
    await page.evaluate(async () => {
        const fixture = Reflect.get(globalThis, '__wysiwygFixture') as {
            editor: { editor: { execute(command: string): unknown } };
        };
        await fixture.editor.editor.execute('document.minify');
    });
    await expect
        .poll(readData)
        .toBe('<main><h1>Compact</h1><p>HTML</p></main>');
    const minified = await readData();
    expect(minified).toBe('<main><h1>Compact</h1><p>HTML</p></main>');
});

test('reports document counts, switches isolated styles, and inserts a preset character', async ({
    page,
}) => {
    const editor = page.locator('.soeditor-classic');
    const surface = editor.locator('.soeditor-classic__visual');
    await setFixtureData(page, '<p id="count-target">Hello 世界</p>');
    const status = editor.locator('.soeditor-ui__document-status');
    await expect(status).toHaveAttribute('data-words', '2');
    await expect(status).toHaveAttribute('data-characters', '8');
    await expect(status).toHaveAttribute('data-source-characters', '33');

    const styles = editor.getByLabel('Content style');
    await expect(styles.locator('option')).toHaveText([
        'Browser default',
        'Minimal',
        'Article',
        'Email',
    ]);
    await styles.selectOption('article');
    await expect(surface).toHaveAttribute(
        'data-soeditor-content-style',
        'article',
    );
    await styles.selectOption('browser');
    await expect(surface).toHaveAttribute(
        'data-soeditor-content-style',
        'browser',
    );

    await clickTextBoundary(page, surface.locator('#count-target'), 8);
    const special = editor.locator('[data-toolbar-item="specialCharacter"]');
    await special.locator('summary').click();
    await special.getByRole('button', { name: 'Insert ©' }).click();
    await expect(surface.locator('#count-target')).toHaveText('Hello 世界©');

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

test('inserts preset special characters at the live caret in every content position', async ({
    page,
}) => {
    const editor = page.locator('.soeditor-classic');
    const surface = editor.locator('.soeditor-classic__visual');
    const special = editor.locator('[data-toolbar-item="specialCharacter"]');
    await setFixtureData(
        page,
        '<p id="symbol-first">ABCDE</p><p id="symbol-second">12345</p><table><tbody><tr><td id="symbol-cell">XYZ</td></tr></tbody></table>',
    );

    const insert = async (
        target: Locator,
        offset: number,
        character: string,
    ): Promise<void> => {
        await clickTextBoundary(page, target, offset);
        await special.locator('summary').click();
        await special
            .getByRole('button', { name: `Insert ${character}` })
            .click();
    };

    await insert(surface.locator('#symbol-first'), 2, '©');
    await expect(surface.locator('#symbol-first')).toHaveText('AB©CDE');
    await insert(surface.locator('#symbol-second'), 3, 'Ω');
    await expect(surface.locator('#symbol-second')).toHaveText('123Ω45');
    await insert(surface.locator('#symbol-cell'), 1, '✓');
    await expect(surface.locator('#symbol-cell')).toHaveText('X✓YZ');

    await setFixtureData(page, '<p id="symbol-immediate">ABCDE</p>');
    await page.evaluate(() => {
        const visual = document.querySelector<HTMLElement>(
            '.soeditor-classic__visual',
        );
        const root = visual?.shadowRoot;
        const text = root?.querySelector('#symbol-immediate')?.firstChild;
        const summary = document.querySelector<HTMLElement>(
            '[data-toolbar-item="specialCharacter"] summary',
        );
        const character = document.querySelector<HTMLButtonElement>(
            '[data-toolbar-item="specialCharacter"] [aria-label="Insert ©"]',
        );
        if (
            root === null ||
            root === undefined ||
            text === null ||
            text === undefined ||
            summary === null ||
            character === null
        ) {
            throw new Error('Missing immediate special-character fixture.');
        }
        document.getSelection()?.setBaseAndExtent(text, 3, text, 3);
        summary.dispatchEvent(
            new PointerEvent('pointerdown', { bubbles: true, composed: true }),
        );
        summary.click();
        character.dispatchEvent(
            new PointerEvent('pointerdown', { bubbles: true, composed: true }),
        );
        character.click();
    });
    await expect(surface.locator('#symbol-immediate')).toHaveText('ABC©DE');

    await clickTextBoundary(page, surface.locator('#symbol-immediate'), 1);
    await special.locator('summary').click();
    await special.getByRole('button', { name: 'Custom…' }).click();
    const customDialog = page.getByRole('dialog', {
        name: 'Special character',
    });
    await customDialog.getByLabel('Character').fill('※');
    await customDialog
        .getByRole('button', { name: 'Insert character' })
        .click();
    await expect(surface.locator('#symbol-immediate')).toHaveText('A※BC©DE');
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
