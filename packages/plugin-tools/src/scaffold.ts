import { mkdir, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

export interface ScaffoldPluginOptions {
    readonly directory: string;
    readonly kind?: PluginTemplateKind;
    readonly packageName: string;
    readonly pluginId: string;
}

/** Focused offline contribution families supported by template version 3. */
export type PluginTemplateKind =
    'basic' | 'cms-widget' | 'paste' | 'theme' | 'upload';

/** Creates a versioned, strict plugin package without overwriting a directory. */
export async function scaffoldPluginPackage(
    options: ScaffoldPluginOptions,
): Promise<string> {
    const directory = resolve(nonEmpty(options.directory, 'directory'));
    const packageName = packageValue(options.packageName);
    const pluginId = pluginIdValue(options.pluginId);
    const kind = kindValue(options.kind ?? 'basic');
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
        write(directory, 'src/index.ts', indexSource(className, kind)),
        write(
            directory,
            'src/plugin.ts',
            pluginSource(className, pluginId, kind),
        ),
    ]);
    return directory;
}

function indexSource(className: string, kind: PluginTemplateKind): string {
    const extras =
        kind === 'cms-widget'
            ? `, cmsObjectDefinitions`
            : kind === 'theme'
              ? `, editorIcons, editorThemeVariables`
              : '';
    return `export { ${className}${extras} } from './plugin.js';\n`;
}

function pluginSource(
    className: string,
    pluginId: string,
    kind: PluginTemplateKind,
): string {
    const id = escapeSingle(pluginId);
    if (kind === 'cms-widget') {
        return `import { CmsObjectsPlugin, Plugin, UiPlugin, uiRegistryServiceToken, type CmsObjectDefinition } from '@soeditor/plugin-sdk';\n\nexport const cmsObjectDefinitions = Object.freeze([\n    { id: 'product-card', label: 'Product card', properties: ['product-id'] },\n] satisfies readonly CmsObjectDefinition[]);\n\nexport class ${className} extends Plugin {\n    static readonly id = '${id}';\n    static readonly requires = [CmsObjectsPlugin, UiPlugin];\n    #commandRegistered = false;\n    #dispose: (() => void)[] = [];\n\n    override init(): void {\n        this.editor.commands.register({\n            id: '${id}.inspect',\n            canExecute: () => true,\n            execute: () => undefined,\n        });\n        this.#commandRegistered = true;\n        try {\n            this.#dispose.push(\n                this.editor.services.get(uiRegistryServiceToken).registerContextMenuItem('${id}.inspect', {\n                    command: '${id}.inspect',\n                    label: 'Inspect product card',\n                    when: ({ target }) => target.closest('[data-soeditor-object="product-card"]') !== null,\n                }),\n            );\n        } catch (error: unknown) {\n            this.editor.commands.unregister('${id}.inspect');\n            this.#commandRegistered = false;\n            throw error;\n        }\n    }\n\n    override destroy(): void {\n        for (const dispose of this.#dispose.reverse()) dispose();\n        this.#dispose = [];\n        if (this.#commandRegistered) this.editor.commands.unregister('${id}.inspect');\n        this.#commandRegistered = false;\n    }\n}\n`;
    }
    if (kind === 'paste') {
        return `import { PastePipelinePlugin, Plugin, pastePipelineServiceToken } from '@soeditor/plugin-sdk';\n\nexport class ${className} extends Plugin {\n    static readonly id = '${id}';\n    static readonly requires = [PastePipelinePlugin];\n    #dispose: (() => void) | undefined;\n\n    override init(): void {\n        this.#dispose = this.editor.services.get(pastePipelineServiceToken).register({\n            id: '${id}.processor',\n            priority: 10,\n            process: (context) => context.classification === 'web'\n                ? { html: context.html.replaceAll(/<font\\b[^>]*>/giu, '<span>').replaceAll('</font>', '</span>') }\n                : undefined,\n        });\n    }\n\n    override destroy(): void {\n        this.#dispose?.();\n        this.#dispose = undefined;\n    }\n}\n`;
    }
    if (kind === 'upload') {
        return `import { Plugin, uploadServiceToken, type UploadService } from '@soeditor/plugin-sdk';\n\nexport class ${className} extends Plugin {\n    static readonly id = '${id}';\n    #service: UploadService | undefined;\n\n    override init(): void {\n        const service = this.editor.config.get<unknown>('cms.upload.service');\n        if (!isUploadService(service)) throw new TypeError('cms.upload.service must provide create(request).');\n        this.editor.services.register(uploadServiceToken, service);\n        this.#service = service;\n    }\n\n    override destroy(): void {\n        if (this.editor.services.tryGet(uploadServiceToken) === this.#service) {\n            this.editor.services.unregister(uploadServiceToken);\n        }\n        this.#service = undefined;\n    }\n}\n\nfunction isUploadService(value: unknown): value is UploadService {\n    return typeof value === 'object' && value !== null && typeof Reflect.get(value, 'create') === 'function';\n}\n`;
    }
    if (kind === 'theme') {
        return `import { Plugin, type EditorUiIconResource, type EditorUiThemeVariables } from '@soeditor/plugin-sdk';\n\nexport const editorThemeVariables = Object.freeze({\n    accent: '#005ea8',\n    focusRing: '#ffbf47',\n    radius: '0.25rem',\n} satisfies EditorUiThemeVariables);\n\nexport const editorIcons = Object.freeze({\n    'format.bold': 'B',\n    'format.italic': 'I',\n} satisfies EditorUiIconResource);\n\nexport class ${className} extends Plugin {\n    static readonly id = '${id}';\n}\n`;
    }
    return `import { Plugin } from '@soeditor/plugin-sdk';\n\nexport class ${className} extends Plugin {\n    static readonly id = '${id}';\n}\n`;
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

function kindValue(value: string): PluginTemplateKind {
    if (
        value !== 'basic' &&
        value !== 'cms-widget' &&
        value !== 'paste' &&
        value !== 'theme' &&
        value !== 'upload'
    ) {
        throw new TypeError(
            `Invalid plugin template kind "${value}"; use basic, cms-widget, paste, upload, or theme.`,
        );
    }
    return value;
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
