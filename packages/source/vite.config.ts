import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

export default defineConfig({
    base: './',
    plugins: [
        {
            name: 'source-recovery-supporting-files',
            generateBundle() {
                for (const fileName of [
                    'runtime.js.map',
                    'source-runtime.NOTICES.txt',
                ]) {
                    this.emitFile({
                        type: 'asset',
                        fileName,
                        source: readFileSync(
                            new URL(
                                `./node_modules/.cache/source-recovery/${fileName}`,
                                import.meta.url,
                            ),
                            'utf8',
                        ),
                    });
                }
            },
        },
    ],
    build: {
        lib: {
            entry: {
                index: 'src/index.ts',
                recovery: 'src/recovery-loader.ts',
            },
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
