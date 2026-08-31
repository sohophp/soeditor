import { defineConfig } from 'vite';

const external = [
    '@soeditor/core',
    '@soeditor/dev-tools',
    '@soeditor/engine',
    '@soeditor/file-manager',
    '@soeditor/html-tools',
    '@soeditor/layout',
    '@soeditor/markdown',
    '@soeditor/preview',
    '@soeditor/projections',
    '@soeditor/rich-text',
    '@soeditor/source',
    '@soeditor/ui',
];

export default defineConfig({
    build: {
        lib: {
            entry: {
                classic: 'src/classic.ts',
                cms: 'src/cms.ts',
                developer: 'src/developer.ts',
                index: 'src/index.ts',
                markdown: 'src/markdown.ts',
                minimal: 'src/minimal.ts',
            },
            formats: ['es'],
        },
        minify: false,
        rollupOptions: { external },
        sourcemap: true,
    },
});
