import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        lib: {
            entry: { index: 'src/index.ts', cms: 'src/cms.ts' },
            formats: ['es'],
        },
        minify: false,
        // Preserve the client boundary for server-component consumers.
        rollupOptions: {
            output: {
                banner: (chunk) =>
                    chunk.name === 'cms' ? "'use client';" : '',
            },
            external: [
                '@soeditor/editor/cms',
                '@soeditor/core',
                '@soeditor/workspace',
                'react',
            ],
        },
        sourcemap: true,
    },
});
