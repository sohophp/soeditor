import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const legacyProduct = readFileSync(
    new URL('../fixtures/cms/legacy-product.html', import.meta.url),
    'utf8',
);

test('keeps block serialization current through native edits, history and external repair', async ({
    page,
}) => {
    const visual = page.locator(
        '.soeditor-classic__visual .soeditor-wysiwyg-content',
    );
    await page.evaluate(() =>
        globalThis.__classicDemo.editor.setData(
            '<p id="first">First</p><p id="second">Second</p><p id="third">Third</p><!--keep--><cms-card data-id="7"></cms-card>',
        ),
    );
    for (const id of ['first', 'third', 'second', 'first']) {
        await visual.locator(`#${id}`).click();
        await page.keyboard.press('End');
        await page.keyboard.insertText('X');
    }
    const edited = await page.evaluate(() =>
        globalThis.__classicDemo.getData(),
    );
    expect(edited).toBe(
        '<p id="first">FirstXX</p><p id="second">SecondX</p><p id="third">ThirdX</p><!--keep--><cms-card data-id="7"></cms-card>',
    );
    // Cross-block deletion and paragraph splitting invalidate both structure and text.
    await page.evaluate(() =>
        globalThis.__classicDemo.select({
            anchor: { block: 0, offset: 3 },
            focus: { block: 1, offset: 3 },
        }),
    );
    await page.keyboard.press('Backspace');
    expect(
        await page.evaluate(() => globalThis.__classicDemo.getData()),
    ).not.toBe(edited);
    await page.evaluate(() => globalThis.__classicDemo.execute('editor.undo'));
    expect(await page.evaluate(() => globalThis.__classicDemo.getData())).toBe(
        edited,
    );
    await visual.locator('#third').click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.keyboard.insertText('New paragraph');
    const split = await page.evaluate(() => globalThis.__classicDemo.getData());
    expect(split).toContain('New paragraph');
    // A cached subtree modified outside commands must still be repaired.
    await visual.locator('#second').evaluate((element) => {
        element.remove();
        element.textContent = 'Untrusted detached edit';
        document
            .querySelector('.soeditor-classic__visual')
            ?.shadowRoot?.querySelector('.soeditor-wysiwyg-content')
            ?.append(element);
    });
    await expect(visual.locator('#second')).toHaveText('SecondX');
    expect(await page.evaluate(() => globalThis.__classicDemo.getData())).toBe(
        split,
    );
    await page.evaluate(async () => {
        const editor = globalThis.__classicDemo.editor;
        await editor.setWorkspaceView('source');
        editor.setData(
            '<p id="replacement">Equal-length replacement</p><!--new-->',
        );
        await editor.setWorkspaceView('wysiwyg');
    });
    await visual.locator('#replacement').click();
    await page.keyboard.press('End');
    await page.keyboard.insertText('!');
    expect(await page.evaluate(() => globalThis.__classicDemo.getData())).toBe(
        '<p id="replacement">Equal-length replacement!</p><!--new-->',
    );
});

