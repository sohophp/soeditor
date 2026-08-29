import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { stdout } from 'node:process';
import { fileURLToPath, URL } from 'node:url';

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const packagesRoot = join(repositoryRoot, 'packages');
const releaseVersion = JSON.parse(
    await readFile(join(repositoryRoot, 'package.json'), 'utf8'),
).version;

if (
    typeof releaseVersion !== 'string' ||
    !/^0\.5\.\d+$/u.test(releaseVersion)
) {
    throw new Error(
        'Registry availability checks only accept a 0.5.x release version.',
    );
}

const packageNames = [];
for (const directory of await readdir(packagesRoot)) {
    const manifest = JSON.parse(
        await readFile(join(packagesRoot, directory, 'package.json'), 'utf8'),
    );
    if (manifest.private !== true) {
        if (manifest.version !== releaseVersion) {
            throw new Error(
                `${String(manifest.name)} is not aligned at ${releaseVersion}.`,
            );
        }
        packageNames.push(manifest.name);
    }
}

if (
    packageNames.length !== 15 ||
    packageNames.some((name) => typeof name !== 'string')
) {
    throw new Error('Expected exactly 15 named public packages.');
}

const collisions = [];
for (const packageName of packageNames.sort()) {
    const endpoint = `https://registry.npmjs.org/${encodeURIComponent(packageName)}/${releaseVersion}`;
    const response = await globalThis.fetch(endpoint, {
        headers: { accept: 'application/json' },
        signal: globalThis.AbortSignal.timeout(15_000),
    });
    if (response.ok) {
        collisions.push(`${packageName}@${releaseVersion}`);
    } else if (response.status !== 404) {
        throw new Error(
            `npm registry returned ${String(response.status)} for ${packageName}@${releaseVersion}.`,
        );
    }
}

if (collisions.length > 0) {
    throw new Error(
        `Refusing a partial or duplicate publication; these versions already exist: ${collisions.join(', ')}.`,
    );
}

stdout.write(
    `All ${String(packageNames.length)} package versions are unpublished at ${releaseVersion}.\n`,
);
