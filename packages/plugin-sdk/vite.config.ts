import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        lib: { entry: 'src/index.ts', fileName: 'index', formats: ['es'] },
        minify: false,
        rollupOptions: {
            external: [
                '@soeditor/core',
                '@soeditor/file-manager',
                '@soeditor/html-tools',
                '@soeditor/ui',
            ],
        },
        sourcemap: true,
    },
});
