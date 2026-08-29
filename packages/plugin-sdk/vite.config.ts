import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        lib: { entry: 'src/index.ts', fileName: 'index', formats: ['es'] },
        minify: false,
        rollupOptions: {
            external: [
                '@soeditor/comments',
                '@soeditor/core',
                '@soeditor/engine',
                '@soeditor/file-manager',
                '@soeditor/html-tools',
                '@soeditor/layout',
                '@soeditor/projections',
                '@soeditor/revisions',
                '@soeditor/ui',
            ],
        },
        sourcemap: true,
    },
});
