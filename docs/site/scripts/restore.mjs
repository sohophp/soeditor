import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
import process from 'node:process';
const name = process.env.DOCS_ARCHIVE;
if (!/^docs-\d+-[a-f0-9]{40}\.tar\.gz$/.test(name ?? ''))
    throw new Error('Invalid archive name');
const root = '/tmp/soeditor-docs-artifact';
await mkdir(root, { recursive: true });
execFileSync('gh', [
    'release',
    'download',
    'docs-deployment-archives',
    '--repo',
    process.env.GITHUB_REPOSITORY,
    '--pattern',
    name,
    '--dir',
    '/tmp',
]);
const paths = execFileSync('tar', ['-tzf', `/tmp/${name}`], {
    encoding: 'utf8',
})
    .trim()
    .split('\n');
if (
    paths.some(
        (path) =>
            path.startsWith('/') ||
            path.split('/').includes('..') ||
            !/^(dist|reports)(\/|$)/.test(path),
    )
)
    throw new Error('Unsafe archive paths');
const types = execFileSync('tar', ['-tvzf', `/tmp/${name}`], {
    encoding: 'utf8',
})
    .trim()
    .split('\n');
if (types.some((line) => !/^[d-]/.test(line)))
    throw new Error('Archive contains links or special files');
execFileSync('tar', ['-xzf', `/tmp/${name}`, '--no-same-owner', '-C', root]);
const manifest = JSON.parse(
    await readFile(resolve(root, 'dist/deployment.json'), 'utf8'),
);
if (manifest.preview || !name.endsWith(`-${manifest.commit}.tar.gz`))
    throw new Error('Wrong restore manifest');
const sums = JSON.parse(
    await readFile(resolve(root, 'reports/checksums.json'), 'utf8'),
);
async function verify(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = resolve(directory, entry.name);
        if (entry.isSymbolicLink()) throw new Error('Symlink in archive');
        if (entry.isDirectory()) {
            await verify(path);
            continue;
        }
        const name = relative(resolve(root, 'dist'), path);
        if (
            createHash('sha256')
                .update(await readFile(path))
                .digest('hex') !== sums[name]
        )
            throw new Error(`Checksum failed: ${name}`);
        delete sums[name];
    }
}
await verify(resolve(root, 'dist'));
if (Object.keys(sums).length) throw new Error('Incomplete archive');
