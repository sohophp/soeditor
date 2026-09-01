import { execFileSync } from 'node:child_process';
import { Buffer } from 'node:buffer';
import { createServer } from 'node:http';
import {
    cp,
    mkdir,
    mkdtemp,
    readFile,
    readdir,
    rm,
    writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { stdout } from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { gzipSync } from 'node:zlib';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from '@playwright/test';

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const workspaceManifest = JSON.parse(
    await readFile(join(repositoryRoot, 'package.json'), 'utf8'),
);
const releaseVersion = workspaceManifest.version;
const releaseLicense = workspaceManifest.license;
const releaseLicenseText = await readFile(
    join(repositoryRoot, 'LICENSE'),
    'utf8',
);
const fixtureSource = join(repositoryRoot, 'tests/consumers/nodenext');
const viteFixtureSource = join(repositoryRoot, 'tests/consumers/vite');
const narrowViteFixtureSource = join(
    repositoryRoot,
    'tests/consumers/vite-narrow',
);
const widgetFixtureSource = join(repositoryRoot, 'tests/consumers/widget');
const temporaryRoot = await mkdtemp(join(tmpdir(), 'soeditor-nodenext-'));
const packDirectory = join(temporaryRoot, 'package');
const fixtureDirectory = join(temporaryRoot, 'consumer');
const viteFixtureDirectory = join(temporaryRoot, 'vite-consumer');
const narrowViteFixtureDirectory = join(temporaryRoot, 'vite-narrow-consumer');
const widgetFixtureDirectory = join(temporaryRoot, 'widget-consumer');

function run(command, args, cwd) {
    execFileSync(command, args, {
        cwd,
        encoding: 'utf8',
        stdio: 'inherit',
    });
}

try {
    await cp(fixtureSource, fixtureDirectory, { recursive: true });
    await mkdir(packDirectory, { recursive: true });
    run(
        'pnpm',
        [
            '--filter',
            '@soeditor/editor',
            'pack',
            '--pack-destination',
            packDirectory,
        ],
        repositoryRoot,
    );
    run(
        'pnpm',
        [
            '--filter',
            '@soeditor/plugin-sdk',
            'pack',
            '--pack-destination',
            packDirectory,
        ],
        repositoryRoot,
    );
    run(
        'pnpm',
        [
            '--filter',
            '@soeditor/presets',
            'pack',
            '--pack-destination',
            packDirectory,
        ],
        repositoryRoot,
    );
    run(
        'pnpm',
        [
            '--filter',
            '@soeditor/adapter-sofinder',
            'pack',
            '--pack-destination',
            packDirectory,
        ],
        repositoryRoot,
    );
    run(
        'pnpm',
        [
            '--filter',
            '@soeditor/file-manager',
            'pack',
            '--pack-destination',
            packDirectory,
        ],
        repositoryRoot,
    );
    run(
        'pnpm',
        [
            '--filter',
            '@soeditor/dev-tools',
            'pack',
            '--pack-destination',
            packDirectory,
        ],
        repositoryRoot,
    );
    run(
        'pnpm',
        [
            '--filter',
            '@soeditor/comments',
            'pack',
            '--pack-destination',
            packDirectory,
        ],
        repositoryRoot,
    );
    run(
        'pnpm',
        [
            '--filter',
            '@soeditor/revisions',
            'pack',
            '--pack-destination',
            packDirectory,
        ],
        repositoryRoot,
    );
    run(
        'pnpm',
        [
            '--filter',
            '@soeditor/core',
            'pack',
            '--pack-destination',
            packDirectory,
        ],
        repositoryRoot,
    );
    run(
        'pnpm',
        [
            '--filter',
            '@soeditor/html-tools',
            'pack',
            '--pack-destination',
            packDirectory,
        ],
        repositoryRoot,
    );
    run(
        'pnpm',
        [
            '--filter',
            '@soeditor/layout',
            'pack',
            '--pack-destination',
            packDirectory,
        ],
        repositoryRoot,
    );
    run(
        'pnpm',
        [
            '--filter',
            '@soeditor/ui',
            'pack',
            '--pack-destination',
            packDirectory,
        ],
        repositoryRoot,
    );
    run(
        'pnpm',
        [
            '--filter',
            '@soeditor/projections',
            'pack',
            '--pack-destination',
            packDirectory,
        ],
        repositoryRoot,
    );
    run(
        'pnpm',
        [
            '--filter',
            '@soeditor/preview',
            'pack',
            '--pack-destination',
            packDirectory,
        ],
        repositoryRoot,
    );
    run(
        'pnpm',
        [
            '--filter',
            '@soeditor/markdown',
            'pack',
            '--pack-destination',
            packDirectory,
        ],
        repositoryRoot,
    );
    run(
        'pnpm',
        [
            '--filter',
            '@soeditor/source',
            'pack',
            '--pack-destination',
            packDirectory,
        ],
        repositoryRoot,
    );
    run(
        'pnpm',
        [
            '--filter',
            '@soeditor/rich-text',
            'pack',
            '--pack-destination',
            packDirectory,
        ],
        repositoryRoot,
    );
    run(
        'pnpm',
        [
            '--filter',
            '@soeditor/wysiwyg',
            'pack',
            '--pack-destination',
            packDirectory,
        ],
        repositoryRoot,
    );
    run(
        'pnpm',
        [
            '--filter',
            '@soeditor/engine',
            'pack',
            '--pack-destination',
            packDirectory,
        ],
        repositoryRoot,
    );
    run(
        'pnpm',
        [
            '--filter',
            '@soeditor/html',
            'pack',
            '--pack-destination',
            packDirectory,
        ],
        repositoryRoot,
    );
    for (const packageName of [
        '@soeditor/workspace',
        '@soeditor/react',
        '@soeditor/vue',
        '@soeditor/plugin-tools',
    ]) {
        run(
            'pnpm',
            [
                '--filter',
                packageName,
                'pack',
                '--pack-destination',
                packDirectory,
            ],
            repositoryRoot,
        );
    }

    const archives = (await readdir(packDirectory)).filter((name) =>
        name.endsWith('.tgz'),
    );

    const coreArchive = archives.find((name) =>
        name.startsWith('soeditor-core-'),
    );
    const commentsArchive = archives.find((name) =>
        name.startsWith('soeditor-comments-'),
    );
    const revisionsArchive = archives.find((name) =>
        name.startsWith('soeditor-revisions-'),
    );
    const soeditorArchive = archives.find((name) =>
        name.startsWith('soeditor-editor-'),
    );
    const pluginSdkArchive = archives.find((name) =>
        name.startsWith('soeditor-plugin-sdk-'),
    );
    const presetsArchive = archives.find((name) =>
        name.startsWith('soeditor-presets-'),
    );
    const adapterSoFinderArchive = archives.find((name) =>
        name.startsWith('soeditor-adapter-sofinder-'),
    );
    const devToolsArchive = archives.find((name) =>
        name.startsWith('soeditor-dev-tools-'),
    );
    const htmlArchive = archives.find((name) =>
        name.startsWith('soeditor-html-'),
    );
    const fileManagerArchive = archives.find((name) =>
        name.startsWith('soeditor-file-manager-'),
    );
    const engineArchive = archives.find((name) =>
        name.startsWith('soeditor-engine-'),
    );
    const richTextArchive = archives.find((name) =>
        name.startsWith('soeditor-rich-text-'),
    );
    const wysiwygArchive = archives.find((name) =>
        name.startsWith('soeditor-wysiwyg-'),
    );
    const sourceArchive = archives.find((name) =>
        name.startsWith('soeditor-source-'),
    );
    const htmlToolsArchive = archives.find((name) =>
        name.startsWith('soeditor-html-tools-'),
    );
    const layoutArchive = archives.find((name) =>
        name.startsWith('soeditor-layout-'),
    );
    const uiArchive = archives.find((name) => name.startsWith('soeditor-ui-'));
    const previewArchive = archives.find((name) =>
        name.startsWith('soeditor-preview-'),
    );
    const projectionsArchive = archives.find((name) =>
        name.startsWith('soeditor-projections-'),
    );
    const markdownArchive = archives.find((name) =>
        name.startsWith('soeditor-markdown-'),
    );
    const workspaceArchive = archives.find((name) =>
        name.startsWith('soeditor-workspace-'),
    );
    const reactArchive = archives.find((name) =>
        name.startsWith('soeditor-react-'),
    );
    const vueArchive = archives.find((name) =>
        name.startsWith('soeditor-vue-'),
    );
    const pluginToolsArchive = archives.find((name) =>
        name.startsWith('soeditor-plugin-tools-'),
    );

    if (
        archives.length !== 24 ||
        coreArchive === undefined ||
        commentsArchive === undefined ||
        revisionsArchive === undefined ||
        workspaceArchive === undefined ||
        reactArchive === undefined ||
        vueArchive === undefined ||
        pluginToolsArchive === undefined
    ) {
        throw new Error('Expected all 24 packed @soeditor archives.');
    }

    if (htmlArchive === undefined) {
        throw new Error('Expected one packed @soeditor/html archive.');
    }

    if (engineArchive === undefined) {
        throw new Error('Expected one packed @soeditor/engine archive.');
    }

    if (richTextArchive === undefined) {
        throw new Error('Expected one packed @soeditor/rich-text archive.');
    }

    if (wysiwygArchive === undefined) {
        throw new Error('Expected one packed @soeditor/wysiwyg archive.');
    }

    if (sourceArchive === undefined) {
        throw new Error('Expected one packed @soeditor/source archive.');
    }

    if (htmlToolsArchive === undefined) {
        throw new Error('Expected one packed @soeditor/html-tools archive.');
    }

    if (layoutArchive === undefined) {
        throw new Error('Expected one packed @soeditor/layout archive.');
    }

    if (uiArchive === undefined) {
        throw new Error('Expected one packed @soeditor/ui archive.');
    }

    if (previewArchive === undefined) {
        throw new Error('Expected one packed @soeditor/preview archive.');
    }

    if (projectionsArchive === undefined) {
        throw new Error('Expected one packed @soeditor/projections archive.');
    }

    if (markdownArchive === undefined) {
        throw new Error('Expected one packed @soeditor/markdown archive.');
    }

    if (devToolsArchive === undefined) {
        throw new Error('Expected one packed @soeditor/dev-tools archive.');
    }

    if (fileManagerArchive === undefined) {
        throw new Error('Expected one packed @soeditor/file-manager archive.');
    }

    if (adapterSoFinderArchive === undefined) {
        throw new Error(
            'Expected one packed @soeditor/adapter-sofinder archive.',
        );
    }

    if (pluginSdkArchive === undefined) {
        throw new Error('Expected one packed @soeditor/plugin-sdk archive.');
    }

    if (presetsArchive === undefined) {
        throw new Error('Expected one packed @soeditor/presets archive.');
    }

    if (soeditorArchive === undefined) {
        throw new Error('Expected one packed @soeditor/editor archive.');
    }

    const packagePath = join(fixtureDirectory, 'package.json');
    const packageData = JSON.parse(await readFile(packagePath, 'utf8'));
    packageData.dependencies['@soeditor/editor'] = `file:${join(
        packDirectory,
        soeditorArchive,
    )}`;
    packageData.dependencies['@soeditor/adapter-sofinder'] = `file:${join(
        packDirectory,
        adapterSoFinderArchive,
    )}`;
    packageData.dependencies['@soeditor/plugin-sdk'] = `file:${join(
        packDirectory,
        pluginSdkArchive,
    )}`;
    packageData.dependencies['@soeditor/presets'] = `file:${join(
        packDirectory,
        presetsArchive,
    )}`;
    packageData.dependencies['@soeditor/core'] = `file:${join(
        packDirectory,
        coreArchive,
    )}`;
    packageData.dependencies['@soeditor/comments'] = `file:${join(
        packDirectory,
        commentsArchive,
    )}`;
    packageData.dependencies['@soeditor/revisions'] = `file:${join(
        packDirectory,
        revisionsArchive,
    )}`;
    packageData.dependencies['@soeditor/dev-tools'] = `file:${join(
        packDirectory,
        devToolsArchive,
    )}`;
    packageData.dependencies['@soeditor/file-manager'] = `file:${join(
        packDirectory,
        fileManagerArchive,
    )}`;
    packageData.dependencies['@soeditor/html'] = `file:${join(
        packDirectory,
        htmlArchive,
    )}`;
    packageData.dependencies['@soeditor/engine'] = `file:${join(
        packDirectory,
        engineArchive,
    )}`;
    packageData.dependencies['@soeditor/rich-text'] = `file:${join(
        packDirectory,
        richTextArchive,
    )}`;
    packageData.dependencies['@soeditor/wysiwyg'] = `file:${join(
        packDirectory,
        wysiwygArchive,
    )}`;
    packageData.dependencies['@soeditor/source'] = `file:${join(
        packDirectory,
        sourceArchive,
    )}`;
    packageData.dependencies['@soeditor/html-tools'] = `file:${join(
        packDirectory,
        htmlToolsArchive,
    )}`;
    packageData.dependencies['@soeditor/layout'] = `file:${join(
        packDirectory,
        layoutArchive,
    )}`;
    packageData.dependencies['@soeditor/ui'] = `file:${join(
        packDirectory,
        uiArchive,
    )}`;
    packageData.dependencies['@soeditor/preview'] = `file:${join(
        packDirectory,
        previewArchive,
    )}`;
    packageData.dependencies['@soeditor/projections'] = `file:${join(
        packDirectory,
        projectionsArchive,
    )}`;
    packageData.dependencies['@soeditor/markdown'] = `file:${join(
        packDirectory,
        markdownArchive,
    )}`;
    packageData.dependencies['@soeditor/workspace'] = `file:${join(
        packDirectory,
        workspaceArchive,
    )}`;
    packageData.dependencies['@soeditor/react'] = `file:${join(
        packDirectory,
        reactArchive,
    )}`;
    packageData.dependencies['@soeditor/vue'] = `file:${join(
        packDirectory,
        vueArchive,
    )}`;
    packageData.dependencies['@soeditor/plugin-tools'] = `file:${join(
        packDirectory,
        pluginToolsArchive,
    )}`;
    await writeFile(packagePath, `${JSON.stringify(packageData, null, 4)}\n`);
    await writeOverrides(fixtureDirectory, packageData.dependencies);

    run('pnpm', ['install'], fixtureDirectory);
    await verifyInstalledManifests(
        fixtureDirectory,
        Object.keys(packageData.dependencies).filter((name) =>
            name.startsWith('@soeditor/'),
        ),
    );
    run('pnpm', ['exec', 'tsc', '-p', 'tsconfig.json'], fixtureDirectory);
    stdout.write('NodeNext packed-package consumer passed.\n');
    run('node', ['runtime.mjs'], fixtureDirectory);
    stdout.write('Node ESM packed-package runtime smoke test passed.\n');

    await cp(viteFixtureSource, viteFixtureDirectory, { recursive: true });
    const vitePackagePath = join(viteFixtureDirectory, 'package.json');
    const vitePackageData = JSON.parse(await readFile(vitePackagePath, 'utf8'));
    vitePackageData.dependencies = { ...packageData.dependencies };
    await writeFile(
        vitePackagePath,
        `${JSON.stringify(vitePackageData, null, 4)}\n`,
    );
    await writeOverrides(viteFixtureDirectory, vitePackageData.dependencies);
    run('pnpm', ['install'], viteFixtureDirectory);
    run('pnpm', ['build'], viteFixtureDirectory);
    const viteAssets = await readdir(join(viteFixtureDirectory, 'dist/assets'));
    const viteJavaScript = viteAssets.find((name) => name.endsWith('.js'));
    if (
        viteJavaScript === undefined ||
        !viteAssets.some((name) => name.endsWith('.js.map')) ||
        !viteAssets.some((name) => name.endsWith('.css'))
    ) {
        throw new Error(
            'Vite packed-package consumer did not emit JS, CSS, and source maps.',
        );
    }
    const viteManifest = JSON.parse(
        await readFile(
            join(viteFixtureDirectory, 'dist/.vite/manifest.json'),
            'utf8',
        ),
    );
    const viteEntry = viteManifest['index.html'];
    if (viteEntry === undefined || viteEntry.isEntry !== true) {
        throw new Error('CMS Vite consumer has no manifest entry.');
    }
    const startupKeys = collectStaticManifestEntries(viteManifest, [
        'index.html',
        ...(viteEntry.dynamicImports ?? []),
    ]);
    const startupSources = await Promise.all(
        [...startupKeys]
            .map((key) => viteManifest[key]?.file)
            .filter((file) => typeof file === 'string' && file.endsWith('.js'))
            .map((file) =>
                readFile(join(viteFixtureDirectory, 'dist', file), 'utf8'),
            ),
    );
    const viteJavaScriptSize = startupSources.reduce(
        (total, source) => total + Buffer.byteLength(source),
        0,
    );
    const viteJavaScriptGzip = gzipSync(startupSources.join('\n')).length;
    if (viteJavaScriptSize > 500_000 || viteJavaScriptGzip > 150_000) {
        throw new Error(
            `CMS Vite startup exceeds its 500/150 kB guard (${String(viteJavaScriptSize)} raw / ${String(viteJavaScriptGzip)} gzip).`,
        );
    }
    for (const excludedMarker of [
        'Developer Visual',
        'Markdown scroll area',
        'SoEditor content preview',
        'commentsServiceToken',
        'revisionsServiceToken',
        'video.insert',
    ]) {
        if (startupSources.some((source) => source.includes(excludedMarker))) {
            throw new Error(
                `CMS Vite startup retained excluded marker "${excludedMarker}".`,
            );
        }
    }
    stdout.write(
        `CMS Vite packed-package build passed (${String(viteJavaScriptSize)} raw / ${String(viteJavaScriptGzip)} gzip).\n`,
    );

    await cp(widgetFixtureSource, widgetFixtureDirectory, { recursive: true });
    const widgetPackagePath = join(widgetFixtureDirectory, 'package.json');
    const widgetPackageData = JSON.parse(
        await readFile(widgetPackagePath, 'utf8'),
    );
    widgetPackageData.dependencies = { ...packageData.dependencies };
    await writeFile(
        widgetPackagePath,
        `${JSON.stringify(widgetPackageData, null, 4)}\n`,
    );
    await writeOverrides(
        widgetFixtureDirectory,
        widgetPackageData.dependencies,
    );
    run('pnpm', ['install'], widgetFixtureDirectory);
    run('pnpm', ['build'], widgetFixtureDirectory);
    await verifyPackedWidget(widgetFixtureDirectory);
    stdout.write(
        'Packed third-party widget TypeScript, Vite, Chromium, accessibility, security, and teardown consumer passed.\n',
    );

    await cp(narrowViteFixtureSource, narrowViteFixtureDirectory, {
        recursive: true,
    });
    const narrowPackagePath = join(narrowViteFixtureDirectory, 'package.json');
    const narrowPackageData = JSON.parse(
        await readFile(narrowPackagePath, 'utf8'),
    );
    narrowPackageData.dependencies = { ...packageData.dependencies };
    await writeFile(
        narrowPackagePath,
        `${JSON.stringify(narrowPackageData, null, 4)}\n`,
    );
    await writeOverrides(
        narrowViteFixtureDirectory,
        narrowPackageData.dependencies,
    );
    run('pnpm', ['install'], narrowViteFixtureDirectory);
    run('pnpm', ['build'], narrowViteFixtureDirectory);
    const narrowAssetsRoot = join(narrowViteFixtureDirectory, 'dist/assets');
    const narrowAssets = await readdir(narrowAssetsRoot);
    const narrowJavaScript = narrowAssets.filter((name) =>
        name.endsWith('.js'),
    );
    if (narrowJavaScript.length === 0) {
        throw new Error('Narrow Vite consumer did not emit JavaScript.');
    }
    const narrowSources = await Promise.all(
        narrowJavaScript.map((name) =>
            readFile(join(narrowAssetsRoot, name), 'utf8'),
        ),
    );
    const narrowManifest = JSON.parse(
        await readFile(
            join(narrowViteFixtureDirectory, 'dist/.vite/manifest.json'),
            'utf8',
        ),
    );
    const narrowStartupKeys = collectStaticManifestEntries(narrowManifest, [
        'index.html',
    ]);
    const narrowStartupFiles = new Set(
        [...narrowStartupKeys]
            .map((key) => narrowManifest[key]?.file)
            .filter((file) =>
                typeof file === 'string' ? file.endsWith('.js') : false,
            ),
    );
    const narrowStartupSources = await Promise.all(
        [...narrowStartupFiles].map((file) =>
            readFile(join(narrowViteFixtureDirectory, 'dist', file), 'utf8'),
        ),
    );
    const narrowSize = narrowStartupSources.reduce(
        (total, source) => total + Buffer.byteLength(source),
        0,
    );
    if (narrowSize > 85_000) {
        throw new Error(
            `Narrow Vite consumer exceeds its 85 kB guard (${String(narrowSize)} bytes).`,
        );
    }
    const narrowTotalSize = narrowSources.reduce(
        (total, source) => total + Buffer.byteLength(source),
        0,
    );
    const lazySizes = narrowJavaScript
        .map((name, index) => ({
            name,
            size: Buffer.byteLength(narrowSources[index] ?? ''),
        }))
        .filter(({ name }) => !narrowStartupFiles.has(`assets/${name}`));
    if (
        narrowTotalSize > 90_000 ||
        lazySizes.some(({ size }) => size > 8_000)
    ) {
        throw new Error(
            `Narrow Vite output exceeds its 90 kB total or 8 kB lazy-chunk guard (${String(narrowTotalSize)} bytes total).`,
        );
    }
    for (const excludedMarker of [
        'HTML source scroll area',
        'Markdown scroll area',
        'Editor split view',
        'SoEditor content preview',
    ]) {
        if (narrowSources.some((source) => source.includes(excludedMarker))) {
            throw new Error(
                `Narrow Vite consumer retained unused feature marker "${excludedMarker}".`,
            );
        }
    }
    if (narrowAssets.some((name) => name.endsWith('.css'))) {
        throw new Error(
            'Narrow Vite consumer emitted CSS without an explicit style import.',
        );
    }
    stdout.write(
        `Narrow Vite tree-shaking audit passed (${String(narrowSize)} bytes).\n`,
    );
} finally {
    await rm(temporaryRoot, { force: true, recursive: true });
}

function collectStaticManifestEntries(manifest, roots) {
    const collected = new Set();
    const pending = [...roots];
    while (pending.length > 0) {
        const key = pending.pop();
        if (typeof key !== 'string' || collected.has(key)) continue;
        const entry = manifest[key];
        if (entry === undefined) continue;
        collected.add(key);
        pending.push(...(entry.imports ?? []));
    }
    return collected;
}

async function verifyPackedWidget(directory) {
    const distributionRoot = resolve(directory, 'dist');
    const server = createServer(async (request, response) => {
        try {
            const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
            const relativePath =
                requestUrl.pathname === '/'
                    ? 'index.html'
                    : decodeURIComponent(requestUrl.pathname.slice(1));
            const filePath = resolve(distributionRoot, relativePath);
            if (
                filePath !== distributionRoot &&
                !filePath.startsWith(`${distributionRoot}${sep}`)
            ) {
                response.writeHead(403).end();
                return;
            }
            const content = await readFile(filePath);
            response.writeHead(200, {
                'content-type': contentType(extname(filePath)),
            });
            response.end(content);
        } catch (error) {
            response.writeHead(error?.code === 'ENOENT' ? 404 : 500).end();
        }
    });
    await new Promise((resolvePromise, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolvePromise);
    });
    const address = server.address();
    if (typeof address !== 'object' || address === null) {
        server.close();
        throw new Error('Packed widget server did not expose a TCP address.');
    }

    const browser = await chromium.launch({ headless: true });
    try {
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto(`http://127.0.0.1:${String(address.port)}/`);
        await page.locator('body[data-ready="true"]').waitFor();
        const boundary = page.locator(
            '[data-soeditor-structured-block="consumer.product-card"]',
        );
        if ((await boundary.count()) !== 1) {
            throw new Error('Packed widget node view did not mount.');
        }
        await boundary.getByRole('button', { name: 'Rename product' }).click();
        await page.waitForFunction(() =>
            globalThis.document.body.dataset.source?.includes(
                'data-title="Renamed"',
            ),
        );
        const result = await page.evaluate(() => ({
            executed: Reflect.get(globalThis, '__packedWidgetExecuted'),
            source: globalThis.document.body.dataset.source,
        }));
        if (
            result.executed !== undefined ||
            !result.source?.includes('<script>') ||
            !result.source.includes('data-id="123"')
        ) {
            throw new Error(
                'Packed widget failed source preservation or execution isolation.',
            );
        }
        const accessibility = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
            .analyze();
        if (accessibility.violations.length > 0) {
            throw new Error(
                `Packed widget has accessibility violations: ${accessibility.violations
                    .map(({ id }) => id)
                    .join(', ')}.`,
            );
        }
        const remaining = await page.evaluate(async () => {
            const harness = Reflect.get(globalThis, '__packedWidget');
            return Reflect.apply(Reflect.get(harness, 'destroy'), harness, []);
        });
        if (remaining !== 0) {
            throw new Error('Packed widget visual teardown left DOM residue.');
        }
    } finally {
        await browser.close();
        await new Promise((resolvePromise, reject) => {
            server.close((error) =>
                error === undefined ? resolvePromise() : reject(error),
            );
        });
    }
}

