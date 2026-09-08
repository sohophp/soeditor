import type { HtmlElement } from '@soeditor/html';
import type { CmsVideoOptions } from './video.js';

export const attribute = (node: HtmlElement, name: string): string =>
    node.attributes.find((item) => item.name === name)?.value ?? '';

export function mediaElement(node: HtmlElement): HtmlElement | undefined {
    if (node.tagName === 'video' || node.tagName === 'iframe') return node;
    if (node.tagName !== 'figure') return undefined;
    return node.children.find(
        (child): child is HtmlElement =>
            child.type === 'element' &&
            (child.tagName === 'video' || child.tagName === 'iframe'),
    );
}

export function youtubeId(value: string): string | undefined {
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        return undefined;
    }
    if (url.protocol !== 'https:' || url.username || url.password || url.port)
        return undefined;
    let id: string | undefined;
    if (url.hostname === 'youtu.be') id = url.pathname.slice(1);
    else if (
        [
            'youtube.com',
            'www.youtube.com',
            'm.youtube.com',
            'www.youtube-nocookie.com',
        ].includes(url.hostname)
    ) {
        id =
            url.pathname === '/watch'
                ? (url.searchParams.get('v') ?? undefined)
                : /^\/(?:embed|shorts)\/([^/]+)$/u.exec(url.pathname)?.[1];
    }
    return id !== undefined && /^[\w-]{11}$/u.test(id) ? id : undefined;
}

export function mediaUrl(
    value: string,
    base: string,
    options: CmsVideoOptions,
): string {
    const trimmed = value.trim();
    if (
        !trimmed ||
        [...trimmed].some(
            (char) =>
                char.charCodeAt(0) <= 32 ||
                char.charCodeAt(0) === 127 ||
                char === '\\',
        ) ||
        trimmed.startsWith('//')
    )
        throw new Error('Enter a valid video or asset URL.');
    const url = new URL(trimmed, base);
    const origin = new URL(base).origin;
    if (
        url.username ||
        url.password ||
        (url.protocol !== 'https:' &&
            !(url.protocol === 'http:' && url.origin === origin))
    )
        throw new Error('Use HTTPS or a same-origin asset URL.');
    if (
        options.allowedMediaOrigins !== undefined &&
        url.origin !== origin &&
        !options.allowedMediaOrigins.includes(url.origin)
    )
        throw new Error('This asset origin is not allowed.');
    return trimmed;
}

/** Split only top-level CSS declarations, retaining quoted/custom values. */
export function styleDeclarations(style: string): readonly string[] {
    const result: string[] = [];
    let start = 0;
    let quote = '';
    let depth = 0;
    let comment = false;
    for (let index = 0; index < style.length; index += 1) {
        const char = style[index];
        const next = style[index + 1];
        if (comment) {
            if (char === '*' && next === '/') {
                comment = false;
                index += 1;
            }
            continue;
        }
        if (char === '\\') {
            index += 1;
            continue;
        }
        if (quote) {
            if (char === quote) quote = '';
            continue;
        }
        if (char === '/' && next === '*') {
            comment = true;
            index += 1;
            continue;
        }
        if (char === '"' || char === "'") {
            quote = char;
            continue;
        }
        if (char === '(' || char === '[' || char === '{') depth += 1;
        if (char === ')' || char === ']' || char === '}')
            depth = Math.max(0, depth - 1);
        if (char === ';' && depth === 0) {
            result.push(style.slice(start, index));
            start = index + 1;
        }
    }
    result.push(style.slice(start));
    return result.filter((value) => value.trim().length > 0);
}

function withoutStyleComments(value: string): string {
    let result = '';
    let cursor = 0;
    while (cursor < value.length) {
        const start = value.indexOf('/*', cursor);
        if (start < 0) return result + value.slice(cursor);
        result += value.slice(cursor, start);
        const end = value.indexOf('*/', start + 2);
        if (end < 0) return result;
        cursor = end + 2;
    }
    return result;
}

export function styleName(declaration: string): string {
    return (withoutStyleComments(declaration).split(':', 1)[0] ?? '')
        .trim()
        .toLowerCase();
}

function styleValue(node: HtmlElement, name: string): string {
    const declaration = styleDeclarations(attribute(node, 'style'))
        .slice()
        .reverse()
        .find((value) => styleName(value) === name);
    const plain =
        declaration === undefined
            ? undefined
            : withoutStyleComments(declaration);
    return plain === undefined
        ? ''
        : plain
              .slice(plain.indexOf(':') + 1)
              .replace(/\s*!important\s*$/iu, '')
              .trim();
}

export function videoWidth(node: HtmlElement): string {
    return (
        styleValue(node, 'width') ||
        attribute(node, 'data-video-width') ||
        attribute(node, 'width') ||
        '100%'
    ).replace(/px$/iu, '');
}

export function videoRatio(node: HtmlElement): string {
    return (
        styleValue(node, 'aspect-ratio') ||
        attribute(node, 'data-video-ratio') ||
        'auto'
    )
        .replace(/\s/gu, '')
        .replace('/', ':');
}

export function videoAlignment(node: HtmlElement): 'left' | 'center' | 'right' {
    const left = styleValue(node, 'margin-left');
    const right = styleValue(node, 'margin-right');
    if (left === 'auto' && right === 'auto') return 'center';
    if (left === 'auto' && /^(?:0|0px)$/u.test(right)) return 'right';
    if (right === 'auto' && /^(?:0|0px)$/u.test(left)) return 'left';
    const value = attribute(node, 'data-align');
    return value === 'left' || value === 'right' ? value : 'center';
}
