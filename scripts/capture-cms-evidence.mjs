import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { argv, version } from 'node:process';

const root = resolve(import.meta.dirname, '..');
if (!argv[2]) throw new Error('Usage: output.json [retained-fixture-dist ...]');
const output = resolve(argv[2]);
const digest = async (path) =>
    createHash('sha256')
        .update(await readFile(path))
        .digest('hex');
const names = execFileSync(
    'git',
    ['ls-files', '-co', '--exclude-standard', '-z'],
    { cwd: root, encoding: 'utf8' },
).split('\0');
const files = {};
for (const name of [...new Set(names)].sort()) {
    // Evidence is output, not runtime input; excluding it avoids self-reference.
    if (
        !name ||
        name.startsWith('docs/evidence/') ||
        resolve(root, name) === output
    )
        continue;
    files[name] = await digest(resolve(root, name));
}
const trees = {};
for (const tree of ['packages/soeditor/dist', ...argv.slice(3)]) {
    const base = resolve(root, tree);
    const hashes = {};
    const walk = async (directory) => {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
            const path = resolve(directory, entry.name);
            if (entry.isDirectory()) await walk(path);
            else if (entry.isFile())
                hashes[relative(base, path)] = await digest(path);
        }
    };
    await walk(base);
    trees[tree] = Object.fromEntries(
        Object.entries(hashes).sort(([a], [b]) => a.localeCompare(b)),
    );
}
const archives = {};
for (const name of await readdir(dirname(output))) {
    if (name.endsWith('.tar.gz'))
        archives[name] = await digest(resolve(dirname(output), name));
}
await writeFile(
    output,
    `${JSON.stringify({ capturedAt: new Date().toISOString(), node: version, head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), worktreeDigest: createHash('sha256').update(JSON.stringify(files)).digest('hex'), files, trees, archives, note: 'Hashes identify the dirty worktree and built artifacts; this is not a commit, a published version, or proof of test execution. Evidence outputs are excluded from the worktree digest.' }, null, 2)}\n`,
);