test('round-trips the synthetic legacy CMS corpus through editing, saving and reopening', async ({
    page,
}) => {
    await page.evaluate(
        (source) => globalThis.__classicDemo.editor.setData(source),
        legacyProduct,
    );
    const visual = page.locator(
        '.soeditor-classic__visual .soeditor-wysiwyg-content',
    );
    await visual.locator('#intro').click();
    await page.keyboard.press('End');
    await page.keyboard.insertText(' 已校对');
    await visual.locator('#ending').click();
    await page.keyboard.press('End');
    await page.keyboard.insertText(' 已完成');
    const edited = await page.evaluate(() =>
        globalThis.__classicDemo.getData(),
    );
    expect(edited).toContain('已校对');
    expect(edited).toContain('已完成');
    for (const marker of [
        '<!--CMS:block:product-42-->',
        'cellpadding="6"',
        'cellspacing="2"',
        'data-unit="mm"',
        'type="A"',
        'value="9"',
        '<product-card data-id="42">',
        '<template data-cms="price">',
        '{{ product.price }}',
        '<script>',
        'onerror=',
    ])
        expect(edited).toContain(marker);
    const before = await visual.locator('#intro').elementHandle();
    for (const view of [
        'source',
        'wysiwyg-source-horizontal',
        'wysiwyg-source-vertical',
        'wysiwyg',
    ] as const) {
        await page.evaluate(
            (view) => globalThis.__classicDemo.editor.setWorkspaceView(view),
            view,
        );
        expect(
            await page.evaluate(() => globalThis.__classicDemo.getData()),
        ).toBe(edited);
    }
    expect(await before?.evaluate((node) => node.isConnected)).toBe(true);
    await before?.dispose();
    await page.getByRole('button', { name: 'Save article' }).click();
    expect(await page.evaluate(() => globalThis.__classicDemo.formData())).toBe(
        edited,
    );
    const reopened = await page.evaluate(async () => {
        const harness = globalThis.__classicDemo;
        const data = harness.getData();
        const host = document.createElement('textarea');
        host.value = data;
        document.body.append(host);
        const instance = await harness.create(host);
        const result = instance.getData();
        await instance.destroy();
        host.remove();
        return result;
    });
    expect(reopened).toBe(edited);
    expect(
        await page.evaluate(() =>
            Reflect.get(globalThis, '__cmsFixtureExecuted'),
        ),
    ).toBeUndefined();
    await expect(visual.locator('script, [onerror]')).toHaveCount(0);
});

test('retains instance isolation and host cleanup across repeated CMS sessions', async ({
    page,
}) => {
    test.setTimeout(120000);
    await page.locator('.soeditor-classic__visual p').first().click();
    for (let round = 0; round < 5; round += 1) {
        const alignment = page.locator(
            '[data-toolbar-item="alignment"] summary',
        );
        await alignment.focus();
        await page.keyboard.press('ArrowDown');
        await expect(
            page.locator(
                '[data-toolbar-item="alignment"] .soeditor-ui__menu-items',
            ),
        ).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(alignment).toBeFocused();
        const name = `session-${String(round)}.png`;
        const before = await page.evaluate((name) => {
            const harness = globalThis.__classicDemo;
            harness.setUploadMode('manual');
            void harness.upload(name);
            return harness.getData();
        }, name);
        const row = page.locator('[data-upload-id]').filter({ hasText: name });
        await row
            .getByRole('button', { name: `Cancel: ${name}`, exact: true })
            .click();
        await expect(row).toHaveAttribute('data-upload-state', 'cancelled');
        expect(
            await page.evaluate(() => globalThis.__classicDemo.getData()),
        ).toBe(before);
        await row
            .getByRole('button', { name: `Close: ${name}`, exact: true })
            .click();
        await page.evaluate(async (name) => {
            const harness = globalThis.__classicDemo;
            harness.setUploadMode('fail');
            try {
                await harness.upload(name);
            } catch {
                /* Expected adapter failure. */
            }
            harness.setUploadMode('success');
        }, name);
        await row
            .getByRole('button', { name: `Retry: ${name}`, exact: true })
            .click();
        await expect(row).toHaveAttribute('data-upload-state', 'succeeded');
        await row
            .getByRole('button', { name: `Close: ${name}`, exact: true })
            .click();
        await expect(row).toHaveCount(0);
    }
    const result = await page.evaluate(async () => {
        const harness = globalThis.__classicDemo;
        const original = harness.getData();
        const errors: string[] = [];
        for (let round = 0; round < 20; round += 1) {
            const form = document.createElement('form');
            const host = document.createElement('textarea');
            host.name = 'article';
            host.defaultValue = `<p>Session ${String(round)}</p><!--host-->`;
            form.append(host);
            document.body.append(form);
            const instance = await harness.create(host, {
                editingModes: ['wysiwyg', 'source'],
            });
            try {
                for (const view of [
                    'source',
                    'wysiwyg-source-horizontal',
                    'wysiwyg-source-vertical',
                    'wysiwyg',
                ] as const)
                    await instance.setWorkspaceView(view);
                instance.setReadonly(true);
                if (
                    instance.element
                        .querySelector('.soeditor-classic__visual')
                        ?.shadowRoot?.querySelector('[contenteditable="true"]')
                )
                    errors.push('readonly');
                instance.setReadonly(false);
                instance.setData(
                    `<p>Changed ${String(round)}</p><!--retained-->`,
                );
                instance.editor.execute('editor.undo');
                instance.editor.execute('editor.redo');
                if (!instance.getData().includes('<!--retained-->'))
                    errors.push('history');
                form.reset();
                await new Promise<void>((done) => setTimeout(done, 0));
                if (!instance.getData().includes(`Session ${String(round)}`))
                    errors.push('reset');
            } finally {
                await instance.destroy();
                await instance.destroy();
                if (host.hidden || form.querySelector('.soeditor-classic'))
                    errors.push('cleanup');
                form.remove();
            }
            if (harness.getData() !== original) errors.push('isolation');
        }
        return errors;
    });
    expect(result).toEqual([]);
    await expect(page.locator('.soeditor-classic')).toHaveCount(1);
});

