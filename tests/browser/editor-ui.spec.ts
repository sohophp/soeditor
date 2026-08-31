import { expect, test, type Page } from '@playwright/test';

const editor = '[data-testid="editor"]';
const source = '[data-testid="source"]';

test.beforeEach(async ({ page }) => {
    await page.goto('/?developer=1');
    await expect(page.locator(editor)).toHaveAttribute(
        'contenteditable',
        'true',
    );
});

test('renders the configured integrated toolbar, groups, status, and theme', async ({
    page,
}) => {
    const items = await page
        .locator('[role="toolbar"] > *')
        .evaluateAll((elements) =>
            elements.map(
                (element) =>
                    (element as HTMLElement).dataset.toolbarItem ?? '|',
            ),
        );
    expect(items).toEqual([
        'undo',
        'redo',
        '|',
        'heading',
        '|',
        'bold',
        'italic',
        'underline',
        'strike',
        'fontFamily',
        'fontSize',
        'fontColor',
        'fontBackgroundColor',
        'highlight',
        'link',
        '|',
        'image',
        'media',
        'table',
        '|',
        'source',
        'preview',
        'format',
        '|',
        'problems',
        'image-browse',
        'media-browse',
        'inspector',
        'outline',
        'find-replace',
        'command-palette',
    ]);
    const strikeIcon = page.locator(
        '[data-toolbar-item="strike"] .soeditor-ui__icon',
    );
    await expect(strikeIcon.locator('text')).toHaveCount(0);
    await expect(strikeIcon).toHaveClass(/soeditor-ui__icon--solid/u);
    await expect(strikeIcon.locator('path')).toHaveCount(1);
    await expect(strikeIcon.locator('path')).toHaveAttribute(
        'd',
        /^M1760 896/u,
    );
    await expect(strikeIcon).toHaveAttribute('viewBox', '0 0 1792 1792');
    await expect(page.locator('.soeditor-ui__status')).toHaveText(
        'Visual · Saved',
    );
    await expect(
        page.locator('[data-status-item="demo.word-count"]'),
    ).toHaveText('Words 2');
    await expect(page.locator('#editor-ui')).toHaveAttribute(
        'data-soeditor-theme',
        'auto',
    );
    expect(
        await page.evaluate(() => {
            const harness = (window as Window & { __soeditor?: UiHarness })
                .__soeditor;
            if (harness === undefined) {
                throw new Error('Playground UI was not exposed.');
            }
            try {
                harness.createEditorUi({
                    editor: harness.editor,
                    element: document.querySelector('#editor-ui')!,
                });
                return '';
            } catch (error: unknown) {
                return error instanceof Error ? error.name : 'unknown';
            }
        }),
    ).toBe('EditorUiAlreadyAttachedError');
});

test('executes command buttons, reflects active state, and handles shortcuts', async ({
    page,
}) => {
    await page.click('#hello');
    await setSelection(page, 0, 0, 5);
    const bold = page.locator('[data-toolbar-item="bold"]');
    await bold.click();
    await expect(page.locator(source)).toHaveText(
        '<p><strong>Hello</strong></p>',
    );
    await expect(bold).toHaveAttribute('aria-pressed', 'true');

    await setSelection(page, 0, 0, 5);
    await page.keyboard.press('Control+i');
    await expect(page.locator(`${editor} em`)).toHaveText('Hello');
    await page.locator('[data-toolbar-item="undo"]').click();
    await expect(page.locator(`${editor} em`)).toHaveCount(0);
});

test('uses the heading dropdown and mode button through shared commands', async ({
    page,
}) => {
    await page.click('#hello');
    await setSelection(page, 0, 0, 5);
    const heading = page.locator('[data-toolbar-item="heading"]');
    await heading.locator('summary').click();
    const headingStyles = await heading
        .locator('.soeditor-ui__heading-choice > span')
        .evaluateAll((samples) =>
            samples.map((sample) => {
                const style = getComputedStyle(sample);
                return [
                    Number.parseFloat(style.fontSize),
                    Number.parseInt(style.fontWeight, 10),
                ];
            }),
        );
    expect(headingStyles).toEqual([
        [16, 400],
        [32, 700],
        [24, 700],
        [18.72, 700],
        [16, 700],
        [13.28, 700],
        [10.72, 700],
    ]);
    await page.locator(editor).click();
    await expect(heading).not.toHaveAttribute('open', '');

    await heading.locator('summary').click();
    const fontSize = page.locator('[data-toolbar-item="fontSize"]');
    await fontSize.locator('summary').click();
    await expect(heading).not.toHaveAttribute('open', '');
    await expect(fontSize).toHaveAttribute('open', '');
    await page.locator('[data-toolbar-item="bold"]').focus();
    await expect(fontSize).not.toHaveAttribute('open', '');

    await heading.locator('summary').click();
    await page.getByRole('button', { name: 'Heading 2' }).click();
    await expect(page.locator(source)).toHaveText('<h2>Hello</h2>');

    await page.locator('[data-toolbar-item="source"]').click();
    await expect(page.locator('.soeditor-ui__status')).toHaveText(
        'Source · Unsaved',
    );
    await expect(page.locator('[data-toolbar-item="bold"]')).toBeDisabled();
    await page.evaluate(() => {
        const harness = (window as Window & { __soeditor?: UiHarness })
            .__soeditor;
        if (harness === undefined) {
            throw new Error('Playground UI was not exposed.');
        }
        harness.editor.execute('format.bold');
    });
    await expect(page.locator(source)).toHaveText('<h2>Hello</h2>');
    await page.locator('[data-toolbar-item="source"]').click();
    await expect(page.locator('.soeditor-ui__status')).toHaveText(
        'Visual · Unsaved · h2',
    );
});

