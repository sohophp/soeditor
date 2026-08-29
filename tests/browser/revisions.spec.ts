import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const editorHost = '[data-testid="editor"]';

test('views and semantically compares a host revision without replacing canonical content', async ({
    page,
}) => {
    await page.goto('/?revisions=1');
    const source = page.locator('[data-testid="source"]');
    await expect(source).toContainText('Hello');
    const initial = await source.textContent();
    await page.getByRole('button', { name: 'Open revision history' }).click();
    const panel = page.getByRole('region', { name: 'Revision history' });
    await panel
        .getByRole('button', { name: 'saved: Published version' })
        .click();

    await expect(
        panel.getByRole('heading', { name: 'Published version' }),
    ).toBeVisible();
    await expect(panel.getByLabel('Revision source')).toContainText(
        'window.__revisionExecuted=true',
    );
    await expect(source).toHaveText(initial ?? '');
    expect(
        await page.evaluate(
            () =>
                (
                    globalThis as typeof globalThis & {
                        __revisionExecuted?: boolean;
                    }
                ).__revisionExecuted,
        ),
    ).toBeUndefined();
});

test('saves a draft and restores through a transaction while comments unlink safely', async ({
    page,
}) => {
    await page.goto('/?comments=1&revisions=1');
    await selectText(page, 0, 5);
    await page.getByRole('button', { name: 'Open comments' }).click();
    let panel = page.getByRole('region', { name: 'Comments' });
    await panel
        .getByRole('textbox', { name: 'New comment' })
        .fill('Restore policy');
    await panel.getByRole('button', { name: 'Add comment' }).click();

    await page.getByRole('button', { name: 'Open revision history' }).click();
    panel = page.getByRole('region', { name: 'Revision history' });
    await panel.getByLabel('Revision label').fill('Working draft');
    await panel.getByRole('button', { name: 'Save current' }).click();
    await expect(
        panel.getByRole('button', { name: 'draft: Working draft' }),
    ).toBeVisible();

    await panel
        .getByRole('button', { name: 'saved: Published version' })
        .click();
    await panel.getByRole('button', { name: 'Restore revision' }).click();
    await expect(page.locator('[data-testid="source"]')).toContainText(
        '<p>Published version</p>',
    );
    expect(
        await page.evaluate(
            () =>
                (
                    globalThis as typeof globalThis & {
                        __revisionExecuted?: boolean;
                    }
                ).__revisionExecuted,
        ),
    ).toBeUndefined();

    await page.getByRole('button', { name: /Open comments/u }).click();
    await expect(
        page
            .getByRole('region', { name: 'Comments' })
            .locator('[data-comment-state="unlinked"]'),
    ).toHaveCount(1);
});

