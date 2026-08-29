import {
    createServiceToken,
    EditorDestroyedError,
    Plugin,
} from '@soeditor/core';

import { DiagnosticsPlugin, diagnosticsServiceToken } from './diagnostics.js';

/** Deliberately narrow HTML formatting options owned by SoEditor. */
export interface HtmlFormattingOptions {
    readonly printWidth?: number;
    readonly tabWidth?: number;
    readonly useTabs?: boolean;
    readonly singleAttributePerLine?: boolean;
    readonly htmlWhitespaceSensitivity?: 'css' | 'strict' | 'ignore';
}

/** UI-independent HTML formatting capability. */
export interface HtmlFormattingService {
    format(source: string, options?: HtmlFormattingOptions): Promise<string>;
}

/** Typed identity of the HTML formatting capability. */
export const htmlFormattingServiceToken =
    createServiceToken<HtmlFormattingService>('soeditor.html-formatting');

/** Reports source that must be repaired before deliberate formatting. */
export class InvalidHtmlFormattingSourceError extends Error {
    constructor() {
        super('HTML source has parser errors and cannot be formatted safely.');
        this.name = 'InvalidHtmlFormattingSourceError';
    }
}

/** Reports a document change that raced an asynchronous format operation. */
export class StaleHtmlFormattingError extends Error {
    constructor() {
        super('HTML source changed before formatting completed.');
        this.name = 'StaleHtmlFormattingError';
    }
}

/** Registers Prettier-backed `document.format`. */
export class HtmlFormattingPlugin extends Plugin {
    static readonly id = 'html-formatting';
    static readonly requires = [DiagnosticsPlugin];
    #destroyed = false;

    override init(): void {
        const serviceValue: HtmlFormattingService = {
            format: (source, options) => this.#format(source, options),
        };
        const service = Object.freeze(serviceValue);
        this.editor.services.register(htmlFormattingServiceToken, service);
        this.editor.commands.register({
            id: 'document.format',
            label: 'Format HTML',
            execute: async ({ editor }, ...args) => {
                const options = readOptions(args);
                const source = editor.getData();
                const revision = editor.state.document.revision;
                const problems = await editor.services
                    .get(diagnosticsServiceToken)
                    .validate(source);
                if (
                    problems.some(
                        (problem) =>
                            problem.provider === 'html.parser' &&
                            problem.severity === 'error',
                    )
                ) {
                    throw new InvalidHtmlFormattingSourceError();
                }
                const formatted = await service.format(source, options);
                if (
                    editor.state.document.revision !== revision ||
                    editor.getData() !== source
                ) {
                    throw new StaleHtmlFormattingError();
                }
                if (formatted !== source) {
                    editor.update(
                        (transaction) => transaction.replaceDocument(formatted),
                        { origin: 'command' },
                    );
                }
                return formatted;
            },
        });
    }

    override destroy(): void {
        this.#destroyed = true;
    }

    async #format(
        source: string,
        options: HtmlFormattingOptions | undefined,
    ): Promise<string> {
        if (this.#destroyed) {
            throw new EditorDestroyedError();
        }
        return formatHtml(source, options);
    }
}

async function formatHtml(
    source: string,
    options: HtmlFormattingOptions | undefined,
): Promise<string> {
    const [{ format }, htmlPlugin] = await Promise.all([
        import('prettier/standalone'),
        import('prettier/plugins/html'),
    ]);
    return format(source, {
        parser: 'html',
        plugins: [htmlPlugin],
        ...options,
    });
}

function readOptions(
    args: readonly unknown[],
): HtmlFormattingOptions | undefined {
    if (args.length === 0) {
        return undefined;
    }
    if (args.length !== 1) {
        throw new TypeError(
            'Command "document.format" accepts at most one options object.',
        );
    }
    const value = args[0];
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new TypeError(
            'Command "document.format" requires an options object.',
        );
    }
    const record = value as Record<string, unknown>;
    const allowed = [
        'printWidth',
        'tabWidth',
        'useTabs',
        'singleAttributePerLine',
        'htmlWhitespaceSensitivity',
    ];
    const unknown = Object.keys(record).find((key) => !allowed.includes(key));
    if (unknown !== undefined) {
        throw new TypeError(
            `Command "document.format" does not support option "${unknown}".`,
        );
    }
    const printWidth = boundedInteger(record.printWidth, 'printWidth', 40, 240);
    const tabWidth = boundedInteger(record.tabWidth, 'tabWidth', 1, 8);
    const useTabs = optionalBoolean(record.useTabs, 'useTabs');
    const singleAttributePerLine = optionalBoolean(
        record.singleAttributePerLine,
        'singleAttributePerLine',
    );
    const sensitivity = record.htmlWhitespaceSensitivity;
    if (
        sensitivity !== undefined &&
        sensitivity !== 'css' &&
        sensitivity !== 'strict' &&
        sensitivity !== 'ignore'
    ) {
        throw new TypeError(
            'Option "htmlWhitespaceSensitivity" must be css, strict, or ignore.',
        );
    }
    return Object.freeze({
        ...(printWidth === undefined ? {} : { printWidth }),
        ...(tabWidth === undefined ? {} : { tabWidth }),
        ...(useTabs === undefined ? {} : { useTabs }),
        ...(singleAttributePerLine === undefined
            ? {}
            : { singleAttributePerLine }),
        ...(sensitivity === undefined
            ? {}
            : { htmlWhitespaceSensitivity: sensitivity }),
    });
}

function boundedInteger(
    value: unknown,
    name: string,
    minimum: number,
    maximum: number,
): number | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (
        !Number.isInteger(value) ||
        Number(value) < minimum ||
        Number(value) > maximum
    ) {
        throw new TypeError(
            `Option "${name}" must be an integer from ${minimum} to ${maximum}.`,
        );
    }
    return Number(value);
}

function optionalBoolean(value: unknown, name: string): boolean | undefined {
    if (value !== undefined && typeof value !== 'boolean') {
        throw new TypeError(`Option "${name}" must be boolean.`);
    }
    return value;
}
