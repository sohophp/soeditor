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
                for (const shape of ['blocks', 'container']) {
                    for (const size of [10240, 102400, 512000]) {
                        const page = await browser.newPage();
                        try {
                            await page.goto('http://127.0.0.1:4189');
                            await page.waitForFunction(
                                () => globalThis.measureCms,
                            );
                            await page.evaluate(
                                (size) =>
                                    globalThis.measureCms.create(size, true),
                                size,
                            );
                            if (shape === 'container')
                                await page.evaluate(() => {
                                    const editor = globalThis.measureCms.editor;
                                    editor.setData(
                                        `<div data-cms-container="article">${editor.getData()}</div>`,
                                    );
                                });
                            await page.waitForTimeout(150);
                            const inputs = await measureInputs(page, 'x');
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
                            const inputAfterSource = await measureInputs(
                                page,
                                'y',
                            );
                            measurements.push({
                                name,
                                shape,
                                size,
                                inputs,
                                inputAfterSource,
                                source,
                            });
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
        for (const shape of ['blocks', 'container'])
            for (const size of [10240, 102400, 512000]) {
                const rows = measurements.filter(
                    (row) =>
                        row.name === name &&
                        row.shape === shape &&
                        row.size === size,
                );
                summary.push({
                    name,
                    shape,
                    size,
                    input: summarize(rows.flatMap((row) => row.inputs)),
                    inputAfterSource: summarize(
                        rows.flatMap((row) => row.inputAfterSource),
                    ),
                    firstSource: summarize(rows.map((row) => row.source[0])),
                    repeatSource: summarize(
                        rows.flatMap((row) => row.source.slice(1)),
                    ),
                });
            }
    await writeFile(
        resolve(argv[4]),
        `${JSON.stringify({ measuredAt: new Date().toISOString(), node: version, chromium: browser.version(), builds, methodology: 'Identical production fixture; flat top-level blocks and one wrapping div; alternating 3 instances per build/shape/size; 2 warmup + 10 input-to-next-frame samples, paced 40ms after each, with eventual status convergence asserted. Source first and 3 repeat switches, then a second identical typing burst after Source has loaded. Deferred statistics still consume main-thread time outside individual next-frame samples. Local P95, not a cross-device guarantee.', summary, measurements }, null, 2)}\n`,
    );
} finally {
    await browser.close();
}

async function measureInputs(page, character) {
    await page.locator('.soeditor-classic__visual p').first().click();
    await page.keyboard.press('End');
    const inputs = [];
    for (let index = 0; index < 12; index += 1) {
        await page.evaluate(() => {
            const surface = globalThis.measureCms.editor.element
                .querySelector('.soeditor-classic__visual')
                .shadowRoot.querySelector('.soeditor-wysiwyg-content');
            surface.addEventListener(
                'beforeinput',
                () => {
                    const start = globalThis.performance.now();
                    globalThis.inputMeasurement = new Promise((done) =>
                        globalThis.requestAnimationFrame(() =>
                            done(globalThis.performance.now() - start),
                        ),
                    );
                },
                { once: true },
            );
        });
        await page.keyboard.insertText(character);
        const elapsed = await page.evaluate(() => globalThis.inputMeasurement);
        assert.ok(Number.isFinite(elapsed));
        if (index >= 2) inputs.push(elapsed);
        // Include periodic deferred status work across a paced burst.
        await page.waitForTimeout(40);
        assert.ok(
            await page.evaluate(
                ({ count, character }) =>
                    globalThis.measureCms.editor
                        .getData()
                        .includes(character.repeat(count)),
                { count: index + 1, character },
            ),
        );
    }
    await page.waitForFunction(() => {
        const source = globalThis.measureCms.editor.getData();
        const status = globalThis.document.querySelector(
            '.soeditor-ui__document-status',
        );
        return (
            Number(status?.getAttribute('data-source-characters')) ===
            Array.from(source).length
        );
    });

    return inputs;
}
