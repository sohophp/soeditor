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
import { join, resolve } from 'node:path';
import { execPath, stdout } from 'node:process';
import { fileURLToPath, URL } from 'node:url';

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const pluginCli = join(
    repositoryRoot,
    'packages',
    'plugin-tools',
    'dist',
    'cli.js',
);
const temporaryRoot = await mkdtemp(
    join(tmpdir(), 'soeditor-plugin-consumer-'),
);
const pluginRoot = join(temporaryRoot, 'plugin');
const packRoot = join(temporaryRoot, 'pack');
const consumerRoot = join(temporaryRoot, 'consumer');

function run(command, args, cwd) {
    execFileSync(command, args, { cwd, encoding: 'utf8', stdio: 'inherit' });
}

try {
    run(
        execPath,
        [
            pluginCli,
            'create',
            pluginRoot,
            '--name',
            '@example/generated',
            '--id',
            'example.generated',
        ],
        repositoryRoot,
    );
    const pluginManifest = JSON.parse(
        await readFile(join(pluginRoot, 'package.json'), 'utf8'),
    );
    pluginManifest.devDependencies = {
        '@soeditor/comments': `file:${join(repositoryRoot, 'packages/comments')}`,
        '@soeditor/core': `file:${join(repositoryRoot, 'packages/core')}`,
        '@soeditor/engine': `file:${join(repositoryRoot, 'packages/engine')}`,
        '@soeditor/file-manager': `file:${join(repositoryRoot, 'packages/file-manager')}`,
        '@soeditor/html-tools': `file:${join(repositoryRoot, 'packages/html-tools')}`,
        '@soeditor/html': `file:${join(repositoryRoot, 'packages/html')}`,
        '@soeditor/layout': `file:${join(repositoryRoot, 'packages/layout')}`,
        '@soeditor/plugin-sdk': `file:${join(repositoryRoot, 'packages/plugin-sdk')}`,
        '@soeditor/plugin-tools': `file:${join(repositoryRoot, 'packages/plugin-tools')}`,
        '@soeditor/projections': `file:${join(repositoryRoot, 'packages/projections')}`,
        '@soeditor/revisions': `file:${join(repositoryRoot, 'packages/revisions')}`,
        '@soeditor/rich-text': `file:${join(repositoryRoot, 'packages/rich-text')}`,
        '@soeditor/ui': `file:${join(repositoryRoot, 'packages/ui')}`,
        typescript: '5.9.2',
        vite: '7.3.6',
    };
    await writeFile(
        join(pluginRoot, 'package.json'),
        `${JSON.stringify(pluginManifest, null, 4)}\n`,
    );
    run('pnpm', ['install'], pluginRoot);
    run('pnpm', ['build'], pluginRoot);
    run(execPath, [pluginCli, 'check', pluginRoot, '--packed'], repositoryRoot);
    await mkdir(packRoot);
    run('pnpm', ['pack', '--pack-destination', packRoot], pluginRoot);
    const archive = (await readdir(packRoot)).find((name) =>
        name.endsWith('.tgz'),
    );
    if (archive === undefined)
        throw new Error('Generated plugin archive is missing.');

    await mkdir(consumerRoot);
    const dependencies = {
        '@example/generated': `file:${join(packRoot, archive)}`,
    };
    for (const directory of await readdir(join(repositoryRoot, 'packages'))) {
        try {
            const manifest = JSON.parse(
                await readFile(
                    join(repositoryRoot, 'packages', directory, 'package.json'),
                    'utf8',
                ),
            );
            if (
                manifest.private !== true &&
                typeof manifest.name === 'string'
            ) {
                dependencies[manifest.name] =
                    `file:${join(repositoryRoot, 'packages', directory)}`;
            }
        } catch (error) {
            if (error?.code !== 'ENOENT') throw error;
        }
    }
    await writeFile(
        join(consumerRoot, 'package.json'),
        `${JSON.stringify(
            {
                name: 'soeditor-generated-plugin-consumer',
                private: true,
                type: 'module',
                packageManager: 'pnpm@11.20.0',
                dependencies,
                devDependencies: { typescript: '5.9.2' },
            },
            null,
            4,
        )}\n`,
    );
    await writeFile(
        join(consumerRoot, 'tsconfig.json'),
        `${JSON.stringify(
            {
                compilerOptions: {
                    module: 'NodeNext',
                    moduleResolution: 'NodeNext',
                    noEmit: true,
                    strict: true,
                    target: 'ES2022',
                },
                include: ['consumer.ts'],
            },
            null,
            4,
        )}\n`,
    );
    await writeFile(
        join(consumerRoot, 'consumer.ts'),
        "import { Editor } from '@soeditor/core';\nimport { GeneratedPlugin } from '@example/generated';\n\nconst editor = await Editor.create({ plugins: [GeneratedPlugin] });\nif (GeneratedPlugin.id !== 'example.generated') throw new Error('Unexpected plugin ID.');\nawait editor.destroy();\n",
    );
    await writeFile(
        join(consumerRoot, 'pnpm-workspace.yaml'),
        [
            'overrides:',
            ...Object.entries(dependencies)
                .filter(([name]) => name.startsWith('@soeditor/'))
                .map(
                    ([name, value]) =>
                        `  ${JSON.stringify(name)}: ${JSON.stringify(value)}`,
                ),
            '',
            'allowBuilds:',
            '    esbuild: true',
            '',
        ].join('\n'),
    );
    run('pnpm', ['install'], consumerRoot);
    run('pnpm', ['exec', 'tsc', '-p', 'tsconfig.json'], consumerRoot);
    run(
        'node',
        [
            '--input-type=module',
            '--eval',
            "import { Editor } from '@soeditor/core'; import { GeneratedPlugin } from '@example/generated'; const editor = await Editor.create({ plugins: [GeneratedPlugin] }); await editor.destroy();",
        ],
        consumerRoot,
    );
    stdout.write(
        'Generated plugin scaffold, check, pack, NodeNext consumer, and runtime passed.\n',
    );
} finally {
    await rm(temporaryRoot, { force: true, recursive: true });
}
