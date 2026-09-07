import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        lib: {
            entry: {
                index: 'src/index.ts',
                save: 'src/save-workflow.ts',
            },
            formats: ['es'],
        },
        minify: false,
        rollupOptions: { external: ['@soeditor/core'] },
        sourcemap: true,
    },
});
