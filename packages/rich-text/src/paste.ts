import { Plugin } from '@soeditor/core';
import {
    PastePipelinePlugin,
    pastePipelineServiceToken,
    type PasteProcessorContext,
    type PasteProcessorResult,
} from '@soeditor/engine';
import {
    parseHtmlDocument,
    parseHtmlFragment,
    serializeHtmlFragment,
    type HtmlAttribute,
    type HtmlChildNode,
} from '@soeditor/html';

const REMOVED_ELEMENTS = new Set([
    'base',
    'button',
    'embed',
    'form',
    'iframe',
    'input',
    'link',
    'meta',
    'object',
    'script',
    'select',
    'style',
    'textarea',
]);

const SEMANTIC_ELEMENTS = new Set([
    'a',
    'blockquote',
    'br',
    'caption',
    'code',
    'col',
    'colgroup',
    'div',
    'em',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'hr',
    'img',
    'li',
    'mark',
    'ol',
    'p',
    'pre',
    's',
    'small',
    'span',
    'strong',
    'sub',
    'sup',
    'table',
    'tbody',
    'td',
    'tfoot',
    'th',
    'thead',
    'tr',
    'u',
    'ul',
]);

const BLOCK_CHILD_CONTAINERS = new Set([
    '#root',
    'colgroup',
    'ol',
    'table',
    'tbody',
    'tfoot',
    'thead',
    'tr',
    'ul',
]);

/** Registers deterministic CMS cleanup for external clipboard and drop HTML. */
export class CmsPastePlugin extends Plugin {
    static readonly id = 'cms-paste';
    static readonly requires = [PastePipelinePlugin];

    #dispose: (() => void) | undefined;

    override init(): void {
        const retainStyles = readBoolean(
            this.editor.config.get<unknown>('cms.paste.retainStyles'),
            false,
            'cms.paste.retainStyles',
        );
        const retainAlignment = readBoolean(
            this.editor.config.get<unknown>('cms.paste.retainAlignment'),
            true,
            'cms.paste.retainAlignment',
        );
        this.#dispose = this.editor.services
            .get(pastePipelineServiceToken)
            .register({
                id: 'soeditor.cms.external-html',
                priority: 0,
                process: (context) =>
                    processCmsPaste(context, retainStyles, retainAlignment),
            });
    }

    override destroy(): void {
        this.#dispose?.();
        this.#dispose = undefined;
    }
}

export type HtmlCleanupProfile = 'balanced' | 'strict' | 'trusted';

/** Command-driven, undoable cleanup for canonical HTML content. */
export class HtmlCleanupPlugin extends Plugin {
    static readonly id = 'html-cleanup';
    static readonly requires = [CmsPastePlugin];

    override init(): void {
        this.editor.commands.register({
            id: 'html.cleanup',
            label: 'Clean HTML',
            canExecute: ({ editor }) =>
                editor.state.document.format === 'html' &&
                !editor.state.readonly,
            execute: ({ editor }, candidate = 'balanced') => {
                const profile = readCleanupProfile(candidate);
                const source = editor.getData();
                const cleaned = cleanupHtml(source, profile);
                if (cleaned !== source) {
                    editor.update(
                        (transaction) =>
                            transaction
                                .replaceDocument(cleaned)
                                .setMeta('html.cleanup.profile', profile),
                        { origin: 'command' },
                    );
                }
                return Object.freeze({
                    changed: cleaned !== source,
                    profile,
                    source: cleaned,
                });
            },
        });
        this.editor.commands.register({
            id: 'html.cleanup.inspect',
            label: 'Inspect HTML cleanup',
            canExecute: ({ editor }) => editor.state.document.format === 'html',
            execute: ({ editor }, candidate = 'balanced') => {
                const profile = readCleanupProfile(candidate);
                const source = editor.getData();
                const cleaned = cleanupHtml(source, profile);
                return Object.freeze({
                    changed: cleaned !== source,
                    profile,
                    source: cleaned,
                });
            },
        });
    }
}

export function cleanupHtml(
    source: string,
    profile: HtmlCleanupProfile,
): string {
    if (profile === 'trusted') return source;
    return (
        processCmsPaste(
            {
                classification: 'web',
                consumed: false,
                files: [],
                html: source,
                policy: profile === 'strict' ? 'semantic' : 'preserve',
                source: 'paste',
                text: '',
                types: [],
            },
            profile === 'balanced',
        )?.html ?? source
    );
}

function readCleanupProfile(value: unknown): HtmlCleanupProfile {
    if (value === 'balanced' || value === 'strict' || value === 'trusted') {
        return value;
    }
    throw new TypeError(
        'HTML cleanup profile must be "strict", "balanced", or "trusted".',
    );
}

