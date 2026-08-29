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
