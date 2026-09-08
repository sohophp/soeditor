import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const repo = process.env.GITHUB_REPOSITORY;
const sha = process.env.DOCS_SHA;
if (!repo || !/^[a-f0-9]{40}$/.test(sha ?? ''))
    throw new Error('Missing archive identity');
const record = JSON.parse(
    await readFile(
        resolve(process.argv[2], 'reports/soeditor-docs-deployment.json'),
        'utf8',
    ),
);
if (!record.verified || record.commit !== sha)
    throw new Error('Only verified deployments may be archived');
const gh = (args) => execFileSync('gh', args, { encoding: 'utf8' });
const tag = 'docs-deployment-archives';
try {
    gh(['release', 'view', tag, '--repo', repo]);
} catch {
    gh([
        'release',
        'create',
        tag,
        '--repo',
        repo,
        '--target',
        sha,
        '--title',
        'Documentation deployment archives',
        '--notes',
        'Verified static-site rollback artifacts. Not an editor package release.',
        '--prerelease',
        '--latest=false',
    ]);
}
const name = `docs-${Date.now()}-${sha}.tar.gz`;
execFileSync('tar', [
    '-czf',
    `/tmp/${name}`,
    '-C',
    process.argv[2],
    'dist',
    'reports',
]);
gh(['release', 'upload', tag, `/tmp/${name}`, '--repo', repo]);
const release = JSON.parse(gh(['api', `repos/${repo}/releases/tags/${tag}`]));
const assets = release.assets
    .filter((asset) => /^docs-\d+-[a-f0-9]{40}\.tar\.gz$/.test(asset.name))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
for (const asset of assets.slice(10)) {
    if (Date.now() - Date.parse(asset.created_at) > 90 * 86400000)
        gh([
            'api',
            '--method',
            'DELETE',
            `repos/${repo}/releases/assets/${asset.id}`,
        ]);
}
