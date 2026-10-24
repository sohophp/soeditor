import { defineConfig } from 'vite';
export default defineConfig({
    build: {
        outDir: 'node_modules/.cache/color-companion',
        emptyOutDir: true,
        lib: {
            entry: '../ui/src/toolbar-color-companion.ts',
            formats: ['es'],
            fileName: () => 'classic-color-tools.js',
        },
        minify: false,
        sourcemap: true,
        rollupOptions: { external: [/^@soeditor\//u] },
    },
});