test.beforeEach(async ({ page }) => {
    await page.goto('/classic.html?test=1');
    await page.locator('body[data-ready="true"]').waitFor();
});

test('preserves one article through paste, formatting, media, Source and submission', async ({
    page,
}) => {
    const visual = page.locator(
        '.soeditor-classic__visual .soeditor-wysiwyg-content',
    );
    await page.evaluate(() => {
        const harness = globalThis.__classicDemo;
        harness.editor.setData('<p>Start</p>');
        harness.select({
            anchor: { block: 0, offset: 0 },
            focus: { block: 0, offset: 5 },
        });
    });
    await visual.locator('p').click();
    await page.keyboard.press('ControlOrMeta+a');
    await visual.evaluate((host) => {
        const transfer = new DataTransfer();
        transfer.setData(
            'text/html',
            '<p style="mso-x:1">Article title</p><p>List item</p><p>Media position</p>',
        );
        transfer.setData(
            'text/plain',
            'Article title\nList item\nMedia position',
        );
        const paste = new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            clipboardData: transfer,
        });
        Object.defineProperty(paste, 'clipboardData', { value: transfer });
        host.dispatchEvent(paste);
    });
    await visual.locator('p').filter({ hasText: 'Article title' }).click();
    await page.evaluate(() =>
        globalThis.__classicDemo.execute('paragraph.heading', 2),
    );
    await visual.locator('p').filter({ hasText: 'List item' }).click();
    await page.evaluate(() => globalThis.__classicDemo.execute('list.ordered'));
    await visual.locator('p').filter({ hasText: 'Media position' }).click();
    await page.keyboard.press('End');
    await page.evaluate(async () => {
        await globalThis.__classicDemo.upload('continuous.png');
    });
    await expect(visual.locator('h2')).toHaveText('Article title');
    await expect(visual.locator('ol li')).toHaveText('List item');
    await expect(visual.locator('img')).toHaveAttribute(
        'src',
        '/uploads/continuous.png',
    );
    await visual.locator('img').click();
    await page
        .getByRole('button', { name: 'Insert paragraph after this block' })
        .click();
    await page.evaluate(() =>
        globalThis.__classicDemo.execute('table.insert', {
            rows: 2,
            columns: 2,
        }),
    );
    await expect(visual.locator('td')).toHaveCount(4);
    const beforeSource = await page.evaluate(() =>
        globalThis.__classicDemo.getData(),
    );
    await page.locator('[data-workspace-view="source"]').first().click();
    const source = page.locator('.soeditor-classic__source .cm-content');
    await source.click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.insertText('<!--continuous-edit-->');
    await page.keyboard.press('ControlOrMeta+z');
    await expect
        .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
        .toBe(beforeSource);
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect
        .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
        .toContain('<!--continuous-edit-->');
    await page.getByRole('button', { name: 'Save article' }).click();
    const submitted = page.getByLabel('Submitted source');
    await expect(submitted).toContainText('<h2>Article title</h2>');
    await expect(submitted).toContainText('<li><p>List item</p></li>');
    await expect(submitted).toContainText('/uploads/continuous.png');
    await expect(submitted).toContainText('<table>');
    await expect(submitted).toContainText('<!--continuous-edit-->');
});

