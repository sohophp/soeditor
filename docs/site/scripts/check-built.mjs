import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
const root = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../.vitepress/dist',
);
async function walk(dir) {
    const result = [];
    for (const entry of await readdir(dir, { withFileTypes: true })) {
        const path = resolve(dir, entry.name);
        if (entry.isDirectory()) result.push(...(await walk(path)));
        else result.push(path);
    }
    return result;
}
const files = await walk(root);
const html = new Map();
for (const path of files.filter((path) => path.endsWith('.html')))
    html.set(path, await readFile(path, 'utf8'));
let checked = 0;
for (const [file, content] of html) {
    if (!/\/(en|zh-CN)\//.test(file)) continue;
    for (const match of content.matchAll(/(?:href|src)="([^"]+)"/g)) {
        const raw = match[1].replaceAll('&amp;', '&');
        if (/^(https?:|data:|mailto:|javascript:)/.test(raw)) continue;
        const url = new URL(
            raw,
            `https://docs.local/${relative(root, file).replace(/\.html$/, '')}`,
        );
        const target = resolve(root, `.${decodeURIComponent(url.pathname)}`);
        const candidates = [
            target,
            `${target}.html`,
            resolve(target, 'index.html'),
        ];
        const exists = await Promise.all(
            candidates.map((path) =>
                stat(path).then(
                    (info) => (info.isFile() ? path : undefined),
                    () => undefined,
                ),
            ),
        );
        const chosen = exists.find(Boolean);
        if (!chosen)
            throw new Error(
                `Missing built target: ${relative(root, file)} -> ${raw}`,
            );
        if (url.hash && html.has(chosen)) {
            const id = decodeURIComponent(url.hash.slice(1));
            if (!html.get(chosen).includes(`id="${id}"`))
                throw new Error(`Missing anchor: ${file} -> ${raw}`);
        }
        checked++;
    }
}
const manifest = JSON.parse(
    await readFile(resolve(root, 'deployment.json'), 'utf8'),
);
if (manifest.preview && files.some((path) => /sitemap.*\.xml$/.test(path)))
    throw new Error('Preview sitemap must not be published');
if (
    files.some(
        (path) =>
            relative(root, path).startsWith('prompts/') ||
            relative(root, path).startsWith('evidence/'),
    )
)
    throw new Error('Internal documents leaked');
process.stdout.write(
    `Built link checks passed: ${checked} links and resources.\n`,
);
