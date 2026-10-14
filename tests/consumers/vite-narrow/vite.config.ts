import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [
        {
            name: 'remove-unreferenced-formatting-worker',
            generateBundle(_options, bundle) {
                // Vite may emit this asset while transforming an unused barrel
                // export. Keep every worker referenced by surviving runtime code.
                for (const [name, output] of Object.entries(bundle)) {
                    if (
                        output.type !== 'asset' ||
                        !/formatting-worker[^/]*\.js$/u.test(name)
                    )
                        continue;
                    const filename = name.split('/').at(-1);
                    if (
                        filename !== undefined &&
                        !Object.values(bundle).some(
                            (item) =>
                                item.type === 'chunk' &&
                                item.code.includes(filename),
                        )
                    )
                        delete bundle[name];
                }
            },
        },
    ],
    build: { manifest: true, sourcemap: true },
});
