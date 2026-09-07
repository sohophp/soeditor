import type * as Source from './index.js';

/** Narrow surface loaded from the separately emitted Source recovery asset. */
export type SourceRecoveryRuntime = Pick<
    typeof Source,
    | 'createSourceEditingEngine'
    | 'attachClassicSourceEnhancements'
    | 'sourceEditingServiceToken'
>;

/** Retries a failed module graph with an independent, same-origin module URL. */
export async function loadSourceRecovery(
    attempt: number,
): Promise<SourceRecoveryRuntime> {
    if (!Number.isSafeInteger(attempt) || attempt < 1)
        throw new TypeError(
            'Source recovery attempt must be a positive integer.',
        );
    const url = new URL(
        '../node_modules/.cache/source-recovery/runtime.js?no-inline',
        import.meta.url,
    );
    url.searchParams.set('soeditor-retry', String(attempt));
    const runtime: unknown = await import(/* @vite-ignore */ url.href);
    if (!isRecoveryRuntime(runtime))
        throw new TypeError('Invalid Source recovery runtime.');
    return runtime;
}

function isRecoveryRuntime(value: unknown): value is SourceRecoveryRuntime {
    if (typeof value !== 'object' || value === null) return false;
    const token: unknown = Reflect.get(value, 'sourceEditingServiceToken');
    return (
        typeof Reflect.get(value, 'createSourceEditingEngine') === 'function' &&
        typeof Reflect.get(value, 'attachClassicSourceEnhancements') ===
            'function' &&
        typeof token === 'object' &&
        token !== null &&
        Reflect.get(token, 'id') === 'soeditor.source-editing'
    );
}
