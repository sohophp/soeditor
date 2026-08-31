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

test('types text through beforeinput and restores the caret', async ({
    page,
}) => {
    await page.click('#hello');
    await setSelection(page, 0, 5);
    await page.keyboard.type('!');

    await expect(page.locator(source)).toHaveText('<p>Hello!</p>');
    expect(await readSelection(page)).toEqual({ anchor: 6, focus: 6 });
});

test('publishes structured operations on visual document transactions', async ({
    page,
}) => {
    await page.click('#hello');
    await page.evaluate(() => {
        const scope = window as Window & {
            __capturedEditingOperations?: unknown;
            __soeditor?: {
                editor: {
                    events: {
                        on(
                            id: string,
                            listener: (event: { transaction: unknown }) => void,
                        ): () => void;
                    };
                };
                readEditingOperations(
                    transaction: unknown,
                ): readonly unknown[] | undefined;
            };
        };
        const harness = scope.__soeditor;
        if (harness === undefined) {
            throw new Error('Playground editor was not exposed.');
        }
        harness.editor.events.on('document:change', ({ transaction }) => {
            scope.__capturedEditingOperations =
                harness.readEditingOperations(transaction);
        });
    });
    await setSelection(page, 0, 5);
    await page.keyboard.type('!');

    expect(
        await page.evaluate(
            () =>
                (
                    window as Window & {
                        __capturedEditingOperations?: unknown;
                    }
                ).__capturedEditingOperations,
        ),
    ).toEqual([
        {
            block: 0,
            from: 5,
            insertedLength: 1,
            kind: 'replace-text',
            to: 5,
        },
    ]);
});

test('replaces intermediate IME composition text instead of duplicating it', async ({
    page,
}) => {
    await page.click('#hello');
    await setSelection(page, 0, 5);
    await page.locator(editor).evaluate((host) => {
        host.dispatchEvent(new CompositionEvent('compositionstart'));
        for (const data of ['n', 'ni', '你']) {
            host.dispatchEvent(
                new InputEvent('beforeinput', {
                    bubbles: true,
                    cancelable: true,
                    data,
                    inputType: 'insertCompositionText',
                }),
            );
        }
        host.dispatchEvent(new CompositionEvent('compositionend'));
    });

    await expect(page.locator(source)).toHaveText('<p>Hello你</p>');
    await page.keyboard.press('Control+z');
    await expect(page.locator(source)).toHaveText('<p>Hello</p>');
});

test('groups typing for transaction-backed undo and restores selection', async ({
    page,
}) => {
    await page.click('#hello');
    await setSelection(page, 0, 5);
    await page.keyboard.type('ABC');
    await expect(page.locator(source)).toHaveText('<p>HelloABC</p>');

    await page.keyboard.press('Control+z');
    await expect(page.locator(source)).toHaveText('<p>Hello</p>');
    expect(await readSelection(page)).toEqual({ anchor: 5, focus: 5 });

    await page.keyboard.press('Control+Shift+z');
    await expect(page.locator(source)).toHaveText('<p>HelloABC</p>');
    expect(await readSelection(page)).toEqual({ anchor: 8, focus: 8 });

    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+y');
    await expect(page.locator(source)).toHaveText('<p>HelloABC</p>');

    await dispatchBeforeInput(page, 'historyUndo');
    await expect(page.locator(source)).toHaveText('<p>Hello</p>');
    await dispatchBeforeInput(page, 'historyRedo');
    await expect(page.locator(source)).toHaveText('<p>HelloABC</p>');
});

test('splits and merges paragraphs with Enter, Backspace, and Delete', async ({
    page,
}) => {
    await page.click('#hello');
    await setSelection(page, 0, 2);
    await page.keyboard.press('Enter');
    await expect(page.locator(source)).toHaveText('<p>He</p><p>llo</p>');

    await setSelection(page, 1, 0);
    await page.keyboard.press('Backspace');
    await expect(page.locator(source)).toHaveText('<p>Hello</p>');

    await setSelection(page, 0, 2);
    await page.keyboard.press('Enter');
    await setSelection(page, 0, 2);
    await page.keyboard.press('Delete');
    await expect(page.locator(source)).toHaveText('<p>Hello</p>');
});

