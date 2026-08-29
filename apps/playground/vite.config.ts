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
        },
    },
});
