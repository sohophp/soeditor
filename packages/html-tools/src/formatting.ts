import {
    createServiceToken,
    EditorDestroyedError,
    Plugin,
} from '@soeditor/core';
import {
    parseHtmlDocument,
    parseHtmlFragment,
    serializeHtmlDocument,
    serializeHtmlFragment,
    type HtmlChildNode,
    type HtmlDocument,
    type HtmlDocumentChildNode,
    type HtmlDocumentFragment,
    type HtmlElement,
} from '@soeditor/html';
import HtmlFormattingWorker from './formatting-worker.ts?worker&inline';
import { keepTagClosingBracketsInline } from './formatting-output.js';
import { hasHtmlParserErrors } from './formatting-validation.js';

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
    minify(source: string): Promise<string>;
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

/** Reports source that exceeds the formatter's bounded worker input. */
export class HtmlFormattingSourceTooLargeError extends Error {
    constructor() {
        super('HTML formatting supports source up to 2 MB.');
        this.name = 'HtmlFormattingSourceTooLargeError';
    }
}

/** Reports a formatter worker that exceeded its execution deadline. */
export class HtmlFormattingTimeoutError extends Error {
    constructor() {
        super('HTML formatting exceeded 15 seconds and was stopped.');
        this.name = 'HtmlFormattingTimeoutError';
    }
}

/** Registers the Prettier-backed whole-source `document.format` command. */
export class HtmlFormattingPlugin extends Plugin {
    static readonly id = 'html-formatting';
    static readonly requires = [DiagnosticsPlugin];
    #destroyed = false;

