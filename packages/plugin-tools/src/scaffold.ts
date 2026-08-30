import { mkdir, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

export interface ScaffoldPluginOptions {
    readonly directory: string;
    readonly packageName: string;
    readonly pluginId: string;
}

/** Creates a versioned, strict plugin package without overwriting a directory. */
export async function scaffoldPluginPackage(
    options: ScaffoldPluginOptions,
): Promise<string> {
    const directory = resolve(nonEmpty(options.directory, 'directory'));
    const packageName = packageValue(options.packageName);
    const pluginId = pluginIdValue(options.pluginId);
    await mkdir(directory);
    await mkdir(resolve(directory, 'src'));
    await mkdir(resolve(directory, 'tests'));
    const className = classNameFrom(packageName);
    await Promise.all([
        write(directory, 'package.json', manifest(packageName)),
        write(directory, 'tsconfig.json', tsconfig()),
        write(directory, 'vite.config.ts', viteConfig()),
        write(
            directory,
            'pnpm-workspace.yaml',
            'allowBuilds:\n    esbuild: true\n\nonlyBuiltDependencies:\n    - esbuild\n',
        ),
        write(
            directory,
            'README.md',
            `# ${packageName}\n\nSoEditor plugin package.\n`,
        ),
        write(
            directory,
            'src/index.ts',
            `export { ${className} } from './plugin.js';\n`,
        ),
        write(
            directory,
            'src/plugin.ts',
            `import { Plugin } from '@soeditor/plugin-sdk';\n\nexport class ${className} extends Plugin {\n    static readonly id = '${escapeSingle(pluginId)}';\n}\n`,
        ),
    ]);
    return directory;
}

function manifest(name: string): string {
    return `${JSON.stringify(
        {
            name,
            version: '0.1.0',
            license: 'MIT',
            packageManager: 'pnpm@11.20.0',
            type: 'module',
            sideEffects: false,
            files: ['dist'],
            exports: {
                '.': { types: './dist/index.d.ts', import: './dist/index.js' },
            },
            scripts: {
                build: 'vite build && tsc -p tsconfig.json --emitDeclarationOnly --declaration --outDir dist',
                check: 'soeditor-plugin check . --packed',
            },
            peerDependencies: { '@soeditor/plugin-sdk': '^1.0.0' },
            devDependencies: {
                '@soeditor/comments': '^1.0.0',
                '@soeditor/core': '^1.0.0',
                '@soeditor/engine': '^1.0.0',
                '@soeditor/file-manager': '^1.0.0',
                '@soeditor/html-tools': '^1.0.0',
                '@soeditor/html': '^1.0.0',
                '@soeditor/layout': '^1.0.0',
                '@soeditor/plugin-sdk': '^1.0.0',
                '@soeditor/plugin-tools': '^1.0.0',
                '@soeditor/projections': '^1.0.0',
                '@soeditor/revisions': '^1.0.0',
                '@soeditor/rich-text': '^1.0.0',
                '@soeditor/ui': '^1.0.0',
                typescript: '^5.9.0',
                vite: '^7.0.0',
            },
        },
        undefined,
        4,
    )}\n`;
}

function tsconfig(): string {
    return `${JSON.stringify(
        {
            compilerOptions: {
                declaration: true,
                declarationMap: true,
                emitDeclarationOnly: true,
                exactOptionalPropertyTypes: true,
                module: 'ESNext',
                moduleResolution: 'Bundler',
                outDir: 'dist',
                strict: true,
                target: 'ES2022',
            },
            include: ['src/**/*.ts'],
        },
        undefined,
        4,
    )}\n`;
}

function viteConfig(): string {
    return "import { defineConfig } from 'vite';\n\nexport default defineConfig({\n    build: {\n        lib: { entry: 'src/index.ts', formats: ['es'], fileName: 'index' },\n        rollupOptions: { external: ['@soeditor/plugin-sdk'] },\n        sourcemap: true,\n    },\n});\n";
}

async function write(
    root: string,
    path: string,
    source: string,
): Promise<void> {
    await writeFile(resolve(root, path), source, {
        encoding: 'utf8',
        flag: 'wx',
    });
}

function packageValue(value: string): string {
    const name = nonEmpty(value, 'package name');
    if (!/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u.test(name)) {
        throw new TypeError(`Invalid npm package name "${name}".`);
    }
    return name;
}

function pluginIdValue(value: string): string {
    const id = nonEmpty(value, 'plugin ID');
    if (!/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/u.test(id)) {
        throw new TypeError(
            `Invalid plugin ID "${id}"; use lowercase letters, numbers, dots, underscores, or hyphens.`,
        );
    }
    return id;
}

function classNameFrom(name: string): string {
    const stem = basename(name).replace(
        /[^a-zA-Z0-9]+(.)/gu,
        (_match, next: string) => next.toUpperCase(),
    );
    const normalized = stem.replace(/^[^a-zA-Z]+/u, '');
    return `${normalized.length === 0 ? 'SoEditor' : normalized[0]!.toUpperCase() + normalized.slice(1)}Plugin`;
}

function nonEmpty(value: unknown, label: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new TypeError(`Plugin ${label} must be a non-empty string.`);
    }
    return value.trim();
}

function escapeSingle(value: string): string {
    return value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
}
