import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { argv, version } from 'node:process';
import { preview } from 'vite';
import { chromium } from '@playwright/test';

// Compare two preserved builds of the measure-cms-loading.mjs fixture.
// Both builds must use the same fixture, dependencies and minification settings.
assert.ok(
    argv[2] && argv[3] && argv[4],
    'Usage: before-dir after-dir output.json',
);
const builds = { before: resolve(argv[2]), after: resolve(argv[3]) };
const browser = await chromium.launch();
const measurements = { before: [], after: [] };
try {
    // Alternate order to reduce warmup/order bias; exclude one warmup per instance.
    for (const order of [
        ['before', 'after'],
        ['after', 'before'],
        ['before', 'after'],
    ]) {
        for (const name of order) {
            const server = await preview({
                configFile: false,
                root: builds[name],
                logLevel: 'error',
                build: { outDir: builds[name] },
                preview: { host: '127.0.0.1', port: 4189, strictPort: true },
            });
            const page = await browser.newPage();
            try {
                await page.goto('http://127.0.0.1:4189');
                await page.waitForFunction(() => globalThis.measureCms);
                await page.evaluate(() =>
                    globalThis.measureCms.create(512000, false),
                );
                await page
                    .locator('.soeditor-classic__visual p')
                    .first()
                    .click();
                await page.keyboard.press('End');
                const samples = [];
                for (let index = 0; index < 7; index += 1) {
                    await page.evaluate(() => {
                        const surface = globalThis.measureCms.editor.element
                            .querySelector('.soeditor-classic__visual')
                            .shadowRoot.querySelector(
                                '.soeditor-wysiwyg-content',
                            );
                        surface.addEventListener(
                            'beforeinput',
                            () => {
                                const start = globalThis.performance.now();
                                globalThis.inputMeasurement = new Promise(
                                    (done) =>
                                        globalThis.requestAnimationFrame(() =>
                                            done(
                                                globalThis.performance.now() -
                                                    start,
                                            ),
                                        ),
                                );
                            },
                            { once: true },
                        );
                    });
                    await page.keyboard.insertText('x');
                    const elapsed = await page.evaluate(
                        () => globalThis.inputMeasurement,
                    );
                    assert.ok(Number.isFinite(elapsed));
                    if (index > 0) samples.push(elapsed);
                }
                measurements[name].push(samples);
                await page.evaluate(() => globalThis.measureCms.destroy());
                assert.equal(
                    await page.locator('.soeditor-classic').count(),
                    0,
                );
            } finally {
                await page.close();
                await new Promise((done) => server.httpServer.close(done));
            }
        }
    }
    const result = {
        measuredAt: new Date().toISOString(),
        node: version,
        chromium: browser.version(),
        builds,
        methodology:
            '500 KiB fixture, Source disabled; native beforeinput to next animation frame; 3 fresh instances per build, 1 excluded warmup and 6 samples each; alternating build order. Local diagnostic comparison, not a release P95.',
        measurements,
        medianMilliseconds: Object.fromEntries(
            Object.entries(measurements).map(([name, rounds]) => {
                const values = rounds.flat().sort((a, b) => a - b);
                return [name, (values[8] + values[9]) / 2];
            }),
        ),
    };
    await writeFile(resolve(argv[4]), `${JSON.stringify(result, null, 2)}\n`);
} finally {
    await browser.close();
}
