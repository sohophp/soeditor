import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        lib: {
            entry: { cms: 'src/cms.ts', index: 'src/index.ts' },
            formats: ['es'],
        },
        minify: false,
        rollupOptions: { external: [/^@soeditor\//u] },
        sourcemap: true,
    },
});