test('keeps separate Chinese composition sessions atomic in shared history', async ({
    page,
}) => {
    const visual = page.locator(
        '.soeditor-classic__visual .soeditor-wysiwyg-content',
    );
    await page.evaluate(() => {
        const harness = globalThis.__classicDemo;
        harness.editor.setData('<p>旧内容</p>');
        harness.select({
            anchor: { block: 0, offset: 0 },
            focus: { block: 0, offset: 3 },
        });
    });
    await visual.evaluate((host) => {
        host.dispatchEvent(new CompositionEvent('compositionstart'));
    });
    await page.keyboard.insertText('新内容');
    await visual.evaluate((host) => {
        host.dispatchEvent(new CompositionEvent('compositionend'));
    });
    await expect
        .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
        .toBe('<p>新内容</p>');

    await visual.evaluate((host) => {
        host.dispatchEvent(new CompositionEvent('compositionstart'));
    });
    await page.keyboard.insertText('，世界');
    await visual.evaluate((host) => {
        host.dispatchEvent(new CompositionEvent('compositionend'));
    });
    await expect
        .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
        .toBe('<p>新内容，世界</p>');
    await page.keyboard.press('ControlOrMeta+z');
    await expect
        .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
        .toBe('<p>新内容</p>');
    await page.keyboard.press('ControlOrMeta+z');
    await expect
        .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
        .toBe('<p>旧内容</p>');
});

