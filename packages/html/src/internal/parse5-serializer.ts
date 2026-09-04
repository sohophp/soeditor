import { serialize } from 'parse5';

import type { HtmlDocument, HtmlDocumentFragment } from '../nodes.js';
import type { HtmlSerializer } from '../serializer.js';
import {
    convertToParse5Document,
    convertToParse5Fragment,
} from './to-parse5.js';

/** @internal Default semantic serializer backed by parse5. */
export class Parse5HtmlSerializer implements HtmlSerializer {
    serializeDocument(document: HtmlDocument): string {
        return normalizeVoidElementSyntax(
            serialize(convertToParse5Document(document)),
        );
    }

    serializeFragment(fragment: HtmlDocumentFragment): string {
        return normalizeVoidElementSyntax(
            serialize(convertToParse5Fragment(fragment)),
        );
    }
}

/**
 * Keep the persisted HTML spelling of line breaks stable. HTML accepts both
 * `<br>` and XML-style `<br />`; SoEditor uses the latter for readable,
 * deterministic CMS output. parse5 intentionally emits the HTML spelling,
 * so normalize only the HTML `br` start tags after serialization.
 */
function normalizeVoidElementSyntax(source: string): string {
    const output: string[] = [];
    const rawTextTags = new Set(['script', 'style', 'textarea', 'title']);
    const lowerSource = source.toLowerCase();
    let index = 0;
    let rawTextTag: string | undefined;
    while (index < source.length) {
        if (rawTextTag !== undefined) {
            const closing = findRawTextClosing(lowerSource, rawTextTag, index);
            if (closing < 0) {
                output.push(source.slice(index));
                break;
            }
            output.push(source.slice(index, closing));
            index = closing;
            rawTextTag = undefined;
            continue;
        }
        if (source.startsWith('<!--', index)) {
            const end = source.indexOf('-->', index + 4);
            const next = end < 0 ? source.length : end + 3;
            output.push(source.slice(index, next));
            index = next;
            continue;
        }
        if (source[index] !== '<') {
            output.push(source[index] ?? '');
            index += 1;
            continue;
        }
        const end = findTagEnd(source, index + 1);
        if (end < 0) {
            output.push(source.slice(index));
            break;
        }
        const tag = source.slice(index, end + 1);
        const match = /^<([A-Za-z][\w:-]*)([\s\S]*)>$/u.exec(tag);
        if (match === null) {
            output.push(tag);
            index = end + 1;
            continue;
        }
        const name = match[1]?.toLowerCase();
        const body = match[2] ?? '';
        if (name === 'br' && !/^\s*\//u.test(body)) {
            const attributes = body.trim();
            output.push(
                attributes.length === 0 ? '<br />' : `<br ${attributes} />`,
            );
        } else {
            output.push(tag);
        }
        if (
            name !== undefined &&
            rawTextTags.has(name) &&
            !/^\s*\//u.test(body)
        ) {
            rawTextTag = name;
        }
        index = end + 1;
    }
    return output.join('');
}

function findTagEnd(source: string, start: number): number {
    let quote: '"' | "'" | undefined;
    for (let index = start; index < source.length; index += 1) {
        const character = source[index];
        if (quote !== undefined) {
            if (character === quote) quote = undefined;
        } else if (character === '"' || character === "'") {
            quote = character;
        } else if (character === '>') {
            return index;
        }
    }
    return -1;
}

function findRawTextClosing(
    lowerSource: string,
    tagName: string,
    start: number,
): number {
    const needle = `</${tagName}`;
    let index = start;
    while (true) {
        const candidate = lowerSource.indexOf(needle, index);
        if (candidate < 0) return -1;
        const next = lowerSource[candidate + needle.length];
        if (
            next === '>' ||
            next === '/' ||
            next === undefined ||
            /\s/u.test(next)
        ) {
            return candidate;
        }
        index = candidate + needle.length;
    }
}