test('undoes and redoes paragraph transactions separately', async ({
    page,
}) => {
    await page.click('#hello');
    await setSelection(page, 0, 2);
    await page.keyboard.press('Enter');
    await expect(page.locator(source)).toHaveText('<p>He</p><p>llo</p>');

    await page.keyboard.press('Control+z');
    await expect(page.locator(source)).toHaveText('<p>Hello</p>');
    expect(await readSelection(page)).toEqual({ anchor: 2, focus: 2 });

    await page.keyboard.press('Control+Shift+z');
    await expect(page.locator(source)).toHaveText('<p>He</p><p>llo</p>');
});

test('replaces a basic selection and represents strong and emphasis', async ({
    page,
}) => {
    await page.click('#hello');
    await setSelection(page, 0, 1, 4);
    await page.keyboard.type('X');
    await expect(page.locator(source)).toHaveText('<p>HXo</p>');

    await setSelection(page, 0, 1, 2);
    await dispatchBeforeInput(page, 'formatBold');
    await expect(page.locator(source)).toHaveText(
        '<p>H<strong>X</strong>o</p>',
    );

    await setSelection(page, 0, 1, 2);
    await dispatchBeforeInput(page, 'formatItalic');
    await expect(page.locator(source)).toHaveText(
        '<p>H<strong><em>X</em></strong>o</p>',
    );
});

test('executes all inline feature commands and restores them with history', async ({
    page,
}) => {
    await page.click('#hello');
    await setSelection(page, 0, 1, 4);

    for (const command of [
        'format.bold',
        'format.italic',
        'format.underline',
        'format.strike',
        'format.inlineCode',
    ]) {
        await executeCommand(page, command);
    }

    await expect(page.locator(source)).toContainText('ell');
    await expect(page.locator(`${editor} strong em u s code`)).toHaveText(
        'ell',
    );
    expect(await commandActive(page, 'format.bold')).toBe(true);

    await page.keyboard.press('Control+z');
    await expect(page.locator(`${editor} code`)).toHaveCount(0);
    await page.keyboard.press('Control+Shift+z');
    await expect(page.locator(`${editor} code`)).toHaveText('ell');
});

test('changes paragraph structures and minimal lists through commands', async ({
    page,
}) => {
    await setEditorData(page, '<p>One</p><p>Two</p>');
    await setSelection(page, 0, 0, 3);
    await executeCommand(page, 'paragraph.heading', 2);
    await expect(page.locator(source)).toHaveText('<h2>One</h2><p>Two</p>');
    expect(await commandActive(page, 'paragraph.set')).toBe(false);

    await executeCommand(page, 'blockquote.toggle');
    await expect(page.locator(source)).toHaveText(
        '<blockquote>One</blockquote><p>Two</p>',
    );
    await executeCommand(page, 'codeBlock.toggle');
    await expect(page.locator(source)).toHaveText('<pre>One</pre><p>Two</p>');

    await setEditorData(page, '<p>One</p><p>Two</p>');
    await setSelectionAcrossParagraphs(page, 0, 0, 1, 3);
    await executeCommand(page, 'list.ordered');
    await expect(page.locator(source)).toHaveText(
        '<ol><li>One</li><li>Two</li></ol>',
    );
    await expect(page.locator(`${editor} > ol`)).toHaveCount(1);
    await expect(page.locator(`${editor} > ol > li`)).toHaveCount(2);
    expect(await commandActive(page, 'list.ordered')).toBe(true);
    await executeCommand(page, 'list.ordered');
    await expect(page.locator(source)).toHaveText('<p>One</p><p>Two</p>');
    await executeCommand(page, 'list.unordered');
    await expect(page.locator(source)).toHaveText(
        '<ul><li>One</li><li>Two</li></ul>',
    );
});

