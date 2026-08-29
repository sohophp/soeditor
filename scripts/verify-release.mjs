import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { stdout } from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { gzipSync } from 'node:zlib';

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const workspaceManifest = JSON.parse(
    await readFile(join(repositoryRoot, 'package.json'), 'utf8'),
);
const releaseVersion = workspaceManifest.version;
const releaseLicense = workspaceManifest.license;
if (
    typeof releaseVersion !== 'string' ||
    !/^0\.8\.\d+$/u.test(releaseVersion)
) {
    throw new Error('The release audit only accepts an aligned 0.8.x version.');
}
const packagesRoot = join(repositoryRoot, 'packages');
const publishable = [];
const [
    changelog,
    dataGovernanceGuide,
    migrationGuide,
    releaseGuide,
    statusDocument,
] = await Promise.all([
    readFile(join(repositoryRoot, 'CHANGELOG.md'), 'utf8'),
    readFile(join(repositoryRoot, 'docs/review-data-governance.md'), 'utf8'),
    readFile(join(repositoryRoot, 'docs/migration-0.7-to-0.8.md'), 'utf8'),
    readFile(join(repositoryRoot, 'docs/releasing.md'), 'utf8'),
    readFile(join(repositoryRoot, 'docs/status.md'), 'utf8'),
]);
for (const [label, source, marker] of [
    ['changelog', changelog, `## ${releaseVersion}`],
    ['data governance guide', dataGovernanceGuide, '`comments.erase(id)`'],
    ['migration guide', migrationGuide, `\`${releaseVersion}\``],
    [
        'release guide',
        releaseGuide,
        `release:verify-registry ${releaseVersion}`,
    ],
    ['status', statusDocument, `\`${releaseVersion}\` release`],
]) {
    if (!source.includes(marker)) {
        throw new Error(
            `The ${label} is not synchronized with ${releaseVersion}.`,
        );
    }
}
const changesetConfiguration = JSON.parse(
    await readFile(join(repositoryRoot, '.changeset/config.json'), 'utf8'),
);
if (changesetConfiguration.access !== 'public') {
    throw new Error('Changesets must preserve public npm package access.');
}

for (const directory of await readdir(packagesRoot)) {
    const packageRoot = join(packagesRoot, directory);
    let manifest;
    try {
        manifest = JSON.parse(
            await readFile(join(packageRoot, 'package.json'), 'utf8'),
        );
    } catch (error) {
        if (error?.code === 'ENOENT') continue;
        throw error;
    }
    if (manifest.private === true) continue;
    publishable.push(manifest.name);
    await stat(join(packageRoot, 'README.md'));
    if (manifest.version !== releaseVersion) {
        throw new Error(
            `${manifest.name} must use release version ${releaseVersion}.`,
        );
    }
    if (
        manifest.repository?.url !==
            'git+https://github.com/sohophp/soeditor.git' ||
        manifest.license !== releaseLicense ||
        manifest.repository?.directory !== `packages/${directory}` ||
        manifest.homepage !== 'https://github.com/sohophp/soeditor#readme' ||
        manifest.bugs?.url !== 'https://github.com/sohophp/soeditor/issues' ||
        manifest.engines?.node !== '>=22.14.0 <23' ||
        manifest.publishConfig?.access !== 'public' ||
        manifest.publishConfig?.provenance !== true ||
        manifest.publishConfig?.registry !== 'https://registry.npmjs.org/'
    ) {
        throw new Error(`${manifest.name} has incomplete release metadata.`);
    }
    for (const [key, value] of Object.entries(manifest.exports ?? {})) {
        if (key.includes('*')) {
            throw new Error(`${manifest.name} has a wildcard public export.`);
        }
        for (const target of exportTargets(value)) {
            if (
                target.includes('/src/') ||
                target.includes('/internal/') ||
                !target.startsWith('./dist/')
            ) {
                throw new Error(
                    `${manifest.name} exposes a non-release target: ${target}.`,
                );
            }
        }
    }
}

