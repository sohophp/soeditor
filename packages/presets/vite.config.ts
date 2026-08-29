import { defineConfig } from 'vite';

const external = [
    '@soeditor/core',
    '@soeditor/dev-tools',
    '@soeditor/engine',
    '@soeditor/file-manager',
    '@soeditor/html-tools',
    '@soeditor/markdown',
    '@soeditor/preview',
    '@soeditor/rich-text',
    '@soeditor/source',
    '@soeditor/ui',
];

export default defineConfig({
    build: {
        lib: { entry: 'src/index.ts', fileName: 'index', formats: ['es'] },
        minify: false,
        rollupOptions: { external },
        sourcemap: true,
    },
});