test('preserves unsafe link source without exposing an executable anchor', async ({
    page,
}) => {
    await setEditorData(
        page,
        '<p>H<a href="javascript:window.__linkExecuted=true" rel="nofollow" title="preserved">ell</a>o</p>',
    );
    await setSelection(page, 0, 1, 4);

    await expect(page.locator(source)).toContainText(
        'href="javascript:window.__linkExecuted=true"',
    );
    await expect(page.locator(`${editor} a`)).not.toHaveAttribute('href');
    expect(await commandActive(page, 'link.set')).toBe(true);
    await page.locator(`${editor} a`).click();
    expect(
        await page.evaluate(
            () =>
                (window as Window & { __linkExecuted?: boolean })
                    .__linkExecuted,
        ),
    ).toBeUndefined();

    await setSelection(page, 0, 1, 4);
    await executeCommand(page, 'link.remove');
    await expect(page.locator(source)).toHaveText('<p>Hello</p>');
});

test('inserts inert images and structured semantic tables and supports undo', async ({
    page,
}) => {
    await page.click('#hello');
    await setSelection(page, 0, 2);
    await executeCommand(page, 'image.insert', {
        alt: 'A & B',
        src: 'x" onerror="window.__imageExecuted=true',
        width: 80,
    });

    await expect(page.locator(source)).toContainText('<img');
    await expect(page.locator('[data-soeditor-opaque-inline]')).toHaveCount(1);
    await expect(page.locator(`${editor} img`)).toHaveCount(0);
    expect(
        await page.evaluate(
            () =>
                (window as Window & { __imageExecuted?: boolean })
                    .__imageExecuted,
        ),
    ).toBeUndefined();

    await page.keyboard.press('Control+z');
    await expect(page.locator(source)).toHaveText('<p>Hello</p>');
    await setSelection(page, 0, 2);
    await executeCommand(page, 'table.insert', { columns: 2, rows: 2 });
    await expect(page.locator(source)).toContainText('<table><tbody><tr><td>');
    await expect(page.locator('[data-soeditor-opaque-block]')).toHaveCount(0);
    await expect(
        page.locator(
            `${editor} [data-soeditor-structured-block="soeditor.table"] table`,
        ),
    ).toHaveCount(1);
});

test('unregisters visual feature capability when the engine is destroyed', async ({
    page,
}) => {
    await page.click('#hello');
    await setSelection(page, 0, 1, 4);
    expect(await commandCanExecute(page, 'format.bold')).toBe(true);

    await page.click('#destroy-engine');
    expect(await commandCanExecute(page, 'format.bold')).toBe(false);
});

test('rejects a duplicate visual service before mutating another host', async ({
    page,
}) => {
    const result = await page.evaluate(() => {
        const harness = (
            window as Window & {
                __soeditor?: {
                    createVisualEditingEngine(options: {
                        editor: unknown;
                        element: HTMLElement;
                    }): unknown;
                    editor: unknown;
                };
            }
        ).__soeditor;
        if (harness === undefined) {
            throw new Error('Playground editor was not exposed.');
        }
        const second = document.createElement('div');
        document.body.append(second);
        let errorName = '';
        try {
            harness.createVisualEditingEngine({
                editor: harness.editor,
                element: second,
            });
        } catch (error: unknown) {
            errorName = error instanceof Error ? error.name : 'unknown';
        }
        return {
            childCount: second.childNodes.length,
            errorName,
            role: second.getAttribute('role'),
        };
    });

    expect(result).toEqual({
        childCount: 0,
        errorName: 'ServiceAlreadyRegisteredError',
        role: null,
    });
});

test('switches visual to exact HTML source editing and back', async ({
    page,
}) => {
    await page.click('#mode');
    await expect(page.locator(editor)).toBeHidden();
    await expect(page.locator('[data-testid="source-editor"]')).toBeVisible();
    await expect(page.locator('.cm-content')).toContainText(
        '<strong>SoEditor</strong>',
    );

    const exact = '<p class="lead">Edited &amp; exact</p>';
    await setSourceText(page, exact);
    await expect(page.locator(source)).toHaveText(exact);

    await page.click('#mode');
    await expect(page.locator('[data-testid="source-editor"]')).toBeHidden();
    await expect(page.locator(editor)).toBeVisible();
    await expect(page.locator(`${editor} p`)).toHaveText('Edited & exact');
    await expect(page.locator(source)).toHaveText(exact);
});

