import type {
    LinkTargetProvider,
    LinkTargetSelection,
    LinkTargetSuggestion,
} from '@soeditor/rich-text';
import type { FileManager, FileManagerResult } from './file-manager.js';
import { normalizeFileManagerResult } from './validation.js';

/** Site data and URL mapping remain host-owned; dialog behavior stays in SoEditor. */
export interface FileManagerLinkTargetOptions {
    readonly fileManager: FileManager;
    readonly searchInternal?: LinkTargetProvider['searchInternal'];
    readonly resolveFile?: (
        file: FileManagerResult,
    ) => PromiseLike<LinkTargetSelection> | LinkTargetSelection;
}

/** Share one picker between image insertion and the Link/Image properties dialogs. */
export function createFileManagerLinkTargetProvider(
    options: FileManagerLinkTargetOptions,
): LinkTargetProvider {
    let pending = false;
    return {
        async select(kind) {
            if (kind !== 'file' || pending) return null;
            pending = true;
            try {
                const selected = normalizeFileManagerResult(
                    await options.fileManager.open({
                        kind: 'file',
                        multiple: false,
                    }),
                );
                if (!selected) return null;
                if (options.resolveFile)
                    return await options.resolveFile(selected);
                return {
                    href: selected.url,
                    ...(selected.name ? { title: selected.name } : {}),
                };
            } finally {
                pending = false;
            }
        },
        ...(options.searchInternal
            ? { searchInternal: options.searchInternal }
            : {}),
    };
}

/** Authenticated same-origin JSON endpoint returning { targets: [{ href, title }] }. */
export interface HttpLinkTargetSearchOptions {
    readonly endpoint: string;
    readonly fetch?: typeof fetch;
}

/** Bounded on-demand page lookup. No site schema or public URL rewriting is assumed. */
export function createHttpLinkTargetSearch(
    options: HttpLinkTargetSearchOptions,
): NonNullable<LinkTargetProvider['searchInternal']> {
    const request = options.fetch ?? globalThis.fetch.bind(globalThis);
    return async (value): Promise<readonly LinkTargetSuggestion[]> => {
        const query = value.trim();
        if (
            !query.startsWith('/') ||
            query.startsWith('//') ||
            query.length > 100
        )
            return [];
        const url = new URL(
            options.endpoint,
            globalThis.location?.href ?? 'http://localhost/',
        );
        if (globalThis.location && url.origin !== globalThis.location.origin)
            throw new TypeError('Link search must use a same-origin endpoint.');
        url.searchParams.set('q', query);
        const response = await request(url.href, {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
        });
        if (!response.ok)
            throw new Error(`Link search failed (${response.status}).`);
        const result: unknown = await response.json();
        if (
            typeof result !== 'object' ||
            result === null ||
            !('targets' in result) ||
            !Array.isArray(result.targets)
        )
            throw new TypeError('Link search returned invalid targets.');
        return result.targets.slice(0, 50).map((item: unknown) => {
            const unsafeHref =
                typeof item === 'object' &&
                item !== null &&
                'href' in item &&
                typeof item.href === 'string' &&
                // eslint-disable-next-line no-control-regex -- Reject control characters in returned URLs.
                /[\u0000-\u001f\u007f\\]/u.test(item.href);
            if (
                typeof item !== 'object' ||
                item === null ||
                !('href' in item) ||
                !('title' in item) ||
                typeof item.href !== 'string' ||
                typeof item.title !== 'string' ||
                !item.title.trim() ||
                item.title.length > 512 ||
                item.href.length > 2048 ||
                !item.href.startsWith('/') ||
                item.href.startsWith('//') ||
                unsafeHref
            )
                throw new TypeError(
                    'Link search returned an invalid site-relative target.',
                );
            return Object.freeze({ href: item.href, title: item.title });
        });
    };
}