function contentType(extension) {
    switch (extension) {
        case '.css':
            return 'text/css; charset=utf-8';
        case '.html':
            return 'text/html; charset=utf-8';
        case '.js':
            return 'text/javascript; charset=utf-8';
        case '.map':
        case '.json':
            return 'application/json; charset=utf-8';
        default:
            return 'application/octet-stream';
    }
}

async function writeOverrides(directory, dependencies) {
    const entries = Object.entries(dependencies).filter(([name]) =>
        name.startsWith('@soeditor/'),
    );
    const yaml = [
        'overrides:',
        ...entries.map(
            ([name, value]) =>
                `  ${JSON.stringify(name)}: ${JSON.stringify(value)}`,
        ),
        '',
        'allowBuilds:',
        '  esbuild: true',
        '',
    ].join('\n');
    await writeFile(join(directory, 'pnpm-workspace.yaml'), yaml);
}

async function verifyInstalledManifests(directory, packageNames) {
    for (const packageName of packageNames) {
        const manifest = JSON.parse(
            await readFile(
                join(directory, 'node_modules', packageName, 'package.json'),
                'utf8',
            ),
        );
        const expectedDirectory =
            packageName === '@soeditor/editor'
                ? 'packages/soeditor'
                : `packages/${packageName.slice('@soeditor/'.length)}`;
        if (
            manifest.version !== releaseVersion ||
            manifest.license !== releaseLicense ||
            manifest.repository?.url !==
                'git+https://github.com/sohophp/soeditor.git' ||
            manifest.repository?.directory !== expectedDirectory ||
            manifest.homepage !==
                'https://github.com/sohophp/soeditor#readme' ||
            manifest.bugs?.url !==
                'https://github.com/sohophp/soeditor/issues' ||
            manifest.engines?.node !== '>=22.14.0 <23' ||
            manifest.publishConfig?.access !== 'public' ||
            manifest.publishConfig?.provenance !== true ||
            manifest.publishConfig?.registry !==
                'https://registry.npmjs.org/' ||
            JSON.stringify(manifest).includes('workspace:')
        ) {
            throw new Error(
                `Packed manifest for ${packageName} is not publication-safe.`,
            );
        }
        const packedLicenseText = await readFile(
            join(directory, 'node_modules', packageName, 'LICENSE'),
            'utf8',
        );
        if (packedLicenseText !== releaseLicenseText) {
            throw new Error(
                `Packed license for ${packageName} does not match the repository license.`,
            );
        }
        for (const target of exportTargets(manifest.exports)) {
            if (
                !target.startsWith('./dist/') ||
                target.includes('/internal/') ||
                target.includes('/src/')
            ) {
                throw new Error(
                    `Packed manifest for ${packageName} exposes ${target}.`,
                );
            }
        }
    }
    stdout.write('Packed publication metadata audit passed.\n');
}

function exportTargets(value) {
    if (typeof value === 'string') return [value];
    if (typeof value !== 'object' || value === null) return [];
    return Object.values(value).flatMap(exportTargets);
}
