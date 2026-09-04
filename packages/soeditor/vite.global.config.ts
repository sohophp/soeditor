import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { collectPublicPropertyNames } from './vite-public-properties.js';

const classicStylesPath = fileURLToPath(
    new URL('./src/classic-editor.css', import.meta.url),
);
const stylesPath = fileURLToPath(new URL('./src/styles.css', import.meta.url));
const uiStylesPath = fileURLToPath(
    new URL('../ui/src/styles.css', import.meta.url),
);
const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
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
    ['SoEditor', 'create', 'createClassicEditor'],
);
const stripOptionalGlobalStyles = (code: string): string =>
    code.replace(
        /\/\* soeditor-global-optional-table-context:start \*\/[\s\S]*?\/\* soeditor-global-optional-table-context:end \*\//u,
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
    define: {
        'import.meta.env.SOEDITOR_OPTIONAL_CLASSIC': JSON.stringify('false'),
        'import.meta.env.SOEDITOR_TABLE_CONTEXT': JSON.stringify('false'),
    },
    plugins: [
        {
            enforce: 'pre',
            name: 'soeditor-strip-optional-global-styles',
            load(id) {
                if (id.split('?', 1)[0] !== stylesPath) return;
                return [
                    stripCompatibilityReviewStyles(
                        readFileSync(uiStylesPath, 'utf8'),
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
