import {
    parseHtmlDocument,
    parseHtmlFragment,
    type HtmlDocumentChildNode,
    type HtmlElement,
} from '@soeditor/html';
import { micromark } from 'micromark';
import TurndownService from 'turndown';

/** Raw HTML behavior when compiling canonical Markdown to HTML. */
export type MarkdownRawHtmlPolicy = 'escape' | 'preserve';

/** Narrow Markdown-to-HTML rendering options owned by SoEditor. */
export interface MarkdownRenderOptions {
    readonly rawHtml?: MarkdownRawHtmlPolicy;
}

/** Compiles CommonMark while retaining exact canonical Markdown separately. */
export function markdownToHtml(
    source: string,
    options: MarkdownRenderOptions = {},
): string {
    const rawHtml = options.rawHtml ?? 'preserve';
    if (rawHtml !== 'escape' && rawHtml !== 'preserve') {
        throw new TypeError(
            'Markdown rawHtml must be either escape or preserve.',
        );
    }
    return micromark(source, {
        allowDangerousHtml: rawHtml === 'preserve',
        allowDangerousProtocol: false,
    });
}

/** One explicit caveat discovered during deliberate HTML conversion. */
export interface MarkdownConversionLoss {
    readonly code: string;
    readonly message: string;
}

/** Result of an intentionally lossy HTML-to-Markdown conversion. */
export interface HtmlToMarkdownResult {
    readonly losses: readonly MarkdownConversionLoss[];
    readonly source: string;
}

/** Converts HTML deliberately and reports known semantic loss categories. */
export function htmlToMarkdown(source: string): HtmlToMarkdownResult {
    const complete = isCompleteDocument(source);
    const parsed = complete
        ? parseHtmlDocument(source)
        : parseHtmlFragment(source);
    const analysis = analyzeHtml(parsed.document.children);
    const service = new TurndownService({
        blankReplacement: (_content, node) =>
            analysis.rawTags.has(node.nodeName.toLowerCase())
                ? node.outerHTML
                : '',
        bulletListMarker: '-',
        codeBlockStyle: 'fenced',
        emDelimiter: '*',
        headingStyle: 'atx',
        strongDelimiter: '**',
    });
    if (analysis.rawTags.size > 0) {
        service.keep((node) =>
            analysis.rawTags.has(node.nodeName.toLowerCase()),
        );
    }
    const losses: MarkdownConversionLoss[] = [];
    if (complete) {
        losses.push(loss('html.document', 'Document chrome is not Markdown.'));
    }
    if (parsed.diagnostics.length > 0) {
        losses.push(
            loss(
                'html.invalid',
                'Parser recovery may normalize invalid HTML during conversion.',
            ),
        );
    }
    if (analysis.comments) {
        losses.push(loss('html.comments', 'HTML comments may be removed.'));
    }
    if (analysis.attributes) {
        losses.push(
            loss(
                'html.attributes',
                'Attributes on converted HTML elements may be removed.',
            ),
        );
    }
    if (analysis.rawTags.size > 0) {
        losses.push(
            loss(
                'html.raw',
                'Custom or namespaced elements remain as raw HTML.',
            ),
        );
    }
    return Object.freeze({
        losses: Object.freeze(losses),
        source: service.turndown(source),
    });
}

function analyzeHtml(nodes: readonly HtmlDocumentChildNode[]): {
    readonly attributes: boolean;
    readonly comments: boolean;
    readonly rawTags: ReadonlySet<string>;
} {
    let attributes = false;
    let comments = false;
    const rawTags = new Set<string>();
    const visit = (children: readonly HtmlDocumentChildNode[]): void => {
        for (const node of children) {
            if (node.type === 'comment') {
                comments = true;
                continue;
            }
            if (node.type !== 'element') {
                continue;
            }
            if (isRawElement(node)) {
                rawTags.add(node.tagName);
            } else if (node.attributes.length > 0) {
                attributes = true;
            }
            visit(node.children);
        }
    };
    visit(nodes);
    return { attributes, comments, rawTags };
}

function isRawElement(element: HtmlElement): boolean {
    return (
        element.namespace !== 'html' ||
        element.tagName.includes('-') ||
        element.tagName === 'template'
    );
}

function loss(code: string, message: string): MarkdownConversionLoss {
    return Object.freeze({ code, message });
}

function isCompleteDocument(source: string): boolean {
    return /<!doctype\s|<\/?(?:html|head|body)(?:\s|>)/iu.test(source);
}
