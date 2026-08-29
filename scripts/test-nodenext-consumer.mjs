import { execFileSync } from 'node:child_process';
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
import { join, resolve } from 'node:path';
import { stdout } from 'node:process';
import { fileURLToPath, URL } from 'node:url';

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const fixtureSource = join(repositoryRoot, 'tests/consumers/nodenext');
const temporaryRoot = await mkdtemp(join(tmpdir(), 'soeditor-nodenext-'));
const packDirectory = join(temporaryRoot, 'package');
const fixtureDirectory = join(temporaryRoot, 'consumer');

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
    const htmlArchive = archives.find((name) =>
        name.startsWith('soeditor-html-'),
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

    if (archives.length !== 9 || coreArchive === undefined) {
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

    const packagePath = join(fixtureDirectory, 'package.json');
    const packageData = JSON.parse(await readFile(packagePath, 'utf8'));
    packageData.dependencies['@soeditor/core'] = `file:${join(
        packDirectory,
        coreArchive,
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

    run('pnpm', ['install', '--ignore-workspace'], fixtureDirectory);
    run('pnpm', ['exec', 'tsc', '-p', 'tsconfig.json'], fixtureDirectory);
    stdout.write('NodeNext packed-package consumer passed.\n');
    run('node', ['runtime.mjs'], fixtureDirectory);
    stdout.write('Node ESM packed-package runtime smoke test passed.\n');
} finally {
    await rm(temporaryRoot, { force: true, recursive: true });
}
