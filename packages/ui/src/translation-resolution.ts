import type {
    EditorUiDirection,
    EditorUiTranslationResource,
} from './types.js';

export interface ResolvedUiTranslation {
    readonly direction: EditorUiDirection;
    readonly locale: string;
    translate(message: string): string;
}

/** Resolves only the resources supplied by the caller. */
export function resolveUiTranslationResources(
    requestedLocale = 'en',
    resources: readonly EditorUiTranslationResource[] = [],
    requestedDirection?: EditorUiDirection,
): ResolvedUiTranslation {
    const locale = normalizeUiLocale(requestedLocale);
    for (const resource of resources) validateResource(resource);
    if (
        requestedDirection !== undefined &&
        requestedDirection !== 'ltr' &&
        requestedDirection !== 'rtl'
    ) {
        throw new TypeError('Editor UI direction must be ltr or rtl.');
    }
    const baseLocale = locale.split('-')[0] ?? locale;
    const matchedLocale = [locale, baseLocale, 'en'].find((candidate) =>
        resources.some(
            (resource) => normalizeUiLocale(resource.locale) === candidate,
        ),
    );
    const matches = resources.filter(
        (resource) => normalizeUiLocale(resource.locale) === matchedLocale,
    );
    const messages = Object.assign(
        {},
        ...matches.map(({ messages }) => messages),
    ) as Record<string, string>;
    const direction =
        requestedDirection ??
        matches.at(-1)?.direction ??
        inferDirection(locale);
    return Object.freeze({
        direction,
        locale,
        translate: (message: string) => messages[message] ?? message,
    });
}

/** Normalizes supported locale aliases without loading translation data. */
export function normalizeUiLocale(locale: string): string {
    if (typeof locale !== 'string' || locale.trim().length === 0) {
        throw new TypeError('Editor UI locale must not be empty.');
    }
    const normalized = locale.trim().replaceAll('_', '-').toLowerCase();
    if (
        normalized === 'zh' ||
        normalized.startsWith('zh-cn') ||
        normalized.startsWith('zh-hans')
    ) {
        return 'zh-CN';
    }
    if (
        normalized.startsWith('zh-tw') ||
        normalized.startsWith('zh-hk') ||
        normalized.startsWith('zh-hant')
    ) {
        return 'zh-TW';
    }
    return normalized === 'en' || normalized.startsWith('en-')
        ? 'en'
        : locale.trim();
}

function validateResource(resource: EditorUiTranslationResource): void {
    if (typeof resource !== 'object' || resource === null) {
        throw new TypeError(
            'An editor UI translation resource must be an object.',
        );
    }
    normalizeUiLocale(resource.locale);
    if (
        resource.direction !== undefined &&
        resource.direction !== 'ltr' &&
        resource.direction !== 'rtl'
    ) {
        throw new TypeError(
            'Translation resource direction must be ltr or rtl.',
        );
    }
    if (
        typeof resource.messages !== 'object' ||
        resource.messages === null ||
        Array.isArray(resource.messages)
    ) {
        throw new TypeError('Translation resource messages must be an object.');
    }
    for (const [key, value] of Object.entries(resource.messages)) {
        if (key.length === 0 || typeof value !== 'string') {
            throw new TypeError(
                'Translation resource messages require non-empty string keys and string values.',
            );
        }
    }
}

function inferDirection(locale: string): EditorUiDirection {
    return /^(?:ar|fa|he|ur)(?:-|$)/iu.test(locale) ? 'rtl' : 'ltr';
}
