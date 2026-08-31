import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { stdout } from 'node:process';
import { fileURLToPath, URL } from 'node:url';

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const packagesRoot = join(repositoryRoot, 'packages');
const packageNames = await readdir(packagesRoot);

for (const directory of packageNames) {
    const packageRoot = join(packagesRoot, directory);
    const manifestPath = join(packageRoot, 'package.json');
    let manifest;
    try {
        manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    } catch (error) {
        if (error?.code === 'ENOENT') continue;
        throw error;
    }
    if (manifest.private === true) continue;
    if (manifest.type !== 'module' || manifest.sideEffects === undefined) {
        throw new Error(`${manifest.name} must declare ESM and sideEffects.`);
    }
    if (!Array.isArray(manifest.files) || !manifest.files.includes('dist')) {
        throw new Error(`${manifest.name} must publish only explicit files.`);
    }
    for (const target of exportTargets(manifest.exports)) {
        await stat(join(packageRoot, target));
    }
    const distRoot = join(packageRoot, 'dist');
    for (const file of await readdir(distRoot)) {
        if (file.endsWith('.js') || file.endsWith('.d.ts')) {
            await stat(join(distRoot, `${file}.map`));
        }
    }
}

const umbrellaRoot = join(packagesRoot, 'soeditor', 'dist');
const globalBundle = await readFile(
    join(umbrellaRoot, 'soeditor.global.js'),
    'utf8',
);
if (
    globalBundle.length > 2_250_000 ||
    !globalBundle.includes('sourceMappingURL')
) {
    throw new Error(
        'CDN bundle exceeds its review guard or lacks a source map.',
    );
}
const minimalEntry = await readFile(
    join(packagesRoot, 'presets', 'dist', 'minimal.js'),
    'utf8',
);
for (const unrelated of ['@soeditor/dev-tools', '@soeditor/markdown']) {
    if (minimalEntry.includes(unrelated)) {
        throw new Error(`Minimal preset unexpectedly imports ${unrelated}.`);
    }
}

stdout.write(
    `Distribution artifact audit passed for ${String(packageNames.length)} package directories.\n`,
);

function exportTargets(value) {
    if (typeof value === 'string') return [value];
    if (typeof value !== 'object' || value === null) return [];
    return Object.values(value).flatMap(exportTargets);
}