test('enforces edit, comments-only, and readonly review policies accessibly', async ({
    page,
}) => {
    await page.goto('/?comments=1&revisions=1&policy=comments-only');
    await expect(page.locator(editorHost)).toHaveAttribute(
        'contenteditable',
        'false',
    );
    await selectText(page, 0, 5);
    await page.getByRole('button', { name: 'Open comments' }).click();
    let panel = page.getByRole('region', { name: 'Comments' });
    await panel
        .getByRole('textbox', { name: 'New comment' })
        .fill('Review only');
    await panel.getByRole('button', { name: 'Add comment' }).click();
    await expect(panel).toContainText('Review only');

    await page.getByRole('button', { name: 'Open revision history' }).click();
    panel = page.getByRole('region', { name: 'Revision history' });
    await panel.getByRole('button', { name: 'readonly', exact: true }).click();
    expect(
        await page.evaluate(() => {
            const harness = (
                globalThis as typeof globalThis & {
                    __soeditor?: {
                        commentsServiceToken: unknown;
                        editor: {
                            services: {
                                get(token: unknown): {
                                    can?(action: string): boolean;
                                    snapshot?: { policy: string };
                                };
                            };
                        };
                        revisionsServiceToken: unknown;
                    };
                }
            ).__soeditor!;
            return {
                canCreate: harness.editor.services
                    .get(harness.commentsServiceToken)
                    .can?.('create'),
                policy: harness.editor.services.get(
                    harness.revisionsServiceToken,
                ).snapshot?.policy,
            };
        }),
    ).toEqual({ canCreate: false, policy: 'readonly' });
    await expect(page.locator(editorHost)).toHaveAttribute(
        'contenteditable',
        'false',
    );
    await page.getByRole('button', { name: /Open comments/u }).click();
    panel = page.getByRole('region', { name: 'Comments' });
    await expect(
        panel.getByRole('button', { name: 'Add comment' }),
    ).toBeDisabled();
    await expect(panel.getByRole('button', { name: 'Reply' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Open revision history' }).click();
    panel = page.getByRole('region', { name: 'Revision history' });
    await panel.getByRole('button', { name: 'edit', exact: true }).click();
    await expect(page.locator(editorHost)).toHaveAttribute(
        'contenteditable',
        'true',
    );

    const accessibility = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
    expect(accessibility.violations).toEqual([]);
});

test('propagates runtime review policy across Visual, Source, and Markdown writers', async ({
    page,
}) => {
    await page.goto('/?revisions=1&split=visual-source');
    await expect(page.locator(editorHost)).toHaveAttribute(
        'contenteditable',
        'true',
    );
    await expect(page.locator('#source-editor .cm-content')).toHaveAttribute(
        'contenteditable',
        'false',
    );
    await page.locator('[data-toolbar-item="source"]').click();
    await expect(page.locator(editorHost)).toHaveAttribute(
        'contenteditable',
        'false',
    );
    await expect(page.locator('#source-editor .cm-content')).toHaveAttribute(
        'contenteditable',
        'true',
    );
    await setPolicy(page, 'readonly');
    await expect(page.locator('#source-editor .cm-content')).toHaveAttribute(
        'contenteditable',
        'false',
    );

    await page.goto('/?format=markdown&revisions=1&policy=comments-only');
    await expect(page.locator('#markdown-editor .cm-content')).toHaveAttribute(
        'contenteditable',
        'false',
    );
    await setPolicy(page, 'edit');
    await expect(page.locator('#markdown-editor .cm-content')).toHaveAttribute(
        'contenteditable',
        'true',
    );
});

test('cleans revision UI and makes a retained service terminal', async ({
    page,
}) => {
    await page.goto('/?revisions=1');
    await page.getByRole('button', { name: 'Open revision history' }).click();
    const retainedError = await page.evaluate(async () => {
        const harness = (
            globalThis as typeof globalThis & {
                __soeditor?: {
                    editor: {
                        destroy(): Promise<void>;
                        services: { get(token: unknown): unknown };
                    };
                    revisionsServiceToken: unknown;
                };
            }
        ).__soeditor!;
        const retained = harness.editor.services.get(
            harness.revisionsServiceToken,
        ) as { viewCurrent(): void };
        await harness.editor.destroy();
        try {
            retained.viewCurrent();
            return '';
        } catch (error: unknown) {
            return error instanceof Error ? error.message : String(error);
        }
    });
    await expect(
        page.getByRole('region', { name: 'Revision history' }),
    ).toHaveCount(0);
    expect(retainedError).toContain('destroyed');
});

async function selectText(page: Page, from: number, to: number): Promise<void> {
    const paragraph = page.locator(`${editorHost} p`).first();
    await expect(paragraph).not.toBeEmpty();
    await paragraph.evaluate(
        (element, range) => {
            const text = element.firstChild;
            if (!(text instanceof Text))
                throw new Error('No paragraph text node.');
            (element.parentElement as HTMLElement | null)?.focus();
            document
                .getSelection()
                ?.setBaseAndExtent(text, range.from, text, range.to);
        },
        { from, to },
    );
}

async function setPolicy(
    page: Page,
    policy: 'edit' | 'readonly',
): Promise<void> {
    await page.evaluate((next) => {
        const harness = (
            globalThis as typeof globalThis & {
                __soeditor?: {
                    editor: {
                        execute(command: string, value: string): unknown;
                    };
                };
            }
        ).__soeditor;
        harness?.editor.execute('review.setPolicy', next);
    }, policy);
}