test('synchronizes external source and provides HTML syntax highlighting', async ({
    page,
}) => {
    await page.click('#mode');
    await page.click('#world');

    await expect(page.locator('.cm-content')).toHaveText('<p>World</p>');
    expect(await page.locator('.cm-content span').count()).toBeGreaterThan(0);
});

test('diagnoses invalid source and locks the last valid visual model until recovery', async ({
    page,
}) => {
    await page.click('#hello');
    await page.click('#mode');
    const invalid = '<p id="first" id="duplicate">Broken</p>';
    await setSourceText(page, invalid);

    await expect(page.locator(source)).toHaveText(invalid);
    await expect(
        page.locator('.cm-lintPoint-error, .cm-lintRange-error'),
    ).toHaveCount(1);
    expect(await sourceDiagnosticCodes(page)).toContain('duplicate-attribute');

    await page.click('#mode');
    await expect(page.locator(source)).toHaveText(invalid);
    await expect(page.locator(`${editor} p`)).toHaveText('Hello');
    await expect(page.locator(editor)).toHaveAttribute(
        'contenteditable',
        'false',
    );

    await page.click('#mode');
    await setSourceText(page, '<p>Recovered</p>');
    await page.click('#mode');
    await expect(page.locator(`${editor} p`)).toHaveText('Recovered');
    await expect(page.locator(editor)).toHaveAttribute(
        'contenteditable',
        'true',
    );
});

test('keeps custom and unsafe source exact without executing it', async ({
    page,
}) => {
    await page.click('#mode');
    const exact =
        '<p onclick="window.__sourceExecuted=true">A<custom-inline data-id="1"></custom-inline></p><!--CMS:block--><svg><foreignObject><div>SVG</div></foreignObject></svg><template><custom-element></custom-element></template><script>window.__sourceExecuted=true</script>';
    await setSourceText(page, exact);

    await expect(page.locator(source)).toHaveText(exact);
    await page.click('#mode');
    await expect(page.locator(source)).toHaveText(exact);
    await expect(page.locator('[data-soeditor-opaque-inline]')).toHaveCount(1);
    expect(
        await page.evaluate(
            () =>
                (window as Window & { __sourceExecuted?: boolean })
                    .__sourceExecuted,
        ),
    ).toBeUndefined();
});

test('preserves recoverable invalid nesting exactly across mode switches', async ({
    page,
}) => {
    await page.click('#mode');
    const recoverable = '<p>before<section>inside</section>after';
    await setSourceText(page, recoverable);
    await page.click('#mode');

    await expect(page.locator(source)).toHaveText(recoverable);
    await page.click('#mode');
    await expect(page.locator('.cm-content')).toHaveText(recoverable);
});

test('uses shared source undo while keeping canonical source synchronized', async ({
    page,
}) => {
    await page.click('#hello');
    await page.click('#mode');
    await page.locator('.cm-content').click();
    await page.keyboard.press('Control+End');
    await page.keyboard.insertText('X');
    await expect(page.locator(source)).toHaveText('<p>Hello</p>X');

    await page.keyboard.press('Control+z');
    await expect(page.locator(source)).toHaveText('<p>Hello</p>');
    await expect(page.locator('.cm-content')).toHaveText('<p>Hello</p>');

    await page.keyboard.press('Control+End');
    await page.keyboard.insertText('Y');
    await executeCommand(page, 'editor.undo');
    await expect(page.locator(source)).toHaveText('<p>Hello</p>');
    await page.keyboard.press('Control+Shift+z');
    await expect(page.locator(source)).toHaveText('<p>Hello</p>Y');
});

test('honors readonly policy in source mode', async ({ page }) => {
    await page.goto('/?readonly=1');
    await page.click('#mode');
    await expect(page.locator('.cm-content')).toHaveAttribute(
        'contenteditable',
        'false',
    );
    const initial = await page.locator(source).textContent();
    await page.locator('.cm-content').click();
    await page.keyboard.insertText('blocked');
    await expect(page.locator(source)).toHaveText(initial ?? '');
});

