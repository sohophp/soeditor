import { test, expect } from '@playwright/test';
import path from 'node:path';

for (const scenario of [
    { language: 'en', status: 401, message: 'Please sign in again' },
    { language: 'zh-CN', status: 401, message: '请先保存当前编辑内容' },
    { language: 'zh-TW', status: 403, message: '登入驗證失敗或權限已變更' },
    { language: 'en', status: 503, message: 'Please try again' },
]) {
    test(`SoFinder ${scenario.language}/${scenario.status} explains errors and recovers on retry`, async ({
        page,
    }) => {
        await page.route('http://127.0.0.1:4173/', (route) =>
            route.fulfill({
                contentType: 'text/html',
                body: '<p>Saved content stays here</p>',
            }),
        );
        let available = false;
        const requests: string[] = [];
        await page.route(
            '**/finder-fixture/assets/sofinder-picker.js*',
            async (route) => {
                requests.push(route.request().url());
                await route.fulfill(
                    available
                        ? {
                              contentType: 'text/javascript',
                              body: 'export async function openPicker() { throw new DOMException("Closed", "AbortError"); }',
                          }
                        : {
                              status: scenario.status,
                              contentType: 'application/json',
                              body: '{"success":false}',
                          },
                );
            },
        );
        await page.goto('/');
        await page.evaluate(
            async ({ language, url }) => {
                const module = await import(/* @vite-ignore */ url);
                Reflect.set(
                    window,
                    'adapters',
                    module.createSoFinderBrowserAdapters({
                        baseUrl: '/finder-fixture',
                        csrfToken: '',
                        language,
                    }),
                );
            },
            {
                language: scenario.language,
                url:
                    '/@fs' +
                    path.resolve('packages/adapter-sofinder/src/browser.ts'),
            },
        );
        expect(requests).toHaveLength(0);
        const open = () =>
            page.evaluate(async () => {
                try {
                    const result = await Reflect.get(
                        window,
                        'adapters',
                    ).fileManager.open({ kind: 'image', multiple: false });
                    return { result };
                } catch (error) {
                    return {
                        message:
                            error instanceof Error
                                ? error.message
                                : String(error),
                    };
                }
            });
        expect((await open()).message).toContain(scenario.message);
        expect(requests).toHaveLength(2); // Failed import and bounded error-status probe.
        available = true;
        expect((await open()).result).toBeNull();
        expect(requests).toHaveLength(3);
        expect(new URL(requests[2]!).searchParams.has('soeditorRetry')).toBe(
            true,
        );
        expect((await open()).result).toBeNull();
        expect(requests).toHaveLength(3); // Successful module retained.
        await expect(page.locator('p')).toHaveText('Saved content stays here');
    });
}
