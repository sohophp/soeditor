/** Application-owned configuration for isolated preview rendering. */
export interface PreviewConfiguration {
    readonly baseUrl?: string;
    readonly context?: Readonly<Record<string, string>>;
    readonly styles?: readonly string[];
    readonly stylesheets?: readonly string[];
    readonly template?: string;
    readonly title?: string;
}

export interface NormalizedPreviewConfiguration {
    readonly baseUrl?: string;
    readonly context: Readonly<Record<string, string>>;
    readonly styles: readonly string[];
    readonly stylesheets: readonly string[];
    readonly template: string;
    readonly title: string;
}

export const defaultPreviewTemplate =
    '<!doctype html><html><head><meta charset="utf-8"><title>Preview</title></head><body>{{ content }}</body></html>';

export function normalizePreviewConfiguration(
    configuration: PreviewConfiguration = {},
): NormalizedPreviewConfiguration {
    const template = configuration.template ?? defaultPreviewTemplate;
    if (typeof template !== 'string' || countContentMarkers(template) !== 1) {
        throw new TypeError(
            'A preview template must contain exactly one {{ content }} marker.',
        );
    }
    const title = configuration.title ?? 'Content preview';
    if (typeof title !== 'string' || title.length === 0) {
        throw new TypeError('A preview title must not be empty.');
    }
    const baseUrl = normalizeBaseUrl(configuration.baseUrl);
    const context = normalizeContext(configuration.context);
    const styles = stringArray(configuration.styles, 'styles');
    const stylesheets = stringArray(configuration.stylesheets, 'stylesheets');
    for (const stylesheet of stylesheets) {
        validateStylesheet(stylesheet, baseUrl);
    }
    return Object.freeze({
        ...(baseUrl === undefined ? {} : { baseUrl }),
        context,
        styles,
        stylesheets,
        template,
        title,
    });
}

export function applyPreviewTemplate(
    template: string,
    source: string,
    context: Readonly<Record<string, string>>,
): string {
    const withContext = template.replace(
        /{{\s*([A-Za-z][\w.-]*)\s*}}/g,
        (marker, key: string) => {
            if (key === 'content') {
                return marker;
            }
            return Object.hasOwn(context, key)
                ? escapeHtml(context[key] ?? '')
                : marker;
        },
    );
    return withContext.replace(/{{\s*content\s*}}/, source);
}

export function isCompleteHtmlDocument(source: string): boolean {
    return (
        /^(?:\s|<!--[\s\S]*?-->)*(?:<!doctype\b[^>]*>\s*)?<html(?:\s|>)/i.test(
            source,
        ) || /^(?:\s|<!--[\s\S]*?-->)*<!doctype\b/i.test(source)
    );
}

function countContentMarkers(template: string): number {
    return template.match(/{{\s*content\s*}}/g)?.length ?? 0;
}

function normalizeBaseUrl(value: string | undefined): string | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (typeof value !== 'string') {
        throw new TypeError('Preview baseUrl must be a string.');
    }
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new TypeError('Preview baseUrl must use HTTP or HTTPS.');
    }
    return url.href;
}

function normalizeContext(
    value: Readonly<Record<string, string>> | undefined,
): Readonly<Record<string, string>> {
    if (value === undefined) {
        return Object.freeze({});
    }
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new TypeError('Preview context must be a string record.');
    }
    const entries: [string, string][] = [];
    for (const [key, item] of Object.entries(value)) {
        if (!/^[A-Za-z][\w.-]*$/.test(key) || typeof item !== 'string') {
            throw new TypeError(
                'Preview context keys and values must be valid strings.',
            );
        }
        entries.push([key, item]);
    }
    return Object.freeze(Object.fromEntries(entries));
}

function stringArray(
    value: readonly string[] | undefined,
    name: string,
): readonly string[] {
    if (value === undefined) {
        return Object.freeze([]);
    }
    if (
        !Array.isArray(value) ||
        value.some((item) => typeof item !== 'string')
    ) {
        throw new TypeError(`Preview ${name} must be a string array.`);
    }
    return Object.freeze([...value]);
}

function validateStylesheet(value: string, baseUrl: string | undefined): void {
    if (value.length === 0) {
        throw new TypeError('Preview stylesheet URLs must not be empty.');
    }
    let url: URL;
    try {
        url = new URL(value, baseUrl ?? 'https://preview.invalid/');
    } catch {
        throw new TypeError(`Preview stylesheet URL "${value}" is invalid.`);
    }
    if (
        url.protocol !== 'http:' &&
        url.protocol !== 'https:' &&
        url.protocol !== 'data:' &&
        url.protocol !== 'blob:'
    ) {
        throw new TypeError(
            `Preview stylesheet URL "${value}" uses an unsafe protocol.`,
        );
    }
}

function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}