test('rejects duplicate source attachment and cleans up idempotently', async ({
    page,
}) => {
    const result = await page.evaluate(() => {
        const harness = (
            window as Window & {
                __soeditor?: {
                    createSourceEditingEngine(options: {
                        editor: unknown;
                        element: HTMLElement;
                    }): unknown;
                    editor: unknown;
                    sourceEngine: { destroy(): void };
                };
            }
        ).__soeditor;
        if (harness === undefined) {
            throw new Error('Playground editor was not exposed.');
        }
        const second = document.createElement('div');
        document.body.append(second);
        let errorName = '';
        try {
            harness.createSourceEditingEngine({
                editor: harness.editor,
                element: second,
            });
        } catch (error: unknown) {
            errorName = error instanceof Error ? error.name : 'unknown';
        }
        harness.sourceEngine.destroy();
        harness.sourceEngine.destroy();
        const sourceHost = document.querySelector(
            '[data-testid="source-editor"]',
        );
        return {
            duplicateChildren: second.childNodes.length,
            errorName,
            sourceChildren: sourceHost?.childNodes.length,
        };
    });

    expect(result).toEqual({
        duplicateChildren: 0,
        errorName: 'ServiceAlreadyRegisteredError',
        sourceChildren: 0,
    });
});

test('produces UI-independent parser and structural problems', async ({
    page,
}) => {
    const sourceWithProblems =
        '<div id="same"></div><p id="same"><img src="x"></p><span a="1" a="2"></span>';
    await setEditorData(page, sourceWithProblems);

    const problems = await executeCommandResult<
        readonly {
            readonly code: string;
            readonly provider: string;
            readonly severity: string;
        }[]
    >(page, 'document.validate');
    expect(problems).toEqual(
        expect.arrayContaining([
            expect.objectContaining({
                code: 'duplicate-attribute',
                provider: 'html.parser',
                severity: 'error',
            }),
            expect.objectContaining({ code: 'html.duplicate-id' }),
            expect.objectContaining({ code: 'html.image-alt' }),
        ]),
    );
});

test('formats deliberately through a command and shares undo with source mode', async ({
    page,
}) => {
    const unformatted = '<main><h1>Title</h1><p>Text</p></main>';
    await setEditorData(page, unformatted);
    await page.click('#mode');

    const formatted = await executeCommandResult<string>(
        page,
        'document.format',
        { htmlWhitespaceSensitivity: 'css', tabWidth: 2 },
    );
    expect(formatted).toBe(
        '<main>\n  <h1>Title</h1>\n  <p>Text</p>\n</main>\n',
    );
    await expect(page.locator(source)).toHaveText(formatted);
    await expect(page.locator('.cm-line')).toHaveCount(5);
    expect(await page.locator('.cm-line').nth(1).textContent()).toBe(
        '  <h1>Title</h1>',
    );

    await executeCommand(page, 'editor.undo');
    await expect(page.locator(source)).toHaveText(unformatted);
    await expect(page.locator('.cm-content')).toHaveText(unformatted);
    await executeCommand(page, 'editor.redo');
    await expect(page.locator(source)).toHaveText(formatted);
});

test('refuses to format parser-invalid exact source', async ({ page }) => {
    const invalid = '<p id="one" id="two">Text</p>';
    await setEditorData(page, invalid);
    await page.click('#mode');

    const errorName = await executeCommandErrorName(page, 'document.format');
    expect(errorName).toBe('InvalidHtmlFormattingSourceError');
    await expect(page.locator(source)).toHaveText(invalid);
});

test('synchronizes external canonical source changes', async ({ page }) => {
    await page.click('#world');

    await expect(page.locator(source)).toHaveText('<p>World</p>');
    await expect(page.locator(`${editor} p`)).toHaveText('World');
});

test('keeps complete documents source-preserved and visually locked', async ({
    page,
}) => {
    await page.click('#document');

    await expect(page.locator(source)).toContainText('<!doctype html>');
    await expect(page.locator(editor)).toHaveAttribute(
        'contenteditable',
        'false',
    );
    await expect(page.locator('[data-soeditor-opaque-block]')).toHaveCount(1);

    await page.click('#hello');
    await expect(page.locator(editor)).toHaveAttribute(
        'contenteditable',
        'true',
    );
    await expect(page.locator(`${editor} p`)).toHaveText('Hello');
});