export function processCmsPaste(
    context: PasteProcessorContext,
    retainStyles = false,
    retainAlignment = true,
): PasteProcessorResult | undefined {
    const policy = context.policy;
    if (context.classification === 'internal') return undefined;
    if (context.classification === 'files') {
        throw new Error('File paste and drop require an UploadService.');
    }
    if (policy === 'plain-text') {
        return Object.freeze({
            html: '',
            policy: 'plain-text',
            text: context.text,
        });
    }
    if (context.html.length === 0) {
        return Object.freeze({ html: '', policy, text: context.text });
    }
    const children = readExternalPasteChildren(context.html);
    if (policy === 'preserve') {
        return Object.freeze({
            html: preservePasteSource(context.html, children),
            policy,
            text: context.text,
        });
    }
    let cleanedChildren = children.flatMap((node) =>
        cleanNode(node, policy, retainStyles),
    );
    if (!retainStyles && !retainAlignment)
        cleanedChildren = cleanedChildren.map(withoutPresentationStyles);
    const normalizedChildren =
        policy === 'semantic'
            ? normalizeSemanticWhitespace(cleanedChildren, '#root')
            : cleanedChildren;
    return Object.freeze({
        html: serializeHtmlFragment(
            Object.freeze({
                children: Object.freeze(normalizedChildren),
                type: 'document-fragment',
            }),
        ),
        policy,
        text: context.text,
    });
}

function withoutPresentationStyles(node: HtmlChildNode): HtmlChildNode {
    if (node.type !== 'element') return node;
    return Object.freeze({
        ...node,
        attributes: Object.freeze(
            node.attributes.filter((attribute) => attribute.name !== 'style'),
        ),
        children: Object.freeze(node.children.map(withoutPresentationStyles)),
    });
}

function preservePasteSource(
    html: string,
    children: readonly HtmlChildNode[],
): string {
    // Clipboard document shells are transport, not part of the selected fragment.
    const start = /<!--\s*StartFragment\s*-->/iu.exec(html);
    const end = /<!--\s*EndFragment\s*-->/iu.exec(html);
    if (start !== null && end !== null) {
        html = html.slice(start.index + start[0].length, end.index);
        children = parseHtmlFragment(html).document.children;
    } else if (/<!doctype\s|<\/?(?:html|head|body)(?:\s|>)/iu.test(html)) {
        const first = children[0]?.source?.start.offset;
        const last = children.at(-1)?.source?.end.offset;
        html =
            first === undefined || last === undefined
                ? ''
                : html.slice(first, last);
        children = parseHtmlFragment(html).document.children;
    }
    const edits: { start: number; end: number; value: string }[] = [];
    const visit = (nodes: readonly HtmlChildNode[]): void => {
        for (const node of nodes) {
            if (node.type !== 'element') continue;
            if (REMOVED_ELEMENTS.has(node.tagName)) {
                if (node.source)
                    edits.push({
                        start: node.source.start.offset,
                        end: node.source.end.offset,
                        value: '',
                    });
                continue;
            }
            const attributes = cleanAttributes(
                node.tagName,
                node.attributes,
                'preserve',
                true,
                true,
            );
            for (const attribute of node.attributes) {
                const retained = attributes.find(
                    (candidate) => candidate.name === attribute.name,
                );
                if (!retained && attribute.source) {
                    let start = attribute.source.start.offset;
                    while (
                        start > 0 &&
                        /[\t\n\r ]/u.test(html[start - 1] ?? '')
                    )
                        start--;
                    edits.push({
                        start,
                        end: attribute.source.end.offset,
                        value: '',
                    });
                }
            }
            visit(node.children);
        }
    };
    visit(children);
    for (const edit of edits.sort((a, b) => b.start - a.start))
        html = html.slice(0, edit.start) + edit.value + html.slice(edit.end);
    return html;
}

function readExternalPasteChildren(html: string): readonly HtmlChildNode[] {
    const start = /<!--\s*StartFragment\s*-->/iu.exec(html);
    const end = /<!--\s*EndFragment\s*-->/iu.exec(html);
    if (start !== null || end !== null) {
        if (
            start === null ||
            end === null ||
            end.index < start.index + start[0].length
        ) {
            throw new Error('Invalid HTML clipboard fragment markers.');
        }
        return parseHtmlFragment(
            html.slice(start.index + start[0].length, end.index),
        ).document.children;
    }
    if (/<!doctype\s|<\/?(?:html|head|body)(?:\s|>)/iu.test(html)) {
        const document = parseHtmlDocument(html).document;
        const htmlElement = document.children.find(
            (node) => node.type === 'element' && node.tagName === 'html',
        );
        if (htmlElement?.type !== 'element') {
            throw new Error('Complete HTML documents require a body to paste.');
        }
        const body = htmlElement.children.find(
            (node) => node.type === 'element' && node.tagName === 'body',
        );
        if (body?.type === 'element') return body.children;
        throw new Error('Complete HTML documents require a body to paste.');
    }
    return parseHtmlFragment(html).document.children;
}

