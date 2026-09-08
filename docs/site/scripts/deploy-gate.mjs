import { readFile, readdir } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import process from 'node:process';
const root = resolve(process.argv[2]);
const manifest = JSON.parse(
    await readFile(resolve(root, 'dist/deployment.json'), 'utf8'),
);
if (
    !/^[a-f0-9]{40}$/.test(process.env.DOCS_SHA ?? '') ||
    manifest.commit !== process.env.DOCS_SHA ||
    manifest.editorVersion !== '1.2.1'
)
    throw new Error('Artifact identity mismatch');
if (manifest.preview !== (process.env.DOCS_TARGET === 'preview'))
    throw new Error('Wrong artifact environment');
const sums = JSON.parse(
    await readFile(resolve(root, 'reports/checksums.json'), 'utf8'),
);
async function verify(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = resolve(directory, entry.name);
        if (entry.isSymbolicLink()) throw new Error('Symlink in artifact');
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
            throw new Error(`Checksum mismatch: ${name}`);
        delete sums[name];
    }
}
await verify(resolve(root, 'dist'));
if (Object.keys(sums).length) throw new Error('Missing artifact files');
const gh = (path) =>
    JSON.parse(execFileSync('gh', ['api', path], { encoding: 'utf8' }));
const repo = process.env.GITHUB_REPOSITORY;
if (!repo) throw new Error('Missing repository');
if (process.env.DOCS_TARGET === 'preview') {
    const run = gh(`repos/${repo}/actions/runs/${process.env.DOCS_RUN_ID}`);
    // GitHub may omit pull_requests after merge or branch deletion. Resolve
    // the checked commit's PRs, then apply the same repository/head checks.
    const prs = run.pull_requests?.length
        ? run.pull_requests
        : gh(`repos/${repo}/commits/${manifest.commit}/pulls`).filter(
              (pr) => pr.head?.sha === manifest.commit,
          );
    if (!prs.length)
        throw new Error('No trusted pull request associated with preview');
    for (const item of prs) {
        const pr = gh(`repos/${repo}/pulls/${item.number}`);
        if (pr.head.repo?.full_name !== repo || pr.head.sha !== manifest.commit)
            throw new Error('Fork or superseded PR preview');
    }
}
if (process.env.DOCS_TARGET === 'production') {
    for (let attempt = 0; attempt < 180; attempt++) {
        const head = gh(`repos/${repo}/git/ref/heads/master`).object.sha;
        if (head !== manifest.commit)
            throw new Error('Superseded master commit; skip this deployment');
        const runs = gh(
            `repos/${repo}/actions/workflows/ci.yml/runs?head_sha=${manifest.commit}&event=push`,
        ).workflow_runs;
        const run = runs[0];
        if (run?.status === 'completed') {
            if (run.conclusion !== 'success')
                throw new Error('Repository CI did not pass');
            break;
        }
        if (attempt === 179)
            throw new Error('Timed out waiting for repository CI');
        await new Promise((done) => setTimeout(done, 10000));
    }
}
process.stdout.write('Artifact identity, checksums and CI gate passed.\n');