test('keeps touch-sized classic controls, logical RTL chrome, and content direction isolated', async ({
    page,
}, testInfo) => {
    await page.setViewportSize({ height: 720, width: 390 });
    await page.evaluate(async () => {
        const host = document.createElement('textarea');
        host.id = 'mobile-rtl';
        host.value = '<p>محتوى عربي</p>';
        document.body.append(host);
        const editor = await globalThis.__classicDemo.create(host, {
            direction: 'rtl',
            locale: 'ar',
            toolbar: [
                'bold',
                'italic',
                'alignment',
                'orderedList',
                'unorderedList',
                'link',
                'source',
            ],
            translations: [
                {
                    direction: 'rtl',
                    locale: 'ar',
                    messages: {
                        'Accessibility help': 'مساعدة إمكانية الوصول',
                        Bold: 'عريض',
                        Help: 'مساعدة',
                    },
                },
            ],
        });
        editor.element.id = 'mobile-rtl-editor';
        Reflect.set(globalThis, '__mobileRtlEditor', editor);
    });
    const chrome = page.locator('.soeditor-ui__chrome[lang="ar"]');
    const classic = chrome.locator('xpath=..');
    await expect(chrome).toHaveAttribute('dir', 'rtl');
    await expect(classic.locator('.soeditor-classic__visual')).toHaveCSS(
        'direction',
        'ltr',
    );
    const help = chrome.getByRole('button', {
        name: 'مساعدة إمكانية الوصول',
    });
    await expect(help).toHaveCSS('cursor', 'pointer');
    await expect(help).toHaveCSS('min-height', '44px');
    await help.click();
    await expect(
        chrome.getByRole('dialog', { name: 'مساعدة إمكانية الوصول' }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(help).toBeFocused();
    await classic.locator('.soeditor-wysiwyg-content p').click();
    for (const name of ['alignment', 'orderedList', 'unorderedList']) {
        const summary = chrome.locator(`[data-toolbar-item="${name}"] summary`);
        if (testInfo.project.use.hasTouch) await summary.tap();
        else await summary.click();
        const menu = chrome.locator(
            `[data-toolbar-item="${name}"] .soeditor-ui__menu-items`,
        );
        await expect(menu).toBeVisible();
        const choice = menu.locator('button').first();
        const bounds = await choice.boundingBox();
        if (!bounds) throw new Error('Missing format choice');
        // Firefox may report 44 CSS pixels as 43.999969 layout pixels.
        expect(Math.round(bounds.width * 100) / 100).toBeGreaterThanOrEqual(44);
        expect(Math.round(bounds.height * 100) / 100).toBeGreaterThanOrEqual(
            44,
        );
        if (testInfo.project.use.hasTouch) await choice.tap();
        else await choice.click();
        await expect(menu).not.toBeVisible();
    }
    await page.setViewportSize({ height: 480, width: 390 });
    await expect(chrome.getByRole('toolbar')).toBeVisible();

    const visual = classic.locator('.soeditor-classic__visual');
    const before = await visual.evaluate(
        (element) => element.getBoundingClientRect().height,
    );
    await classic.getByRole('separator').evaluate((handle) => {
        const box = handle.getBoundingClientRect();
        handle.dispatchEvent(
            new PointerEvent('pointerdown', {
                bubbles: true,
                button: 0,
                clientY: box.top,
                pointerType: 'touch',
            }),
        );
        document.dispatchEvent(
            new PointerEvent('pointermove', {
                bubbles: true,
                clientY: box.top + 24,
                pointerType: 'touch',
            }),
        );
        document.dispatchEvent(
            new PointerEvent('pointerup', {
                bubbles: true,
                clientY: box.top + 24,
                pointerType: 'touch',
            }),
        );
    });
    await expect
        .poll(() =>
            visual.evaluate(
                (element) => element.getBoundingClientRect().height,
            ),
        )
        .toBeGreaterThan(before);
    const accessibility = await new AxeBuilder({ page })
        .include('#mobile-rtl-editor')
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();
    expect(accessibility.violations).toEqual([]);

    await page.evaluate(async () => {
        const editor = Reflect.get(globalThis, '__mobileRtlEditor') as {
            destroy(): Promise<void>;
        };
        await editor.destroy();
    });
    await expect(page.locator('#mobile-rtl')).toBeVisible();
});

test('completes the canonical CMS authoring, submit, security, and teardown journey', async ({
    page,
}) => {
    const visual = page.locator(
        '.soeditor-classic__visual .soeditor-wysiwyg-content',
    );
    await expect
        .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
        .toContain(
            '<!--CMS:block--><product-card data-id="42"></product-card>',
        );

    await page.evaluate(() => {
        const harness = globalThis.__classicDemo;
        harness.editor.setData('<p>旧内容 Alpha Beta</p>');
        harness.select({
            anchor: { block: 0, offset: 0 },
            focus: { block: 0, offset: 3 },
        });
    });
    await visual.evaluate((host) => {
        host.dispatchEvent(new CompositionEvent('compositionstart'));
    });
    await page.keyboard.insertText('新内容');
    await visual.evaluate((host) => {
        host.dispatchEvent(new CompositionEvent('compositionend'));
    });
    await page.evaluate(() => {
        const harness = globalThis.__classicDemo;
        harness.select({
            anchor: { block: 0, offset: 4 },
            focus: { block: 0, offset: 9 },
        });
        harness.execute('style.lead');
        harness.editor.setData(
            `${harness.getData()}<ol><li>First</li><li>Second</li></ol>`,
        );
        harness.select({
            anchor: { block: 2, offset: 0 },
            focus: { block: 2, offset: 0 },
        });
    });
    await page.keyboard.press('Tab');
    await expect
        .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
        .toContain('<li>First<ol><li>Second</li></ol></li>');

    await visual.evaluate((host) => {
        const transfer = new DataTransfer();
        transfer.setData(
            'text/html',
            '<h2 style="mso-x:1" onclick="run()">Office heading</h2><p><b>Office bold</b></p><script>run()</script>',
        );
        transfer.setData('text/plain', 'Office heading\nOffice bold');
        const paste = new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            clipboardData: transfer,
        });
        Object.defineProperty(paste, 'clipboardData', {
            configurable: true,
            value: transfer,
        });
        host.dispatchEvent(paste);
    });
    const afterPaste = await page.evaluate(() =>
        globalThis.__classicDemo.getData(),
    );
    expect(afterPaste).toContain('<h2>Office heading</h2>');
    expect(afterPaste).toContain('<strong>Office bold</strong>');
    expect(afterPaste).not.toMatch(/mso-|onclick|<script/iu);

    await page.evaluate(async () => {
        const harness = globalThis.__classicDemo;
        await harness.upload('journey.png');
        harness.editor.setData('<p>Linked article</p>');
        harness.select({
            anchor: { block: 0, offset: 0 },
            focus: { block: 0, offset: 6 },
        });
        harness.execute('link.set', { href: '/articles/42', title: 'Article' });
        harness.select({
            anchor: { block: 0, offset: 14 },
            focus: { block: 0, offset: 14 },
        });
        harness.execute('table.insert', { columns: 2, rows: 2 });
        harness.execute('editor.undo');
        harness.execute('editor.redo');
    });
    await expect
        .poll(() => page.evaluate(() => globalThis.__classicDemo.getData()))
        .toContain('<table>');

    await page.locator('[data-workspace-view="source"]').first().click();
    const source = page.locator('.soeditor-classic__source .cm-content');
    await expect(source).toContainText('Linked</a> article');
    await source.click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.insertText(
        '<p>Submitted journey</p><!--CMS:retained--><product-card data-id="99"></product-card>',
    );
    await page.getByRole('button', { name: 'Save article' }).click();
    await expect(page.getByLabel('Submitted source')).toHaveText(
        '<p>Submitted journey</p><!--CMS:retained--><product-card data-id="99"></product-card>',
    );

    await page.evaluate(() => {
        globalThis.__classicDemo.editor.setData(
            '<p>Safe</p><script>globalThis.__cmsExecuted=true</script><img src="x" onerror="globalThis.__cmsExecuted=true"><product-card data-id="100"></product-card>',
        );
    });
    await page.locator('[data-workspace-view="wysiwyg"]').first().click();
    await expect(visual.locator('script')).toHaveCount(0);
    expect(
        await page.evaluate(() => Reflect.get(globalThis, '__cmsExecuted')),
    ).toBe(undefined);
    const finalSource = await page.evaluate(() =>
        globalThis.__classicDemo.getData(),
    );
    expect(finalSource).toContain('<script>');
    expect(finalSource).toContain('onerror=');
    expect(finalSource).toContain(
        '<product-card data-id="100"></product-card>',
    );

    await page.evaluate(() => globalThis.__classicDemo.destroy());
    await expect(page.locator('.soeditor-classic')).toHaveCount(0);
    await expect(page.locator('#content')).toBeVisible();
    await expect(page.locator('#content')).toHaveValue(finalSource);
});

