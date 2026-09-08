import { build as buildExamples } from 'vite';
import { build as buildDocs } from 'vitepress';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, writeFile, readdir, cp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import process from 'node:process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageRoot = resolve(
    dirname(fileURLToPath(import.meta.resolve('soeditor-release/cms'))),
    '..',
);
const editorPackage = JSON.parse(
    await readFile(resolve(packageRoot, 'package.json'), 'utf8'),
);
if (editorPackage.version !== '1.2.1' || !packageRoot.includes('node_modules'))
    throw new Error('Expected published SoEditor 1.2.1');
const examples = ['basic', 'form', 'source', 'assets', 'save', 'multiple'];
const graph = [];
await buildExamples({
    configFile: false,
    root: resolve(root, 'examples'),
    base: '/demos/',
    build: {
        outDir: resolve(root, 'public/demos'),
        emptyOutDir: true,
        manifest: true,
        rollupOptions: {
            input: examples.map((name) =>
                resolve(root, `examples/${name}.html`),
            ),
        },
    },
    plugins: [
        {
            name: 'published-editor-only',
            generateBundle(_options, bundle) {
                for (const id of this.getModuleIds()) {
                    if (
                        /\/packages\/[^/]+\/(src|dist)\//.test(id) &&
                        !id.includes('/node_modules/')
                    )
                        throw new Error(`Workspace source in docs: ${id}`);
                }
                for (const [file, chunk] of Object.entries(bundle)) {
                    if (chunk.type === 'chunk')
                        graph.push({
                            file,
                            imports: chunk.imports,
                            dynamicImports: chunk.dynamicImports,
                            modules: Object.keys(chunk.modules).map((id) =>
                                id.includes('/node_modules/')
                                    ? id.slice(
                                          id.lastIndexOf('/node_modules/') + 1,
                                      )
                                    : relative(root, id),
                            ),
                        });
                }
            },
        },
    ],
});
if (process.argv.includes('--examples-only')) process.exit(0);
const download = resolve(root, '.vitepress/reports/example-source');
await rm(download, { recursive: true, force: true });
await rm(resolve(root, 'public/downloads'), { recursive: true, force: true });
await mkdir(download, { recursive: true });
for (const name of await readdir(resolve(root, 'examples')))
    await cp(resolve(root, 'examples', name), resolve(download, name));
await mkdir(resolve(download, 'public'), { recursive: true });
await cp(
    resolve(root, 'public/sample-image.svg'),
    resolve(download, 'public/sample-image.svg'),
);
await writeFile(
    resolve(download, 'package.json'),
    JSON.stringify(
        {
            name: 'soeditor-examples',
            private: true,
            type: 'module',
            scripts: { dev: 'vite --host 0.0.0.0', build: 'vite build' },
            dependencies: {
                'soeditor-release': 'npm:@soeditor/editor@1.2.1',
                '@soeditor/file-manager': '1.2.1',
                '@soeditor/adapter-sofinder': '1.2.1',
                '@soeditor/presets': '1.2.1',
            },
            devDependencies: { vite: '7.3.6', typescript: '5.9.3' },
        },
        null,
        2,
    ),
);
await writeFile(
    resolve(download, 'pnpm-workspace.yaml'),
    'allowBuilds:\n  esbuild: true\n',
);
await writeFile(
    resolve(download, 'vite.config.js'),
    `import { defineConfig } from 'vite';\nexport default defineConfig({build:{rollupOptions:{input:${JSON.stringify(examples.map((name) => name + '.html'))}}}});\n`,
);
await mkdir(resolve(root, 'public/downloads'), { recursive: true });
execFileSync('tar', [
    '-czf',
    resolve(root, 'public/downloads/soeditor-examples-1.2.1.tar.gz'),
    '-C',
    download,
    '.',
]);
await buildDocs(root);
const dist = resolve(root, '.vitepress/dist');
const preview = process.env.DOCS_PREVIEW === '1';
await writeFile(resolve(dist, '_redirects'), '/ /zh-CN/ 302\n');
await writeFile(
    resolve(dist, '_headers'),
    `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Cache-Control: public, max-age=0, must-revalidate\n${preview ? '  X-Robots-Tag: noindex, nofollow\n' : ''}\n/assets/*\n  ! Cache-Control\n  Cache-Control: public, max-age=31536000, immutable\n/demos/assets/*\n  ! Cache-Control\n  Cache-Control: public, max-age=31536000, immutable\n/demos/*\n  X-Robots-Tag: noindex, nofollow\n  Content-Security-Policy: frame-ancestors 'self'\n`,
);
await writeFile(
    resolve(dist, 'robots.txt'),
    preview
        ? 'User-agent: *\nDisallow: /\n'
        : 'User-agent: *\nAllow: /\nDisallow: /demos/\nSitemap: https://soeditor.sohophp.app/sitemap.xml\n',
);
const commit = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
}).trim();
const lock = await readFile(resolve(root, '../../pnpm-lock.yaml'));
const manifest = {
    commit,
    editorVersion: editorPackage.version,
    preview,
    lockSha256: createHash('sha256').update(lock).digest('hex'),
};
await writeFile(
    resolve(dist, 'deployment.json'),
    JSON.stringify(manifest, null, 2),
);
await mkdir(resolve(root, '.vitepress/reports'), { recursive: true });
await writeFile(
    resolve(root, '.vitepress/reports/example-graph.json'),
    JSON.stringify(graph, null, 2),
);
// Artifact checksums cover every served file; the manifest itself stays outside the asset directory.
async function files(directory) {
    const result = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = resolve(directory, entry.name);
        if (entry.isDirectory()) result.push(...(await files(path)));
        else result.push(path);
    }
    return result;
}
const sums = {};
for (const path of (await files(dist)).sort())
    sums[relative(dist, path)] = createHash('sha256')
        .update(await readFile(path))
        .digest('hex');
await writeFile(
    resolve(root, '.vitepress/reports/checksums.json'),
    JSON.stringify(sums, null, 2),
);

execFileSync(process.execPath, [resolve(root, 'scripts/check-built.mjs')], {
    stdio: 'inherit',
});
