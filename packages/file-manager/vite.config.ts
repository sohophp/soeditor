import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        lib: {
            entry: { index: 'src/index.ts', ckfinder: 'src/ckfinder.ts' },
            fileName: (_format, name) => `${name}.js`,
            formats: ['es'],
        },
        minify: false,
        rollupOptions: {
            external: [
                '@soeditor/core',
                '@soeditor/engine',
                '@soeditor/rich-text',
                '@soeditor/ui',
            ],
        },
        sourcemap: true,
    },
});
