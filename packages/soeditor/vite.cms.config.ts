import { defineConfig } from 'vite';
export default defineConfig({
    define: {
        'import.meta.env.SOEDITOR_OPTIONAL_CLASSIC': JSON.stringify('false'),
    },
    build: {
        emptyOutDir: false,
        lib: {
            entry: { cms: 'src/cms.ts' },
            formats: ['es'],
        },
        minify: 'terser',
        terserOptions: {
            module: true,
            compress: {
                passes: 5,
                toplevel: true,
                unsafe: true,
                unsafe_arrows: true,
            },
            format: { comments: false, semicolons: false },
            mangle: {
                // Vite minifies ESM chunks independently. Property mangling would
                // rename shared object keys inconsistently across chunk boundaries.
                toplevel: true,
            },
        },
        sourcemap: true,
    },
});
