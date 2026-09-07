const blockTags = new Set(
    'address article aside blockquote caption dd div dl dt fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hr li main nav ol p pre section table tbody td tfoot th thead tr ul'.split(
        ' ',
    ),
);
const excludedTags = new Set([
    'script',
    'style',
    'template',
    'noscript',
    'iframe',
]);
const cjk = '[\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}]';
const wordRun = `(?!${cjk})[\\p{L}\\p{N}](?:(?!${cjk})[\\p{L}\\p{M}\\p{N}])*`;
const wordPattern = new RegExp(`${cjk}|${wordRun}(?:['’]${wordRun})*`, 'gu');

/** Deterministic units: CJK characters, other letter/number runs, no punctuation. */
export function countTextUnits(text: string): number {
    let count = 0;
    for (const match of text.matchAll(wordPattern)) {
        if (match[0].length > 0) count += 1;
    }
    return count;
}

export function countCodePoints(text: string): number {
    let count = 0;
    for (let index = 0; index < text.length; count += 1) {
        const code = text.codePointAt(index);
        index += code !== undefined && code > 0xffff ? 2 : 1;
    }
    return count;
}

/** Detached semantic text only: no live layout, CSS cascade, or document writes. */
export function countDocumentStatus(document: Document, source: string) {
    const template = document.createElement('template');
    template.innerHTML = source;
    let characters = 0;
    let words = 0;
    let parts: string[] = [];
    const flush = (preformatted: boolean): void => {
        const raw = parts.join('');
        const text = preformatted
            ? raw
            : raw.replace(/[ \t\r\n\f]+/gu, ' ').trim();
        if (text.trim().length > 0) {
            characters += countCodePoints(text);
            words += countTextUnits(text);
        }
        parts = [];
    };
    type Task = { node: Node; preformatted: boolean } | { boundary: boolean };
    const pending: Task[] = [{ node: template.content, preformatted: false }];
    while (pending.length > 0) {
        const task = pending.pop();
        if (task === undefined) break;
        if ('boundary' in task) {
            flush(task.boundary);
            continue;
        }
        const { node, preformatted } = task;
        if (node.nodeType === 3) {
            parts.push(node.nodeValue ?? '');
            continue;
        }
        if (node.nodeType !== 1 && node.nodeType !== 11) continue;
        const element = node.nodeType === 1 ? (node as HTMLElement) : undefined;
        if (
            element !== undefined &&
            (excludedTags.has(element.localName) ||
                element.hasAttribute('hidden') ||
                element.style?.display === 'none' ||
                element.style?.visibility === 'hidden')
        )
            continue;
        if (element?.localName === 'br') {
            if (preformatted) parts.push('\n');
            else flush(false);
            continue;
        }
        const block = element !== undefined && blockTags.has(element.localName);
        const pre = preformatted || element?.localName === 'pre';
        if (block) {
            flush(preformatted);
            pending.push({ boundary: pre });
        }
        for (let index = node.childNodes.length - 1; index >= 0; index -= 1) {
            const child = node.childNodes[index];
            if (child !== undefined)
                pending.push({ node: child, preformatted: pre });
        }
    }
    flush(false);
    return Object.freeze({
        characters,
        words,
        sourceCharacters: countCodePoints(source),
    });
}
