import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { argv } from 'node:process';
import { gzipSync } from 'node:zlib';
import { preview } from 'vite';
import { chromium } from '@playwright/test';

assert.ok(
    argv[2] && argv[3] && argv[4],
    'Usage: before-dist after-dist output.json',
);
const browser = await chromium.launch();
const results = [];
try {
    for (const [name, directory] of [
        ['before', argv[2]],
        ['after', argv[3]],
    ]) {
        const fixture = resolve(directory);
        const server = await preview({
            configFile: false,
            root: fixture,
            logLevel: 'error',
            build: { outDir: fixture },
            preview: { host: '127.0.0.1', port: 4194, strictPort: true },
        });
        const page = await browser.newPage();
        try {
            await page.goto('http://127.0.0.1:4194');
            await page.waitForFunction(() => globalThis.measureCms);
            await page.evaluate(() =>
                globalThis.measureCms.create(102400, true),
            );
            await page.evaluate(async () => {
                await globalThis.measureCms.source();
                await globalThis.measureCms.visual();
            });
            const undo = [];
            for (let index = 0; index < 12; index += 1) {
                await page
                    .locator('.soeditor-classic__visual p')
                    .first()
                    .click();
                await page.keyboard.press('End');
                await page.keyboard.insertText('x');
                undo.push(
                    await page.evaluate(async () => {
                        const classic = globalThis.measureCms.editor,
                            before = classic.getData();
                        const start = globalThis.performance.now();
                        await classic.editor.execute('editor.undo');
                        const milliseconds =
                            globalThis.performance.now() - start;
                        await classic.editor.execute('editor.redo');
                        await classic.setWorkspaceView('source');
                        await classic.setWorkspaceView('wysiwyg');
                        if (classic.getData() !== before)
                            throw new Error(
                                'History changed canonical content',
                            );
                        return milliseconds;
                    }),
                );
                await page.waitForTimeout(150);
            }
            const cdp = await page.context().newCDPSession(page);
            await cdp.send('Profiler.enable');
            await cdp.send('Profiler.start');
            await page.evaluate(async () => {
                const editor = globalThis.measureCms.editor.editor;
                for (let i = 0; i < 3; i += 1) {
                    await editor.execute('editor.undo');
                    await editor.execute('editor.redo');
                }
            });
            const { profile } = await cdp.send('Profiler.stop');
            const cpuProfile = `${argv[4]}.${name}.cpuprofile.json.gz`;
            await writeFile(cpuProfile, gzipSync(JSON.stringify(profile)));
            const mean = (values) =>
                values.reduce((sum, value) => sum + value, 0) / values.length;
            results.push({
                name,
                fixture,
                undo,
                earlyMean: mean(undo.slice(0, 3)),
                lateMean: mean(undo.slice(-3)),
                cpuProfile,
            });
            await page.evaluate(() => globalThis.measureCms.destroy());
        } finally {
            await page.close();
            await new Promise((done) => server.httpServer.close(done));
        }
    }
    await writeFile(
        argv[4],
        `${JSON.stringify({ measuredAt: new Date().toISOString(), chromium: browser.version(), results, note: 'Twelve 100 KiB edit/history/Source cycles per build followed by a separate three-pair CPU profile. A diagnostic comparison, not a cross-device latency SLA. Use the retained pre-sync build to isolate the Source synchronization change.' }, null, 2)}\n`,
    );
} finally {
    await browser.close();
}
