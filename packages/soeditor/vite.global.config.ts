import { defineConfig } from 'vite';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { collectPublicPropertyNames } from './vite-public-properties.js';

const classicStylesPath = fileURLToPath(
    new URL('./src/classic-editor.css', import.meta.url),
);
const stylesPath = fileURLToPath(new URL('./src/styles.css', import.meta.url));
const uiStylesPath = fileURLToPath(
    new URL('../ui/src/cms.css', import.meta.url),
);
const inlineUiTranslationLoaderPath = fileURLToPath(
    new URL('./src/ui-translation-loader-inline.ts', import.meta.url),
);
const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const fileManagerSourcePath = fileURLToPath(
    new URL('../file-manager/src/index.ts', import.meta.url),
);
const richTextSourcePath = fileURLToPath(
    new URL('../rich-text/src/index.ts', import.meta.url),
);
const globalRuntimePackages = [
    'core',
    'engine',
    'html',
    'layout',
    'presets',
    'projections',
    'rich-text',
    'soeditor',
    'ui',
    'wysiwyg',
];
const publicPropertyNames = collectPublicPropertyNames(
    repositoryRoot,
    globalRuntimePackages,
    [
        'SoEditor',
        'create',
        'createClassicEditor',
        'attachClassicImageContext',
        'createVideoRuntime',
    ],
);
const stripOptionalGlobalStyles = (code: string): string =>
    code
        .replace(
            /\/\* soeditor-global-legacy-projection:start \*\/[\s\S]*?\/\* soeditor-global-legacy-projection:end \*\//gu,
            '',
        )
        .replace(
            /\/\* soeditor-global-optional-table-context:start \*\/[\s\S]*?\/\* soeditor-global-optional-table-context:end \*\//gu,
            '',
        )
        .replace(
            /\/\* soeditor-global-optional-dialog-windows:start \*\/[\s\S]*?\/\* soeditor-global-optional-dialog-windows:end \*\//u,
            '',
        );
const stripCompatibilityReviewStyles = (code: string): string =>
    code
        .replace(
            /\/\* soeditor-global-compatibility-review:start \*\/[\s\S]*?\/\* soeditor-global-compatibility-review:end \*\//u,
            '',
        )
        .replace(
            /\.soeditor-ui__character-grid\s*\{[\s\S]*?(?=\.soeditor-ui__status-bar\s*\{)/u,
            '',
        )
        .replace(
            /\.soeditor-ui__panel\s*\{[\s\S]*?(?=\.soeditor-ui__notifications\s*\{)/u,
            '',
        );

export default defineConfig({
    resolve: {
        alias: [
            ...['', '/cms', '/translations'].map((entry) => ({
                find: new RegExp(`^@soeditor/ui${entry}$`, 'u'),
                replacement: fileURLToPath(
                    new URL(
                        `../ui/src/${entry === '' ? 'index' : entry.slice(1)}.ts`,
                        import.meta.url,
                    ),
                ),
            })),
            {
                find: /^@soeditor\/file-manager$/u,
                replacement: fileManagerSourcePath,
            },
            {
                find: /^@soeditor\/rich-text$/u,
                replacement: richTextSourcePath,
            },
        ],
    },
    base: './',
    define: {
        'import.meta.env.SOEDITOR_STANDALONE_VIDEO': JSON.stringify('true'),
        'import.meta.env.SOEDITOR_OPTIONAL_CLASSIC': JSON.stringify('false'),
        'import.meta.env.SOEDITOR_TABLE_CONTEXT': JSON.stringify('false'),
        'import.meta.env.SOEDITOR_SOURCE_TOOLBAR': JSON.stringify('false'),
        'import.meta.env.SOEDITOR_RESPONSIVE_ASSET_METADATA':
            JSON.stringify('false'),
    },
    plugins: [
        {
            enforce: 'pre',
            name: 'soeditor-global-lazy-image-tools',
            resolveId(source, importer) {
                if (
                    source === './classic-image-context.js' &&
                    importer?.endsWith('/src/classic-editor.ts')
                )
                    return { id: './classic-image-tools.js', external: true };
            },
            generateBundle() {
                const dist = new URL('./dist/', import.meta.url);
                const candidates = readdirSync(dist).filter((name) =>
                    /^classic-image-context-.*\.js$/.test(name),
                );
                const selected = candidates
                    .map((name) => ({
                        name,
                        source: readFileSync(new URL(name, dist), 'utf8'),
                    }))
                    .sort((a, b) => a.source.length - b.source.length)[0];
                if (selected === undefined || /^import /m.test(selected.source))
                    throw new Error('Missing self-contained image tools');
                this.emitFile({
                    type: 'asset',
                    fileName: 'classic-image-tools.js',
                    source: selected.source.replace(
                        /sourceMappingURL=.*$/m,
                        'sourceMappingURL=classic-image-tools.js.map',
                    ),
                });
                this.emitFile({
                    type: 'asset',
                    fileName: 'classic-image-tools.js.map',
                    source: readFileSync(
                        new URL(`${selected.name}.map`, dist),
                        'utf8',
                    ),
                });
            },
        },
        {
            enforce: 'pre',
            name: 'soeditor-inline-ui-translations',
            resolveId(source, importer) {
                if (
                    source === './ui-translation-loader.js' &&
                    importer?.endsWith('/src/classic-editor.ts') === true
                ) {
                    return inlineUiTranslationLoaderPath;
                }
            },
        },
        {
            enforce: 'pre',
            name: 'soeditor-strip-optional-global-styles',
            load(id) {
                if (id.split('?', 1)[0] !== stylesPath) return;
                return [
                    stripOptionalGlobalStyles(
                        stripCompatibilityReviewStyles(
                            readFileSync(uiStylesPath, 'utf8'),
                        ),
                    ),
                    stripOptionalGlobalStyles(
                        readFileSync(classicStylesPath, 'utf8'),
                    ),
                ].join('\n');
            },
        },
    ],
    build: {
        assetsDir: '',
        emptyOutDir: false,
        lib: {
            cssFileName: 'soeditor',
            entry: 'src/browser-global.ts',
            fileName: () => 'soeditor.global.js',
            formats: ['iife'],
            name: 'SoEditor',
        },
        cssMinify: 'lightningcss',
        minify: 'terser',
        terserOptions: {
            ecma: 2022,
            compress: {
                passes: 5,
                toplevel: true,
                unsafe: true,
                unsafe_arrows: true,
            },
            format: { comments: false, semicolons: false },
            mangle: {
                properties: {
                    builtins: false,
                    keep_quoted: true,
                    reserved: [...publicPropertyNames],
                },
                toplevel: true,
            },
        },
        rollupOptions: {
            external: [
                '@soeditor/html-tools',
                '@soeditor/preview',
                '@soeditor/source',
            ],
            output: {
                exports: 'default',
                footer: "Object.defineProperty(globalThis, 'SoEditor', { configurable: false, enumerable: true, value: SoEditor, writable: false });",
                inlineDynamicImports: true,
            },
        },
        sourcemap: true,
    },
});
