import { format } from 'prettier/standalone';
import htmlPlugin from 'prettier/plugins/html';

import type { HtmlFormattingOptions } from './formatting.js';
import { keepTagClosingBracketsInline } from './formatting-output.js';
import { hasHtmlParserErrors } from './formatting-validation.js';

interface FormattingWorkerRequest {
    readonly id: number;
    readonly options?: HtmlFormattingOptions;
    readonly source: string;
}

const addEventListenerValue: unknown = Reflect.get(
    globalThis,
    'addEventListener',
);
if (typeof addEventListenerValue !== 'function') {
    throw new Error('HTML formatting worker cannot receive messages.');
}

Reflect.apply(addEventListenerValue, globalThis, [
    'message',
    (event: unknown) => {
        const request = readRequest(
            typeof event === 'object' && event !== null
                ? Reflect.get(event, 'data')
                : undefined,
        );
        if (request === undefined) return;
        if (hasHtmlParserErrors(request.source)) {
            postResponse({
                id: request.id,
                reason: 'invalid-source',
                type: 'failure',
            });
            return;
        }
        void format(request.source, {
            parser: 'html',
            plugins: [htmlPlugin],
            ...request.options,
        }).then(
            (result) => {
                postResponse({
                    id: request.id,
                    result: keepTagClosingBracketsInline(result),
                    type: 'success',
                });
            },
            (error: unknown) => {
                postResponse({
                    id: request.id,
                    message:
                        error instanceof Error ? error.message : String(error),
                    reason: 'formatter',
                    type: 'failure',
                });
            },
        );
    },
]);

function postResponse(response: Readonly<Record<string, unknown>>): void {
    const postMessageValue: unknown = Reflect.get(globalThis, 'postMessage');
    if (typeof postMessageValue !== 'function') {
        throw new Error('HTML formatting worker cannot send messages.');
    }
    Reflect.apply(postMessageValue, globalThis, [response]);
}

function readRequest(value: unknown): FormattingWorkerRequest | undefined {
    if (typeof value !== 'object' || value === null) return undefined;
    const id: unknown = Reflect.get(value, 'id');
    const options = readOptions(Reflect.get(value, 'options'));
    const source: unknown = Reflect.get(value, 'source');
    if (
        typeof id !== 'number' ||
        typeof source !== 'string' ||
        options === null
    ) {
        return undefined;
    }
    return {
        id,
        ...(options === undefined ? {} : { options }),
        source,
    };
}

function readOptions(value: unknown): HtmlFormattingOptions | null | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== 'object' || value === null) return null;
    const htmlWhitespaceSensitivity: unknown = Reflect.get(
        value,
        'htmlWhitespaceSensitivity',
    );
    const printWidth: unknown = Reflect.get(value, 'printWidth');
    const singleAttributePerLine: unknown = Reflect.get(
        value,
        'singleAttributePerLine',
    );
    const tabWidth: unknown = Reflect.get(value, 'tabWidth');
    const useTabs: unknown = Reflect.get(value, 'useTabs');
    if (
        (htmlWhitespaceSensitivity !== undefined &&
            htmlWhitespaceSensitivity !== 'css' &&
            htmlWhitespaceSensitivity !== 'ignore' &&
            htmlWhitespaceSensitivity !== 'strict') ||
        (printWidth !== undefined && typeof printWidth !== 'number') ||
        (singleAttributePerLine !== undefined &&
            typeof singleAttributePerLine !== 'boolean') ||
        (tabWidth !== undefined && typeof tabWidth !== 'number') ||
        (useTabs !== undefined && typeof useTabs !== 'boolean')
    ) {
        return null;
    }
    return {
        ...(htmlWhitespaceSensitivity === undefined
            ? {}
            : { htmlWhitespaceSensitivity }),
        ...(printWidth === undefined ? {} : { printWidth }),
        ...(singleAttributePerLine === undefined
            ? {}
            : { singleAttributePerLine }),
        ...(tabWidth === undefined ? {} : { tabWidth }),
        ...(useTabs === undefined ? {} : { useTabs }),
    };
}
