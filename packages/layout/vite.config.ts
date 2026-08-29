import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        lib: {
            cssFileName: 'styles',
            entry: 'src/index.ts',
            fileName: 'index',
            formats: ['es'],
        },
        minify: false,
        rollupOptions: {
            external: ['@soeditor/core', '@soeditor/projections'],
        },
        sourcemap: true,
    },
});
