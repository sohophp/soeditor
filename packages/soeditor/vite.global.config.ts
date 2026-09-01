import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        assetsDir: '',
        emptyOutDir: false,
        lib: {
            cssFileName: 'soeditor',
            entry: 'src/browser-global.ts',
            fileName: () => 'soeditor.global.js',
            formats: ['iife'],
            name: 'SoEditor',
        },
        minify: true,
        rollupOptions: {
            external: ['@soeditor/source'],
            output: {
                exports: 'default',
                footer: "Object.defineProperty(globalThis, 'SoEditor', { configurable: false, enumerable: true, value: SoEditor, writable: false });",
                inlineDynamicImports: true,
            },
        },
        sourcemap: true,
    },
});
