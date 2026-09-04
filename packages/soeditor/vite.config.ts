import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        lib: {
            entry: {
                'cms-optional': 'src/cms-optional.ts',
                index: 'src/index.ts',
            },
            formats: ['es'],
        },
        minify: false,
        rollupOptions: { external: [/^@soeditor\//u] },
        sourcemap: true,
    },
});
