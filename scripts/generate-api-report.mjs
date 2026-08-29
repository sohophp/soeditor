import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { argv, stdout } from 'node:process';
import { fileURLToPath, URL } from 'node:url';

import ts from 'typescript';
import { format } from 'prettier';

import {
    apiClassifications,
    classifyApiExport,
} from './api-classifications.mjs';

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const packagesRoot = join(repositoryRoot, 'packages');
const reportPath = join(repositoryRoot, 'docs', 'api-report.md');
const checkOnly = argv.includes('--check');

function hash(content) {
    return createHash('sha256')
        .update(content.replaceAll('\r\n', '\n'))
        .digest('hex');
}

async function listDeclarationFiles(directory) {
    const files = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...(await listDeclarationFiles(path)));
        } else if (entry.isFile() && entry.name.endsWith('.d.ts')) {
            files.push(path);
        }
    }
    return files.sort();
}

async function hashDeclarationTree(directory) {
    const dist = join(directory, 'dist');
    const files = await listDeclarationFiles(dist).catch(() => []);
    if (files.length === 0) {
        throw new Error(
            `No declaration files found below ${relative(repositoryRoot, dist)}.`,
        );
    }
    const contents = [];
    for (const file of files) {
        contents.push(relative(dist, file), await readFile(file, 'utf8'));
    }
    return hash(contents.join('\n'));
}

