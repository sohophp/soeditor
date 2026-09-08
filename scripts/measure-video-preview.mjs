import { performance } from 'node:perf_hooks';
import { argv, stdout } from 'node:process';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build, preview } from 'vite';
import { chromium } from '@playwright/test';

const root = resolve(import.meta.dirname, '..');
const fixture = resolve(root, 'node_modules/.cache/video-preview-measurement');
await mkdir(fixture, { recursive: true });
await writeFile(
    resolve(fixture, 'index.html'),
    '<!doctype html><html><body><textarea></textarea><script type="module" src="/main.js"></script></body></html>',
);
await writeFile(
    resolve(fixture, 'main.js'),
    `
import {createClassicEditor} from ${JSON.stringify(resolve(root, 'packages/soeditor/dist/cms-optional.js'))};
import {createCmsVideoPlugin} from ${JSON.stringify(resolve(root, 'packages/soeditor/dist/video.js'))};
import {cmsPreset} from ${JSON.stringify(resolve(root, 'packages/presets/dist/cms.js'))};
import ${JSON.stringify(resolve(root, 'packages/soeditor/dist/cms-styles.css'))};
globalThis.previewFixture = await createClassicEditor(document.querySelector('textarea'), {
 preset:cmsPreset, plugins:[...cmsPreset.plugins, createCmsVideoPlugin()], editingModes:['wysiwyg'],
 toolbar:['cmsVideo','popupPreview'], preview:true,
 data:Array.from({length:100}, (_,index)=>'<p>Article '+index+'</p><iframe width="560" height="315" title="Movie '+index+'" src="https://www.youtube.com/embed/abcdefghijk"></iframe><div style="height:600px"></div>').join(''),
});
document.body.dataset.ready='true';
`,
);
await build({
    configFile: false,
    root: fixture,
    logLevel: 'error',
    build: { outDir: 'dist', minify: true },
});
const server = await preview({
    configFile: false,
    root: fixture,
    preview: { host: '127.0.0.1', port: 4197, strictPort: true },
});
const browser = await chromium.launch();
try {
    const context = await browser.newContext({
        viewport: { width: 1024, height: 768 },
    });
    let requests = 0;
    await context.route('https://www.youtube-nocookie.com/**', (route) => {
        ++requests;
        return route.fulfill({
            contentType: 'text/html',
            body: '<button>Play video</button>',
        });
    });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4197');
    await page.locator('body[data-ready=true]').waitFor();
    assert.equal(requests, 0);
    const pending = context.waitForEvent('page');
    const start = performance.now();
    await page.locator('[data-toolbar-item=popupPreview]').click();
    const popup = await pending;
    const article = popup.locator('body > iframe');
    const first = popup
        .locator('[data-preview-player]')
        .first()
        .locator('iframe');
    await first
        .contentFrame()
        .getByRole('button', { name: 'Play video' })
        .waitFor();
    const openMs = performance.now() - start;
    const initialRequests = requests;
    const original = await first.elementHandle();
    assert.equal(initialRequests, 1);
    const samples = [];
    for (let index = 0; index < 12; index++) {
        const started = performance.now();
        await page.evaluate((index) => {
            const editor = globalThis.previewFixture;
            editor.setData(
                editor
                    .getData()
                    .replace(
                        /<p>(?:Article 0|Edited \d+)<\/p>/,
                        '<p>Edited ' + index + '</p>',
                    ),
            );
        }, index);
        await article
            .contentFrame()
            .getByText(`Edited ${index}`, { exact: true })
            .waitFor();
        samples.push(performance.now() - started);
    }
    assert.equal(await original.evaluate((node) => node.isConnected), true);
    assert.equal(requests, 1);
    const scrollStart = performance.now();
    await article.evaluate((frame) =>
        frame.contentWindow.scrollTo(
            0,
            frame.contentDocument.documentElement.scrollHeight,
        ),
    );
    const last = popup
        .locator('[data-preview-player]')
        .last()
        .locator('iframe');
    await last
        .contentFrame()
        .getByRole('button', { name: 'Play video' })
        .waitFor();
    const scrollMs = performance.now() - scrollStart;
    assert.equal(requests, 2);
    const sorted = [...samples].sort((a, b) => a - b);
    const result = {
        checkedAt: new Date().toISOString(),
        videos: 100,
        initialRequests,
        requestsAfterTwelveTextEdits: 1,
        requestsAfterScrollToEnd: requests,
        retainedFirstPlayer: true,
        openMs,
        scrollMs,
        textRefresh: {
            samplesMs: samples,
            p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
        },
        scope: 'Production-built optional CMS fixture; deterministic YouTube response, no live playback claim.',
    };
    await writeFile(
        resolve(argv[2] ?? '/tmp/video-preview-measurement.json'),
        JSON.stringify(result, null, 4) + '\n',
    );
    stdout.write(JSON.stringify(result) + '\n');
    await popup.close();
} finally {
    await browser.close();
    await new Promise((resolve) => server.httpServer.close(resolve));
}
