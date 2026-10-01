import {
    parseHtmlDocument,
    parseHtmlFragment,
    type HtmlDocumentChildNode,
    type HtmlElement,
    type SourceRange,
} from '@soeditor/html';
import { isHtmlDocumentSource } from './formatting-validation.js';

type Node = HtmlDocumentChildNode;
interface Edit {
    start: number;
    end: number;
    value: string;
}
const blocks = new Set([
    'address',
    'article',
    'aside',
    'blockquote',
    'body',
    'caption',
    'dd',
    'details',
    'dialog',
    'div',
    'dl',
    'dt',
    'fieldset',
    'figcaption',
    'figure',
    'footer',
    'form',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'head',
    'header',
    'hgroup',
    'hr',
    'html',
    'li',
    'main',
    'menu',
    'nav',
    'ol',
    'p',
    'pre',
    'section',
    'summary',
    'table',
    'tbody',
    'td',
    'tfoot',
    'th',
    'thead',
    'tr',
    'ul',
]);
const structural = new Set([
    'html',
    'head',
    'table',
    'colgroup',
    'tbody',
    'tfoot',
    'thead',
    'tr',
]);
const literal = new Set(['pre', 'code', 'textarea', 'script', 'style']);

function readTree(source: string): readonly Node[] {
    return isHtmlDocumentSource(source)
        ? parseHtmlDocument(source).document.children
        : parseHtmlFragment(source).document.children;
}
function raw(source: string, range: SourceRange): string {
    return source.slice(range.start.offset, range.end.offset);
}
function whitespace(node: Node, source: string): boolean {
    return (
        node.type === 'text' &&
        /^[\t\r\n ]+$/u.test(node.value) &&
        node.source !== undefined &&
        // Document parsing can merge/relocate whitespace across closing tags.
        // Encoded spaces still count as authored content and are preserved.
        (/^[\t\r\n ]+$/u.test(raw(source, node.source)) ||
            /[<>]/u.test(raw(source, node.source)))
    );
}
function protectedElement(element: HtmlElement): boolean {
    return (
        element.namespace !== 'html' ||
        literal.has(element.tagName) ||
        element.attributes.some(
            (attribute) =>
                attribute.name === 'style' &&
                /(?:^|;)\s*white-space\s*:\s*(?:pre(?:-wrap|-line)?|break-spaces)\b/iu.test(
                    attribute.value,
                ),
        )
    );
}
function block(node: Node | undefined): boolean {
    return (
        node?.type === 'doctype' ||
        (node?.type === 'element' &&
            node.namespace === 'html' &&
            blocks.has(node.tagName))
    );
}
function layoutGap(
    parent: string | undefined,
    previous: Node | undefined,
    next: Node | undefined,
): boolean {
    return (
        (parent !== undefined && structural.has(parent)) ||
        (block(previous) && block(next)) ||
        (previous === undefined && block(next)) ||
        (block(previous) && next === undefined)
    );
}
function apply(source: string, edits: readonly Edit[]): string {
    let result = '';
    let offset = 0;
    for (const edit of [...edits].sort(
        (a, b) => a.start - b.start || a.end - b.end,
    )) {
        if (edit.start < offset)
            throw new Error('Overlapping HTML formatting edits.');
        result += source.slice(offset, edit.start) + edit.value;
        offset = edit.end;
    }
    return result + source.slice(offset);
}

/** Apply indentation without rewriting attribute values, text, or embedded data. */
export function preserveFormattedContent(
    source: string,
    formatted: string,
): string {
    const edits: Edit[] = [];
    const restore = (
        original: SourceRange | undefined,
        output: SourceRange | undefined,
    ): void => {
        if (original !== undefined && output !== undefined)
            edits.push({
                start: output.start.offset,
                end: output.end.offset,
                value: raw(source, original),
            });
    };
    const visit = (
        originals: readonly Node[],
        outputs: readonly Node[],
        parent?: string,
        originalBounds = [0, source.length],
        outputBounds = [0, formatted.length],
    ): void => {
        const before = originals.filter((node) => !whitespace(node, source));
        const after = outputs.filter((node) => !whitespace(node, formatted));
        if (before.length !== after.length)
            throw new Error('HTML formatting changed the content structure.');
        for (let index = 0; index < before.length; index++) {
            const original = before[index];
            const output = after[index];
            if (
                original === undefined ||
                output === undefined ||
                original.type !== output.type
            )
                throw new Error('HTML formatting changed a content node.');
            if (original.type === 'element' && output.type === 'element') {
                if (
                    original.tagName !== output.tagName ||
                    original.namespace !== output.namespace ||
                    original.attributes.length !== output.attributes.length
                )
                    throw new Error('HTML formatting changed an element.');
                if (protectedElement(original)) {
                    restore(original.source, output.source);
                    continue;
                }
                original.attributes.forEach((attribute, index) => {
                    const candidate = output.attributes[index];
                    if (
                        candidate === undefined ||
                        attribute.name !== candidate.name ||
                        attribute.namespace !== candidate.namespace
                    )
                        throw new Error(
                            'HTML formatting changed an attribute.',
                        );
                    restore(attribute.source, candidate.source);
                });
                visit(
                    original.children,
                    output.children,
                    original.tagName,
                    [
                        original.source?.startTag?.end.offset ??
                            original.source?.start.offset ??
                            0,
                        original.source?.endTag?.start.offset ??
                            original.source?.end.offset ??
                            source.length,
                    ],
                    [
                        output.source?.startTag?.end.offset ??
                            output.source?.start.offset ??
                            0,
                        output.source?.endTag?.start.offset ??
                            output.source?.end.offset ??
                            formatted.length,
                    ],
                );
            } else restore(original.source, output.source);
        }
        // Indentation may change between ordinary blocks; inline gaps remain literal.
        for (let index = 0; index <= before.length; index++) {
            const previous = before[index - 1];
            const next = before[index];
            if (layoutGap(parent, previous, next)) continue;
            const start = previous?.source?.end.offset ?? originalBounds[0];
            const end = next?.source?.start.offset ?? originalBounds[1];
            const outputStart =
                after[index - 1]?.source?.end.offset ?? outputBounds[0];
            const outputEnd =
                after[index]?.source?.start.offset ?? outputBounds[1];
            if (
                start === undefined ||
                end === undefined ||
                outputStart === undefined ||
                outputEnd === undefined
            )
                continue;
            const value = source.slice(start, end);
            if (
                /^[\t\r\n ]*$/u.test(value) &&
                /^[\t\r\n ]*$/u.test(formatted.slice(outputStart, outputEnd))
            )
                edits.push({ start: outputStart, end: outputEnd, value });
        }
    };
    visit(readTree(source), readTree(formatted));
    return apply(formatted, edits);
}

