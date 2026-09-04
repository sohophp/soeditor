import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { collectPublicPropertyNames } from './vite-public-properties.js';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const cmsRuntimePackages = [
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
    cmsRuntimePackages,
    ['createClassicEditor'],
);

export default defineConfig({
    define: {
        'import.meta.env.SOEDITOR_OPTIONAL_CLASSIC': JSON.stringify('false'),
    },
    build: {
        emptyOutDir: false,
        lib: {
            entry: { cms: 'src/cms.ts' },
            formats: ['es'],
        },
        minify: 'terser',
        terserOptions: {
            module: true,
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
                    keep_quoted: 'strict',
                    reserved: [...publicPropertyNames],
                },
                toplevel: true,
            },
        },
        sourcemap: true,
    },
});
