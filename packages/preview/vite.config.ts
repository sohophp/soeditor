import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        lib: {
            entry: { index: 'src/index.ts', media: 'src/media-service.ts' },
            fileName: (_format, entryName) => `${entryName}.js`,
            formats: ['es'],
        },
        minify: false,
        rollupOptions: {
            external: ['@soeditor/core', '@soeditor/projections'],
        },
        sourcemap: true,
    },
});
