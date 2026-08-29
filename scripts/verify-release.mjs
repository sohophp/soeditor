import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { stdout } from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { gzipSync } from 'node:zlib';

const releaseVersion = '0.5.0';
const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const packagesRoot = join(repositoryRoot, 'packages');
const publishable = [];
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

if (publishable.length !== 15) {
    throw new Error(
        `Expected 15 publishable packages, found ${String(publishable.length)}.`,
    );
}
if (new Set(publishable).size !== publishable.length) {
    throw new Error('Publishable package names must be unique.');
}

const umbrellaDist = join(packagesRoot, 'soeditor', 'dist');
const globalPath = join(umbrellaDist, 'soeditor.global.js');
const cssPath = join(umbrellaDist, 'soeditor.css');
const esmPath = join(umbrellaDist, 'index.js');
const globalSource = await readFile(globalPath);
const globalRaw = (await stat(globalPath)).size;
const globalGzip = gzipSync(globalSource).length;
const cssRaw = (await stat(cssPath)).size;
const esmRaw = (await stat(esmPath)).size;

assertBudget('CDN global raw', globalRaw, 1_250_000);
assertBudget('CDN global gzip', globalGzip, 410_000);
assertBudget('standalone CSS', cssRaw, 10_000);
assertBudget('umbrella ESM facade', esmRaw, 2_000);

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
    1_000_000,
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
