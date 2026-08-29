import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        lib: {
            entry: 'src/index.ts',
            fileName: 'index',
            formats: ['es'],
        },
        minify: false,
        rollupOptions: {
            external: [
                '@soeditor/core',
                '@soeditor/engine',
                '@soeditor/html',
                '@soeditor/projections',
                'codemirror',
                /^@codemirror\//u,
            ],
        },
        sourcemap: true,
    },
});
