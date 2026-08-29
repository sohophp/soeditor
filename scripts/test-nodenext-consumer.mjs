import { execFileSync } from 'node:child_process';
import {
    cp,
    mkdir,
    mkdtemp,
    readFile,
    readdir,
    rm,
    stat,
    writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { stdout } from 'node:process';
import { fileURLToPath, URL } from 'node:url';

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
const temporaryRoot = await mkdtemp(join(tmpdir(), 'soeditor-nodenext-'));
const packDirectory = join(temporaryRoot, 'package');
const fixtureDirectory = join(temporaryRoot, 'consumer');
const viteFixtureDirectory = join(temporaryRoot, 'vite-consumer');

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
        ['--filter', 'soeditor', 'pack', '--pack-destination', packDirectory],
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

    const archives = (await readdir(packDirectory)).filter((name) =>
        name.endsWith('.tgz'),
    );

    const coreArchive = archives.find((name) =>
        name.startsWith('soeditor-core-'),
    );
    const soeditorArchive = archives.find((name) => /^soeditor-\d/u.test(name));
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
    const sourceArchive = archives.find((name) =>
        name.startsWith('soeditor-source-'),
    );
    const htmlToolsArchive = archives.find((name) =>
        name.startsWith('soeditor-html-tools-'),
    );
    const uiArchive = archives.find((name) => name.startsWith('soeditor-ui-'));
    const previewArchive = archives.find((name) =>
        name.startsWith('soeditor-preview-'),
    );
    const markdownArchive = archives.find((name) =>
        name.startsWith('soeditor-markdown-'),
    );

    if (archives.length !== 15 || coreArchive === undefined) {
        throw new Error('Expected one packed @soeditor/core archive.');
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

    if (sourceArchive === undefined) {
        throw new Error('Expected one packed @soeditor/source archive.');
    }

    if (htmlToolsArchive === undefined) {
        throw new Error('Expected one packed @soeditor/html-tools archive.');
    }

    if (uiArchive === undefined) {
        throw new Error('Expected one packed @soeditor/ui archive.');
    }

    if (previewArchive === undefined) {
        throw new Error('Expected one packed @soeditor/preview archive.');
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
        throw new Error('Expected one packed soeditor archive.');
    }

    const packagePath = join(fixtureDirectory, 'package.json');
    const packageData = JSON.parse(await readFile(packagePath, 'utf8'));
    packageData.dependencies.soeditor = `file:${join(
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
    packageData.dependencies['@soeditor/source'] = `file:${join(
        packDirectory,
        sourceArchive,
    )}`;
    packageData.dependencies['@soeditor/html-tools'] = `file:${join(
        packDirectory,
        htmlToolsArchive,
    )}`;
    packageData.dependencies['@soeditor/ui'] = `file:${join(
        packDirectory,
        uiArchive,
    )}`;
    packageData.dependencies['@soeditor/preview'] = `file:${join(
        packDirectory,
        previewArchive,
    )}`;
    packageData.dependencies['@soeditor/markdown'] = `file:${join(
        packDirectory,
        markdownArchive,
    )}`;
    await writeFile(packagePath, `${JSON.stringify(packageData, null, 4)}\n`);
    await writeOverrides(fixtureDirectory, packageData.dependencies);

    run('pnpm', ['install'], fixtureDirectory);
    await verifyInstalledManifests(
        fixtureDirectory,
        Object.keys(packageData.dependencies).filter(
            (name) => name === 'soeditor' || name.startsWith('@soeditor/'),
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
    const viteJavaScriptSize = (
        await stat(join(viteFixtureDirectory, 'dist/assets', viteJavaScript))
    ).size;
    if (viteJavaScriptSize > 100_000) {
        throw new Error(
            `Minimal Vite consumer exceeds its 100 kB tree-shaking guard (${String(viteJavaScriptSize)} bytes).`,
        );
    }
    stdout.write('Vite packed-package production build passed.\n');
} finally {
    await rm(temporaryRoot, { force: true, recursive: true });
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
            packageName === 'soeditor'
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
