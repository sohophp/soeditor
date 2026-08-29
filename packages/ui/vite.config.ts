import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        copyPublicDir: false,
        cssCodeSplit: true,
        lib: {
            cssFileName: 'soeditor-ui',
            entry: {
                index: 'src/index.ts',
                styles: 'src/styles.css',
            },
            fileName: 'index',
            formats: ['es'],
        },
        minify: false,
        rollupOptions: {
            external: ['@soeditor/core'],
        },
        sourcemap: true,
    },
});
