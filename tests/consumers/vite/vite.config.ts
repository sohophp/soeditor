import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        manifest: true,
        sourcemap: true,
        rollupOptions: { input: ['index.html', 'source.html'] },
    },
});