function cleanNode(
    node: HtmlChildNode,
    policy: 'preserve' | 'semantic',
    retainStyles: boolean,
    inheritedAlignment?: string,
    literalWhitespace = false,
): readonly HtmlChildNode[] {
    if (node.type === 'text') return [Object.freeze({ ...node })];
    if (node.type === 'comment') {
        return policy === 'preserve' ? [Object.freeze({ ...node })] : [];
    }
    const tagName =
        policy === 'semantic' ? semanticTag(node.tagName) : node.tagName;
    if (REMOVED_ELEMENTS.has(tagName)) return [];
    const preserveWhitespace =
        literalWhitespace || tagName === 'pre' || tagName === 'code';
    const alignment =
        node.attributes
            .filter((attribute) => attribute.name === 'style')
            .flatMap((attribute) =>
                Array.from(
                    attribute.value.matchAll(
                        /(?:^|;)\s*text-align\s*:\s*([a-z]+)/giu,
                    ),
                    (match) => match[1]?.toLowerCase(),
                ),
            )
            .at(-1) ?? inheritedAlignment;
    const cleanedChildren = node.children.flatMap((child) =>
        cleanNode(child, policy, retainStyles, alignment, preserveWhitespace),
    );
    const children =
        policy === 'semantic' && !preserveWhitespace
            ? normalizeSemanticWhitespace(cleanedChildren, tagName)
            : cleanedChildren;
    if (
        policy === 'semantic' &&
        (!SEMANTIC_ELEMENTS.has(tagName) || tagName.includes(':'))
    ) {
        return children;
    }
    const attributes = cleanAttributes(
        tagName,
        node.attributes,
        policy,
        retainStyles,
        inheritedAlignment !== undefined && inheritedAlignment !== 'start',
    );
    if (
        policy === 'semantic' &&
        tagName === 'span' &&
        attributes.length === 0
    ) {
        return children;
    }
    return [
        Object.freeze({
            attributes,
            children: Object.freeze(children),
            namespace: 'html',
            tagName: policy === 'semantic' && tagName === 'div' ? 'p' : tagName,
            type: 'element',
        }),
    ];
}

function normalizeSemanticWhitespace(
    children: readonly HtmlChildNode[],
    parentTag: string,
): readonly HtmlChildNode[] {
    const normalized = children.map((child) =>
        child.type === 'text'
            ? Object.freeze({
                  ...child,
                  value: child.value.replace(/\s+/gu, ' '),
              })
            : child,
    );
    if (BLOCK_CHILD_CONTAINERS.has(parentTag)) {
        return normalized.filter(
            (child) => child.type !== 'text' || child.value !== ' ',
        );
    }
    const first = normalized.at(0);
    const last = normalized.at(-1);
    return normalized
        .map((child, index) => {
            if (child.type !== 'text') return child;
            let value = child.value;
            if (child === first || index === 0) value = value.trimStart();
            if (child === last || index === normalized.length - 1) {
                value = value.trimEnd();
            }
            return Object.freeze({ ...child, value });
        })
        .filter((child) => child.type !== 'text' || child.value.length > 0);
}

function semanticTag(tagName: string): string {
    switch (tagName.toLowerCase()) {
        case 'b':
            return 'strong';
        case 'i':
            return 'em';
        case 'del':
        case 'strike':
            return 's';
        default:
            return tagName.toLowerCase();
    }
}

function cleanAttributes(
    tagName: string,
    attributes: readonly HtmlAttribute[],
    policy: 'preserve' | 'semantic',
    retainStyles: boolean,
    retainDefaultAlignment: boolean,
): readonly HtmlAttribute[] {
    const cleaned: HtmlAttribute[] = [];
    for (const attribute of attributes) {
        const name = attribute.name.toLowerCase();
        if (
            attribute.namespace !== undefined ||
            name.startsWith('on') ||
            name === 'srcdoc' ||
            name === 'contenteditable'
        ) {
            continue;
        }
        if (name === 'href' || name === 'src' || name === 'action') {
            if (!isSafeExternalUrl(attribute.value, name === 'src')) continue;
        }
        if (name === 'style') {
            const style = cleanStyle(
                attribute.value,
                retainStyles,
                policy,
                retainDefaultAlignment,
            );
            if (style.length > 0) cleaned.push({ name, value: style });
            continue;
        }
        if (name === 'class') {
            if (policy === 'preserve') {
                cleaned.push({ name, value: attribute.value });
            }
            continue;
        }
        if (
            policy === 'preserve' ||
            isSemanticAttribute(tagName, name, attribute.value)
        ) {
            cleaned.push({ name, value: attribute.value });
        }
    }
    return Object.freeze(cleaned.map((attribute) => Object.freeze(attribute)));
}

