import { readFile, readdir, access } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
async function markdown(directory) {
    const result = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = resolve(directory, entry.name);
        if (entry.isDirectory()) result.push(...(await markdown(path)));
        else if (entry.name.endsWith('.md')) result.push(path);
    }
    return result;
}
const cn = await markdown(resolve(root, 'zh-CN'));
const en = await markdown(resolve(root, 'en'));
const paths = (files, locale) =>
    files.map((path) => relative(resolve(root, locale), path)).sort();
if (JSON.stringify(paths(cn, 'zh-CN')) !== JSON.stringify(paths(en, 'en')))
    throw new Error('Missing translation');
for (const file of [...cn, ...en]) {
    const content = await readFile(file, 'utf8');
    if (
        !content.includes('description:') ||
        /\bTODO\b|待补充|Coming soon/.test(content)
    )
        throw new Error(`Incomplete page: ${file}`);
    for (const match of content.matchAll(/\]\((\/[^)#]+)(?:#[^)]*)?\)/g)) {
        const path = resolve(root, `.${match[1]}`);
        if (match[1].startsWith('/downloads/')) continue;
        const candidates = match[1].endsWith('/')
            ? [resolve(path, 'index.md')]
            : [path, `${path}.md`];
        if (
            !(
                await Promise.all(
                    candidates.map((candidate) =>
                        access(candidate).then(
                            () => true,
                            () => false,
                        ),
                    ),
                )
            ).some(Boolean)
        )
            throw new Error(`Broken link in ${file}: ${match[1]}`);
    }
}
for (const [specifier, version] of [
    ['soeditor-release/cms', '1.2.1'],
    ['@soeditor/file-manager', '1.2.1'],
    ['@soeditor/adapter-sofinder', '1.2.1'],
    ['@soeditor/presets/cms-runtime', '1.2.1'],
]) {
    const entry = fileURLToPath(import.meta.resolve(specifier));
    if (!entry.includes('/node_modules/'))
        throw new Error(`Workspace dependency: ${entry}`);
    const pkg = JSON.parse(
        await readFile(resolve(dirname(entry), '../package.json'), 'utf8'),
    );
    if (pkg.version !== version)
        throw new Error(`Wrong published version: ${specifier}`);
}
process.stdout.write(
    `Documentation checks passed: ${cn.length} pages per language; published dependencies pinned.\n`,
);