test('applies a link through a native modal dialog', async ({ page }) => {
    await page.click('#hello');
    await setSelection(page, 0, 0, 5);
    await page.locator('[data-toolbar-item="link"]').click();
    const dialog = page.getByRole('dialog', { name: 'Link' });
    await expect(dialog.getByLabel('Displayed text')).toHaveValue('Hello');
    await dialog.getByLabel('Link URL').fill('/article');
    await dialog.getByLabel('Title').fill('Article');
    await dialog.getByRole('button', { name: 'Insert link' }).click();

    await expect(dialog).toHaveCount(0);
    await expect(page.locator(source)).toHaveText(
        '<p><a href="/article" title="Article">Hello</a></p>',
    );
});

test('inserts image through a dialog and tables through the size picker', async ({
    page,
}) => {
    await page.click('#hello');
    await setSelection(page, 0, 5);
    await page.locator('[data-toolbar-item="image"]').click();
    const imageDialog = page.getByRole('dialog', { name: 'Image' });
    await imageDialog.getByLabel('Image URL').fill('/image.png');
    await imageDialog.getByLabel('Alternative text').fill('Example');
    await imageDialog.getByRole('button', { name: 'Insert image' }).click();
    await expect(page.locator(source)).toContainText(
        '<img src="/image.png" alt="Example">',
    );

    await setSelection(page, 0, 5);
    await page.locator('[data-toolbar-item="table"]').click();
    const tablePicker = page.getByRole('dialog', {
        name: 'Choose table size',
    });
    await tablePicker
        .getByRole('gridcell', { name: 'Insert 2 by 3 table' })
        .click();
    await expect(page.locator(source)).toContainText('<table>');
    await expect(
        page.locator(
            `${editor} [data-soeditor-structured-block="soeditor.table"]`,
        ),
    ).toBeVisible();
    await expect(page.locator(source)).toContainText(
        '<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>',
    );
});

test('supports plugin-contributed compact toolbars and host-scoped shortcuts', async ({
    page,
}) => {
    await page.goto('/?toolbar=compact');
    await expect(page.locator('[role="toolbar"] > *')).toHaveCount(3);
    await page.click('#hello');
    await page.locator('[data-toolbar-item="uppercase"]').click();
    await expect(page.locator(source)).toHaveText('<P>HELLO</P>');

    await page.click('#world');
    await page.locator(editor).focus();
    await page.keyboard.press('Alt+u');
    await expect(page.locator(source)).toHaveText('<P>WORLD</P>');
});

test('isolates toolbar update failures from editor state changes', async ({
    page,
}) => {
    await page.goto('/?toolbar=failing');
    await expect(
        page.locator('.soeditor-ui__notification').first(),
    ).toContainText('Example toolbar update failed.');
    await page.click('#hello');
    await expect(page.locator(source)).toHaveText('<p>Hello</p>');
});

test('fails explicitly for an unknown configured toolbar item', async ({
    page,
}) => {
    const pageError = page.waitForEvent('pageerror');
    await page.goto('/?toolbar=missing');
    await expect(page.locator('[role="toolbar"]')).toHaveCount(0);
    expect((await pageError).name).toBe('ToolbarItemNotRegisteredError');
});

test('renders notifications and balloons as text and switches themes', async ({
    page,
}) => {
    await page.evaluate(() => {
        const harness = (window as Window & { __soeditor?: UiHarness })
            .__soeditor;
        if (harness === undefined) {
            throw new Error('Playground UI was not exposed.');
        }
        harness.ui.notifications.show({
            duration: 10_000,
            message: '<img src=x onerror=alert(1)>',
            severity: 'warning',
        });
        harness.ui.balloons.show({
            anchor: document.querySelector('[data-toolbar-item="bold"]')!,
            content: '<b>not markup</b>',
        });
        harness.ui.setTheme('dark');
        harness.ui.setStatus('<strong>custom</strong>');
    });

    await expect(page.locator('.soeditor-ui__notification')).toHaveText(
        '<img src=x onerror=alert(1)>',
    );
    await expect(page.locator('.soeditor-ui__notification img')).toHaveCount(0);
    await expect(page.locator('.soeditor-ui__balloon')).toHaveText(
        '<b>not markup</b>',
    );
    await expect(page.locator('.soeditor-ui__balloon b')).toHaveCount(0);
    await expect(page.locator('#editor-ui')).toHaveAttribute(
        'data-soeditor-theme',
        'dark',
    );
    await expect(page.locator('.soeditor-ui__status')).toHaveText(
        '<strong>custom</strong>',
    );
    await page.locator(editor).click();
    await expect(page.locator('.soeditor-ui__balloon')).toHaveCount(0);
});

