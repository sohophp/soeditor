import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { argv, version } from 'node:process';
import { chromium } from '@playwright/test';
import { preview } from 'vite';

assert.ok(argv[2] && argv[3], 'Usage: retained-fixture-dist output.json');
const fixture = resolve(argv[2]);
const server = await preview({
    configFile: false,
    root: fixture,
    logLevel: 'error',
    build: { outDir: fixture },
    preview: { host: '127.0.0.1', port: 4190, strictPort: true },
});
const browser = await chromium.launch();
try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('http://127.0.0.1:4190');
    await page.waitForFunction(() => globalThis.measureCms);
    const cdp = await page.context().newCDPSession(page);
    const checkpoints = [];
    for (let round = 0; round < 33; round += 1) {
        await page.evaluate(() => globalThis.measureCms.create(102400, true));
        for (let toggle = 0; toggle < 3; toggle += 1) {
            await page.evaluate(() => globalThis.measureCms.source());
            await page.evaluate(() => globalThis.measureCms.visual());
        }
        await page.locator('.soeditor-classic__visual p').first().click();
        await page.keyboard.press('End');
        await page.keyboard.insertText('会话编辑');
        assert.ok(
            await page.evaluate(() =>
                globalThis.measureCms.editor.getData().includes('会话编辑'),
            ),
        );
        await page.evaluate(() => globalThis.measureCms.destroy());
        assert.equal(await page.locator('.soeditor-classic').count(), 0);
        await page.waitForTimeout(100);
        await cdp.send('HeapProfiler.collectGarbage');
        if (round >= 2 && (round === 2 || (round + 1) % 5 === 3)) {
            checkpoints.push({
                round: round + 1,
                ...(await cdp.send('Memory.getDOMCounters')),
                ...(await cdp.send('Runtime.getHeapUsage')),
            });
        }
    }
    assert.deepEqual(errors, []);
    const first = checkpoints[0];
    const last = checkpoints.at(-1);
    await writeFile(
        resolve(argv[3]),
        `${JSON.stringify({ measuredAt: new Date().toISOString(), node: version, chromium: browser.version(), methodology: '100 KiB minified production fixture; 3 warmup + 30 create/edit/destroy sessions, 3 Source round trips per session; 100ms settling and forced GC. CDP includes browser/library caches and the fixture retains its last destroyed wrapper. Diagnostic trend, not proof of absence of all leaks or a real multi-hour human session.', checkpoints, delta: { nodes: last.nodes - first.nodes, jsEventListeners: last.jsEventListeners - first.jsEventListeners, usedSize: last.usedSize - first.usedSize }, errors }, null, 2)}\n`,
    );
} finally {
    await browser.close();
    await new Promise((done) => server.httpServer.close(done));
}
