import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        cssCodeSplit: true,
        lib: {
            entry: {
                'cms-optional': 'src/cms-optional.ts',
                index: 'src/index.ts',
                styles: 'src/styles.css',
                'cms-styles': 'src/cms-styles.css',
                content: 'src/content.css',
            },
            cssFileName: 'styles',
            formats: ['es'],
        },
        minify: false,
        rollupOptions: { external: [/^@soeditor\//u] },
        sourcemap: true,
    },
});
