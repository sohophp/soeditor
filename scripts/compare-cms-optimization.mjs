import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { argv, version } from 'node:process';
import { preview } from 'vite';
import { chromium } from '@playwright/test';

assert.ok(
    argv[2] && argv[3] && argv[4],
    'Usage: before-dir after-dir output.json',
);
const builds = { before: resolve(argv[2]), after: resolve(argv[3]) };
const browser = await chromium.launch();
const measurements = [];
try {
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
            try {
                for (const size of [10240, 102400, 512000]) {
                    const page = await browser.newPage();
                    try {
                        await page.goto('http://127.0.0.1:4189');
                        await page.waitForFunction(() => globalThis.measureCms);
                        await page.evaluate(
                            (size) => globalThis.measureCms.create(size, true),
                            size,
                        );
                        await page
                            .locator('.soeditor-classic__visual p')
                            .first()
                            .click();
                        await page.keyboard.press('End');
                        const inputs = [];
                        for (let index = 0; index < 12; index += 1) {
                            await page.evaluate(() => {
                                const surface =
                                    globalThis.measureCms.editor.element
                                        .querySelector(
                                            '.soeditor-classic__visual',
                                        )
                                        .shadowRoot.querySelector(
                                            '.soeditor-wysiwyg-content',
                                        );
                                surface.addEventListener(
                                    'beforeinput',
                                    () => {
                                        const start =
                                            globalThis.performance.now();
                                        globalThis.inputMeasurement =
                                            new Promise((done) =>
                                                globalThis.requestAnimationFrame(
                                                    () =>
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
                            if (index >= 2) inputs.push(elapsed);
                            assert.ok(
                                await page.evaluate(
                                    (count) =>
                                        globalThis.measureCms.editor
                                            .getData()
                                            .includes('x'.repeat(count)),
                                    index + 1,
                                ),
                            );
                        }
                        const source = [];
                        const original = await page.evaluate(() =>
                            globalThis.measureCms.editor.getData(),
                        );
                        for (let index = 0; index < 4; index += 1) {
                            source.push(
                                await page.evaluate(() =>
                                    globalThis.measureCms.source(),
                                ),
                            );
                            await page.evaluate(() =>
                                globalThis.measureCms.visual(),
                            );
                            assert.equal(
                                await page.evaluate(() =>
                                    globalThis.measureCms.editor.getData(),
                                ),
                                original,
                            );
                        }
                        measurements.push({ name, size, inputs, source });
                        await page.evaluate(() =>
                            globalThis.measureCms.destroy(),
                        );
                        assert.equal(
                            await page.locator('.soeditor-classic').count(),
                            0,
                        );
                    } finally {
                        await page.close();
                    }
                }
            } finally {
                await new Promise((done) => server.httpServer.close(done));
            }
        }
    }
    const summarize = (values) => {
        const sorted = values.toSorted((a, b) => a - b);
        return {
            samples: sorted.length,
            median:
                (sorted[Math.floor((sorted.length - 1) / 2)] +
                    sorted[Math.floor(sorted.length / 2)]) /
                2,
            p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
        };
    };
    const summary = [];
    for (const name of Object.keys(builds))
        for (const size of [10240, 102400, 512000]) {
            const rows = measurements.filter(
                (row) => row.name === name && row.size === size,
            );
            summary.push({
                name,
                size,
                input: summarize(rows.flatMap((row) => row.inputs)),
                firstSource: summarize(rows.map((row) => row.source[0])),
                repeatSource: summarize(
                    rows.flatMap((row) => row.source.slice(1)),
                ),
            });
        }
    await writeFile(
        resolve(argv[4]),
        `${JSON.stringify({ measuredAt: new Date().toISOString(), node: version, chromium: browser.version(), builds, methodology: 'Identical minified production fixture; alternating 3 fresh instances per build and size; native input to next frame, 2 warmup + 10 samples; first Source and 3 repeat switches per instance. Local sample P95, not cross-device qualification.', summary, measurements }, null, 2)}\n`,
    );
} finally {
    await browser.close();
}