if (publishable.length !== 19) {
    throw new Error(
        `Expected 19 publishable packages, found ${String(publishable.length)}.`,
    );
}
if (new Set(publishable).size !== publishable.length) {
    throw new Error('Publishable package names must be unique.');
}
if (
    !publishable.includes('@soeditor/editor') ||
    publishable.some((name) => !name.startsWith('@soeditor/'))
) {
    throw new Error(
        'All public packages must use the @soeditor scope and include @soeditor/editor.',
    );
}

const umbrellaDist = join(packagesRoot, 'soeditor', 'dist');
const pluginSdkDeclarations = await readFile(
    join(packagesRoot, 'plugin-sdk', 'dist', 'index.d.ts'),
    'utf8',
);
for (const contract of [
    'CommentDataExport',
    'CommentStorageAdapter',
    'RevisionDataExport',
    'RevisionStorage',
    'StructuredBlockConversion',
    'StructuredNodeViewFactory',
    'VisualEditingService',
    'commentsServiceToken',
    'revisionsServiceToken',
    'visualEditingServiceToken',
]) {
    if (!pluginSdkDeclarations.includes(contract)) {
        throw new Error(
            `The curated plugin SDK is missing required contract ${contract}.`,
        );
    }
}
const globalPath = join(umbrellaDist, 'soeditor.global.js');
const cssPath = join(umbrellaDist, 'soeditor.css');
const esmPath = join(umbrellaDist, 'index.js');
const globalSource = await readFile(globalPath);
const cssSource = await readFile(cssPath, 'utf8');
const globalRaw = (await stat(globalPath)).size;
const globalGzip = gzipSync(globalSource).length;
const cssRaw = (await stat(cssPath)).size;
const esmRaw = (await stat(esmPath)).size;

assertBudget('CDN global raw', globalRaw, 1_350_000);
assertBudget('CDN global gzip', globalGzip, 430_000);
assertBudget('standalone CSS', cssRaw, 10_000);
assertBudget('umbrella ESM facade', esmRaw, 2_000);
for (const requiredSelector of ['.soeditor-split-view', '.soeditor-ui']) {
    if (!cssSource.includes(requiredSelector)) {
        throw new Error(
            `Standalone CSS is missing required selector ${requiredSelector}.`,
        );
    }
}

const playgroundAssets = join(repositoryRoot, 'apps/playground/dist/assets');
const playgroundJavaScript = (
    await Promise.all(
        (await readdir(playgroundAssets))
            .filter((name) => name.endsWith('.js'))
            .map(async (name) => ({
                name,
                size: (await stat(join(playgroundAssets, name))).size,
            })),
    )
).sort((left, right) => right.size - left.size);
const largestPlaygroundChunk = playgroundJavaScript[0];
if (largestPlaygroundChunk === undefined) {
    throw new Error('Playground build has no JavaScript output.');
}
assertBudget(
    'largest Playground chunk',
    largestPlaygroundChunk.size,
    1_040_000,
);

stdout.write(
    [
        `Release audit passed for ${String(publishable.length)} packages at ${releaseVersion}.`,
        `CDN global: ${formatBytes(globalRaw)} raw / ${formatBytes(globalGzip)} gzip.`,
        `Standalone CSS: ${formatBytes(cssRaw)}; ESM facade: ${formatBytes(esmRaw)}.`,
        `Largest Playground chunk: ${largestPlaygroundChunk.name} (${formatBytes(largestPlaygroundChunk.size)}).`,
        '',
    ].join('\n'),
);

function assertBudget(label, actual, maximum) {
    if (actual > maximum) {
        throw new Error(
            `${label} exceeds its release budget: ${formatBytes(actual)} > ${formatBytes(maximum)}.`,
        );
    }
}

function exportTargets(value) {
    if (typeof value === 'string') return [value];
    if (typeof value !== 'object' || value === null) return [];
    return Object.values(value).flatMap(exportTargets);
}

function formatBytes(bytes) {
    return `${(bytes / 1_000).toFixed(2)} kB`;
}
