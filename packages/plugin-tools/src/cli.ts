#!/usr/bin/env node
import { argv, stderr, stdout } from 'node:process';

import { checkPluginPackage } from './plugin-check.js';
import { scaffoldPluginPackage } from './scaffold.js';
import type { PluginTemplateKind } from './scaffold.js';

try {
    const [command, target, ...flags] = argv.slice(2);
    if (command === 'create' && target !== undefined) {
        const packageName = flag(flags, '--name');
        const pluginId = flag(flags, '--id');
        const kind = optionalKind(flags);
        const directory = await scaffoldPluginPackage({
            directory: target,
            ...(kind === undefined ? {} : { kind }),
            packageName,
            pluginId,
        });
        stdout.write(`Created SoEditor plugin package at ${directory}.\n`);
    } else if (command === 'check' && target !== undefined) {
        const report = await checkPluginPackage(target, {
            packed: flags.includes('--packed'),
        });
        for (const issue of report.issues) {
            stderr.write(`[${issue.code}] ${issue.message}\n`);
        }
        stdout.write(
            `${report.valid ? 'Valid' : 'Invalid'} SoEditor plugin package${report.packageName === undefined ? '' : ` ${report.packageName}`}.\n`,
        );
        if (!report.valid) process.exitCode = 1;
    } else {
        throw new Error(
            'Usage: soeditor-plugin create <directory> --name <package> --id <plugin-id> [--kind basic|cms-widget|paste|upload|theme] | check <directory> [--packed]',
        );
    }
} catch (error: unknown) {
    stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
}

function optionalFlag(values: string[], name: string): string | undefined {
    const index = values.indexOf(name);
    return index < 0 ? undefined : values[index + 1];
}

function optionalKind(values: string[]): PluginTemplateKind | undefined {
    const value = optionalFlag(values, '--kind');
    if (value === undefined) return undefined;
    if (
        value === 'basic' ||
        value === 'cms-widget' ||
        value === 'paste' ||
        value === 'upload' ||
        value === 'theme'
    ) {
        return value;
    }
    throw new Error(`Invalid --kind "${value}".`);
}

function flag(values: string[], name: string): string {
    const index = values.indexOf(name);
    const value = index < 0 ? undefined : values[index + 1];
    if (value === undefined) throw new Error(`Missing ${name}.`);
    return value;
}
