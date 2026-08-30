import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const editor = '[data-testid="editor"]';

test('keeps the dark-theme primary dialog action at AA contrast', async ({
    page,
}) => {
    await page.goto('/?preset=classic');
    await page.evaluate(() => {
        const harness = (
            window as Window & {
                __soeditor?: { ui: { setTheme(theme: string): void } };
            }
        ).__soeditor;
        if (harness === undefined)
            throw new Error('UI harness was not exposed.');
        harness.ui.setTheme('dark');
    });
    await setSelection(page, 0, 0, 5);
    await page.locator('[data-toolbar-item="link"]').click();

    const primary = page.getByRole('button', { name: 'Insert link' });
    const contrast = await primary.evaluate((element) => {
        const style = getComputedStyle(element);
        return contrastRatio(style.color, style.backgroundColor);

        function contrastRatio(foreground: string, background: string): number {
            const luminance = (color: string): number => {
                const channels = color
                    .match(/[\d.]+/gu)
                    ?.slice(0, 3)
                    .map(Number);
                if (channels === undefined || channels.length !== 3) return 0;
                const linear = channels.map((channel) => {
                    const value = channel / 255;
                    return value <= 0.04045
                        ? value / 12.92
                        : ((value + 0.055) / 1.055) ** 2.4;
                });
                return (
                    (linear[0] ?? 0) * 0.2126 +
                    (linear[1] ?? 0) * 0.7152 +
                    (linear[2] ?? 0) * 0.0722
                );
            };
            const foregroundLuminance = luminance(foreground);
            const backgroundLuminance = luminance(background);
            return (
                (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
                (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
            );
        }
    });
    expect(contrast).toBeGreaterThanOrEqual(4.5);

    const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
    expect(results.violations).toEqual([]);
});

test('keeps keyboard focus visible in forced colors and honors reduced motion', async ({
    page,
}) => {
    await page.emulateMedia({
        forcedColors: 'active',
        reducedMotion: 'reduce',
    });
    await page.goto('/?split=visual-source');
    const separator = page.getByRole('separator', {
        name: 'Resize editor panes',
    });
    await separator.focus();
    await expect(separator).toBeFocused();
    const focusStyle = await separator.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
            outlineStyle: style.outlineStyle,
            outlineWidth: style.outlineWidth,
        };
    });
    expect(focusStyle).toEqual({ outlineStyle: 'solid', outlineWidth: '2px' });

    const movingElements = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('*')]
            .filter((element) => {
                if (element.classList.contains('cm-cursorLayer')) return false;
                const style = getComputedStyle(element);
                return (
                    !/^0s(?:, 0s)*$/u.test(style.animationDuration) ||
                    !/^0s(?:, 0s)*$/u.test(style.transitionDuration)
                );
            })
            .map((element) => element.outerHTML.slice(0, 160)),
    );
    expect(movingElements).toEqual([]);
});

test('returns keyboard focus to the invoking command after dialog cancellation', async ({
    page,
}) => {
    await page.goto('/?preset=classic');
    await setSelection(page, 0, 0, 5);
    const link = page.locator('[data-toolbar-item="link"]');
    await link.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Link' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Link' })).toHaveCount(0);
    await expect(link).toBeFocused();
});

test('applies application CSP nonces to generated Source and Markdown styles', async ({
    page,
}) => {
    await page.goto('/?preset=classic');
    const result = await page.evaluate(async () => {
        const harness = (
            window as Window & {
                __soeditor?: {
                    Editor: {
                        create(options: unknown): Promise<{
                            destroy(): Promise<void>;
                        }>;
                    };
                    createMarkdownEditingEngine(options: unknown): {
                        destroy(): void;
                    };
                    createSourceEditingEngine(options: unknown): {
                        destroy(): void;
                    };
                };
            }
        ).__soeditor;
        if (harness === undefined)
            throw new Error('Editor harness was not exposed.');

        const inspect = async (format: 'html' | 'markdown') => {
            const frame = document.createElement('iframe');
            frame.srcdoc =
                '<!doctype html><html><head></head><body></body></html>';
            document.body.append(frame);
            await new Promise<void>((resolve) =>
                frame.addEventListener('load', () => resolve(), { once: true }),
            );
            const frameDocument = frame.contentDocument;
            if (frameDocument === null)
                throw new Error('Fixture iframe did not load.');
            const host = frameDocument.createElement('div');
            frameDocument.body.append(host);
            const instance = await harness.Editor.create({ format });
            const nonce = `${format}-nonce`;
            const engine =
                format === 'html'
                    ? harness.createSourceEditingEngine({
                          cspNonce: nonce,
                          editor: instance,
                          element: host,
                      })
                    : harness.createMarkdownEditingEngine({
                          cspNonce: nonce,
                          editor: instance,
                          element: host,
                      });
            const nonceCount = frameDocument.head.querySelectorAll(
                `style[nonce="${nonce}"]`,
            ).length;
            engine.destroy();
            await instance.destroy();
            frame.remove();
            return nonceCount;
        };

        const invalidHost = document.createElement('div');
        document.body.append(invalidHost);
        const invalidEditor = await harness.Editor.create({ format: 'html' });
        let invalidNonce = '';
        try {
            harness.createSourceEditingEngine({
                cspNonce: ' ',
                editor: invalidEditor,
                element: invalidHost,
            });
        } catch (error: unknown) {
            invalidNonce = error instanceof Error ? error.message : 'unknown';
        }
        const invalidResidue = invalidHost.childElementCount;
        await invalidEditor.destroy();
        invalidHost.remove();

        return {
            html: await inspect('html'),
            invalidNonce,
            invalidResidue,
            markdown: await inspect('markdown'),
        };
    });
    expect(result.html).toBeGreaterThan(0);
    expect(result.markdown).toBeGreaterThan(0);
    expect(result.invalidNonce).toContain('must not be empty');
    expect(result.invalidResidue).toBe(0);
});

async function setSelection(
    page: Page,
    paragraphIndex: number,
    anchor: number,
    focus = anchor,
): Promise<void> {
    await page.locator(editor).evaluate(
        (host, values) => {
            const paragraph = host.querySelectorAll('p')[values.paragraphIndex];
            const text = paragraph?.firstChild;
            if (!(text instanceof Text)) {
                throw new Error('Paragraph text was not found.');
            }
            document
                .getSelection()
                ?.setBaseAndExtent(text, values.anchor, text, values.focus);
            (host as HTMLElement).focus();
        },
        { anchor, focus, paragraphIndex },
    );
}
