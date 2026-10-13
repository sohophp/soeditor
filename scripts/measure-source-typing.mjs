// Run against a local playground server. Results are synthetic, single-run data.
import { writeFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const results = [];
const base = process.env.SOEDITOR_TEST_BASE_URL ?? 'http://127.0.0.1:4173';
const block =
    '<div class="t1"><p>The company has always adhered to customer satisfaction.</p><p>设备图片与说明 <strong>CMS content</strong></p></div>\n';
try {
    for (const targetUnits of [16_384, 131_072, 524_288]) {
        const source =
            block.repeat(Math.ceil(targetUnits / block.length)) + '<p>tail</p>';
        const page = await browser.newPage();
        await page.goto(`${base}/classic.html?test=1`);
        await page.locator('body[data-ready=true]').waitFor();
        await page.evaluate(
            (source) => globalThis.__classicDemo.editor.setData(source),
            source,
        );
        await page.locator('[data-workspace-view=source]').click();
        await page.locator('.cm-content').click();
        await page.keyboard.press('Control+End');
        for (let index = 0; index < 4; index++)
            await page.keyboard.press('ArrowLeft');
        await page.waitForTimeout(500);
        await page.evaluate(() => {
            globalThis.window.keyTimes = [];
            globalThis.window.renders = 0;
            globalThis.window.longTasks = [];
            const surface = globalThis.document
                .querySelector('.soeditor-classic__visual')
                .shadowRoot.querySelector('[contenteditable]');
            new globalThis.MutationObserver((records) => {
                globalThis.window.renders += records.filter(
                    (record) =>
                        record.type === 'childList' &&
                        record.target === surface,
                ).length;
            }).observe(surface, { childList: true });
            new globalThis.PerformanceObserver((list) =>
                globalThis.window.longTasks.push(
                    ...list.getEntries().map((entry) => entry.duration),
                ),
            ).observe({ type: 'longtask' });
            globalThis.document.querySelector('.cm-content').addEventListener(
                'keydown',
                (event) => {
                    if (event.key.length !== 1) return;
                    const start = globalThis.performance.now();
                    globalThis.requestAnimationFrame(() =>
                        globalThis.window.keyTimes.push(
                            globalThis.performance.now() - start,
                        ),
                    );
                },
                true,
            );
        });
        const start = globalThis.performance.now();
        await page.keyboard.type('abcdefghijklmnopqrstuvwxyz012345', {
            delay: 12,
        });
        const wall = globalThis.performance.now() - start;
        await page.waitForTimeout(400);
        const metadata = {
            targetUnits,
            sourceUnits: source.length,
            utf8Bytes: Buffer.byteLength(source),
            wall,
        };
        results.push(
            await page.evaluate((metadata) => {
                const times = globalThis.window.keyTimes.sort((a, b) => a - b);
                return {
                    ...metadata,
                    keys: times.length,
                    p50: times[Math.floor(times.length * 0.5)],
                    p95: times[Math.floor(times.length * 0.95)],
                    max: times.at(-1),
                    hiddenRenders: globalThis.window.renders,
                    longTasks: globalThis.window.longTasks.length,
                    longTaskMs: globalThis.window.longTasks.reduce(
                        (a, b) => a + b,
                        0,
                    ),
                    typed: globalThis.__classicDemo.editor
                        .getData()
                        .includes('abcdefghijklmnopqrstuvwxyz012345'),
                };
            }, metadata),
        );
        await page.close();
    }
    const json = JSON.stringify(results, null, 2);
    if (process.argv[2] !== undefined) writeFileSync(process.argv[2], json);
    globalThis.console.log(json);
} finally {
    await browser.close();
}
