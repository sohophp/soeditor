import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { argv, stdout } from 'node:process';
import { gzipSync } from 'node:zlib';
import { preview } from 'vite';
import { chromium } from '@playwright/test';

assert.ok(argv[2] && argv[3], 'Usage: fixture-dist output.json [minutes=15]');
const minutes = Number(argv[4] ?? 15);
assert.ok(Number.isFinite(minutes) && minutes >= 1 && minutes <= 120);
const fixture = resolve(argv[2]);
const server = await preview({
    configFile: false,
    root: fixture,
    logLevel: 'error',
    build: { outDir: fixture },
    preview: { host: '127.0.0.1', port: 4192, strictPort: true },
});
const browser = await chromium.launch();
try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('http://127.0.0.1:4192');
    await page.waitForFunction(() => globalThis.measureCms);
    await page.evaluate(() => globalThis.measureCms.create(102400, true));
    const cdp = await page.context().newCDPSession(page);
    const snapshots = [];
    async function snapshot(label) {
        await cdp.send('HeapProfiler.collectGarbage');
        const chunks = [];
        const receive = (event) => chunks.push(event.chunk);
        cdp.on('HeapProfiler.addHeapSnapshotChunk', receive);
        try {
            await cdp.send('HeapProfiler.takeHeapSnapshot', {
                reportProgress: false,
            });
        } finally {
            cdp.off('HeapProfiler.addHeapSnapshotChunk', receive);
        }
        const text = chunks.join('');
        const path = `${argv[3]}.${label}.heapsnapshot.gz`;
        await writeFile(path, gzipSync(text));
        const data = JSON.parse(text);
        const fields = data.snapshot.meta.node_fields;
        const step = fields.length,
            nameIndex = fields.indexOf('name'),
            sizeIndex = fields.indexOf('self_size');
        const totals = new Map();
        for (let i = 0; i < data.nodes.length; i += step) {
            const name = data.strings[data.nodes[i + nameIndex]];
            const row = totals.get(name) ?? { count: 0, selfBytes: 0 };
            row.count += 1;
            row.selfBytes += data.nodes[i + sizeIndex];
            totals.set(name, row);
        }
        snapshots.push({
            label,
            path,
            topSelfBytes: [...totals]
                .sort((a, b) => b[1].selfBytes - a[1].selfBytes)
                .slice(0, 30),
            detachedNames: [...totals].filter(([name]) =>
                name.startsWith('Detached '),
            ),
        });
    }
    // Warm Source and status before measuring one continuously mounted editor.
    await page.evaluate(async () => {
        await globalThis.measureCms.source();
        await globalThis.measureCms.visual();
    });
    await page.waitForTimeout(250);
    await snapshot('warm');
    const start = Date.now(),
        checkpoints = [];
    const cycleMeasurements = [];
    let cycles = 0,
        nextCheckpoint = 0;
    while (Date.now() - start < minutes * 60000) {
        const cycleStart = Date.now();
        await page.locator('.soeditor-classic__visual p').first().click();
        await page.keyboard.press('End');
        await page.keyboard.insertText('x');
        cycles += 1;
        assert.ok(
            await page.evaluate(
                (count) =>
                    globalThis.measureCms.editor
                        .getData()
                        .includes('x'.repeat(count)),
                cycles,
            ),
        );
        const inputMilliseconds = Date.now() - cycleStart;
        const phases = await page.evaluate(async () => {
            const classic = globalThis.measureCms.editor;
            const before = classic.getData();
            const undoStart = globalThis.performance.now();
            await classic.editor.execute('editor.undo');
            const undo = globalThis.performance.now() - undoStart;
            const redoStart = globalThis.performance.now();
            await classic.editor.execute('editor.redo');
            const redo = globalThis.performance.now() - redoStart;
            if (classic.getData() !== before)
                throw new Error('History changed canonical content');
            const viewsStart = globalThis.performance.now();
            classic.setReadonly(true);
            classic.setReadonly(false);
            await classic.setWorkspaceView('source');
            await classic.setWorkspaceView('wysiwyg-source-horizontal');
            await classic.setWorkspaceView('wysiwyg-source-vertical');
            await classic.setWorkspaceView('wysiwyg');
            if (classic.getData() !== before)
                throw new Error('Switch changed canonical content');
            return {
                undo,
                redo,
                views: globalThis.performance.now() - viewsStart,
            };
        });
        cycleMeasurements.push({
            cycle: cycles,
            inputMilliseconds,
            ...phases,
            totalMilliseconds: Date.now() - cycleStart,
        });
        await page.waitForTimeout(500);
        if (Date.now() - start >= nextCheckpoint) {
            await cdp.send('HeapProfiler.collectGarbage');
            const row = {
                elapsedSeconds: (Date.now() - start) / 1000,
                cycles,
                lastCycle: cycleMeasurements.at(-1),
                ...(await cdp.send('Memory.getDOMCounters')),
                ...(await cdp.send('Runtime.getHeapUsage')),
            };
            checkpoints.push(row);
            stdout.write(`${JSON.stringify(row)}\n`);
            nextCheckpoint += 60000;
        }
    }
    await snapshot('mounted-end');
    await page.evaluate(() => globalThis.measureCms.destroy());
    assert.equal(await page.locator('.soeditor-classic').count(), 0);
    await page.waitForTimeout(250);
    await snapshot('destroyed');
    assert.deepEqual(errors, []);
    const final = {
        ...(await cdp.send('Memory.getDOMCounters')),
        ...(await cdp.send('Runtime.getHeapUsage')),
    };
    await writeFile(
        argv[3],
        `${JSON.stringify({ measuredAt: new Date().toISOString(), chromium: browser.version(), minutes, cycles, cycleMeasurements, elapsedSeconds: (Date.now() - start) / 1000, checkpoints, final, snapshots, errors, note: 'One continuously mounted 100 KiB production editor with edit, undo/redo, readonly and all Source views. Forced GC and full heap snapshots are diagnostics, not latency benchmarks or manual IME/Office/Safari qualification. History and the fixture-held destroyed wrapper are intentional retainers; snapshot self sizes are not dominator retained sizes.' }, null, 2)}\n`,
    );
} finally {
    await browser.close();
    await new Promise((done) => server.httpServer.close(done));
}
