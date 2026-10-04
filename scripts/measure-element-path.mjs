import { chromium } from '@playwright/test';
import { build, preview } from 'vite';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { argv, stdout } from 'node:process';
/* global window, document, performance, requestAnimationFrame, InputEvent, Event */

// Compare the exact pre-change archived packages with current compiled packages.
const root = resolve(import.meta.dirname, '..');
const archive = argv[2];
assert.ok(archive, 'Pass the pre-change editor source archive.');
const sandbox = await mkdtemp(resolve(tmpdir(), 'soeditor-element-path-'));
execFileSync('tar', ['-xzf', resolve(archive), '-C', sandbox]);
const results = { baselineArchive: resolve(archive), sizes: [], sandbox };
const percentile = (values, fraction) =>
    [...values].sort((a, b) => a - b)[
        Math.floor((values.length - 1) * fraction)
    ];

for (const [name, packagesRoot] of [
    ['before', sandbox],
    ['after', root],
]) {
    const entry = resolve(sandbox, `${name}.html`);
    await writeFile(
        entry,
        `<textarea></textarea><script type="module" src="./${name}.js"></script>`,
    );
    await writeFile(
        resolve(sandbox, `${name}.js`),
        `
import { createClassicEditor } from ${JSON.stringify(resolve(packagesRoot, 'packages/soeditor/dist/cms-optional.js'))};
import ${JSON.stringify(resolve(packagesRoot, 'packages/soeditor/dist/cms-styles.css'))};
window.createBench = createClassicEditor;
`,
    );
    await build({
        configFile: false,
        root: sandbox,
        logLevel: 'error',
        plugins: [
            {
                name: 'archived-editor-packages',
                async resolveId(id, importer) {
                    const match = /^@soeditor\/([^/]+)(.*)$/u.exec(id);
                    if (!match) {
                        if (
                            importer?.startsWith(sandbox) &&
                            !id.startsWith('.') &&
                            !id.startsWith('/')
                        )
                            return this.resolve(
                                id,
                                importer.replace(sandbox, root),
                                { skipSelf: true },
                            );
                        return;
                    }
                    const directory = resolve(
                        packagesRoot,
                        'packages',
                        match[1] === 'editor' ? 'soeditor' : match[1],
                    );
                    const manifest = JSON.parse(
                        await readFile(
                            resolve(directory, 'package.json'),
                            'utf8',
                        ),
                    );
                    const entry =
                        manifest.exports[match[2] ? `.${match[2]}` : '.'];
                    return resolve(
                        directory,
                        typeof entry === 'string' ? entry : entry.import,
                    );
                },
            },
        ],
        build: {
            outDir: resolve(sandbox, `output-${name}`),
            rollupOptions: { input: entry },
        },
    });
    const server = await preview({
        configFile: false,
        root: sandbox,
        build: { outDir: resolve(sandbox, `output-${name}`) },
        preview: { host: '127.0.0.1', port: 0 },
    });
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        for (const size of [10_240, 102_400, 512_000]) {
            await page.goto(`${server.resolvedUrls.local[0]}${name}.html`);
            const metric = await page.evaluate(async (size) => {
                const block =
                    '<section><h2>Article</h2><p>Text <strong>bold</strong> <a href="/page">link</a>.</p><ul><li>One</li><li>Two</li></ul><!--keep--></section>';
                const html = block.repeat(Math.ceil(size / block.length));
                const starts = [],
                    inputs = [],
                    paths = [],
                    selections = [],
                    unwrapping = [];
                const frame = () =>
                    new Promise((resolve) => requestAnimationFrame(resolve));
                for (let trial = 0; trial < 7; trial++) {
                    let start = performance.now();
                    const instance = await window.createBench(
                        document.querySelector('textarea'),
                        { data: html, editingModes: ['wysiwyg'] },
                    );
                    starts.push(performance.now() - start);
                    const surface = document
                        .querySelector('.soeditor-classic__visual')
                        .shadowRoot.querySelector('.soeditor-wysiwyg-content');
                    const paragraph = surface.querySelector('p');
                    surface.focus();
                    const range = document.createRange();
                    range.selectNodeContents(paragraph);
                    range.collapse(false);
                    document.getSelection().removeAllRanges();
                    document.getSelection().addRange(range);
                    document.dispatchEvent(new Event('selectionchange'));
                    await frame();
                    const visual = instance.editor.services.tryGet({
                        id: 'soeditor.visual-editing',
                    });
                    for (let index = 0; index < 100; index++) {
                        start = performance.now();
                        visual.getElementPath?.();
                        paths.push(performance.now() - start);
                    }
                    for (let index = 0; index < 30; index++) {
                        start = performance.now();
                        paragraph.firstChild.data += 'x';
                        surface.dispatchEvent(
                            new InputEvent('input', {
                                inputType: 'insertText',
                                data: 'x',
                                bubbles: true,
                            }),
                        );
                        inputs.push(performance.now() - start);
                    }
                    if (visual.getElementPath) {
                        // Finish input layout before measuring the separate selection action.
                        await frame();
                        await frame();
                        const item = visual
                            .getElementPath()
                            .find((item) => item.tagName === 'section');
                        start = performance.now();
                        instance.editor.execute('element.select', item.id);
                        selections.push(performance.now() - start);
                        const p = visual
                            .getElementPath()
                            .find((item) => item.tagName === 'p');
                        instance.editor.execute('element.select', p.id);
                        start = performance.now();
                        instance.editor.execute('element.unwrap');
                        unwrapping.push(performance.now() - start);
                    }
                    await instance.destroy();
                    await frame();
                    if (
                        document.querySelector(
                            '.soeditor-element-selection,.soeditor-empty-element',
                        )
                    )
                        throw new Error('Leaked affordance');
                }
                const sourceTransitions = [];
                for (let trial = 0; trial < 7; trial++) {
                    const instance = await window.createBench(
                        document.querySelector('textarea'),
                        { data: html, editingModes: ['wysiwyg', 'source'] },
                    );
                    const start = performance.now();
                    await instance.setWorkspaceView('source');
                    sourceTransitions.push(performance.now() - start);
                    await instance.destroy();
                    await frame();
                }
                return {
                    size,
                    starts,
                    inputs,
                    paths,
                    selections,
                    unwrapping,
                    sourceTransitions,
                };
            }, size);
            const record = {
                name,
                size,
                startupMedian: percentile(metric.starts, 0.5),
                inputMedian: percentile(metric.inputs, 0.5),
                pathP95: percentile(metric.paths, 0.95),
                selectionP95: percentile(metric.selections, 0.95),
                unwrapP95: percentile(metric.unwrapping, 0.95),
                sourceMedian: percentile(metric.sourceTransitions, 0.5),
            };
            results.sizes.push(record);
            stdout.write(`${JSON.stringify(record)}\n`);
        }
    } finally {
        await browser.close();
        await new Promise((resolve) => server.httpServer.close(resolve));
    }
}
await writeFile(
    argv[3] ?? '/tmp/soeditor-element-path-performance.json',
    JSON.stringify(results, null, 2),
);
for (const after of results.sizes.filter((item) => item.name === 'after')) {
    assert.ok(after.pathP95 <= 5, 'Element path exceeded 5 ms');
    assert.ok(after.selectionP95 <= 50, 'Element selection exceeded 50 ms');
    const before = results.sizes.find(
        (item) => item.name === 'before' && item.size === after.size,
    );
    assert.ok(
        after.startupMedian <= before.startupMedian * 1.1,
        `Startup regressed at ${after.size}`,
    );
    assert.ok(
        after.inputMedian <= before.inputMedian * 1.1,
        `Input regressed at ${after.size}`,
    );
    assert.ok(
        after.sourceMedian <= before.sourceMedian * 1.1,
        `Source transition regressed at ${after.size}`,
    );
}
