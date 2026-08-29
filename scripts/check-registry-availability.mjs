import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { stdout } from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath, URL } from 'node:url';

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const packagesRoot = join(repositoryRoot, 'packages');
const releaseVersion = JSON.parse(
    await readFile(join(repositoryRoot, 'package.json'), 'utf8'),
).version;

if (
    typeof releaseVersion !== 'string' ||
    !/^0\.7\.\d+$/u.test(releaseVersion)
) {
    throw new Error(
        'Registry availability checks only accept a 0.7.x release version.',
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
    packageNames.length !== 17 ||
    packageNames.some((name) => typeof name !== 'string')
) {
    throw new Error('Expected exactly 17 named public packages.');
}
if (
    !packageNames.includes('@soeditor/editor') ||
    packageNames.some((name) => !name.startsWith('@soeditor/'))
) {
    throw new Error(
        'All public packages must use the @soeditor scope and include @soeditor/editor.',
    );
}

const collisions = [];
for (const packageName of packageNames.sort()) {
    const endpoint = `https://registry.npmjs.org/${encodeURIComponent(packageName)}/${releaseVersion}`;
    const response = await fetchRegistry(endpoint);
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

async function fetchRegistry(endpoint) {
    let latestFailure = 'no response';
    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            const response = await globalThis.fetch(endpoint, {
                headers: { accept: 'application/json' },
                signal: globalThis.AbortSignal.timeout(15_000),
            });
            if (response.status !== 429 && response.status < 500) {
                return response;
            }
            latestFailure = `HTTP ${String(response.status)}`;
        } catch (error) {
            latestFailure = error instanceof Error ? error.message : 'unknown';
        }
        if (attempt < 2) await delay(2_000);
    }
    throw new Error(
        `npm registry availability check failed for ${endpoint} (${latestFailure}).`,
    );
}
