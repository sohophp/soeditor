import { spawnSync, spawn } from 'node:child_process';
import process from 'node:process';
const examples = spawnSync(
    process.execPath,
    ['scripts/build.mjs', '--examples-only'],
    { stdio: 'inherit' },
);
if (examples.status !== 0) process.exit(examples.status ?? 1);
const server = spawn(
    'pnpm',
    ['exec', 'vitepress', 'dev', '.', ...process.argv.slice(2)],
    { stdio: 'inherit' },
);
server.on('exit', (code) => process.exit(code ?? 0));