test('preserves nested cached siblings and repairs detached descendants in one CMS container', async ({
    page,
}) => {
    const html =
        '<div class="article"><section id="a"><p>Alpha</p></section><section id="b"><p>Beta</p><span onclick="globalThis.__nestedExecuted=true">Safe</span></section><!--marker--><cms-slot data-id="4"></cms-slot></div>';
    await page.evaluate(
        (html) => globalThis.__classicDemo.editor.setData(html),
        html,
    );
    const visual = page.locator('.soeditor-wysiwyg-content');
    for (const id of ['a', 'b', 'a']) {
        await visual.locator(`#${id} p`).click();
        await page.keyboard.press('End');
        await page.keyboard.insertText('X');
    }
    const saved = await page.evaluate(() => globalThis.__classicDemo.getData());
    expect(saved).toBe(
        html.replace('Alpha', 'AlphaXX').replace('Beta', 'BetaX'),
    );
    await visual.locator('#b').evaluate((node) => {
        const parent = node.parentNode;
        node.remove();
        const text = node.querySelector('p');
        if (text !== null) text.textContent = 'Detached corruption';
        node.querySelector('span')?.setAttribute('data-changed', 'yes');
        parent?.appendChild(node);
    });
    await expect(visual.locator('#b p')).toHaveText('BetaX');
    expect(await page.evaluate(() => globalThis.__classicDemo.getData())).toBe(
        saved,
    );
    await page.evaluate(async () => {
        const editor = globalThis.__classicDemo.editor;
        await editor.setWorkspaceView('source');
        await editor.setWorkspaceView('wysiwyg');
    });
    expect(await page.evaluate(() => globalThis.__classicDemo.getData())).toBe(
        saved,
    );
    await visual.locator('#b span').click();
    expect(
        await page.evaluate(() => Reflect.get(globalThis, '__nestedExecuted')),
    ).toBeUndefined();
    expect(await visual.locator('[onclick]').count()).toBe(0);
});
