import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        lib: {
            entry: { cli: 'src/cli.ts', index: 'src/index.ts' },
            formats: ['es'],
        },
        minify: false,
        rollupOptions: { external: [/^node:/u] },
        sourcemap: true,
    },
});
