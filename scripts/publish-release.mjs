import { execFileSync } from 'node:child_process';
import { argv } from 'node:process';

const options = parseOptions(argv.slice(2));
const publicationArguments = [
    '--access',
    'public',
    '--no-git-checks',
    ...(options.dryRun ? ['--dry-run'] : ['--provenance']),
    '--tag',
    options.tag,
];

publish(['--filter', '@soeditor/editor', 'publish', ...publicationArguments]);
publish([
    '--filter',
    './packages/**',
    '--filter',
    '!@soeditor/editor',
    '-r',
    'publish',
    ...publicationArguments,
]);

function publish(arguments_) {
    execFileSync('pnpm', arguments_, { stdio: 'inherit' });
}

function parseOptions(arguments_) {
    let dryRun = false;
    let tag = 'latest';
    for (let index = 0; index < arguments_.length; index += 1) {
        const argument = arguments_[index];
        if (argument === '--dry-run') {
            dryRun = true;
        } else if (argument === '--tag') {
            const value = arguments_[index + 1];
            if (value !== 'latest' && value !== 'next') {
                throw new TypeError('Release tag must be latest or next.');
            }
            tag = value;
            index += 1;
        } else {
            throw new TypeError(
                `Unknown release publication option: ${argument}`,
            );
        }
    }
    return { dryRun, tag };
}
