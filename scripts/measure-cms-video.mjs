import { Buffer } from 'node:buffer';
import { argv, stdout } from 'node:process';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { build, preview } from 'vite';
import { chromium } from '@playwright/test';

const root = resolve(import.meta.dirname, '..');
const fixture = resolve(root, 'node_modules/.cache/cms-video-measurement');
await mkdir(fixture, { recursive: true });
await writeFile(
    resolve(fixture, 'index.html'),
    '<!doctype html><html><head><title>Video loading fixture</title></head><body><textarea></textarea><script type="module" src="./main.js"></script></body></html>',
);
await writeFile(
    resolve(fixture, 'main.js'),
    `
import {createClassicEditor} from ${JSON.stringify(resolve(root, 'packages/soeditor/dist/cms-optional.js'))};
import {cmsPreset} from ${JSON.stringify(resolve(root, 'packages/presets/dist/cms.js'))};
import ${JSON.stringify(resolve(root, 'packages/soeditor/dist/cms-styles.css'))};
const enabled = new URL(location.href).searchParams.has('video');
const plugins = [...cmsPreset.plugins];
if (enabled) plugins.push((await import(${JSON.stringify(resolve(root, 'packages/soeditor/dist/video.js'))})).createCmsVideoPlugin());
const start = globalThis.performance.now();
globalThis.videoEditor = await createClassicEditor(globalThis.document.querySelector('textarea'), {
    preset:cmsPreset, plugins, editingModes:['wysiwyg'],
    toolbar: enabled ? ['bold','cmsVideo'] : ['bold'],
    data:'<p>Article</p><video src="/movie.mp4" controls title="Movie"></video>',
});
globalThis.videoStartup = globalThis.performance.now() - start;
globalThis.document.body.dataset.ready = 'true';
`,
);
const files = [];
await build({
    configFile: false,
    root: fixture,
    logLevel: 'error',
    plugins: [
        {
            name: 'video-loading-evidence',
            generateBundle(_options, bundle) {
                for (const item of Object.values(bundle)) {
                    const data =
                        item.type === 'chunk' ? item.code : item.source;
                    files.push({
                        file: item.fileName,
                        type: item.type,
                        bytes: Buffer.byteLength(data),
                        gzip: gzipSync(data).length,
                        ...(item.type === 'chunk'
                            ? {
                                  modules: Object.keys(item.modules).map((id) =>
                                      id.replace(`${root}/`, ''),
                                  ),
                              }
                            : {}),
                    });
                }
            },
        },
    ],
    build: { outDir: 'dist', sourcemap: true, minify: true },
});
const runtime = files.find(
    (item) =>
        item.type === 'chunk' &&
        item.modules.some((name) =>
            /soeditor\/dist\/video-runtime-[^/]+\.js$/u.test(name),
        ),
);
assert.ok(runtime, 'A separately loaded properties runtime must be emitted.');
const recovery = files.find(
    (item) =>
        item.type === 'asset' &&
        /^assets\/video-runtime-.*\.js$/u.test(item.file),
);
assert.ok(recovery, 'The independent recovery runtime must remain an asset.');
const dialogWindows = files.find(
    (item) =>
        item.type === 'chunk' &&
        item.modules.some((name) =>
            /soeditor\/dist\/classic-dialog-windows-[^/]+\.js$/u.test(name),
        ),
);
assert.ok(
    dialogWindows,
    'Dialog window controls must remain a separate chunk.',
);
const server = await preview({
    configFile: false,
    root: fixture,
    logLevel: 'error',
    preview: { host: '127.0.0.1', port: 4192, strictPort: true },
});
const browser = await chromium.launch();
const report = {
    checkedAt: new Date().toISOString(),
    runtime: { file: runtime.file, bytes: runtime.bytes, gzip: runtime.gzip },
    recovery: {
        file: recovery.file,
        bytes: recovery.bytes,
        gzip: recovery.gzip,
    },
    cases: [],
};
try {
    for (const enabled of [false, true]) {
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.goto(`http://127.0.0.1:4192/${enabled ? '?video=1' : ''}`);
        await page.locator('body[data-ready="true"]').waitFor();
        const requests = await page.evaluate(() =>
            globalThis.performance
                .getEntriesByType('resource')
                .map((entry) => entry.name),
        );
        assert.ok(
            !requests.some(
                (url) =>
                    url.endsWith(runtime.file) ||
                    url.includes(recovery.file) ||
                    url.endsWith(dialogWindows.file),
            ),
            'No player/properties/recovery requests at startup.',
        );
        if (enabled) {
            assert.equal(
                await page.locator('[data-soeditor-video-card]').count(),
                1,
            );
            assert.equal(
                await page.locator('.soeditor-wysiwyg-content video').count(),
                0,
            );
            await page.locator('.soeditor-wysiwyg-content p').click();
            await page.route(`**/${runtime.file}`, (route) => route.abort());
            await page.locator('[data-toolbar-item="cmsVideo"]').click();
            await page.locator('.soeditor-ui__notification').waitFor();
            await page.unroute(`**/${runtime.file}`);
            await page.locator('[data-toolbar-item="cmsVideo"]').click();
            await page
                .getByRole('dialog', { name: 'Insert video', exact: true })
                .waitFor();
            await page
                .getByRole('button', { name: 'Resize dialog', exact: true })
                .waitFor();
            const loaded = await page.evaluate(() =>
                globalThis.performance
                    .getEntriesByType('resource')
                    .map((entry) => entry.name),
            );
            assert.ok(
                loaded.some((url) => url.includes(recovery.file)),
                'Production retry must load the independently emitted runtime.',
            );
            await page
                .getByRole('dialog')
                .getByRole('button', { name: 'Cancel', exact: true })
                .click();
            const interaction = await page.evaluate(async () => {
                const editor = globalThis.videoEditor;
                const data =
                    '<p>Article text.</p><video src="/movie.mp4" controls title="Movie"></video>'.repeat(
                        150,
                    );
                const renderStart = globalThis.performance.now();
                editor.setData(data);
                const renderMilliseconds =
                    globalThis.performance.now() - renderStart;
                await new Promise(globalThis.requestAnimationFrame);
                return {
                    renderMilliseconds,
                    characters: data.length,
                    cards: globalThis.document
                        .querySelector('.soeditor-classic__visual')
                        .shadowRoot.querySelectorAll(
                            '[data-soeditor-video-card]',
                        ).length,
                };
            });
            assert.equal(interaction.cards, 150);
            await page.evaluate(() => {
                const surface = globalThis.document
                    .querySelector('.soeditor-classic__visual')
                    .shadowRoot.querySelector('.soeditor-wysiwyg-content');
                let start = 0;
                globalThis.videoInputFrames = [];
                surface.addEventListener(
                    'beforeinput',
                    () => {
                        start = globalThis.performance.now();
                    },
                    { capture: true },
                );
                surface.addEventListener('input', () => {
                    const began = start;
                    globalThis.requestAnimationFrame(() => {
                        globalThis.videoInputFrames.push(
                            globalThis.performance.now() - began,
                        );
                    });
                });
            });
            await page.locator('.soeditor-wysiwyg-content p').first().click();
            await page.keyboard.type('Typing sample', { delay: 30 });
            const frames = await page.evaluate(async () => {
                await new Promise(globalThis.requestAnimationFrame);
                return globalThis.videoInputFrames;
            });
            assert.equal(frames.length, 13);
            interaction.inputToFrameMilliseconds = {
                samples: frames.length,
                median: frames.toSorted((a, b) => a - b)[
                    Math.floor(frames.length / 2)
                ],
                max: Math.max(...frames),
            };
            report.cases.push({
                enabled,
                startupMilliseconds: await page.evaluate(
                    () => globalThis.videoStartup,
                ),
                requests: requests.length,
                interaction,
                productionRetry: true,
            });
        } else
            report.cases.push({
                enabled,
                startupMilliseconds: await page.evaluate(
                    () => globalThis.videoStartup,
                ),
                requests: requests.length,
            });
        assert.deepEqual(errors, []);
        await page.evaluate(() => globalThis.videoEditor.destroy());
        await page.close();
    }
    const output = resolve(argv[2] ?? '/tmp/soeditor-cms-video.json');
    await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
    stdout.write(
        `Video production loading and recovery checks passed: ${output}\n`,
    );
} finally {
    await browser.close();
    await new Promise((resolveClose, reject) =>
        server.httpServer.close((error) =>
            error ? reject(error) : resolveClose(),
        ),
    );
}
