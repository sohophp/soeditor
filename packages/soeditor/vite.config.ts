import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

export default defineConfig({
    base: './',
    plugins: [
        {
            name: 'video-recovery-map',
            generateBundle() {
                for (const fileName of [
                    'video-runtime.js.map',
                    'video-runtime.NOTICES.txt',
                ]) {
                    this.emitFile({
                        type: 'asset',
                        fileName,
                        source: readFileSync(
                            new URL(
                                `./node_modules/.cache/video-recovery/${fileName}`,
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
        cssCodeSplit: true,
        lib: {
            entry: {
                'cms-optional': 'src/cms-optional.ts',
                index: 'src/index.ts',
                video: 'src/video.ts',
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
