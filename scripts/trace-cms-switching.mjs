import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { argv } from 'node:process';
import { gzipSync } from 'node:zlib';
import { preview } from 'vite';
import { chromium } from '@playwright/test';

assert.ok(argv[2] && argv[3], 'Usage: fixture-dist output.json');
const fixture = resolve(argv[2]);
const server = await preview({
    configFile: false,
    root: fixture,
    logLevel: 'error',
    build: { outDir: fixture },
    preview: { host: '127.0.0.1', port: 4191, strictPort: true },
});
const browser = await chromium.launch();
try {
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:4191');
    await page.waitForFunction(() => globalThis.measureCms);
    await page.evaluate(() => globalThis.measureCms.create(512000, true));
    await page.evaluate(() => globalThis.measureCms.source());
    await page.evaluate(() => globalThis.measureCms.visual());
    const cdp = await page.context().newCDPSession(page);
    const complete = new Promise((done) =>
        cdp.once('Tracing.tracingComplete', done),
    );
    await cdp.send('Tracing.start', {
        categories:
            'devtools.timeline,blink.user_timing,disabled-by-default-devtools.timeline.stack',
        transferMode: 'ReturnAsStream',
    });
    const elapsed = [];
    for (let index = 0; index < 3; index += 1) {
        elapsed.push(
            await page.evaluate(async () => {
                globalThis.performance.mark('source-start');
                const source = await globalThis.measureCms.source();
                globalThis.performance.mark('source-end');
                await globalThis.measureCms.visual();
                globalThis.performance.mark('visual-end');
                return source;
            }),
        );
    }
    await cdp.send('Tracing.end');
    const { stream } = await complete;
    let text = '';
    for (;;) {
        const chunk = await cdp.send('IO.read', { handle: stream });
        assert.ok(!chunk.base64Encoded);
        text += chunk.data;
        if (chunk.eof) break;
    }
    await cdp.send('IO.close', { handle: stream });
    await writeFile(`${argv[3]}.trace.json.gz`, gzipSync(text));
    const events = JSON.parse(text).traceEvents;
    const names = [
        'Layout',
        'UpdateLayoutTree',
        'PrePaint',
        'Paint',
        'FunctionCall',
        'MinorGC',
        'MajorGC',
    ];
    const summary = Object.fromEntries(
        names.map((name) => {
            const matches = events.filter(
                (event) => event.name === name && event.ph === 'X',
            );
            return [
                name,
                {
                    count: matches.length,
                    milliseconds:
                        matches.reduce(
                            (sum, event) => sum + (event.dur ?? 0),
                            0,
                        ) / 1000,
                },
            ];
        }),
    );
    await writeFile(
        argv[3],
        `${JSON.stringify({ measuredAt: new Date().toISOString(), chromium: browser.version(), fixture, elapsed, summary, note: 'Three warmed 500 KiB Source/WYSIWYG round trips. Timeline durations overlap: do not sum categories or compare traced latency with untraced samples. Full trace is retained alongside this file.' }, null, 2)}\n`,
    );
    await page.evaluate(() => globalThis.measureCms.destroy());
} finally {
    await browser.close();
    await new Promise((done) => server.httpServer.close(done));
}
