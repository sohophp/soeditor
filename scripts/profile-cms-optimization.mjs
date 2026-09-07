import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { SourceMap } from 'node:module';
import { resolve } from 'node:path';
import { argv } from 'node:process';
import { URL } from 'node:url';
import { chromium } from '@playwright/test';
import { preview } from 'vite';

assert.ok(
    argv[2] && argv[3] && argv[4],
    'Usage: before-dir after-dir output.json',
);
const browser = await chromium.launch();
const results = [];
try {
    for (const [name, fixture] of [
        ['before', resolve(argv[2])],
        ['after', resolve(argv[3])],
    ]) {
        const server = await preview({
            configFile: false,
            root: fixture,
            logLevel: 'error',
            build: { outDir: fixture },
            preview: { host: '127.0.0.1', port: 4190, strictPort: true },
        });
        const page = await browser.newPage();
        try {
            await page.goto('http://127.0.0.1:4190');
            await page.waitForFunction(() => globalThis.measureCms);
            await page.evaluate(() =>
                globalThis.measureCms.create(512000, true),
            );
            await page.locator('.soeditor-classic__visual p').first().click();
            await page.keyboard.press('End');
            await page.keyboard.insertText('warmup');
            const cdp = await page.context().newCDPSession(page);
            await cdp.send('Profiler.enable');
            for (const action of ['input', 'source']) {
                await cdp.send('Profiler.start');
                if (action === 'input')
                    for (let index = 0; index < 5; index += 1)
                        await page.keyboard.insertText('x');
                else
                    for (let index = 0; index < 3; index += 1) {
                        await page.evaluate(() =>
                            globalThis.measureCms.source(),
                        );
                        await page.evaluate(() =>
                            globalThis.measureCms.visual(),
                        );
                    }
                const { profile } = await cdp.send('Profiler.stop');
                const maps = new Map();
                const locations = new Map();
                for (const node of profile.nodes) {
                    const frame = node.callFrame;
                    let location = frame.functionName || '(anonymous)';
                    if (frame.url.startsWith('http://127.0.0.1:4190/')) {
                        const file = new URL(frame.url).pathname;
                        if (!maps.has(file)) {
                            try {
                                maps.set(
                                    file,
                                    new SourceMap(
                                        JSON.parse(
                                            await readFile(
                                                resolve(
                                                    fixture,
                                                    `.${file}.map`,
                                                ),
                                                'utf8',
                                            ),
                                        ),
                                    ),
                                );
                            } catch {
                                maps.set(file, undefined);
                            }
                        }
                        const entry = maps
                            .get(file)
                            ?.findEntry(frame.lineNumber, frame.columnNumber);
                        location = entry?.originalSource
                            ? `${entry.originalSource}:${String(entry.originalLine + 1)} ${entry.name || location}`
                            : `${file} ${location}`;
                    }
                    locations.set(node.id, location);
                }
                const times = new Map();
                for (
                    let index = 0;
                    index < (profile.samples?.length ?? 0);
                    index += 1
                ) {
                    const location = locations.get(profile.samples[index]);
                    times.set(
                        location,
                        (times.get(location) ?? 0) +
                            (profile.timeDeltas[index] ?? 0) / 1000,
                    );
                }
                results.push({
                    name,
                    action,
                    selfMilliseconds: [...times]
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 40),
                });
            }
        } finally {
            await page.close();
            await new Promise((done) => server.httpServer.close(done));
        }
    }
    await writeFile(
        resolve(argv[4]),
        `${JSON.stringify({ measuredAt: new Date().toISOString(), chromium: browser.version(), methodology: 'Separate CDP CPU diagnostic, 500 KiB, 5 native inputs and 3 Source round trips including first load; sampled self time mapped through preserved source maps. Not combined with latency samples.', results }, null, 2)}\n`,
    );
} finally {
    await browser.close();
}