function isConditionalExport(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getTypesTarget(exportValue) {
    if (!isConditionalExport(exportValue)) return undefined;
    return typeof exportValue.types === 'string'
        ? exportValue.types
        : undefined;
}

function getImportTarget(exportValue) {
    if (typeof exportValue === 'string') return exportValue;
    if (!isConditionalExport(exportValue)) return undefined;
    return typeof exportValue.import === 'string'
        ? exportValue.import
        : undefined;
}

function getSymbolKind(checker, symbol) {
    const target =
        (symbol.flags & ts.SymbolFlags.Alias) === 0
            ? symbol
            : checker.getAliasedSymbol(symbol);
    const hasType = (target.flags & ts.SymbolFlags.Type) !== 0;
    const hasValue = (target.flags & ts.SymbolFlags.Value) !== 0;
    if (hasType && hasValue) return 'type/value';
    if (hasValue) return 'value';
    if (hasType) return 'type';
    return 'namespace';
}

function getSymbolDeclarationHash(checker, symbol) {
    const target =
        (symbol.flags & ts.SymbolFlags.Alias) === 0
            ? symbol
            : checker.getAliasedSymbol(symbol);
    const declarations = target.getDeclarations() ?? [];
    const content = declarations
        .map((declaration) => declaration.getText(declaration.getSourceFile()))
        .sort()
        .join('\n');
    return hash(
        content.length === 0
            ? `${target.name}:${String(target.flags)}`
            : content,
    );
}

const packages = [];
for (const directory of await readdir(packagesRoot)) {
    const manifestPath = join(packagesRoot, directory, 'package.json');
    let manifest;
    try {
        manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    } catch {
        continue;
    }
    if (manifest.private === true) continue;
    if (
        typeof manifest.name !== 'string' ||
        !isConditionalExport(manifest.exports)
    ) {
        throw new Error(`Invalid public package manifest: ${manifestPath}`);
    }
    packages.push({
        declarationTreeHash: await hashDeclarationTree(
            join(packagesRoot, directory),
        ),
        directory,
        manifest,
    });
}
packages.sort((left, right) =>
    left.manifest.name.localeCompare(right.manifest.name),
);

if (packages.length !== 23) {
    throw new Error(
        `Expected 23 public packages, found ${String(packages.length)}.`,
    );
}

const declarationEntries = [];
for (const packageEntry of packages) {
    for (const [subpath, exportValue] of Object.entries(
        packageEntry.manifest.exports,
    )) {
        const typesTarget = getTypesTarget(exportValue);
        if (typesTarget === undefined) continue;
        declarationEntries.push({
            entry: subpath,
            file: resolve(packagesRoot, packageEntry.directory, typesTarget),
            package: packageEntry.manifest.name,
        });
    }
}

const program = ts.createProgram(
    declarationEntries.map(({ file }) => file),
    {
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        skipLibCheck: true,
        target: ts.ScriptTarget.ES2022,
    },
);
const checker = program.getTypeChecker();
const diagnostics = ts.getPreEmitDiagnostics(program);
if (diagnostics.length > 0) {
    throw new Error(
        ts.formatDiagnosticsWithColorAndContext(diagnostics, {
            getCanonicalFileName: (file) => file,
            getCurrentDirectory: () => repositoryRoot,
            getNewLine: () => '\n',
        }),
    );
}

const reportEntries = [];
const totals = { deprecated: 0, experimental: 0, stable: 0 };
const exportedNames = new Set();
for (const declarationEntry of declarationEntries) {
    const sourceFile = program.getSourceFile(declarationEntry.file);
    const moduleSymbol =
        sourceFile === undefined
            ? undefined
            : checker.getSymbolAtLocation(sourceFile);
    if (sourceFile === undefined || moduleSymbol === undefined) {
        throw new Error(
            `Cannot inspect ${relative(repositoryRoot, declarationEntry.file)}. Run pnpm build first.`,
        );
    }
    const symbols = checker
        .getExportsOfModule(moduleSymbol)
        .map((symbol) => {
            exportedNames.add(symbol.name);
            const classification = classifyApiExport(symbol.name);
            totals[classification] += 1;
            return {
                classification,
                declarationHash: getSymbolDeclarationHash(checker, symbol),
                kind: getSymbolKind(checker, symbol),
                name: symbol.name,
            };
        })
        .sort((left, right) => left.name.localeCompare(right.name));
    reportEntries.push({
        ...declarationEntry,
        declarationHash: hash(await readFile(declarationEntry.file, 'utf8')),
        symbols,
    });
}

for (const [classification, names] of [
    ['deprecated', apiClassifications.deprecatedNames],
    ['experimental', apiClassifications.experimentalNames],
]) {
    for (const name of names) {
        if (!exportedNames.has(name)) {
            throw new Error(
                `The ${classification} API classification for "${name}" does not match an exported symbol.`,
            );
        }
    }
}

const lines = [
    '# SoEditor public API report',
    '',
    '> Generated by `pnpm api:report`. Do not edit manually.',
    '',
    'This report freezes every declared TypeScript package entry point. A changed',
    'symbol list or declaration hash requires explicit API review. CSS exports and',
    'CLI bins are listed as stable resources. Undeclared `src`/`dist` subpaths and',
    'implementation modules are internal even when present in a checkout or tarball.',
    '',
    `Summary: ${String(packages.length)} packages; ${String(totals.stable)} stable, ${String(totals.experimental)} experimental, and ${String(totals.deprecated)} deprecated symbol entries.`,
    '',
];

for (const packageEntry of packages) {
    lines.push(
        `## ${packageEntry.manifest.name}`,
        '',
        `Declaration tree SHA-256: \`${packageEntry.declarationTreeHash}\``,
        '',
    );
    const packageReports = reportEntries.filter(
        (entry) => entry.package === packageEntry.manifest.name,
    );
    for (const [subpath, exportValue] of Object.entries(
        packageEntry.manifest.exports,
    )) {
        const declaration = packageReports.find(
            (entry) => entry.entry === subpath,
        );
        const importTarget = getImportTarget(exportValue);
        if (declaration === undefined) {
            lines.push(
                `- \`${subpath}\` — stable resource (${importTarget ?? 'declared asset'})`,
            );
            continue;
        }
        lines.push(
            `### ${subpath}`,
            '',
            `Declaration SHA-256: \`${declaration.declarationHash}\``,
            '',
            '| Export | Kind | Classification | Signature SHA-256 |',
            '| ------ | ---- | -------------- | ---------------- |',
        );
        for (const symbol of declaration.symbols) {
            lines.push(
                `| \`${symbol.name}\` | ${symbol.kind} | ${symbol.classification} | \`${symbol.declarationHash.slice(0, 16)}\` |`,
            );
        }
        lines.push('');
    }
    const bins = packageEntry.manifest.bin;
    if (isConditionalExport(bins)) {
        for (const [name, target] of Object.entries(bins)) {
            lines.push(`- bin \`${name}\` — stable CLI (${String(target)})`);
        }
        lines.push('');
    }
}

const report = await format(`${lines.join('\n').trimEnd()}\n`, {
    parser: 'markdown',
    proseWrap: 'always',
    tabWidth: 4,
});
if (checkOnly) {
    const current = await readFile(reportPath, 'utf8').catch(() => '');
    if (current !== report) {
        throw new Error(
            `Public API report is stale. Run pnpm api:report and review ${relative(repositoryRoot, reportPath)}.`,
        );
    }
    stdout.write('Public API report matches all 23 package entry points.\n');
} else {
    await writeFile(reportPath, report);
    stdout.write(`Updated ${relative(repositoryRoot, reportPath)}.\n`);
}
