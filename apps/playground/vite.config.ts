import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                classic: fileURLToPath(
                    new URL('classic.html', import.meta.url),
                ),
                frameworks: fileURLToPath(
                    new URL('framework-adapters.html', import.meta.url),
                ),
                main: fileURLToPath(new URL('index.html', import.meta.url)),
                workspace: fileURLToPath(
                    new URL('workspace.html', import.meta.url),
                ),
                wysiwyg: fileURLToPath(
                    new URL('wysiwyg.html', import.meta.url),
                ),
            },
        },
        sourcemap: true,
    },
    resolve: {
        alias: {
            '@soeditor/editor/styles.css': fileURLToPath(
                new URL(
                    '../../packages/soeditor/src/styles.css',
                    import.meta.url,
                ),
            ),
            '@soeditor/editor': fileURLToPath(
                new URL(
                    '../../packages/soeditor/src/index.ts',
                    import.meta.url,
                ),
            ),
            '@soeditor/adapter-sofinder': fileURLToPath(
                new URL(
                    '../../packages/adapter-sofinder/src/index.ts',
                    import.meta.url,
                ),
            ),
            '@soeditor/core': fileURLToPath(
                new URL('../../packages/core/src/index.ts', import.meta.url),
            ),
            '@soeditor/react': fileURLToPath(
                new URL('../../packages/react/src/index.ts', import.meta.url),
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
            '@soeditor/markdown': fileURLToPath(
                new URL(
                    '../../packages/markdown/src/index.ts',
                    import.meta.url,
                ),
            ),
            '@soeditor/layout/styles.css': fileURLToPath(
                new URL(
                    '../../packages/layout/src/styles.css',
                    import.meta.url,
                ),
            ),
            '@soeditor/layout': fileURLToPath(
                new URL('../../packages/layout/src/index.ts', import.meta.url),
            ),
            '@soeditor/file-manager': fileURLToPath(
                new URL(
                    '../../packages/file-manager/src/index.ts',
                    import.meta.url,
                ),
            ),
            '@soeditor/preview': fileURLToPath(
                new URL('../../packages/preview/src/index.ts', import.meta.url),
            ),
            '@soeditor/projections': fileURLToPath(
                new URL(
                    '../../packages/projections/src/index.ts',
                    import.meta.url,
                ),
            ),
            '@soeditor/rich-text': fileURLToPath(
                new URL(
                    '../../packages/rich-text/src/index.ts',
                    import.meta.url,
                ),
            ),
            '@soeditor/presets': fileURLToPath(
                new URL('../../packages/presets/src/index.ts', import.meta.url),
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
            '@soeditor/vue': fileURLToPath(
                new URL('../../packages/vue/src/index.ts', import.meta.url),
            ),
            '@soeditor/workspace': fileURLToPath(
                new URL(
                    '../../packages/workspace/src/index.ts',
                    import.meta.url,
                ),
            ),
            '@soeditor/wysiwyg': fileURLToPath(
                new URL('../../packages/wysiwyg/src/index.ts', import.meta.url),
            ),
        },
    },
});
