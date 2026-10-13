import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        lib: {
            entry: { index: 'src/index.ts', browser: 'src/browser.ts' },
            fileName: (_format, name) => `${name}.js`,
            formats: ['es'],
        },
        minify: false,
        rollupOptions: {
            external: ['@soeditor/file-manager'],
        },
        sourcemap: true,
    },
});
