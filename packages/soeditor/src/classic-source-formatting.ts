import type { Editor } from '@soeditor/core';
import type {
    HtmlFormattingOptions,
    HtmlFormattingService,
} from '@soeditor/html-tools';

/** Registers lightweight command proxies; the formatter is requested only on use. */
export function attachClassicSourceFormatting(
    editor: Editor,
    isDestroyed: () => boolean,
): HtmlFormattingService {
    let loading: Promise<HtmlFormattingService> | undefined;
    const load = (): Promise<HtmlFormattingService> => {
        loading ??= import('@soeditor/html-tools')
            .then((module) => {
                if (isDestroyed())
                    throw new Error('Classic editor has been destroyed.');
                return module.createHtmlFormattingService();
            })
            .catch((error: unknown) => {
                loading = undefined;
                throw error;
            });
        return loading;
    };
    const service =
        editor.services.tryGet<HtmlFormattingService>(
            'soeditor.html-formatting',
        ) ??
        Object.freeze({
            format: async (source: string, options?: HtmlFormattingOptions) => {
                if (isDestroyed())
                    throw new Error('Classic editor has been destroyed.');
                return (await load()).format(source, options);
            },
            minify: async (source: string) => {
                if (isDestroyed())
                    throw new Error('Classic editor has been destroyed.');
                return (await load()).minify(source);
            },
        });
    if (!editor.services.has('soeditor.html-formatting')) {
        editor.services.register('soeditor.html-formatting', service);
    }
    for (const operation of ['format', 'minify'] as const) {
        const id = `document.${operation}`;
        if (editor.commands.has(id)) continue;
        editor.commands.register({
            id,
            label:
                operation === 'format'
                    ? 'Format source HTML'
                    : 'Minify source HTML',
            canExecute: () =>
                !isDestroyed() &&
                !editor.state.readonly &&
                editor.state.mode === 'source',
            execute: async (_context, ...args) => {
                if (args.length > (operation === 'format' ? 1 : 0)) {
                    throw new TypeError(`Invalid arguments for ${id}.`);
                }
                const options = args[0];
                if (!isFormattingOptions(options)) {
                    throw new TypeError('Invalid HTML formatting options.');
                }
                const source = editor.getData();
                const revision = editor.state.document.revision;
                // The formatter validates all supplied option names and values.
                const formatted =
                    operation === 'format'
                        ? await service.format(source, options)
                        : await service.minify(source);
                if (
                    isDestroyed() ||
                    editor.state.readonly ||
                    editor.state.document.revision !== revision ||
                    editor.getData() !== source
                ) {
                    throw new Error(
                        'HTML source changed before formatting completed.',
                    );
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
    return service;
}

function isFormattingOptions(
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
