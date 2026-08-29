import { expect, test, type Page } from '@playwright/test';

const editor = '[data-testid="editor"]';
const source = '[data-testid="source"]';

test.beforeEach(async ({ page }) => {
    await page.goto('/');
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
