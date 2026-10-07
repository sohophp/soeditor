import type { Editor } from '@soeditor/core';
import type {
    HtmlFormattingOptions,
    HtmlFormattingService,
} from '@soeditor/html-tools';

/** Registers lightweight command proxies; the formatter is requested only on use. */
export function attachClassicSourceFormatting(
    editor: Editor,
    isDestroyed: () => boolean,
    translate: (message: string) => string = (message) => message,
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
                const source = editor.getData();
                const revision = editor.state.document.revision;
                const { applySourceFormatting } =
                    await import('./classic-formatting-feedback.js');
                return applySourceFormatting(
                    editor,
                    service,
                    isDestroyed,
                    translate,
                    operation,
                    args,
                    source,
                    revision,
                );
            },
        });
    }
    return service;
}
