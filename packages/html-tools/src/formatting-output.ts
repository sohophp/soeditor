/**
 * Prettier deliberately hangs `>` on a following line for whitespace-sensitive
 * inline HTML. Join only whitespace occurring inside a tag immediately before
 * its closing bracket; text, quoted attributes, comments, and raw text remain
 * unchanged.
 */
export function keepTagClosingBracketsInline(source: string): string {
    let result = '';
    let inTag = false;
    let quote: '"' | "'" | undefined;
    let rawTextTag: 'script' | 'style' | undefined;
    let tagStart = -1;
    for (let index = 0; index < source.length; index += 1) {
        const character = source[index]!;
        if (!inTag) {
            if (rawTextTag !== undefined) {
                if (!beginsRawTextClosingTag(source, index, rawTextTag)) {
                    result += character;
                    continue;
                }
                inTag = true;
                tagStart = index;
                result += character;
                continue;
            }
            if (source.startsWith('<!--', index)) {
                const end = source.indexOf('-->', index + 4);
                if (end === -1) {
                    result += source.slice(index);
                    break;
                }
                result += source.slice(index, end + 3);
                index = end + 2;
                continue;
            }
            result += character;
            if (character === '<' && beginsHtmlTag(source[index + 1])) {
                inTag = true;
                tagStart = index;
            }
            continue;
        }
        if (quote !== undefined) {
            result += character;
            if (character === quote) quote = undefined;
            continue;
        }
        if (character === '"' || character === "'") {
            quote = character;
            result += character;
            continue;
        }
        if (character === '>') {
            const tag = source.slice(tagStart, index + 1);
            inTag = false;
            result += character;
            if (/^<script(?:\s|>)/iu.test(tag)) rawTextTag = 'script';
            else if (/^<style(?:\s|>)/iu.test(tag)) rawTextTag = 'style';
            else if (
                rawTextTag !== undefined &&
                new RegExp(`^<\\/${rawTextTag}(?:\\s|>)`, 'iu').test(tag)
            ) {
                rawTextTag = undefined;
            }
            continue;
        }
        if (character === '\n' || character === '\r') {
            let next = index + 1;
            if (character === '\r' && source[next] === '\n') next += 1;
            while (source[next] === ' ' || source[next] === '\t') next += 1;
            if (source[next] === '>') {
                index = next - 1;
                continue;
            }
        }
        result += character;
    }
    return result;
}

function beginsHtmlTag(character: string | undefined): boolean {
    return character !== undefined && /[!/?A-Za-z]/u.test(character);
}

function beginsRawTextClosingTag(
    source: string,
    index: number,
    tagName: 'script' | 'style',
): boolean {
    const candidate = source.slice(index, index + tagName.length + 3);
    return new RegExp(`^<\\/${tagName}(?:\\s|>)`, 'iu').test(candidate);
}
