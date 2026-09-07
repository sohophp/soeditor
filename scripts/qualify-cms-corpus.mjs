import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { argv } from 'node:process';
import { URL } from 'node:url';
import { preview } from 'vite';
import { chromium } from '@playwright/test';
import { parseHtmlFragment } from '../packages/html/dist/index.js';

assert.ok(
    argv[2] && argv[3] && argv[4],
    'Usage: fixture-dist output.json file.html [...]',
);
const fixture = resolve(argv[2]);
const server = await preview({
    configFile: false,
    root: fixture,
    logLevel: 'error',
    build: { outDir: fixture },
    preview: { host: '127.0.0.1', port: 4193, strictPort: true },
});
const browser = await chromium.launch();
const results = [];
try {
    for (const file of argv.slice(4)) {
        const html = await readFile(resolve(file), 'utf8');
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.route('**/*', (route) =>
            new URL(route.request().url()).origin === 'http://127.0.0.1:4193'
                ? route.continue()
                : route.abort(),
        );
        try {
            await page.goto('http://127.0.0.1:4193');
            await page.waitForFunction(() => globalThis.measureCms);
            await page.evaluate(() =>
                globalThis.measureCms.create(10240, true),
            );
            await page.evaluate(
                (html) => globalThis.measureCms.editor.setData(html),
                html,
            );
            const before = await page.evaluate(() =>
                globalThis.measureCms.editor.getData(),
            );
            await page.evaluate(async () => {
                await globalThis.measureCms.source();
                await globalThis.measureCms.visual();
            });
            assert.equal(
                await page.evaluate(() =>
                    globalThis.measureCms.editor.getData(),
                ),
                before,
                'Unedited Source round trip changed data',
            );
            const paragraph = page
                .locator('.soeditor-wysiwyg-content p')
                .filter({ hasText: /\S/u })
                .first();
            assert.equal(
                await paragraph.count(),
                1,
                'Provide a body fragment with a nonempty editable paragraph',
            );
            await paragraph.click();
            await page.keyboard.press('End');
            await page.keyboard.press('ArrowLeft');
            let marker = 'CMS验收';
            while (before.includes(marker)) marker += 'X';
            await page.keyboard.insertText(marker);
            const saved = await page.evaluate(() =>
                globalThis.measureCms.editor.getData(),
            );
            assert.ok(saved.includes(marker));
            assert.deepEqual(
                semanticHtml(saved.replace(marker, '')),
                semanticHtml(before),
                'Editing changed unrelated HTML semantics',
            );
            await page.evaluate(async () => {
                const editor = globalThis.measureCms.editor;
                for (const view of [
                    'source',
                    'wysiwyg-source-horizontal',
                    'wysiwyg-source-vertical',
                    'wysiwyg',
                ])
                    await editor.setWorkspaceView(view);
            });
            assert.equal(
                await page.evaluate(() =>
                    globalThis.measureCms.editor.getData(),
                ),
                saved,
            );
            await page.evaluate(() => globalThis.measureCms.destroy());
            await page.evaluate(() =>
                globalThis.measureCms.create(10240, true),
            );
            await page.evaluate(
                (saved) => globalThis.measureCms.editor.setData(saved),
                saved,
            );
            assert.equal(
                await page.evaluate(() =>
                    globalThis.measureCms.editor.getData(),
                ),
                saved,
            );
            assert.deepEqual(errors, []);
            await page.evaluate(() => globalThis.measureCms.destroy());
            results.push({
                file: resolve(file),
                sha256: createHash('sha256').update(html).digest('hex'),
                savedSha256: createHash('sha256').update(saved).digest('hex'),
                passed: true,
            });
        } catch (error) {
            results.push({
                file: resolve(file),
                passed: false,
                error: String(error),
                errors,
            });
        } finally {
            await page.close();
        }
    }
    await writeFile(
        argv[3],
        `${JSON.stringify({ measuredAt: new Date().toISOString(), chromium: browser.version(), results, note: 'File-based automated round trip only. Paths and hashes identify samples; origin, anonymization, actual Office clipboard and manual qualification must be recorded separately. External network requests are blocked; no input file is modified.' }, null, 2)}\n`,
    );
    assert.ok(
        results.every((result) => result.passed),
        'One or more corpus files failed; inspect output',
    );
} finally {
    await browser.close();
    await new Promise((done) => server.httpServer.close(done));
}

function semanticHtml(source) {
    const visit = (node) => {
        if (node.type === 'text' || node.type === 'comment')
            return { type: node.type, value: node.value };
        if (node.type === 'element')
            return {
                type: node.type,
                tagName: node.tagName,
                namespace: node.namespace,
                attributes: node.attributes
                    .map(({ name, value, namespace, prefix }) => ({
                        name,
                        value,
                        namespace,
                        prefix,
                    }))
                    .sort((a, b) =>
                        JSON.stringify(a).localeCompare(JSON.stringify(b)),
                    ),
                children: node.children.map(visit),
            };
        return { type: node.type, children: node.children.map(visit) };
    };
    return visit(parseHtmlFragment(source).document);
}
