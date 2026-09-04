import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        copyPublicDir: false,
        cssCodeSplit: true,
        lib: {
            cssFileName: 'soeditor-ui',
            entry: {
                compatibility: 'src/compatibility.ts',
                index: 'src/index.ts',
                styles: 'src/styles.css',
            },
            fileName: (_format, entryName) => `${entryName}.js`,
            formats: ['es'],
        },
        minify: false,
        rollupOptions: {
            external: ['@soeditor/core'],
        },
        sourcemap: true,
    },
});
