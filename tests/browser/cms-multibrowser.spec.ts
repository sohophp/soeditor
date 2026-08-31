import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.goto('/classic.html?test=1');
    await page.locator('body[data-ready="true"]').waitFor();
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
}) => {
    await page.setViewportSize({ height: 720, width: 390 });
    await page.evaluate(async () => {
        const host = document.createElement('textarea');
        host.id = 'mobile-rtl';
        host.value = '<p>محتوى عربي</p>';
        document.body.append(host);
        const editor = await globalThis.__classicDemo.create(host, {
            direction: 'rtl',
            locale: 'ar',
            toolbar: ['bold', 'italic', 'link', 'source'],
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

    await page.locator('[data-toolbar-item="source"]').first().click();
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
    await page.locator('[data-toolbar-item="source"]').first().click();
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
