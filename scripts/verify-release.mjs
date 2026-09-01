import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { stdout } from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { gzipSync } from 'node:zlib';

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const rootManifest = JSON.parse(
    await readFile(join(repositoryRoot, 'package.json'), 'utf8'),
);
const releaseVersion = rootManifest.version;
const releaseLicense = rootManifest.license;
if (
    typeof releaseVersion !== 'string' ||
    !/^1\.1\.\d+$/u.test(releaseVersion)
) {
    throw new Error('The release audit only accepts an aligned 1.1.x version.');
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
    readFile(join(repositoryRoot, 'docs/migration-1.0-to-1.1.md'), 'utf8'),
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

if (publishable.length !== 24) {
    throw new Error(
        `Expected 24 publishable packages, found ${String(publishable.length)}.`,
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

const [
    umbrellaManifest,
    workspaceManifest,
    reactManifest,
    vueManifest,
    toolsManifest,
] = await Promise.all(
    ['soeditor', 'workspace', 'react', 'vue', 'plugin-tools'].map(
        async (directory) =>
            JSON.parse(
                await readFile(
                    join(packagesRoot, directory, 'package.json'),
                    'utf8',
                ),
            ),
    ),
);
if (
    umbrellaManifest.dependencies?.['@soeditor/workspace'] !== 'workspace:*' ||
    umbrellaManifest.exports?.['./cms']?.import !== './dist/cms.js' ||
    umbrellaManifest.dependencies?.react !== undefined ||
    umbrellaManifest.dependencies?.vue !== undefined ||
    umbrellaManifest.dependencies?.['@soeditor/plugin-tools'] !== undefined ||
    workspaceManifest.peerDependencies?.['@soeditor/core'] !== 'workspace:*' ||
    reactManifest.peerDependencies?.react !== '>=18.2.0 <20' ||
    reactManifest.peerDependencies?.vue !== undefined ||
    vueManifest.peerDependencies?.vue !== '^3.5.0' ||
    vueManifest.peerDependencies?.react !== undefined ||
    toolsManifest.bin?.['soeditor-plugin'] !== './dist/cli.js' ||
    toolsManifest.dependencies !== undefined
) {
    throw new Error(
        'The 1.0 Workspace, framework, tooling, or umbrella dependency boundary is invalid.',
    );
}

const umbrellaDist = join(packagesRoot, 'soeditor', 'dist');
const pluginSdkDeclarations = await readFile(
    join(packagesRoot, 'plugin-sdk', 'dist', 'index.d.ts'),
    'utf8',
);
const umbrellaDeclarations = await readFile(
    join(umbrellaDist, 'index.d.ts'),
    'utf8',
);
if (!umbrellaDeclarations.includes("export * from '@soeditor/workspace'")) {
    throw new Error('The 1.0 umbrella is missing the public Workspace export.');
}
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
const globalText = globalSource.toString('utf8');
const cssSource = await readFile(cssPath, 'utf8');
const globalRaw = (await stat(globalPath)).size;
const globalGzip = gzipSync(globalSource).length;
const cssRaw = (await stat(cssPath)).size;
const esmRaw = (await stat(esmPath)).size;

assertBudget('CMS global raw', globalRaw, 500_000);
assertBudget('CMS global gzip', globalGzip, 150_000);
assertBudget('standalone CSS', cssRaw, 27_000);
assertBudget('umbrella ESM facade', esmRaw, 2_000);
for (const excludedMarker of [
    'Developer Visual',
    'Markdown',
    'commentsServiceToken',
    'emailAnalyze',
    'emailOptimize',
    'preview.refresh',
    'revisionsServiceToken',
    'video.insert',
]) {
    if (globalText.includes(excludedMarker)) {
        throw new Error(
            `CMS global unexpectedly contains excluded product marker ${excludedMarker}.`,
        );
    }
}
for (const requiredSelector of ['.soeditor-ui', '.soeditor-table-widget']) {
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
    1_080_000,
);

stdout.write(
    [
        `Release audit passed for ${String(publishable.length)} packages at ${releaseVersion}.`,
        `CMS global: ${formatBytes(globalRaw)} raw / ${formatBytes(globalGzip)} gzip.`,
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
