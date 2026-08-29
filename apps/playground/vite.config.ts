import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
    build: {
        sourcemap: true,
    },
    resolve: {
        alias: {
            '@soeditor/core': fileURLToPath(
                new URL('../../packages/core/src/index.ts', import.meta.url),
            ),
            '@soeditor/engine': fileURLToPath(
                new URL('../../packages/engine/src/index.ts', import.meta.url),
            ),
            '@soeditor/html': fileURLToPath(
                new URL('../../packages/html/src/index.ts', import.meta.url),
            ),
            '@soeditor/html-tools': fileURLToPath(
                new URL(
                    '../../packages/html-tools/src/index.ts',
                    import.meta.url,
                ),
            ),
            '@soeditor/source': fileURLToPath(
                new URL('../../packages/source/src/index.ts', import.meta.url),
            ),
            '@soeditor/ui/styles.css': fileURLToPath(
                new URL('../../packages/ui/src/styles.css', import.meta.url),
            ),
            '@soeditor/ui': fileURLToPath(
                new URL('../../packages/ui/src/index.ts', import.meta.url),
            ),
        },
    },
});
