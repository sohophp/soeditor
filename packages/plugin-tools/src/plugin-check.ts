import { execFile } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

const execute = promisify(execFile);

export interface PluginCheckOptions {
    readonly packed?: boolean;
}

export interface PluginCheckIssue {
    readonly code: string;
    readonly message: string;
}

export interface PluginCheckReport {
    readonly issues: readonly PluginCheckIssue[];
    readonly packageName: string | undefined;
    readonly pluginIds: readonly string[];
    readonly valid: boolean;
}

/** Audits a plugin package without importing or executing its source. */
export async function checkPluginPackage(
    directory: string,
    options: PluginCheckOptions = {},
): Promise<PluginCheckReport> {
    const root = resolve(directory);
    const issues: PluginCheckIssue[] = [];
    const manifest = await jsonRecord(resolve(root, 'package.json'), issues);
    checkManifest(manifest, issues);
    const sourceFiles = await sourcePaths(resolve(root, 'src'));
    const sources = await Promise.all(
        sourceFiles.map(async (path) => ({
            path,
            source: await readFile(path, 'utf8'),
        })),
    );
    const pluginIds = sources.flatMap(({ source }) =>
        [
            ...source.matchAll(
                /static\s+readonly\s+id\s*=\s*['"]([^'"]+)['"]/gu,
            ),
        ].map((match) => match[1]!),
    );
    if (pluginIds.length === 0) {
        issue(
            issues,
            'PLUGIN_ID_MISSING',
            'No static readonly plugin ID was found.',
        );
    }
    const duplicates = pluginIds.filter(
        (id, index) => pluginIds.indexOf(id) !== index,
    );
    for (const id of pluginIds) {
        if (!/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/u.test(id)) {
            issue(
                issues,
                'PLUGIN_ID_FORMAT',
                `Plugin ID "${id}" must use lowercase letters, numbers, dots, underscores, or hyphens.`,
            );
        }
    }
    for (const id of new Set(duplicates)) {
        issue(
            issues,
            'PLUGIN_ID_DUPLICATE',
            `Plugin ID "${id}" is duplicated.`,
        );
    }
    for (const { path, source } of sources) {
        if (
            /['"]@soeditor\/[^/'"]+\/(?:src|dist|internal)(?:\/[^'"]*)?['"]/u.test(
                source,
            )
        ) {
            issue(
                issues,
                'INTERNAL_IMPORT',
                `${path} imports an unsupported SoEditor internal path.`,
            );
        }
    }
    if (
        !sources.some(({ source }) =>
            /from\s+['"]@soeditor\/plugin-sdk['"]/u.test(source),
        )
    ) {
        issue(
            issues,
            'SDK_CONTRIBUTION_MISSING',
            'Plugin source must consume contributions from the public @soeditor/plugin-sdk root.',
        );
    }
    const rootSource = sources.find(({ path }) =>
        path.endsWith('/src/index.ts'),
    )?.source;
    if (rootSource === undefined || !/export\s+\{/u.test(rootSource)) {
        issue(
            issues,
            'ROOT_EXPORT_MISSING',
            'src/index.ts must explicitly export the plugin contribution.',
        );
    }
    if (options.packed === true) await checkPacked(root, issues);
    return Object.freeze({
        issues: Object.freeze(issues.map((value) => Object.freeze(value))),
        packageName:
            typeof manifest.name === 'string' ? manifest.name : undefined,
        pluginIds: Object.freeze(pluginIds),
        valid: issues.length === 0,
    });
}

function checkManifest(
    manifest: Record<string, unknown>,
    issues: PluginCheckIssue[],
): void {
    if (typeof manifest.name !== 'string' || manifest.name.length === 0) {
        issue(issues, 'MANIFEST_NAME', 'package.json requires a package name.');
    }
    if (
        typeof manifest.version !== 'string' ||
        !/^\d+\.\d+\.\d+(?:-|$)/u.test(manifest.version)
    ) {
        issue(
            issues,
            'MANIFEST_VERSION',
            'package.json requires a SemVer version.',
        );
    }
    if (manifest.type !== 'module') {
        issue(issues, 'ESM_REQUIRED', 'Plugin packages must use type: module.');
    }
    if (manifest.sideEffects !== false) {
        issue(
            issues,
            'TREE_SHAKING',
            'Plugin packages must declare sideEffects: false.',
        );
    }
    const exports = record(manifest.exports);
    const rootExport = record(exports['.']);
    if (
        typeof rootExport.import !== 'string' ||
        !rootExport.import.startsWith('./dist/') ||
        typeof rootExport.types !== 'string' ||
        !rootExport.types.startsWith('./dist/')
    ) {
        issue(
            issues,
            'EXPORT_MAP',
            'The package root must expose dist import and types entries.',
        );
    }
    const peers = record(manifest.peerDependencies);
    const sdkRange = peers['@soeditor/plugin-sdk'];
    if (
        typeof sdkRange !== 'string' ||
        !/(?:\^0\.9\.|>=\s*0\.9\.)/u.test(sdkRange)
    ) {
        issue(
            issues,
            'SDK_PEER_RANGE',
            'Declare @soeditor/plugin-sdk as a compatible peer dependency.',
        );
    }
}

async function checkPacked(
    root: string,
    issues: PluginCheckIssue[],
): Promise<void> {
    try {
        const { stdout } = await execute(
            'npm',
            ['pack', '--dry-run', '--ignore-scripts', '--json'],
            { cwd: root, encoding: 'utf8', maxBuffer: 2_000_000 },
        );
        const result: unknown = JSON.parse(stdout);
        const entry = Array.isArray(result) ? record(result[0]) : {};
        const files = Array.isArray(entry.files)
            ? entry.files.flatMap((value) => {
                  const path = record(value).path;
                  return typeof path === 'string' ? [path] : [];
              })
            : [];
        for (const required of [
            'dist/index.js',
            'dist/index.d.ts',
            'package.json',
        ]) {
            if (!files.includes(required)) {
                issue(
                    issues,
                    'PACKED_FILE_MISSING',
                    `Packed artifact is missing ${required}.`,
                );
            }
        }
        if (files.some((path) => path.startsWith('src/'))) {
            issue(
                issues,
                'PACKED_SOURCE',
                'Packed artifact must not expose src files.',
            );
        }
    } catch (error: unknown) {
        issue(
            issues,
            'PACK_FAILED',
            `Unable to inspect packed artifact: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
}

async function sourcePaths(directory: string): Promise<string[]> {
    let entries;
    try {
        entries = await readdir(directory, { withFileTypes: true });
    } catch {
        return [];
    }
    const paths = await Promise.all(
        entries.map(async (entry) => {
            const path = resolve(directory, entry.name);
            return entry.isDirectory()
                ? sourcePaths(path)
                : /\.[cm]?tsx?$/u.test(entry.name)
                  ? [path]
                  : [];
        }),
    );
    return paths.flat().sort();
}

async function jsonRecord(
    path: string,
    issues: PluginCheckIssue[],
): Promise<Record<string, unknown>> {
    try {
        return record(JSON.parse(await readFile(path, 'utf8')));
    } catch (error: unknown) {
        issue(
            issues,
            'MANIFEST_READ',
            `Unable to read package.json: ${error instanceof Error ? error.message : String(error)}`,
        );
        return {};
    }
}

function record(value: unknown): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return {};
    }
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value)) result[key] = Reflect.get(value, key);
    return result;
}

function issue(
    issues: PluginCheckIssue[],
    code: string,
    message: string,
): void {
    issues.push(Object.freeze({ code, message }));
}