    override init(): void {
        const serviceValue: HtmlFormattingService = {
            format: (source, options) => this.#format(source, options),
            minify: (source) => this.#minify(source),
        };
        const service = Object.freeze(serviceValue);
        this.editor.services.register(htmlFormattingServiceToken, service);
        this.editor.commands.register({
            id: 'document.format',
            label: 'Format source HTML',
            canExecute: ({ editor }) =>
                editor.state.document.format === 'html' &&
                editor.state.mode === 'source',
            execute: async ({ editor }, ...args) => {
                const options = readOptions(args);
                const source = editor.getData();
                assertFormattingSourceSize(source);
                const revision = editor.state.document.revision;
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
        this.editor.commands.register({
            id: 'document.minify',
            label: 'Minify source HTML',
            canExecute: ({ editor }) =>
                editor.state.document.format === 'html' &&
                editor.state.mode === 'source',
            execute: async ({ editor }, ...args) => {
                if (args.length !== 0) {
                    throw new TypeError(
                        'Command "document.minify" does not accept arguments.',
                    );
                }
                const source = editor.getData();
                assertFormattingSourceSize(source);
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
                const minified = await service.minify(source);
                if (
                    editor.state.document.revision !== revision ||
                    editor.getData() !== source
                ) {
                    throw new StaleHtmlFormattingError();
                }
                if (minified !== source) {
                    editor.update(
                        (transaction) => transaction.replaceDocument(minified),
                        { origin: 'command' },
                    );
                }
                return minified;
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

    async #minify(source: string): Promise<string> {
        if (this.#destroyed) {
            throw new EditorDestroyedError();
        }
        assertFormattingSourceSize(source);
        return minifyHtml(source);
    }
}

async function formatHtml(
    source: string,
    options: HtmlFormattingOptions | undefined,
): Promise<string> {
    assertFormattingSourceSize(source);
    if (typeof Worker !== 'undefined') {
        return formatHtmlInWorker(source, options);
    }
    if (hasHtmlParserErrors(source)) {
        throw new InvalidHtmlFormattingSourceError();
    }
    const [{ format }, htmlPlugin] = await Promise.all([
        import('prettier/standalone'),
        import('prettier/plugins/html'),
    ]);
    return keepTagClosingBracketsInline(
        await format(source, {
            parser: 'html',
            plugins: [htmlPlugin],
            ...options,
        }),
    );
}

const maximumFormattingSourceLength = 2 * 1024 * 1024;
const formattingTimeoutMilliseconds = 15_000;

function assertFormattingSourceSize(source: string): void {
    if (source.length > maximumFormattingSourceLength) {
        throw new HtmlFormattingSourceTooLargeError();
    }
}

interface FormattingWorkerSuccess {
    readonly id: number;
    readonly result: string;
    readonly type: 'success';
}

interface FormattingWorkerFailure {
    readonly id: number;
    readonly message?: string;
    readonly reason: 'formatter' | 'invalid-source';
    readonly type: 'failure';
}

type FormattingWorkerResponse =
    FormattingWorkerFailure | FormattingWorkerSuccess;

function formatHtmlInWorker(
    source: string,
    options: HtmlFormattingOptions | undefined,
): Promise<string> {
    return new Promise((resolve, reject) => {
        const worker = new HtmlFormattingWorker({
            name: 'soeditor-html-formatter',
            type: 'module',
        });
        let settled = false;
        const finish = (action: () => void): void => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            worker.terminate();
            action();
        };
        const timeout = setTimeout(() => {
            finish(() => reject(new HtmlFormattingTimeoutError()));
        }, formattingTimeoutMilliseconds);
        worker.addEventListener('message', (event: MessageEvent<unknown>) => {
            const response = readFormattingWorkerResponse(event.data);
            if (response === undefined || response.id !== 1) return;
            if (response.type === 'success') {
                finish(() => resolve(response.result));
            } else if (response.reason === 'invalid-source') {
                finish(() => reject(new InvalidHtmlFormattingSourceError()));
            } else {
                finish(() =>
                    reject(
                        new Error(
                            response.message ??
                                'HTML formatting worker failed.',
                        ),
                    ),
                );
            }
        });
        worker.addEventListener('error', (event) => {
            finish(() =>
                reject(
                    new Error(
                        event.message || 'HTML formatting worker failed.',
                    ),
                ),
            );
        });
        worker.postMessage({ id: 1, options, source });
    });
}

function readFormattingWorkerResponse(
    value: unknown,
): FormattingWorkerResponse | undefined {
    if (typeof value !== 'object' || value === null) return undefined;
    const id: unknown = Reflect.get(value, 'id');
    const type: unknown = Reflect.get(value, 'type');
    if (id !== 1 || (type !== 'success' && type !== 'failure')) {
        return undefined;
    }
    if (type === 'success') {
        const result: unknown = Reflect.get(value, 'result');
        return typeof result === 'string' ? { id, result, type } : undefined;
    }
    const reason: unknown = Reflect.get(value, 'reason');
    if (reason !== 'formatter' && reason !== 'invalid-source') {
        return undefined;
    }
    const message: unknown = Reflect.get(value, 'message');
    if (message !== undefined && typeof message !== 'string') {
        return undefined;
    }
    return {
        id,
        ...(message === undefined ? {} : { message }),
        reason,
        type,
    };
}

const blockElements = new Set([
    'address',
    'article',
    'aside',
    'blockquote',
    'body',
    'caption',
    'dd',
    'details',
    'dialog',
    'div',
    'dl',
    'dt',
    'fieldset',
    'figcaption',
    'figure',
    'footer',
    'form',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'header',
    'hgroup',
    'hr',
    'html',
    'li',
    'main',
    'menu',
    'nav',
    'ol',
    'p',
    'pre',
    'section',
    'summary',
    'table',
    'tbody',
    'td',
    'tfoot',
    'th',
    'thead',
    'tr',
    'ul',
]);

const structuralContainers = new Set([
    'html',
    'head',
    'table',
    'tbody',
    'tfoot',
    'thead',
    'tr',
]);

/**
 * Produces compact semantic HTML without altering inline whitespace. Only
 * indentation-only nodes between block structures are discarded; comments,
 * custom elements, executable source data, and text inside preformatted
 * elements remain intact.
 */
function minifyHtml(source: string): string {
    if (/^\s*(?:<!doctype\s|<html(?:\s|>))/iu.test(source)) {
        const parsed = parseHtmlDocument(source);
        const compact: HtmlDocument = Object.freeze({
            type: 'document',
            children: compactDocumentChildren(parsed.document.children),
        });
        return serializeHtmlDocument(compact);
    }
    const parsed = parseHtmlFragment(source);
    const compact: HtmlDocumentFragment = Object.freeze({
        type: 'document-fragment',
        children: compactChildren(parsed.document.children),
    });
    return serializeHtmlFragment(compact);
}

function compactDocumentChildren(
    children: readonly HtmlDocumentChildNode[],
): readonly HtmlDocumentChildNode[] {
    return Object.freeze(
        children
            .map((child): HtmlDocumentChildNode =>
                child.type === 'element' ? compactElement(child) : child,
            )
            .filter(
                (child) =>
                    child.type !== 'text' ||
                    !/^\s+$/u.test(child.value) ||
                    !/[\r\n]/u.test(child.value),
            ),
    );
}

function compactChildren(
    children: readonly HtmlChildNode[],
    parentTag?: string,
): readonly HtmlChildNode[] {
    const compacted = children
        .map((child): HtmlChildNode =>
            child.type === 'element' ? compactElement(child) : child,
        )
        .filter((child, index, all) => {
            if (
                child.type !== 'text' ||
                !/^\s+$/u.test(child.value) ||
                !/[\r\n]/u.test(child.value)
            ) {
                return true;
            }
            const previous = all[index - 1];
            const next = all[index + 1];
            if (
                parentTag !== undefined &&
                structuralContainers.has(parentTag)
            ) {
                return false;
            }
            return !(
                (isBlockElement(previous) && isBlockElement(next)) ||
                (previous === undefined && isBlockElement(next)) ||
                (isBlockElement(previous) && next === undefined)
            );
        });
    return Object.freeze(compacted);
}

function compactElement(element: HtmlElement): HtmlElement {
    if (
        element.tagName === 'pre' ||
        element.tagName === 'textarea' ||
        element.tagName === 'script' ||
        element.tagName === 'style'
    ) {
        return element;
    }
    return Object.freeze({
        ...element,
        children: compactChildren(element.children, element.tagName),
    });
}

function isBlockElement(node: HtmlChildNode | undefined): boolean {
    return node?.type === 'element' && blockElements.has(node.tagName);
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