function isSemanticAttribute(
    tagName: string,
    name: string,
    value: string,
): boolean {
    if (name === 'title' || name === 'lang' || name === 'dir') return true;
    if (/^aria-[a-z0-9-]+$/u.test(name)) return true;
    if (tagName === 'a') return ['href', 'rel', 'target'].includes(name);
    if (tagName === 'img') {
        return (
            name === 'src' ||
            name === 'alt' ||
            ((name === 'width' || name === 'height') &&
                /^\d{1,5}$/u.test(value))
        );
    }
    if (tagName === 'ol') {
        return (
            (name === 'start' && /^-?\d{1,6}$/u.test(value)) ||
            (name === 'type' && /^(?:1|a|A|i|I)$/u.test(value))
        );
    }
    if (tagName === 'ul') {
        return name === 'type' && /^(?:disc|circle|square)$/u.test(value);
    }
    if (tagName === 'td' || tagName === 'th') {
        return (
            ((name === 'rowspan' || name === 'colspan') &&
                /^\d{1,3}$/u.test(value)) ||
            (name === 'scope' && /^(?:row|col|rowgroup|colgroup)$/u.test(value))
        );
    }
    if (tagName === 'colgroup' || tagName === 'col') {
        return (
            (name === 'span' && /^\d{1,3}$/u.test(value)) ||
            (tagName === 'col' &&
                name === 'width' &&
                /^(?:\d{1,4}|\d{1,4}px|100%|\d{1,2}%)$/u.test(value))
        );
    }
    return false;
}

function cleanStyle(
    value: string,
    retainStyles: boolean,
    policy: 'preserve' | 'semantic',
    retainDefaultAlignment: boolean,
): string {
    if (policy === 'preserve') {
        // Keep authored declarations and their spelling, rather than applying
        // the semantic presentation allowlist to a preservation request.
        return /url\s*\(|expression\s*\(|javascript:|\/\*|\\/iu.test(value) ||
            Array.from(value).some((character) => {
                const code = character.charCodeAt(0);
                return code < 32 && code !== 9 && code !== 10 && code !== 13;
            })
            ? ''
            : value;
    }
    const allowed = retainStyles
        ? new Set([
              'background-color',
              'color',
              'font-family',
              'font-size',
              'font-style',
              'font-weight',
              'text-align',
              'text-decoration',
          ])
        : new Set(['text-align']);
    const declarations: string[] = [];
    for (const declaration of value.split(';')) {
        const separator = declaration.indexOf(':');
        if (separator < 1) continue;
        const name = declaration.slice(0, separator).trim().toLowerCase();
        const candidate = declaration.slice(separator + 1).trim();
        // Native web clipboards materialize the default logical alignment.
        // Do not turn that presentation default into saved paragraph styles.
        // Explicit preservation/style-retention policies keep authored values.
        if (
            policy === 'semantic' &&
            !retainStyles &&
            !retainDefaultAlignment &&
            name === 'text-align' &&
            /^start$/iu.test(candidate)
        )
            continue;
        if (
            allowed.has(name) &&
            candidate.length > 0 &&
            candidate.length <= 128 &&
            !/url\s*\(|expression\s*\(|javascript:/iu.test(candidate)
        ) {
            declarations.push(`${name}: ${candidate}`);
        }
    }
    return declarations.length === 0 ? '' : `${declarations.join('; ')};`;
}

function isSafeExternalUrl(value: string, image: boolean): boolean {
    const normalized = Array.from(value.trim())
        .filter((character) => (character.codePointAt(0) ?? 0) > 0x20)
        .join('');
    if (normalized.startsWith('#') || /^(?:\.?\.?\/|\/)/u.test(normalized)) {
        return true;
    }
    if (!/^[a-z][a-z0-9+.-]*:/iu.test(normalized)) return true;
    if (/^(?:https?):/iu.test(normalized)) return true;
    if (!image && /^(?:mailto|tel):/iu.test(normalized)) return true;
    return (
        image && /^data:image\/(?:gif|jpeg|png|webp);base64,/iu.test(normalized)
    );
}

function readBoolean(value: unknown, fallback: boolean, path: string): boolean {
    if (value === undefined) return fallback;
    if (typeof value !== 'boolean')
        throw new TypeError(`${path} must be boolean.`);
    return value;
}
