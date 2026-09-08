import { test, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';

test('mobile loading and layout budgets, median of three runs', async ({
    browser,
    browserName,
}, testInfo) => {
    test.skip(
        testInfo.project.name !== 'chromium',
        'One fixed Chromium mobile measurement',
    );
    test.setTimeout(60000);
    const samples: { lcp: number; cls: number; bytes: number }[] = [];
    for (let run = 0; run < 3; run++) {
        const context = await browser.newContext({
            viewport: { width: 360, height: 800 },
            isMobile: true,
            deviceScaleFactor: 1,
        });
        const page = await context.newPage();
        const session = await context.newCDPSession(page);
        await session.send('Network.enable');
        await session.send('Network.emulateNetworkConditions', {
            offline: false,
            latency: 40,
            downloadThroughput: 1250000,
            uploadThroughput: 625000,
        });
        await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
        await page.addInitScript(() => {
            const samples = { lcp: 0, cls: 0 };
            Object.defineProperty(window, '__docsPerformance', {
                value: samples,
            });
            new PerformanceObserver((list) => {
                for (const entry of list.getEntries())
                    samples.lcp = Math.max(samples.lcp, entry.startTime);
            }).observe({ type: 'largest-contentful-paint', buffered: true });
            new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (
                        'hadRecentInput' in entry &&
                        !entry.hadRecentInput &&
                        'value' in entry &&
                        typeof entry.value === 'number'
                    )
                        samples.cls += entry.value;
                }
            }).observe({ type: 'layout-shift', buffered: true });
        });
        await page.goto('/en/');
        await page.waitForTimeout(1200);
        const result = await page.evaluate(() => {
            const value: unknown = Reflect.get(window, '__docsPerformance');
            if (
                !value ||
                typeof value !== 'object' ||
                !('lcp' in value) ||
                !('cls' in value) ||
                typeof value.lcp !== 'number' ||
                typeof value.cls !== 'number'
            )
                throw new Error('Missing metrics');
            const resources = performance.getEntriesByType('resource');
            if (resources.some((entry) => entry.name.includes('/demos/')))
                throw new Error('Editor loaded before activation');
            return {
                lcp: value.lcp,
                cls: value.cls,
                bytes: resources.reduce(
                    (sum, entry) =>
                        sum +
                        ('transferSize' in entry &&
                        typeof entry.transferSize === 'number'
                            ? entry.transferSize
                            : 0),
                    0,
                ),
            };
        });
        await page.getByRole('button', { name: 'Start editing' }).click();
        await expect(
            page.frameLocator('iframe').locator('body'),
        ).toHaveAttribute('data-ready', 'true');
        await page.waitForTimeout(600);
        const activationCls = await page.evaluate(() => {
            const value: unknown = Reflect.get(window, '__docsPerformance');
            if (
                !value ||
                typeof value !== 'object' ||
                !('cls' in value) ||
                typeof value.cls !== 'number'
            )
                throw new Error('Missing CLS');
            return value.cls;
        });
        samples.push({ ...result, cls: activationCls });
        await context.close();
    }
    const median = [...samples].sort((a, b) => a.lcp - b.lcp)[1];
    if (!median) throw new Error('Missing sample');
    await writeFile(
        new URL('../.vitepress/reports/performance.json', import.meta.url),
        JSON.stringify(
            {
                browser: browserName,
                viewport: '360x800',
                cpu: '4x',
                network: '40ms, 10 Mbps down',
                samples,
                median,
            },
            null,
            2,
        ),
    );
    expect(median.lcp).toBeGreaterThan(0);
    expect(median.lcp).toBeLessThanOrEqual(2500);
    for (const sample of samples) expect(sample.cls).toBeLessThanOrEqual(0.1);
});

test('Source and formatter chunks remain outside WYSIWYG requests', async ({
    page,
}) => {
    const graph: unknown = JSON.parse(
        await readFile(
            new URL(
                '../.vitepress/reports/example-graph.json',
                import.meta.url,
            ),
            'utf8',
        ),
    );
    if (!Array.isArray(graph)) throw new Error('Invalid graph');
    const optional = graph.filter(
        (row: unknown): row is { file: string; modules: string[] } => {
            if (
                !row ||
                typeof row !== 'object' ||
                !('file' in row) ||
                typeof row.file !== 'string' ||
                !('modules' in row) ||
                !Array.isArray(row.modules)
            )
                return false;
            return row.modules.some(
                (id: unknown) =>
                    typeof id === 'string' &&
                    /@soeditor\/(source|html-tools)\/dist\/index\.js|prettier\//.test(
                        id,
                    ),
            );
        },
    );
    expect(optional.length).toBeGreaterThan(0);
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));
    await page.goto('/demos/source.html?lang=en');
    await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
    for (const chunk of optional)
        expect(requests.some((url) => url.includes(chunk.file))).toBe(false);
    await page
        .locator('.controls')
        .getByRole('button', { name: 'HTML Source', exact: true })
        .click();
    await expect(page.locator('.cm-editor')).toBeVisible();
    for (const chunk of optional.filter((row) =>
        row.modules.some((id) =>
            /@soeditor\/html-tools\/dist\/index\.js|prettier\//.test(id),
        ),
    ))
        expect(requests.some((url) => url.includes(chunk.file))).toBe(false);
    await page
        .locator('.controls')
        .getByRole('button', { name: 'Format HTML', exact: true })
        .click();
    await expect(
        page
            .locator('.controls')
            .getByRole('button', { name: 'Format HTML', exact: true }),
    ).toBeEnabled();
    expect(
        optional
            .filter((row) =>
                row.modules.some((id) =>
                    /@soeditor\/html-tools\/dist\/index\.js|prettier\//.test(
                        id,
                    ),
                ),
            )
            .some((chunk) => requests.some((url) => url.includes(chunk.file))),
    ).toBe(true);
});
