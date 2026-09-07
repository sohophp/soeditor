import { build, preview } from 'vite';
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { argv, version, stdout, exit } from 'node:process';
import { URL } from 'node:url';
import { Buffer } from 'node:buffer';
import assert from 'node:assert/strict';
import { cmsLoadingBudgets, verifyCmsLoading } from './cms-loading-budgets.mjs';

const root = resolve(import.meta.dirname, '..');
const output = resolve(argv[2] ?? '/tmp/soeditor-cms-loading.json');
const fixture = resolve(root, 'node_modules/.cache/soeditor-cms-loading');
await mkdir(fixture, { recursive: true });
const entry = resolve(root, 'packages/soeditor/src/cms-optional.ts');
await writeFile(
    resolve(fixture, 'index.html'),
    '<!doctype html><html><head><title>CMS loading measurement</title></head><body><textarea></textarea><script type="module" src="./main.js"></script></body></html>',
);
await writeFile(
    resolve(fixture, 'main.js'),
    `
import { createClassicEditor } from ${JSON.stringify(entry)};
import ${JSON.stringify(resolve(root, 'packages/soeditor/src/cms-styles.css'))};
let editor;
globalThis.measureCms = {
  get editor() { return editor; },
  async create(size, source, initialData) {
    const block = '<section data-cms="record"><h2>CMS article</h2><p>Text <strong>bold</strong> and <a href="/page">link</a>.</p><table><tbody><tr><td>A</td><td>B</td></tr></tbody></table><!-- cms --><product-card data-id="1"></product-card></section>';
    const data = initialData ?? block.repeat(Math.ceil(size / block.length));
    const start = globalThis.performance.now();
    editor = await createClassicEditor(document.querySelector('textarea'), {
      data, editingModes: source ? ['wysiwyg', 'source'] : ['wysiwyg'],
      toolbar: ['bold', 'italic', 'alignment', 'orderedList', 'unorderedList', 'format', 'minify'],
    });
    return { milliseconds: globalThis.performance.now() - start, characters: data.length };
  },
  async source() {
    const start = globalThis.performance.now();
    await editor.setWorkspaceView('source');
    return globalThis.performance.now() - start;
  },
  async format() { const start = globalThis.performance.now(); await editor.editor.execute('document.format'); return globalThis.performance.now() - start; },
  visual() { return editor.setWorkspaceView('wysiwyg'); },
  async destroy() { const start = globalThis.performance.now(); await editor.destroy(); return globalThis.performance.now() - start; },
};
`,
);
const graph = [];
const assets = [];
await build({
    configFile: false,
    root: fixture,
    logLevel: 'error',
    plugins: [
        {
            name: 'cms-loading-graph',
            generateBundle(_options, bundle) {
                for (const item of Object.values(bundle)) {
                    if (item.type !== 'chunk') {
                        assets.push({
                            file: item.fileName,
                            raw:
                                typeof item.source === 'string'
                                    ? Buffer.byteLength(item.source)
                                    : item.source.byteLength,
                            gzip: gzipSync(item.source).length,
                        });
                        continue;
                    }
                    graph.push({
                        file: item.fileName,
                        entry: item.isEntry,
                        imports: item.imports,
                        dynamicImports: item.dynamicImports,
                        modules: Object.keys(item.modules).map((id) =>
                            relative(root, id),
                        ),
                    });
                }
            },
        },
    ],
    build: { outDir: 'dist', sourcemap: true, minify: true },
});
if (argv.includes('--build-only')) {
    stdout.write(
        `Production CMS fixture built at ${resolve(fixture, 'dist')}\n`,
    );
    exit(0);
}
const server = await preview({
    configFile: false,
    root: fixture,
    logLevel: 'error',
    preview: { host: '127.0.0.1', port: 4188, strictPort: true },
});
const browser = await chromium.launch();
const runs = [];
try {
    for (const size of [10_240, 102_400, 512_000]) {
        for (const source of [false, true]) {
            const context = await browser.newContext();
            const page = await context.newPage();
            const cdp = await context.newCDPSession(page);
            const requests = new Set();
            page.on('request', (request) =>
                requests.add(new URL(request.url()).pathname),
            );
            await page.goto('http://127.0.0.1:4188');
            await page.waitForFunction(
                () => globalThis.measureCms !== undefined,
            );
            const create = await page.evaluate(
                ({ size, source }) =>
                    globalThis.measureCms.create(size, source),
                { size, source },
            );
            const initialRequests = [...requests];
            const heapBefore = await cdp.send('Runtime.getHeapUsage');
            let sourceFirst, sourceAgain, formatting;
            if (source) {
                sourceFirst = await page.evaluate(() =>
                    globalThis.measureCms.source(),
                );
                await page.locator('.cm-content').waitFor({ state: 'visible' });
                const afterSource = [...requests];
                await page.evaluate(() => globalThis.measureCms.visual());
                sourceAgain = await page.evaluate(() =>
                    globalThis.measureCms.source(),
                );
                await page.locator('.cm-content').waitFor({ state: 'visible' });
                formatting = {
                    milliseconds: await page.evaluate(() =>
                        globalThis.measureCms.format(),
                    ),
                    requests: [...requests].filter(
                        (url) => !afterSource.includes(url),
                    ),
                };
                sourceFirst = {
                    milliseconds: sourceFirst,
                    requests: afterSource.filter(
                        (url) => !initialRequests.includes(url),
                    ),
                };
            }
            const destroy = await page.evaluate(() =>
                globalThis.measureCms.destroy(),
            );
            await cdp.send('HeapProfiler.collectGarbage');
            const heapAfter = await cdp.send('Runtime.getHeapUsage');
            const warmCreate = await page.evaluate(
                ({ size, source }) =>
                    globalThis.measureCms.create(size, source),
                { size, source },
            );
            let interactions;
            if (argv.includes('--interactions')) {
                await page.evaluate(() => {
                    const editor = globalThis.measureCms.editor;
                    const surface = editor.element
                        .querySelector('.soeditor-classic__visual')
                        .shadowRoot.querySelector('.soeditor-wysiwyg-content');
                    const paragraph = surface.querySelector('p');
                    surface.focus();
                    const range = globalThis.document.createRange();
                    range.selectNodeContents(paragraph);
                    range.collapse(false);
                    const selection = globalThis.document.getSelection();
                    selection.removeAllRanges();
                    selection.addRange(range);
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
                await page.keyboard.insertText('Measured input');
                const inputToFrame = await page.evaluate(
                    () => globalThis.inputMeasurement,
                );
                assert.equal(typeof inputToFrame, 'number');
                const pasteToFrame = await page.evaluate(async () => {
                    const surface = globalThis.measureCms.editor.element
                        .querySelector('.soeditor-classic__visual')
                        .shadowRoot.querySelector('.soeditor-wysiwyg-content');
                    const clipboardData = new globalThis.DataTransfer();
                    clipboardData.setData(
                        'text/html',
                        '<p>Pasted <strong>CMS</strong> <img alt="pixel" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jQZkAAAAASUVORK5CYII=" /></p>',
                    );
                    const start = globalThis.performance.now();
                    surface.dispatchEvent(
                        new globalThis.ClipboardEvent('paste', {
                            bubbles: true,
                            cancelable: true,
                            clipboardData,
                        }),
                    );
                    await new Promise(globalThis.requestAnimationFrame);
                    if (
                        !globalThis.measureCms.editor
                            .getData()
                            .includes('Pasted')
                    )
                        throw new Error('Measured paste was not applied.');
                    return globalThis.performance.now() - start;
                });
                await page
                    .locator('.soeditor-classic__visual td')
                    .first()
                    .click();
                const tableToFrame = await page.evaluate(async () => {
                    const editor = globalThis.measureCms.editor.editor;
                    const start = globalThis.performance.now();
                    const before = editor.getData();
                    await editor.execute('table.row.insertAfter');
                    await new Promise(globalThis.requestAnimationFrame);
                    if (editor.getData() === before)
                        throw new Error(
                            'Measured table command was not applied.',
                        );
                    return globalThis.performance.now() - start;
                });
                const menuFirstOpen = {};
                for (const item of [
                    'alignment',
                    'orderedList',
                    'unorderedList',
                ]) {
                    const summary = page.locator(
                        `[data-toolbar-item="${item}"] summary`,
                    );
                    await summary.evaluate((element) => {
                        element.addEventListener(
                            'click',
                            () => {
                                const start = globalThis.performance.now();
                                globalThis.menuMeasurement = new Promise(
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
                    await summary.click();
                    await page
                        .locator(
                            `[data-toolbar-item="${item}"] details[open], details[data-toolbar-item="${item}"][open]`,
                        )
                        .waitFor();
                    menuFirstOpen[item] = await page.evaluate(
                        () => globalThis.menuMeasurement,
                    );
                    await page.keyboard.press('Escape');
                }
                interactions = {
                    menuFirstOpen,
                    inputToFrame,
                    pasteToFrame,
                    tableToFrame,
                    pasteMethod:
                        'synthetic globalThis.ClipboardEvent with text and image HTML',
                };
            }
            await page.evaluate(() => globalThis.measureCms.destroy());
            const lifecycle = [];
            if (argv.includes('--interactions')) {
                for (let cycle = 0; cycle < 3; ++cycle) {
                    await page.evaluate(
                        ({ size, source }) =>
                            globalThis.measureCms.create(size, source),
                        { size, source },
                    );
                    if (source)
                        await page.evaluate(() =>
                            globalThis.measureCms.source(),
                        );
                    await page.evaluate(() => globalThis.measureCms.destroy());
                    assert.equal(
                        await page
                            .locator('.soeditor-classic, .cm-editor')
                            .count(),
                        0,
                    );
                    await cdp.send('HeapProfiler.collectGarbage');
                    lifecycle.push(await cdp.send('Runtime.getHeapUsage'));
                }
            }
            runs.push({
                size,
                source,
                create,
                initialRequests,
                sourceFirst,
                sourceAgain,
                formatting,
                destroy,
                warmCreate,
                interactions,
                lifecycle,
                heapBefore,
                heapAfter,
            });
            await writeFile(
                `${output}.partial.json`,
                JSON.stringify(runs, null, 2) + '\n',
            );
            await context.close();
        }
    }
    let recovery;
    if (argv.includes('--recovery')) {
        const context = await browser.newContext();
        const page = await context.newPage();
        const sourceChunk = graph.find((chunk) =>
            chunk.modules.some((id) =>
                id.endsWith('packages/source/dist/index.js'),
            ),
        );
        assert.ok(sourceChunk, 'The built Source chunk must be identifiable.');
        await page.route(`**/${sourceChunk.file}`, (route) =>
            route.abort('failed'),
        );
        const attempts = [];
        await page.route('**/*soeditor-retry=*', (route) => {
            attempts.push(route.request().url());
            return attempts.length === 1
                ? route.abort('failed')
                : route.continue();
        });
        await page.route('http://127.0.0.1:4188/', async (route) => {
            const response = await route.fetch();
            await route.fulfill({
                response,
                headers: {
                    ...response.headers(),
                    'Content-Security-Policy':
                        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:",
                },
            });
        });
        await page.goto('http://127.0.0.1:4188');
        await page.waitForFunction(() => globalThis.measureCms !== undefined);
        await page.evaluate(() => globalThis.measureCms.create(10_240, true));
        for (let attempt = 0; attempt < 2; ++attempt) {
            await assert.rejects(
                page.evaluate(() => globalThis.measureCms.source()),
            );
        }
        await page.evaluate(() => globalThis.measureCms.source());
        await page.locator('.cm-content').waitFor({ state: 'visible' });
        assert.equal(attempts.length, 2);
        assert.notEqual(attempts[0], attempts[1]);
        await page.evaluate(() => globalThis.measureCms.destroy());
        recovery = {
            passed: true,
            scriptPolicy: "script-src 'self'",
            attempts,
        };
        await context.close();
    }
    const artifacts = [];
    for (const path of [
        'packages/soeditor/dist/soeditor.global.js',
        'packages/soeditor/dist/soeditor.css',
        'packages/soeditor/dist/cms.js',
    ]) {
        const data = await readFile(resolve(root, path));
        artifacts.push({ path, raw: data.length, gzip: gzipSync(data).length });
    }
    const chunks = [];
    for (const chunk of graph) {
        const data = await readFile(resolve(fixture, 'dist', chunk.file));
        chunks.push({
            ...chunk,
            raw: data.length,
            gzip: gzipSync(data).length,
        });
    }
    const verification = verifyCmsLoading({ artifacts, assets, chunks, runs });
    await mkdir(resolve(output, '..'), { recursive: true });
    await writeFile(
        output,
        JSON.stringify(
            {
                timestamp: new Date().toISOString(),
                commit: execFileSync('git', ['rev-parse', 'HEAD'], {
                    cwd: root,
                    encoding: 'utf8',
                }).trim(),
                node: version,
                dirty: execFileSync('git', ['status', '--short'], {
                    cwd: root,
                    encoding: 'utf8',
                }),
                budgets: cmsLoadingBudgets,
                verification,
                artifacts,
                assets,
                recovery,
                chunks,
                runs,
            },
            null,
            2,
        ) + '\n',
    );
    stdout.write(`CMS loading measurements written to ${output}\n`);
} finally {
    await browser.close();
    await new Promise((done) => server.httpServer.close(done));
}