test('enforces readonly policy for user-facing beforeinput', async ({
    page,
}) => {
    await page.goto('/?readonly=1');
    await expect(page.locator(editor)).toHaveAttribute(
        'contenteditable',
        'false',
    );
    const initial = await page.locator(source).textContent();
    await page.locator(editor).evaluate((host) => {
        host.dispatchEvent(
            new InputEvent('beforeinput', {
                bubbles: true,
                cancelable: true,
                data: 'X',
                inputType: 'insertText',
            }),
        );
    });
    await expect(page.locator(source)).toHaveText(initial ?? '');
});

test('preserves unknown HTML while editing supported content', async ({
    page,
}) => {
    await expect(page.locator('[data-soeditor-opaque-block]')).toHaveCount(2);
    await setSelection(page, 0, 5);
    await page.keyboard.type('!');

    await expect(page.locator(source)).toContainText(
        '<product-card data-id="123"></product-card><!--CMS:block-->',
    );
    await expect(page.locator(source)).toContainText('<p>Hello!');
});

test('rejects browser deletion across an opaque inline boundary', async ({
    page,
}) => {
    await page.click('#inline-opaque');
    const preserved = '<p>A<product-card data-id="1"></product-card>B</p>';

    await setSelection(page, 0, 1);
    await page.keyboard.press('Delete');
    await expect(page.locator(source)).toHaveText(preserved);

    await setSelection(page, 0, 0, 2);
    await page.keyboard.press('Backspace');
    await expect(page.locator(source)).toHaveText(preserved);
});

test('copies and cuts semantic clipboard MIME data through transactions', async ({
    page,
}) => {
    await page.click('#hello');
    await setSelection(page, 0, 1, 4);

    expect(await dispatchClipboard(page, 'copy')).toEqual({
        html: '<p>ell</p>',
        text: 'ell',
    });
    expect(await dispatchClipboard(page, 'cut')).toEqual({
        html: '<p>ell</p>',
        text: 'ell',
    });
    await expect(page.locator(source)).toHaveText('<p>Ho</p>');

    await page.keyboard.press('Control+z');
    await expect(page.locator(source)).toHaveText('<p>Hello</p>');
});

test('normalizes multiline plain-text paste and supports undo', async ({
    page,
}) => {
    await page.click('#hello');
    await setSelection(page, 0, 2);
    await dispatchPaste(page, '', 'One\r\nTwo');

    await expect(page.locator(source)).toHaveText('<p>HeOne</p><p>Twollo</p>');
    await page.keyboard.press('Control+z');
    await expect(page.locator(source)).toHaveText('<p>Hello</p>');
});

test('rejects complete-document HTML paste without changing source', async ({
    page,
}) => {
    await page.click('#hello');
    await setSelection(page, 0, 2);
    await dispatchPaste(
        page,
        '<!doctype html><html><head><title>X</title></head><body><p>Body</p></body></html>',
        'Body',
    );

    await expect(page.locator(source)).toHaveText('<p>Hello</p>');
});

test('pastes rich, unknown, and unsafe HTML without executing it', async ({
    page,
}) => {
    await page.click('#hello');
    await setSelection(page, 0, 2);
    await dispatchPaste(
        page,
        '<strong>X</strong><script>window.__pasteExecuted = true</script><custom-inline data-id="1"></custom-inline>',
        'X',
    );

    await expect(page.locator(source)).toContainText('<strong>X</strong>');
    await expect(page.locator(source)).toContainText('<script>');
    await expect(page.locator(source)).toContainText('<custom-inline');
    await expect(page.locator(`${editor} strong`)).toHaveText('X');
    await expect(page.locator('[data-soeditor-opaque-inline]')).toHaveCount(2);
    expect(
        await page.evaluate(
            () =>
                (window as Window & { __pasteExecuted?: boolean })
                    .__pasteExecuted,
        ),
    ).toBeUndefined();
});

