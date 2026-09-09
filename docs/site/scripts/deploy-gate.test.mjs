import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const sha = 'a'.repeat(40);
async function rejectedArtifact(mutate, message) {
    const root = await mkdtemp(join(tmpdir(), 'soeditor-docs-gate-'));
    try {
        await mkdir(join(root, 'dist'));
        await mkdir(join(root, 'reports'));
        const files = {
            'deployment.json': JSON.stringify({
                commit: sha,
                editorVersion: '1.4.0',
                preview: false,
            }),
            'index.html': '<p>Checked artifact</p>',
        };
        const sums = {};
        for (const [name, content] of Object.entries(files)) {
            await writeFile(join(root, 'dist', name), content);
            sums[name] = createHash('sha256').update(content).digest('hex');
        }
        await writeFile(
            join(root, 'reports/checksums.json'),
            JSON.stringify(sums),
        );
        await mutate(root);
        const result = spawnSync(
            process.execPath,
            [
                fileURLToPath(new URL('./deploy-gate.mjs', import.meta.url)),
                root,
            ],
            {
                encoding: 'utf8',
                timeout: 5000,
                // No credentials or repository context: rejection must precede any GitHub/Cloudflare access.
                env: { DOCS_SHA: sha, DOCS_TARGET: 'production' },
            },
        );
        assert.equal(result.status, 1);
        assert.match(result.stderr, message);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
}

test('rejects changed assets before deployment access', async () => {
    await rejectedArtifact(
        (root) =>
            writeFile(
                join(root, 'dist/index.html'),
                '<p>Changed after checks</p>',
            ),
        /Checksum mismatch: index.html/,
    );
});
test('rejects an incomplete artifact', async () => {
    await rejectedArtifact(
        (root) => rm(join(root, 'dist/index.html')),
        /Missing artifact files/,
    );
});
test('rejects links outside the artifact', async () => {
    await rejectedArtifact(
        (root) => symlink('/etc/passwd', join(root, 'dist/outside')),
        /Symlink in artifact/,
    );
});

test('rejects workspace component previews before deployment access', async () => {
    await rejectedArtifact(
        (root) =>
            writeFile(
                join(root, 'dist/deployment.json'),
                JSON.stringify({
                    commit: sha,
                    editorVersion: '1.4.0',
                    preview: false,
                    workspacePreview: true,
                }),
            ),
        /Workspace examples are local previews only/,
    );
});
