import { defineConfig } from 'vite';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

// A self-contained recovery asset avoids reusing a failed module graph. It is
// requested after a failed ESM load, or on first video use in the global build.
export default defineConfig({
    plugins: [
        {
            name: 'video-recovery-notices',
            generateBundle() {
                const notices = new Map<string, string>();
                for (const id of this.getModuleIds()) {
                    if (!id.includes('/node_modules/')) continue;
                    let directory = dirname(id.split('?')[0] ?? id);
                    while (dirname(directory) !== directory) {
                        const manifestPath = join(directory, 'package.json');
                        if (existsSync(manifestPath)) {
                            const manifest: unknown = JSON.parse(
                                readFileSync(manifestPath, 'utf8'),
                            );
                            const name: unknown =
                                typeof manifest === 'object' &&
                                manifest !== null
                                    ? Reflect.get(manifest, 'name')
                                    : undefined;
                            const version: unknown =
                                typeof manifest === 'object' &&
                                manifest !== null
                                    ? Reflect.get(manifest, 'version')
                                    : undefined;
                            if (
                                typeof name === 'string' &&
                                typeof version === 'string'
                            ) {
                                const license = [
                                    'LICENSE',
                                    'LICENSE.md',
                                    'LICENSE.txt',
                                    'LICENCE',
                                ]
                                    .map((file) => join(directory, file))
                                    .find(existsSync);
                                if (license === undefined)
                                    throw new Error(
                                        `Missing bundled license for ${name}.`,
                                    );
                                notices.set(
                                    `${name}@${version}`,
                                    readFileSync(license, 'utf8'),
                                );
                                break;
                            }
                        }
                        directory = dirname(directory);
                    }
                }
                this.emitFile({
                    type: 'asset',
                    fileName: 'video-runtime.NOTICES.txt',
                    source: [...notices]
                        .sort(([left], [right]) => left.localeCompare(right))
                        .map(([name, license]) => `${name}\n${license}`)
                        .join('\n\n'),
                });
            },
        },
    ],
    build: {
        sourcemap: 'hidden',
        outDir: 'node_modules/.cache/video-recovery',
        lib: {
            entry: 'src/video-runtime.ts',
            formats: ['es'],
            fileName: () => 'video-runtime.js',
        },
        minify: 'terser',
        terserOptions: {
            module: true,
            format: { comments: false },
            compress: { passes: 2 },
        },
        rollupOptions: { output: { inlineDynamicImports: true } },
    },
});
