import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
    checkPluginPackage,
    pluginTemplateVersion,
    scaffoldPluginPackage,
} from '../src/index.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
    await Promise.all(
        temporaryDirectories
            .splice(0)
            .map((path) => rm(path, { force: true, recursive: true })),
    );
});

describe('plugin package tooling', () => {
    it('creates a strict versioned SDK-root template without overwriting', async () => {
        const parent = await temporaryDirectory();
        const target = resolve(parent, 'plugin');
        await scaffoldPluginPackage({
            directory: target,
            packageName: '@example/soeditor-product-card',
            pluginId: 'example.product-card',
        });

        expect(pluginTemplateVersion).toBe(3);
        expect(
            await readFile(resolve(target, 'src/plugin.ts'), 'utf8'),
        ).toContain("from '@soeditor/plugin-sdk'");
        expect((await checkPluginPackage(target)).valid).toBe(true);
        await expect(
            scaffoldPluginPackage({
                directory: target,
                packageName: '@example/duplicate',
                pluginId: 'duplicate',
            }),
        ).rejects.toMatchObject({ code: 'EEXIST' });
        await expect(
            scaffoldPluginPackage({
                directory: resolve(parent, 'invalid'),
                packageName: '@example/invalid',
                pluginId: 'Invalid ID',
            }),
        ).rejects.toThrow('Invalid plugin ID');
    });

    it('creates deterministic focused CMS contribution families', async () => {
        const parent = await temporaryDirectory();
        for (const kind of [
            'cms-widget',
            'paste',
            'upload',
            'theme',
        ] as const) {
            const target = resolve(parent, kind);
            await scaffoldPluginPackage({
                directory: target,
                kind,
                packageName: `@example/${kind}`,
                pluginId: `example.${kind}`,
            });
            const source = await readFile(
                resolve(target, 'src/plugin.ts'),
                'utf8',
            );
            expect(source).toContain("from '@soeditor/plugin-sdk'");
            expect((await checkPluginPackage(target)).valid).toBe(true);
        }
    });

    it('reports remote execution and unsafe DOM output', async () => {
        const root = await temporaryDirectory();
        await mkdir(resolve(root, 'src'));
        await writeFile(
            resolve(root, 'package.json'),
            JSON.stringify({
                name: 'unsafe',
                version: '1.0.0',
                type: 'module',
                sideEffects: false,
                exports: {
                    '.': {
                        import: './dist/index.js',
                        types: './dist/index.d.ts',
                    },
                },
                peerDependencies: { '@soeditor/plugin-sdk': '^1.0.0' },
            }),
        );
        await writeFile(
            resolve(root, 'src/index.ts'),
            "import { Plugin } from '@soeditor/plugin-sdk';\nimport('https://example.test/plugin.js');\nexport { Unsafe };\nclass Unsafe extends Plugin { static readonly id = 'unsafe'; init() { document.body.innerHTML = '<b>x</b>'; eval('1'); } }\n",
        );
        const report = await checkPluginPackage(root);
        expect(report.issues.map(({ code }) => code)).toEqual(
            expect.arrayContaining([
                'REMOTE_IMPORT',
                'DYNAMIC_CODE',
                'UNSAFE_DOM_OUTPUT',
            ]),
        );
    });

    it('reports manifest, duplicate-ID, internal-import, and export defects', async () => {
        const root = await temporaryDirectory();
        await mkdir(resolve(root, 'src'));
        await writeFile(
            resolve(root, 'package.json'),
            JSON.stringify({
                name: 'broken',
                version: 'nope',
                type: 'commonjs',
            }),
        );
        await writeFile(
            resolve(root, 'src/index.ts'),
            "import '@soeditor/core/internal';\nexport * from './two.js';\nstatic readonly id = 'same';\nstatic readonly id = 'Invalid ID';\n",
        );
        await writeFile(
            resolve(root, 'src/two.ts'),
            "export class Two { static readonly id = 'same'; }\n",
        );

        const report = await checkPluginPackage(root);
        expect(report.valid).toBe(false);
        expect(report.issues.map(({ code }) => code)).toEqual(
            expect.arrayContaining([
                'MANIFEST_VERSION',
                'ESM_REQUIRED',
                'TREE_SHAKING',
                'EXPORT_MAP',
                'SDK_PEER_RANGE',
                'SDK_CONTRIBUTION_MISSING',
                'PLUGIN_ID_DUPLICATE',
                'PLUGIN_ID_FORMAT',
                'INTERNAL_IMPORT',
                'ROOT_EXPORT_MISSING',
            ]),
        );
    });

    it('checks packed files without running package lifecycle scripts', async () => {
        const parent = await temporaryDirectory();
        const root = resolve(parent, 'plugin');
        await scaffoldPluginPackage({
            directory: root,
            packageName: '@example/packed-plugin',
            pluginId: 'example.packed',
        });
        await mkdir(resolve(root, 'dist'));
        await writeFile(resolve(root, 'dist/index.js'), 'export {};\n');
        await writeFile(resolve(root, 'dist/index.d.ts'), 'export {};\n');
        const manifest: unknown = JSON.parse(
            await readFile(resolve(root, 'package.json'), 'utf8'),
        );
        if (typeof manifest !== 'object' || manifest === null) {
            throw new Error('Generated manifest is not an object.');
        }
        Reflect.set(manifest, 'scripts', { prepack: 'exit 99' });
        await writeFile(
            resolve(root, 'package.json'),
            `${JSON.stringify(manifest, undefined, 4)}\n`,
        );

        const report = await checkPluginPackage(root, { packed: true });
        expect(report.valid).toBe(true);
    });
});

async function temporaryDirectory(): Promise<string> {
    const path = await mkdtemp(resolve(tmpdir(), 'soeditor-plugin-tools-'));
    temporaryDirectories.push(path);
    return path;
}
