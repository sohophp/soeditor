import type { EditingPoint, EditingSelection } from '@soeditor/engine';
import {
    parseHtmlFragment,
    type HtmlChildNode,
    type HtmlElement,
    type HtmlText,
    type SourceRange,
} from '@soeditor/html';

/** Maps a WYSIWYG selection to the corresponding canonical source range. */
export function sourceRangeForEditingSelection(
    source: string,
    selection: EditingSelection,
    document: Document,
): SourceRange | undefined {
    const fragment = parseHtmlFragment(source);
    const blocks = sourceEditingBlocks(fragment.document.children);
    const anchor = sourceOffsetForEditingPoint(
        source,
        blocks,
        selection.anchor,
        document,
    );
    const focus = sourceOffsetForEditingPoint(
        source,
        blocks,
        selection.focus,
        document,
    );
    if (anchor === undefined || focus === undefined) return undefined;
    return sourceRange(
        source,
        Math.min(anchor, focus),
        Math.max(anchor, focus),
    );
}

function sourceEditingBlocks(
    children: readonly HtmlChildNode[],
): readonly HtmlElement[] {
    const blocks: HtmlElement[] = [];
    const appendListItems = (node: HtmlChildNode): void => {
        if (node.type !== 'element') return;
        if (node.tagName === 'li') blocks.push(node);
        for (const child of node.children) appendListItems(child);
    };
    for (const node of children) {
        if (node.type !== 'element') continue;
        if (node.tagName === 'ol' || node.tagName === 'ul') {
            for (const child of node.children) appendListItems(child);
        } else {
            blocks.push(node);
        }
    }
    return blocks;
}

function sourceOffsetForEditingPoint(
    source: string,
    blocks: readonly HtmlElement[],
    point: EditingPoint,
    document: Document,
): number | undefined {
    const block = blocks[point.block];
    if (block === undefined) return undefined;
    const texts: HtmlText[] = [];
    const appendText = (node: HtmlChildNode): void => {
        if (node.type === 'text') texts.push(node);
        else if (node.type === 'element') {
            for (const child of node.children) appendText(child);
        }
    };
    for (const child of block.children) appendText(child);
    let remaining = point.offset;
    for (const text of texts) {
        if (text.source === undefined) continue;
        if (remaining <= text.value.length) {
            const raw = source.slice(
                text.source.start.offset,
                text.source.end.offset,
            );
            return (
                text.source.start.offset +
                rawOffsetForDecodedText(raw, remaining, document)
            );
        }
        remaining -= text.value.length;
    }
    return block.source?.endTag?.start.offset ?? block.source?.end.offset;
}

function rawOffsetForDecodedText(
    raw: string,
    decodedOffset: number,
    document: Document,
): number {
    if (!raw.includes('&')) return Math.min(decodedOffset, raw.length);
    const decoder = document.createElement('textarea');
    let rawOffset = 0;
    let decodedLength = 0;
    while (rawOffset < raw.length && decodedLength < decodedOffset) {
        if (raw[rawOffset] === '&') {
            const end = raw.indexOf(';', rawOffset + 1);
            if (end !== -1) {
                const entity = raw.slice(rawOffset, end + 1);
                decoder.innerHTML = entity;
                const value = decoder.value;
                if (value !== entity) {
                    if (decodedLength + value.length > decodedOffset) break;
                    decodedLength += value.length;
                    rawOffset = end + 1;
                    continue;
                }
            }
        }
        const codePoint = raw.codePointAt(rawOffset);
        if (codePoint === undefined) break;
        const character = String.fromCodePoint(codePoint);
        decodedLength += character.length;
        rawOffset += character.length;
    }
    return rawOffset;
}

function sourceRange(
    source: string,
    startOffset: number,
    endOffset: number,
): SourceRange {
    const position = (offset: number) => {
        const before = source.slice(0, offset);
        const lines = before.split('\n');
        return {
            column: (lines.at(-1)?.length ?? 0) + 1,
            line: lines.length,
            offset,
        };
    };
    return { end: position(endOffset), start: position(startOffset) };
}
