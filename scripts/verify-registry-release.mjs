import { execFileSync } from 'node:child_process';
import {
    mkdir,
    mkdtemp,
    readFile,
    readdir,
    rm,
    writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { argv, stdout } from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { URL } from 'node:url';
import { chromium } from '@playwright/test';

const workspaceManifest = JSON.parse(
    await readFile(new URL('../package.json', import.meta.url), 'utf8'),
);
const version = argv[2] ?? workspaceManifest.version;
if (!/^0\.6\.\d+$/u.test(version)) {
    throw new TypeError('Registry verification requires a 0.6.x version.');
}

const temporaryRoot = await mkdtemp(join(tmpdir(), 'soeditor-registry-'));
const consumerRoot = join(temporaryRoot, 'consumer');

try {
    await mkdir(join(consumerRoot, 'src'), { recursive: true });
    await writeFile(
        join(consumerRoot, 'package.json'),
        `${JSON.stringify(
            {
                name: 'soeditor-registry-consumer',
                packageManager: 'pnpm@11.20.0',
                private: true,
                type: 'module',
                scripts: { build: 'vite build' },
                dependencies: { '@soeditor/editor': version },
                devDependencies: { vite: '7.3.6' },
            },
            null,
            4,
        )}\n`,
    );
    await writeFile(
        join(consumerRoot, 'pnpm-workspace.yaml'),
        'allowBuilds:\n  esbuild: true\n',
    );
    await writeFile(
        join(consumerRoot, 'index.html'),
        '<!doctype html><html><body><script type="module" src="/src/main.js"></script></body></html>\n',
    );
    await writeFile(
        join(consumerRoot, 'src/main.js'),
        [
            "import { SoEditor, minimalPreset } from '@soeditor/editor';",
            "import '@soeditor/editor/styles.css';",
            "const editor = await SoEditor.create({ data: '<p>Registry</p>', format: minimalPreset.format, plugins: minimalPreset.plugins });",
            'document.body.dataset.source = editor.getData();',
            'await editor.destroy();',
            '',
        ].join('\n'),
    );
    await fetchWithRetry(
        'https://registry.npmjs.org/%40soeditor%2Feditor',
        {
            headers: {
                Accept: 'application/vnd.npm.install-v1+json',
            },
        },
        36,
    );
    run(
        'pnpm',
        ['install', '--registry=https://registry.npmjs.org'],
        consumerRoot,
    );
    run('pnpm', ['build'], consumerRoot);

    await verifyPublishedPackages(version, workspaceManifest.license);

    const cdnBase = `https://cdn.jsdelivr.net/npm/@soeditor/editor@${version}/dist`;
    const [globalResponse, cssResponse, mapResponse] = await Promise.all([
        fetchWithRetry(`${cdnBase}/soeditor.global.js`),
        fetchWithRetry(`${cdnBase}/soeditor.css`),
        fetchWithRetry(`${cdnBase}/soeditor.global.js.map`),
    ]);
    const [globalSource, cssSource, mapSource] = await Promise.all([
        globalResponse.text(),
        cssResponse.text(),
        mapResponse.text(),
    ]);
    if (
        globalSource.length < 100_000 ||
        !globalSource.includes('sourceMappingURL=soeditor.global.js.map') ||
        !cssSource.includes('--soeditor-bg') ||
        !mapSource.includes('"sources"')
    ) {
        throw new Error('Published CDN artifacts are incomplete.');
    }

    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        await page.addScriptTag({ url: `${cdnBase}/soeditor.global.js` });
        const result = await page.evaluate(async () => {
            const api = Reflect.get(globalThis, 'SoEditor');
            const editor = await api.create({ data: '<p>CDN registry</p>' });
            const data = editor.getData();
            await editor.destroy();
            return { data, frozen: Object.isFrozen(api) };
        });
        if (result.data !== '<p>CDN registry</p>' || !result.frozen) {
            throw new Error('Published CDN global failed its lifecycle smoke.');
        }
    } finally {
        await browser.close();
    }

    stdout.write(
        `Registry and CDN verification passed for @soeditor/editor@${version}.\n`,
    );
} finally {
    await rm(temporaryRoot, { force: true, recursive: true });
}

function run(command, args, cwd) {
    execFileSync(command, args, { cwd, stdio: 'inherit' });
}

async function verifyPublishedPackages(releaseVersion, releaseLicense) {
    const packagesRoot = new URL('../packages/', import.meta.url);
    const expectedPackages = [];
    for (const directory of await readdir(packagesRoot)) {
        const manifest = JSON.parse(
            await readFile(
                new URL(`${directory}/package.json`, packagesRoot),
                'utf8',
            ),
        );
        if (manifest.private !== true) {
            expectedPackages.push({ directory, name: manifest.name });
        }
    }
    if (expectedPackages.length !== 17) {
        throw new Error('Registry verification expected 17 public packages.');
    }

    await Promise.all(
        expectedPackages.map(async ({ directory, name }) => {
            const endpoint = `https://registry.npmjs.org/${encodeURIComponent(name)}/${releaseVersion}`;
            const response = await fetchWithRetry(endpoint);
            const manifest = await response.json();
            if (
                manifest.name !== name ||
                manifest.version !== releaseVersion ||
                manifest.license !== releaseLicense ||
                manifest.repository?.url !==
                    'git+https://github.com/sohophp/soeditor.git' ||
                manifest.repository?.directory !== `packages/${directory}`
            ) {
                throw new Error(
                    `Published metadata is incorrect for ${name}@${releaseVersion}.`,
                );
            }
        }),
    );
}

async function fetchWithRetry(url, init = {}, attempts = 12) {
    let latestFailure = 'no response';
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
            const response = await globalThis.fetch(url, {
                ...init,
                signal: globalThis.AbortSignal.timeout(15_000),
            });
            if (response.ok) return response;
            latestFailure = `HTTP ${String(response.status)}`;
        } catch (error) {
            latestFailure = error instanceof Error ? error.message : 'unknown';
        }
        if (attempt < attempts - 1) {
            await delay(10_000);
        }
    }
    throw new Error(
        `Published resource ${url} remained unavailable (${latestFailure}).`,
    );
}
