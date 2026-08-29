import { expect, test, type Page } from '@playwright/test';

test('demonstrates manual validation and configured rule severity', async ({
    page,
}) => {
    await page.goto('/?quality=1&diagnostics=manual&a11y=error');
    await expect(page.locator('body')).toHaveAttribute(
        'data-diagnostics',
        'manual',
    );
    expect(await diagnostics(page)).toMatchObject({
        problems: [],
        status: 'idle',
    });

    await page.getByRole('button', { name: 'Validate document' }).click();
    await expect
        .poll(() => diagnostics(page))
        .toMatchObject({
            status: 'ready',
        });
    expect((await diagnostics(page)).problems).toEqual(
        expect.arrayContaining([
            {
                code: 'a11y.interactive-name',
                provider: 'html.accessibility',
                severity: 'error',
            },
            {
                code: 'seo.document-title',
                provider: 'html.seo',
                severity: 'warning',
            },
        ]),
    );
});

test('demonstrates debounced validation and disabled rules', async ({
    page,
}) => {
    await page.goto('/?quality=1&diagnostics=auto');
    await expect(page.locator('body')).toHaveAttribute(
        'data-diagnostics',
        'debounced',
    );
    await expect
        .poll(() => diagnostics(page))
        .toMatchObject({
            status: 'ready',
        });
    expect((await diagnostics(page)).problems).toEqual(
        expect.arrayContaining([
            expect.objectContaining({ code: 'a11y.interactive-name' }),
        ]),
    );

    await page.goto('/?quality=1&diagnostics=manual&a11y=off');
    await page.getByRole('button', { name: 'Validate document' }).click();
    await expect
        .poll(() => diagnostics(page))
        .toMatchObject({
            status: 'ready',
        });
    expect((await diagnostics(page)).problems).not.toEqual(
        expect.arrayContaining([
            expect.objectContaining({ code: 'a11y.interactive-name' }),
        ]),
    );
});

async function diagnostics(page: Page): Promise<DiagnosticsResult> {
    return page.evaluate(() => {
        const harness = (
            window as Window & {
                __soeditor?: {
                    diagnosticsServiceToken: unknown;
                    editor: {
                        services: {
                            get(token: unknown): {
                                snapshot: {
                                    problems: readonly {
                                        code: string;
                                        provider: string;
                                        severity: string;
                                    }[];
                                    status: string;
                                };
                            };
                        };
                    };
                };
            }
        ).__soeditor;
        if (harness === undefined) throw new Error('Harness unavailable.');
        const snapshot = harness.editor.services.get(
            harness.diagnosticsServiceToken,
        ).snapshot;
        return {
            problems: snapshot.problems.map(({ code, provider, severity }) => ({
                code,
                provider,
                severity,
            })),
            status: snapshot.status,
        };
    });
}

interface DiagnosticsResult {
    readonly problems: readonly {
        readonly code: string;
        readonly provider: string;
        readonly severity: string;
    }[];
    readonly status: string;
}
