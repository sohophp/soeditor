import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import process from 'node:process';
const root = resolve(process.argv[2]);
const preview = process.env.DOCS_TARGET === 'preview';
if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID)
    throw new Error(
        'Configure Cloudflare credentials in the GitHub environment',
    );
const cli = '/tmp/soeditor-docs-cli/node_modules/wrangler/bin/wrangler.js';
const configPath = '/tmp/soeditor-docs-wrangler.json';
const config = {
    name: preview ? 'soeditor-docs-preview' : 'soeditor-docs',
    compatibility_date: '2026-03-01',
    workers_dev: preview,
    preview_urls: preview,
    routes: preview
        ? []
        : [{ pattern: 'soeditor.sohophp.app', custom_domain: true }],
    assets: {
        directory: resolve(root, 'dist'),
        html_handling: 'auto-trailing-slash',
        not_found_handling: '404-page',
    },
};
await writeFile(configPath, JSON.stringify(config));
const headers = await readFile(resolve(root, 'dist/_headers'), 'utf8');
if (preview && !headers.includes('X-Robots-Tag: noindex, nofollow'))
    throw new Error('Preview indexing protection missing');
const api = async (path, options = {}) => {
    const response = await fetch(
        `https://api.cloudflare.com/client/v4/${path}`,
        {
            ...options,
            headers: {
                Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
                'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(20000),
        },
    );
    const data = await response.json();
    if (!response.ok || !data.success)
        throw new Error(`Cloudflare API request failed: ${response.status}`);
    return data.result;
};
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
let previous;
if (!preview) {
    const repo = process.env.GITHUB_REPOSITORY;
    const head = JSON.parse(
        execFileSync('gh', ['api', `repos/${repo}/git/ref/heads/master`], {
            encoding: 'utf8',
        }),
    ).object.sha;
    if (process.env.DOCS_ROLLBACK !== '1' && head !== process.env.DOCS_SHA)
        throw new Error('Superseded master commit');
    const zones = await api('zones?name=sohophp.app');
    if (
        zones.length !== 1 ||
        zones[0].status !== 'active' ||
        zones[0].account?.id !== account
    )
        throw new Error('Expected active sohophp.app zone');
    const domains = await api(`accounts/${account}/workers/domains`);
    const existing = domains.find(
        (domain) => domain.hostname === 'soeditor.sohophp.app',
    );
    if (existing && existing.service !== config.name)
        throw new Error('Domain belongs to another Worker');
    const records = await api(
        `zones/${zones[0].id}/dns_records?name=soeditor.sohophp.app`,
    );
    if (!existing && records.length)
        throw new Error('Existing DNS service must be reviewed before binding');
    // A missing Worker is expected on the first deployment; other API errors must stop it.
    const scripts = await api(`accounts/${account}/workers/scripts`);
    if (scripts.some((script) => script.id === config.name)) {
        const deployments = await api(
            `accounts/${account}/workers/scripts/${config.name}/deployments`,
        );
        previous = deployments.deployments?.[0]?.versions;
    }
}
if (preview) {
    const scripts = await api(`accounts/${account}/workers/scripts`);
    if (!scripts.some((script) => script.id === config.name)) {
        execFileSync(
            process.execPath,
            [cli, 'deploy', '--config', configPath],
            { stdio: 'inherit', timeout: 180000 },
        );
    }
}
const result = execFileSync(
    process.execPath,
    [
        cli,
        ...(preview ? ['versions', 'upload'] : ['deploy']),
        '--config',
        configPath,
    ],
    { encoding: 'utf8', timeout: 180000 },
);
process.stdout.write(result);
const url = preview
    ? result.match(/https:\/\/[^\s]+\.workers\.dev/)?.[0]
    : 'https://soeditor.sohophp.app';
const manifest = JSON.parse(
    await readFile(resolve(root, 'dist/deployment.json'), 'utf8'),
);
const record = {
    ...manifest,
    url,
    deployedAt: new Date().toISOString(),
    result,
    versionId: result.match(/(?:Version ID|Version):\s*([a-f0-9-]{36})/i)?.[1],
    verified: false,
    rolledBack: false,
};
try {
    if (!url) throw new Error('No preview URL returned');
    // First custom-domain certificate issuance may take a short time.
    let lastError;
    for (let attempt = 0; attempt < 12; attempt++) {
        try {
            execFileSync(
                process.execPath,
                ['docs/site/scripts/smoke.mjs', url],
                { stdio: 'pipe', timeout: 120000 },
            );
            const served = await fetch(`${url}/deployment.json`, {
                cache: 'no-store',
                signal: AbortSignal.timeout(15000),
            }).then((r) => r.json());
            if (served.commit !== manifest.commit)
                throw new Error('Served commit mismatch');
            record.verified = true;
            break;
        } catch (error) {
            lastError = error;
            await new Promise((done) => setTimeout(done, 5000));
        }
    }
    if (!record.verified) throw lastError;
} catch (error) {
    if (!preview && previous?.length) {
        await api(
            `accounts/${account}/workers/scripts/${config.name}/deployments`,
            {
                method: 'POST',
                body: JSON.stringify({
                    strategy: 'percentage',
                    versions: previous,
                }),
            },
        );
        execFileSync(
            process.execPath,
            ['docs/site/scripts/smoke.mjs', 'https://soeditor.sohophp.app'],
            { stdio: 'inherit' },
        );
        record.rolledBack = true;
    }
    throw error;
} finally {
    await writeFile(
        '/tmp/soeditor-docs-deployment.json',
        JSON.stringify(record, null, 2),
    );
    if (process.env.GITHUB_STEP_SUMMARY)
        await appendFile(
            process.env.GITHUB_STEP_SUMMARY,
            `\nSoEditor docs: ${url ?? 'no URL'}\n\nCommit: ${manifest.commit}\n\nVerified: ${record.verified}; rollback: ${record.rolledBack}\n`,
        );
}
