import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { stdout } from 'node:process';
import { fileURLToPath, URL } from 'node:url';

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const docsRoot = join(repositoryRoot, 'docs');
const requiredDocuments = [
    'api-overview.md',
    'api-report.md',
    'cms-plugin-ecosystem.md',
    'deployment-operations.md',
    'getting-started.md',
    'migration-0.5-to-0.6.md',
    'migration-0.6-to-0.7.md',
    'migration-0.7-to-0.8.md',
    'migration-0.8-to-0.9.md',
    'migration-0.9-to-1.0.md',
    'qualification.md',
    'security.md',
    'support-policy.md',
    'troubleshooting.md',
];
const evidenceFiles = [
    'comments.spec.ts',
    'developer-tools.spec.ts',
    'diagnostics-configuration.spec.ts',
    'distribution.spec.ts',
    'editor-ui.spec.ts',
    'file-manager.spec.ts',
    'framework-adapters.spec.ts',
    'markdown.spec.ts',
    'media.spec.ts',
    'node-views.spec.ts',
    'qualification.spec.ts',
    'release-hardening.spec.ts',
    'revisions.spec.ts',
    'split-view.spec.ts',
    'table.spec.ts',
    'visual-editing.spec.ts',
    'workspace.spec.ts',
];

for (const document of requiredDocuments) {
    await access(join(docsRoot, document));
}
for (const evidence of evidenceFiles) {
    await access(join(repositoryRoot, 'tests', 'browser', evidence));
}

const markdownFiles = [join(repositoryRoot, 'README.md')];
for (const name of await readdir(docsRoot)) {
    if (name.endsWith('.md')) markdownFiles.push(join(docsRoot, name));
}
for (const packageName of await readdir(join(repositoryRoot, 'packages'))) {
    const readme = join(repositoryRoot, 'packages', packageName, 'README.md');
    try {
        await access(readme);
        markdownFiles.push(readme);
    } catch {
        // A package README is recommended but not an implicit public contract.
    }
}

const broken = [];
for (const file of markdownFiles) {
    const content = await readFile(file, 'utf8');
    for (const match of content.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/gu)) {
        const rawTarget = match[1]?.trim();
        if (
            rawTarget === undefined ||
            rawTarget.startsWith('#') ||
            /^[a-z][a-z\d+.-]*:/iu.test(rawTarget)
        ) {
            continue;
        }
        const target = rawTarget
            .replace(/^<|>$/gu, '')
            .split('#', 1)[0]
            ?.split('?', 1)[0];
        if (target === undefined || target.length === 0) continue;
        try {
            await access(resolve(dirname(file), decodeURIComponent(target)));
        } catch {
            broken.push(`${relative(repositoryRoot, file)} -> ${rawTarget}`);
        }
    }
}
if (broken.length > 0) {
    throw new Error(`Broken local documentation links:\n${broken.join('\n')}`);
}

const qualification = await readFile(
    join(docsRoot, 'qualification.md'),
    'utf8',
);
for (const evidence of evidenceFiles) {
    if (!qualification.includes(evidence)) {
        throw new Error(
            `Qualification evidence does not reference ${evidence}.`,
        );
    }
}

let browserScenarios = 0;
for (const name of await readdir(join(repositoryRoot, 'tests', 'browser'))) {
    if (!name.endsWith('.spec.ts')) continue;
    const content = await readFile(
        join(repositoryRoot, 'tests', 'browser', name),
        'utf8',
    );
    browserScenarios += content.match(/^test\s*\(/gmu)?.length ?? 0;
}
if (browserScenarios !== 202) {
    throw new Error(
        `Expected 202 documented Chromium scenarios, found ${String(browserScenarios)}.`,
    );
}

const rootReadme = await readFile(join(repositoryRoot, 'README.md'), 'utf8');
for (const document of [
    'api-overview.md',
    'deployment-operations.md',
    'migration-0.9-to-1.0.md',
    'qualification.md',
    'security.md',
    'troubleshooting.md',
]) {
    if (!rootReadme.includes(document)) {
        throw new Error(`README does not link to docs/${document}.`);
    }
}

stdout.write(
    `Documentation audit passed for ${String(markdownFiles.length)} current files and ${String(browserScenarios)} Chromium scenarios.\n`,
);
