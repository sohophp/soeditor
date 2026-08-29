import { access, readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { stdout } from 'node:process';
import { fileURLToPath, URL } from 'node:url';

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const packagesRoot = join(repositoryRoot, 'packages');
const licenseFiles = ['LICENSE', 'LICENSE.md', 'LICENSE.txt'];
const presentLicenseFiles = [];

for (const filename of licenseFiles) {
    try {
        await access(join(repositoryRoot, filename));
        presentLicenseFiles.push(filename);
    } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
    }
}

if (presentLicenseFiles.length !== 1) {
    throw new Error(
        'A release requires exactly one owner-approved LICENSE, LICENSE.md, or LICENSE.txt file.',
    );
}
const licenseText = await readFile(
    join(repositoryRoot, presentLicenseFiles[0]),
    'utf8',
);
if (licenseText.trim().length === 0) {
    throw new Error('The owner-approved license file must not be empty.');
}

const rootManifest = JSON.parse(
    await readFile(join(repositoryRoot, 'package.json'), 'utf8'),
);
const approvedLicense = rootManifest.license;
if (
    typeof approvedLicense !== 'string' ||
    approvedLicense.trim().length === 0 ||
    approvedLicense === 'UNLICENSED'
) {
    throw new Error(
        'The root package must declare the owner-approved npm license expression.',
    );
}

let publicPackageCount = 0;
for (const directory of await readdir(packagesRoot)) {
    const manifest = JSON.parse(
        await readFile(join(packagesRoot, directory, 'package.json'), 'utf8'),
    );
    if (manifest.private === true) continue;
    publicPackageCount += 1;
    if (manifest.license !== approvedLicense) {
        throw new Error(
            `${String(manifest.name)} must declare license ${approvedLicense}.`,
        );
    }
}

if (publicPackageCount !== 19) {
    throw new Error(
        `Expected 19 public package licenses, found ${String(publicPackageCount)}.`,
    );
}

stdout.write(
    `Release license metadata passed for ${String(publicPackageCount)} packages (${approvedLicense}; ${presentLicenseFiles[0]}).\n`,
);
