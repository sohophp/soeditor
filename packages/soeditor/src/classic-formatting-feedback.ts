import type { Editor } from '@soeditor/core';
import type {
    HtmlFormattingOptions,
    HtmlFormattingService,
} from '@soeditor/html-tools';

export function isFormattingOptions(
    value: unknown,
): value is HtmlFormattingOptions | undefined {
    if (value === undefined) return true;
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        return false;
    return Object.entries(value).every(([key, item]) => {
        if (key === 'printWidth' || key === 'tabWidth')
            return typeof item === 'number' && Number.isInteger(item);
        if (key === 'useTabs' || key === 'singleAttributePerLine')
            return typeof item === 'boolean';
        if (key === 'htmlWhitespaceSensitivity')
            return item === 'css' || item === 'strict' || item === 'ignore';
        return false;
    });
}

export function localizeFormattingError(
    error: unknown,
    translate: (message: string) => string,
): void {
    if (
        error instanceof Error &&
        error.name === 'InvalidHtmlFormattingSourceError' &&
        typeof error.cause === 'object' &&
        error.cause !== null
    ) {
        const issue = error.cause;
        const line: unknown = Reflect.get(issue, 'line');
        const column: unknown = Reflect.get(issue, 'column');
        const reason: unknown = Reflect.get(issue, 'reason');
        const code: unknown = Reflect.get(issue, 'code');
        if (typeof reason === 'string' && typeof code === 'string') {
            error.message = translate(
                typeof line === 'number' && typeof column === 'number'
                    ? 'Cannot format HTML. Line {line}, column {column}: {reason} ({code}). Source was not changed.'
                    : 'Cannot format HTML. {reason} ({code}). Source was not changed.',
            )
                .replace('{line}', String(line))
                .replace('{column}', String(column))
                .replace('{reason}', translate(reason))
                .replace('{code}', code);
        }
    }
}

export async function applySourceFormatting(
    editor: Editor,
    service: HtmlFormattingService,
    isDestroyed: () => boolean,
    translate: (message: string) => string,
    operation: 'format' | 'minify',
    args: readonly unknown[],
    source: string,
    revision: number,
): Promise<string> {
    if (args.length > (operation === 'format' ? 1 : 0)) {
        throw new TypeError(
            `Invalid arguments for ${`document.${operation}`}.`,
        );
    }
    const options = args[0];
    if (!isFormattingOptions(options)) {
        throw new TypeError('Invalid HTML formatting options.');
    }
    // The formatter validates all supplied option names and values.
    let formatted: string;
    try {
        formatted =
            operation === 'format'
                ? await service.format(source, options)
                : await service.minify(source);
    } catch (error) {
        localizeFormattingError(error, translate);
        throw error;
    }
    if (
        isDestroyed() ||
        editor.state.readonly ||
        editor.state.document.revision !== revision ||
        editor.getData() !== source
    ) {
        throw new Error('HTML source changed before formatting completed.');
    }
    if (formatted !== source) {
        editor.update((transaction) => transaction.replaceDocument(formatted), {
            origin: 'command',
        });
    }
    return formatted;
}
