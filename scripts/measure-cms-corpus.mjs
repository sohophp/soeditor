import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { argv, version, platform, arch } from 'node:process';
import { URL } from 'node:url';
import { preview } from 'vite';
import { chromium } from '@playwright/test';

assert.ok(
    argv[2] && argv[3] && argv[4],
    'Usage: fixture-dist manifest.json output.json',
);
const fixture = resolve(argv[2]);
const manifestPath = resolve(argv[3]);
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
assert.ok(Array.isArray(manifest.samples) && manifest.samples.length > 0);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const buildFiles = {};
async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = resolve(directory, entry.name);
        if (entry.isDirectory()) await walk(path);
        else buildFiles[relative(fixture, path)] = sha256(await readFile(path));
    }
}
await walk(fixture);
const server = await preview({
    configFile: false,
    root: fixture,
    logLevel: 'error',
    build: { outDir: fixture },
    preview: { host: '127.0.0.1', port: 4194, strictPort: true },
});
const browser = await chromium.launch();
const results = [];
try {
    for (const sample of manifest.samples) {
        assert.equal(typeof sample.path, 'string');
        assert.ok(['synthetic', 'real-anonymized'].includes(sample.kind));
        assert.equal(typeof sample.provenance, 'string');
        assert.ok(sample.provenance.trim());
        const path = resolve(dirname(manifestPath), sample.path);
        const html = await readFile(path, 'utf8');
        const runs = [];
        for (let round = 0; round < 3; round += 1) {
            const page = await browser.newPage({
                viewport: { width: 1280, height: 800 },
            });
            const errors = [];
            const blockedRequests = new Set();
            page.on('pageerror', (error) => errors.push(error.message));
            await page.route('**/*', (route) => {
                const url = route.request().url();
                if (new URL(url).origin === 'http://127.0.0.1:4194')
                    return route.continue();
                blockedRequests.add(url);
                return route.abort();
            });
            try {
                await page.goto('http://127.0.0.1:4194');
                await page.waitForFunction(() => globalThis.measureCms);
                const startup = await page.evaluate(
                    (html) => globalThis.measureCms.create(0, true, html),
                    html,
                );
                const paragraph = page
                    .locator('.soeditor-wysiwyg-content p')
                    .filter({ hasText: /\S/u })
                    .first();
                assert.equal(
                    await paragraph.count(),
                    1,
                    'Sample needs a nonempty editable paragraph',
                );
                await paragraph.click();
                await page.keyboard.press('End');
                await page.keyboard.press('ArrowLeft');
                const input = [];
                for (let index = 0; index < 12; index += 1) {
                    await paragraph.evaluate((paragraph) => {
                        const surface = paragraph.closest(
                            '.soeditor-wysiwyg-content',
                        );
                        if (surface === null)
                            throw new Error('Missing editing surface');
                        globalThis.corpusInput = new Promise(
                            (resolve, reject) => {
                                const timeout = globalThis.setTimeout(
                                    () =>
                                        reject(
                                            new Error(
                                                'No beforeinput event reached the editing surface',
                                            ),
                                        ),
                                    5000,
                                );
                                surface.addEventListener(
                                    'beforeinput',
                                    () => {
                                        globalThis.clearTimeout(timeout);
                                        const start =
                                            globalThis.performance.now();
                                        globalThis.requestAnimationFrame(() =>
                                            resolve(
                                                globalThis.performance.now() -
                                                    start,
                                            ),
                                        );
                                    },
                                    { once: true, capture: true },
                                );
                            },
                        );
                    });
                    await page.keyboard.insertText('x');
                    const elapsed = await page.evaluate(
                        () => globalThis.corpusInput,
                    );
                    if (index >= 2) input.push(elapsed);
                    await page.waitForTimeout(40);
                }
                const selection = [];
                for (let index = 0; index < 10; index += 1) {
                    const start = await page.evaluate(() =>
                        globalThis.performance.now(),
                    );
                    await page.keyboard.press(
                        index % 2 ? 'ArrowRight' : 'ArrowLeft',
                    );
                    selection.push(
                        await page.evaluate(
                            (start) =>
                                new Promise((resolve) =>
                                    globalThis.requestAnimationFrame(() =>
                                        resolve(
                                            globalThis.performance.now() -
                                                start,
                                        ),
                                    ),
                                ),
                            start,
                        ),
                    );
                }
                const original = await page.evaluate(() =>
                    globalThis.measureCms.editor.getData(),
                );
                const views = [];
                for (const view of [
                    'source',
                    'wysiwyg-source-horizontal',
                    'wysiwyg-source-vertical',
                    'wysiwyg',
                ]) {
                    views.push(
                        await page.evaluate(async (view) => {
                            const start = globalThis.performance.now();
                            await globalThis.measureCms.editor.setWorkspaceView(
                                view,
                            );
                            return {
                                view,
                                milliseconds:
                                    globalThis.performance.now() - start,
                            };
                        }, view),
                    );
                    assert.equal(
                        await page.evaluate(() =>
                            globalThis.measureCms.editor.getData(),
                        ),
                        original,
                    );
                }
                const cell = page
                    .locator('.soeditor-wysiwyg-content td')
                    .first();
                let tableSelection;
                if (await cell.count()) {
                    const start = await page.evaluate(() =>
                        globalThis.performance.now(),
                    );
                    await cell.click();
                    tableSelection = await page.evaluate(
                        (start) =>
                            new Promise((resolve) =>
                                globalThis.requestAnimationFrame(() =>
                                    resolve(
                                        globalThis.performance.now() - start,
                                    ),
                                ),
                            ),
                        start,
                    );
                }
                await page.evaluate(() => globalThis.measureCms.destroy());
                assert.deepEqual(errors, []);
                runs.push({
                    round,
                    startup: startup.milliseconds,
                    input,
                    selection,
                    views,
                    tableSelection,
                    blockedRequests: [...blockedRequests],
                    errors,
                });
            } finally {
                await page.close();
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
        results.push({
            path,
            kind: sample.kind,
            provenance: sample.provenance,
            sha256: sha256(html),
            bytes: Buffer.byteLength(html),
            input: summarize(runs.flatMap((run) => run.input)),
            selection: summarize(runs.flatMap((run) => run.selection)),
            runs,
        });
        await writeFile(
            resolve(argv[4]),
            JSON.stringify(
                {
                    measuredAt: new Date().toISOString(),
                    node: version,
                    platform,
                    arch,
                    chromium: browser.version(),
                    viewport: { width: 1280, height: 800 },
                    buildFiles,
                    results,
                    note: 'Three fresh production instances per sample. Input is beforeinput to next frame; selection/table timings include browser protocol overhead. External requests blocked. Synthetic samples are not real articles or manual device qualification. Compare only matching sample hashes, viewport, protocol and environment; build hashes identify the versions under comparison.',
                },
                null,
                2,
            ) + '\n',
        );
    }
} finally {
    await browser.close();
    await new Promise((done) => server.httpServer.close(done));
}