/** Remove only source indentation/tag whitespace; never reserialize the HTML tree. */
export function compactHtmlSource(source: string): string {
    const edits: Edit[] = [];
    const tokens: {
        node: Node;
        range: SourceRange;
        parent: string | undefined;
    }[] = [];
    const protectedRanges: SourceRange[] = [];
    const visit = (children: readonly Node[], parent?: string): void => {
        for (const node of children) {
            if (node.type === 'element') {
                const opening = node.source?.startTag;
                const closing = node.source?.endTag;
                if (opening !== undefined)
                    tokens.push({ node, range: opening, parent: node.tagName });
                if (closing !== undefined)
                    tokens.push({ node, range: closing, parent });
                if (protectedElement(node)) {
                    if (node.source !== undefined)
                        protectedRanges.push(node.source);
                    continue;
                }
                if (opening !== undefined)
                    edits.push({
                        start: opening.start.offset,
                        end: opening.end.offset,
                        value: compactTag(raw(source, opening)),
                    });
                visit(node.children, node.tagName);
            } else if (
                (node.type === 'comment' || node.type === 'doctype') &&
                node.source !== undefined
            ) {
                tokens.push({ node, range: node.source, parent });
            }
        }
    };
    visit(readTree(source));
    tokens.sort((a, b) => a.range.start.offset - b.range.start.offset);
    protectedRanges.sort((a, b) => a.start.offset - b.start.offset);
    let protectedIndex = 0;
    const preceding: (Node | undefined)[] = [];
    const following: (Node | undefined)[] = [];
    let previousNode: Node | undefined;
    for (let index = 0; index <= tokens.length; index++) {
        preceding.push(previousNode);
        const node = tokens[index]?.node;
        if (node !== undefined && node.type !== 'comment') previousNode = node;
    }
    let nextNode: Node | undefined;
    for (let index = tokens.length; index >= 0; index--) {
        const node = tokens[index]?.node;
        if (node !== undefined && node.type !== 'comment') nextNode = node;
        following[index] = nextNode;
    }
    for (let index = 0; index <= tokens.length; index++) {
        const start = tokens[index - 1]?.range.end.offset ?? 0;
        const end = tokens[index]?.range.start.offset ?? source.length;
        if (
            end <= start ||
            !/^[\t\r\n ]+$/u.test(source.slice(start, end)) ||
            !/[\r\n]/u.test(source.slice(start, end))
        )
            continue;
        while (
            (protectedRanges[protectedIndex]?.end.offset ?? Infinity) <= start
        )
            protectedIndex++;
        const protectedRange = protectedRanges[protectedIndex];
        if (
            protectedRange !== undefined &&
            protectedRange.start.offset <= start &&
            end <= protectedRange.end.offset
        )
            continue;
        const before = preceding[index];
        const after = following[index];
        if (
            layoutGap(tokens[index - 1]?.parent, before, after) ||
            (before?.type === 'doctype' && block(after))
        )
            edits.push({ start, end, value: '' });
    }
    return apply(source, edits);
}
function compactTag(source: string): string {
    let result = '';
    let quote: string | undefined;
    for (let index = 0; index < source.length; index++) {
        const character = source[index];
        if (character === undefined) continue;
        if (quote !== undefined) {
            result += character;
            if (character === quote) quote = undefined;
        } else if (character === '"' || character === "'") {
            quote = character;
            result += character;
        } else if (/[\t\r\n ]/u.test(character)) {
            while (
                source[index + 1] !== undefined &&
                /[\t\r\n ]/u.test(source[index + 1] ?? '')
            )
                index++;
            if (source[index + 1] !== '>') result += ' ';
        } else result += character;
    }
    return result;
}