test('cleans only UI-owned DOM on explicit and editor destruction', async ({
    page,
}) => {
    await page.evaluate(() => {
        const harness = (window as Window & { __soeditor?: UiHarness })
            .__soeditor;
        if (harness === undefined) {
            throw new Error('Playground UI was not exposed.');
        }
        harness.ui.destroy();
        harness.ui.destroy();
    });
    await expect(page.locator('[role="toolbar"]')).toHaveCount(0);
    await expect(page.locator(editor)).toHaveAttribute(
        'contenteditable',
        'true',
    );
    const terminalErrors = await page.evaluate(() => {
        const harness = (window as Window & { __soeditor?: UiHarness })
            .__soeditor;
        if (harness === undefined) {
            throw new Error('Playground UI was not exposed.');
        }
        const errors: string[] = [];
        for (const invoke of [
            () =>
                harness.ui.notifications.show({
                    duration: 1,
                    message: 'late',
                    severity: 'info',
                }),
            () => harness.ui.dialogs.open({ title: 'late' }),
            () =>
                harness.ui.balloons.show({
                    anchor: document.querySelector('[data-testid="editor"]')!,
                    content: 'late',
                }),
        ]) {
            try {
                invoke();
            } catch (error: unknown) {
                errors.push(error instanceof Error ? error.name : 'unknown');
            }
        }
        return errors;
    });
    expect(terminalErrors).toEqual([
        'EditorUiDestroyedError',
        'EditorUiDestroyedError',
        'EditorUiDestroyedError',
    ]);

    await page.reload();
    await page.click('#destroy-editor');
    await expect(page.locator('[role="toolbar"]')).toHaveCount(0);
    await expect(page.locator('#editor-ui')).not.toHaveClass(/soeditor-ui/);
});

test('finishes UI cleanup when a contributed status destructor fails', async ({
    page,
}) => {
    await page.goto('/?status=failing-cleanup');
    const errorName = await page.evaluate(() => {
        const harness = (window as Window & { __soeditor?: UiHarness })
            .__soeditor;
        if (harness === undefined) {
            throw new Error('Playground UI was not exposed.');
        }
        try {
            harness.ui.destroy();
            return '';
        } catch (error: unknown) {
            return error instanceof Error ? error.name : 'unknown';
        }
    });
    expect(errorName).toBe('AggregateError');
    await expect(page.locator('.soeditor-ui__chrome')).toHaveCount(0);
    await expect(page.locator('#editor-ui')).not.toHaveClass(/soeditor-ui/u);
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
            if (paragraph === undefined) {
                throw new Error('Paragraph text was not found.');
            }
            const texts: Text[] = [];
            const walker = document.createTreeWalker(
                paragraph,
                NodeFilter.SHOW_TEXT,
            );
            let current = walker.nextNode();
            while (current !== null) {
                texts.push(current as Text);
                current = walker.nextNode();
            }
            const locate = (offset: number): [Node, number] => {
                let position = 0;
                for (const text of texts) {
                    if (offset <= position + text.data.length) {
                        return [text, offset - position];
                    }
                    position += text.data.length;
                }
                return [paragraph, paragraph.childNodes.length];
            };
            const [anchorNode, anchorOffset] = locate(values.anchor);
            const [focusNode, focusOffset] = locate(values.focus);
            document
                .getSelection()
                ?.setBaseAndExtent(
                    anchorNode,
                    anchorOffset,
                    focusNode,
                    focusOffset,
                );
            (host as HTMLElement).focus();
        },
        { anchor, focus, paragraphIndex },
    );
}

interface UiHarness {
    readonly createEditorUi: (options: {
        editor: unknown;
        element: Element;
    }) => unknown;
    readonly editor: {
        execute(command: string, ...args: readonly unknown[]): unknown;
    };
    readonly ui: {
        readonly balloons: {
            show(options: { anchor: Element; content: string }): unknown;
        };
        readonly dialogs: {
            open(options: { title: string }): unknown;
        };
        readonly notifications: {
            show(options: {
                duration: number;
                message: string;
                severity: string;
            }): unknown;
        };
        destroy(): void;
        setStatus(message: string): void;
        setTheme(theme: string): void;
    };
}