test('refuses cut across opaque inline content without data loss', async ({
    page,
}) => {
    await page.click('#inline-opaque');
    const preserved = '<p>A<product-card data-id="1"></product-card>B</p>';
    await setSelection(page, 0, 0, 2);

    expect(await dispatchClipboard(page, 'cut')).toEqual({
        html: '',
        text: '',
    });
    await expect(page.locator(source)).toHaveText(preserved);
});

test('does not execute preserved scripts or event-handler attributes', async ({
    page,
}) => {
    await page.click('#unsafe');

    await expect(page.locator('[data-soeditor-opaque-block]')).toHaveCount(2);
    expect(
        await page.evaluate(
            () =>
                (window as Window & { __soeditorExecuted?: boolean })
                    .__soeditorExecuted,
        ),
    ).toBeUndefined();
    await expect(page.locator(source)).toContainText('onerror=');
    await expect(page.locator(source)).toContainText('<script>');
});

test('repairs out-of-band DOM mutations from controlled state', async ({
    page,
}) => {
    await page.click('#hello');
    await page.locator(`${editor} p`).evaluate((paragraph) => {
        paragraph.textContent = 'uncontrolled';
    });

    await expect(page.locator(`${editor} p`)).toHaveText('Hello');
    await expect(page.locator(source)).toHaveText('<p>Hello</p>');
});

test('cleans the surface and event boundary on idempotent destruction', async ({
    page,
}) => {
    await page.click('#hello');
    await page.click('#destroy-engine');
    await page.click('#destroy-engine');

    await expect(page.locator(editor)).toBeEmpty();
    await expect(page.locator(editor)).not.toHaveAttribute('contenteditable');
    await page.locator(editor).evaluate((host) => {
        host.dispatchEvent(
            new InputEvent('beforeinput', {
                bubbles: true,
                cancelable: true,
                data: 'X',
                inputType: 'insertText',
            }),
        );
    });
    await expect(page.locator(source)).toHaveText('<p>Hello</p>');
});

