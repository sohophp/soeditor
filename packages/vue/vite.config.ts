import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        lib: {
            entry: { index: 'src/index.ts', cms: 'src/cms.ts' },
            formats: ['es'],
        },
        minify: false,
        rollupOptions: {
            external: [
                '@soeditor/editor/cms',
                '@soeditor/core',
                '@soeditor/workspace',
                'vue',
            ],
        },
        sourcemap: true,
    },
});
