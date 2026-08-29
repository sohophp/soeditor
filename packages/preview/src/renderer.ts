import {
    applyPreviewTemplate,
    isCompleteHtmlDocument,
    type NormalizedPreviewConfiguration,
} from './configuration.js';

const PREVIEW_CSP = [
    "default-src 'none'",
    "script-src 'none'",
    "style-src 'unsafe-inline' http: https: data: blob:",
    'img-src http: https: data: blob:',
    'font-src http: https: data: blob:',
    'media-src http: https: data: blob:',
    "connect-src 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    "form-action 'none'",
    'base-uri http: https:',
].join('; ');

export function renderPreviewDocument(
    source: string,
    configuration: NormalizedPreviewConfiguration,
    view: Window,
): string {
    const markup = isCompleteHtmlDocument(source)
        ? source
        : applyPreviewTemplate(
              configuration.template,
              source,
              configuration.context,
          );
    const Parser = (view as Window & { DOMParser: typeof DOMParser }).DOMParser;
    const document = new Parser().parseFromString(markup, 'text/html');
    removeSourcePolicies(document);
    const csp = document.createElement('meta');
    csp.httpEquiv = 'Content-Security-Policy';
    csp.content = PREVIEW_CSP;
    document.head.prepend(csp);

    if (configuration.baseUrl !== undefined) {
        const base = document.createElement('base');
        base.href = configuration.baseUrl;
        csp.after(base);
    }
    for (const stylesheet of configuration.stylesheets) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = stylesheet;
        document.head.append(link);
    }
    for (const css of configuration.styles) {
        const style = document.createElement('style');
        style.textContent = css;
        document.head.append(style);
    }

    return `${serializeDoctype(document.doctype)}${document.documentElement.outerHTML}`;
}

function removeSourcePolicies(document: Document): void {
    for (const meta of Array.from(
        document.querySelectorAll<HTMLMetaElement>('meta[http-equiv]'),
    )) {
        const directive = meta.httpEquiv.toLowerCase();
        if (
            directive === 'content-security-policy' ||
            directive === 'refresh'
        ) {
            meta.remove();
        }
    }
    for (const base of Array.from(document.querySelectorAll('base'))) {
        base.remove();
    }
}

function serializeDoctype(doctype: DocumentType | null): string {
    if (doctype === null) {
        return '<!DOCTYPE html>';
    }
    const publicId = doctype.publicId;
    const systemId = doctype.systemId;
    if (publicId.length > 0) {
        return `<!DOCTYPE ${doctype.name} PUBLIC "${publicId}" "${systemId}">`;
    }
    if (systemId.length > 0) {
        return `<!DOCTYPE ${doctype.name} SYSTEM "${systemId}">`;
    }
    return `<!DOCTYPE ${doctype.name}>`;
}