test('cleans the visual engine when the owning Core editor is destroyed', async ({
    page,
}) => {
    await page.click('#destroy-editor');

    await expect(page.locator(editor)).toBeEmpty();
    await expect(page.locator(editor)).not.toHaveAttribute('contenteditable');
    await expect(page.locator('[data-testid="source-editor"]')).toBeEmpty();
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
                throw new Error('Paragraph was not found.');
            }

            const textNodes: Text[] = [];
            const walker = document.createTreeWalker(
                paragraph,
                NodeFilter.SHOW_TEXT,
            );
            let current = walker.nextNode();
            while (current !== null) {
                textNodes.push(current as Text);
                current = walker.nextNode();
            }

            const locate = (offset: number): [Node, number] => {
                let position = 0;
                for (const text of textNodes) {
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

async function setSelectionAcrossParagraphs(
    page: Page,
    anchorBlock: number,
    anchorOffset: number,
    focusBlock: number,
    focusOffset: number,
): Promise<void> {
    await page.locator(editor).evaluate(
        (host, values) => {
            const paragraphs = host.querySelectorAll('p');
            const anchor = paragraphs[values.anchorBlock]?.firstChild;
            const focus = paragraphs[values.focusBlock]?.firstChild;
            if (
                anchor === undefined ||
                anchor === null ||
                focus === undefined ||
                focus === null
            ) {
                throw new Error('Selection endpoints were not found.');
            }
            document
                .getSelection()
                ?.setBaseAndExtent(
                    anchor,
                    values.anchorOffset,
                    focus,
                    values.focusOffset,
                );
            (host as HTMLElement).focus();
        },
        { anchorBlock, anchorOffset, focusBlock, focusOffset },
    );
}

async function executeCommand(
    page: Page,
    id: string,
    ...args: readonly unknown[]
): Promise<void> {
    await executeCommandResult(page, id, ...args);
}

async function executeCommandResult<Result>(
    page: Page,
    id: string,
    ...args: readonly unknown[]
): Promise<Result> {
    return page.evaluate(
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
            if (harness === undefined) {
                throw new Error('Playground editor was not exposed.');
            }
            return harness.editor.execute(commandId, ...commandArgs) as Result;
        },
        { args, id },
    );
}

async function executeCommandErrorName(
    page: Page,
    id: string,
    ...args: readonly unknown[]
): Promise<string> {
    return page.evaluate(
        async ({ args: commandArgs, id: commandId }) => {
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
            if (harness === undefined) {
                throw new Error('Playground editor was not exposed.');
            }
            try {
                await harness.editor.execute(commandId, ...commandArgs);
                return '';
            } catch (error: unknown) {
                return error instanceof Error ? error.name : 'unknown';
            }
        },
        { args, id },
    );
}

async function commandActive(page: Page, id: string): Promise<boolean> {
    return page.evaluate((commandId) => {
        const harness = (
            window as Window & {
                __soeditor?: {
                    editor: { commands: { isActive(id: string): boolean } };
                };
            }
        ).__soeditor;
        return harness?.editor.commands.isActive(commandId) ?? false;
    }, id);
}

async function commandCanExecute(page: Page, id: string): Promise<boolean> {
    return page.evaluate((commandId) => {
        const harness = (
            window as Window & {
                __soeditor?: {
                    editor: { commands: { canExecute(id: string): boolean } };
                };
            }
        ).__soeditor;
        return harness?.editor.commands.canExecute(commandId) ?? false;
    }, id);
}

async function setEditorData(page: Page, data: string): Promise<void> {
    await page.evaluate((sourceData) => {
        const harness = (
            window as Window & {
                __soeditor?: { editor: { setData(data: string): void } };
            }
        ).__soeditor;
        if (harness === undefined) {
            throw new Error('Playground editor was not exposed.');
        }
        harness.editor.setData(sourceData);
    }, data);
}

async function setSourceText(page: Page, value: string): Promise<void> {
    const content = page.locator('.cm-content');
    await content.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.insertText(value);
}

async function sourceDiagnosticCodes(page: Page): Promise<readonly string[]> {
    return page.evaluate(() => {
        const harness = (
            window as Window & {
                __soeditor?: {
                    sourceEngine: {
                        readonly diagnostics: readonly {
                            readonly code: string;
                        }[];
                    };
                };
            }
        ).__soeditor;
        return harness?.sourceEngine.diagnostics.map(({ code }) => code) ?? [];
    });
}

async function readSelection(
    page: Page,
): Promise<{ readonly anchor: number; readonly focus: number }> {
    return page.locator(editor).evaluate((host) => {
        const paragraph = host.querySelector('p');
        const selection = document.getSelection();
        if (
            paragraph === null ||
            selection?.anchorNode === null ||
            selection?.focusNode === null ||
            selection === null
        ) {
            throw new Error('Selection was not available.');
        }

        const offsetOf = (node: Node, offset: number): number => {
            const range = document.createRange();
            range.setStart(paragraph, 0);
            range.setEnd(node, offset);
            return range.toString().length;
        };

        return {
            anchor: offsetOf(selection.anchorNode, selection.anchorOffset),
            focus: offsetOf(selection.focusNode, selection.focusOffset),
        };
    });
}

async function dispatchBeforeInput(
    page: Page,
    inputType: string,
): Promise<void> {
    await page.locator(editor).evaluate((host, type) => {
        host.dispatchEvent(
            new InputEvent('beforeinput', {
                bubbles: true,
                cancelable: true,
                inputType: type,
            }),
        );
    }, inputType);
}

async function dispatchClipboard(
    page: Page,
    type: 'copy' | 'cut',
): Promise<{ readonly html: string; readonly text: string }> {
    return page.locator(editor).evaluate((host, eventType) => {
        const data = new DataTransfer();
        host.dispatchEvent(
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
    page: Page,
    html: string,
    text: string,
): Promise<void> {
    await page.locator(editor).evaluate(
        (host, data) => {
            const clipboard = new DataTransfer();
            clipboard.setData('text/html', data.html);
            clipboard.setData('text/plain', data.text);
            host.dispatchEvent(
                new ClipboardEvent('paste', {
                    bubbles: true,
                    cancelable: true,
                    clipboardData: clipboard,
                }),
            );
        },
        { html, text },
    );
}
