import { defineConfig } from 'vite';
import { minify } from 'terser';

export default defineConfig({
    worker: {
        plugins: () => [
            {
                name: 'compact-inline-formatting-worker',
                async renderChunk(code) {
                    const result = await minify(code, {
                        compress: { passes: 3 },
                        mangle: true,
                        format: { comments: false },
                    });
                    if (result.code === undefined)
                        throw new Error(
                            'Formatting worker minification failed',
                        );
                    return { code: result.code, map: null };
                },
            },
        ],
    },
    build: {
        lib: {
            entry: 'src/index.ts',
            fileName: 'index',
            formats: ['es'],
        },
        minify: false,
        rollupOptions: {
            external: [
                '@soeditor/core',
                '@soeditor/html',
                'prettier/standalone',
                'prettier/plugins/html',
            ],
        },
        sourcemap: true,
    },
});
