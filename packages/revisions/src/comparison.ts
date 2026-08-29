import {
    parseHtmlDocument,
    parseHtmlFragment,
    type HtmlAttribute,
    type HtmlNode,
} from '@soeditor/html';
import type { DocumentFormat } from '@soeditor/core';

const MAX_COMPARISON_CHANGES = 2_000;

export type RevisionChangeKind = 'changed' | 'inserted' | 'removed';

export interface RevisionChange {
    readonly after?: string;
    readonly before?: string;
    readonly kind: RevisionChangeKind;
    readonly path: string;
}

export interface RevisionComparison {
    readonly changes: readonly RevisionChange[];
    readonly equivalent: boolean;
    readonly format: DocumentFormat;
    readonly truncated: boolean;
}

/** Creates a bounded semantic HTML-tree or exact Markdown-line comparison. */
export function compareRevisionSources(
    format: DocumentFormat,
    before: string,
    after: string,
): RevisionComparison {
    if (format === 'markdown') {
        return compareValues(
            format,
            before.split('\n'),
            after.split('\n'),
            'line',
        );
    }
    const document = isCompleteDocument(before) || isCompleteDocument(after);
    const left = document
        ? parseHtmlDocument(before).document
        : parseHtmlFragment(before).document;
    const right = document
        ? parseHtmlDocument(after).document
        : parseHtmlFragment(after).document;
    return compareValues(
        format,
        semanticNode(left),
        semanticNode(right),
        'document',
    );
}

function compareValues(
    format: DocumentFormat,
    before: unknown,
    after: unknown,
    root: string,
): RevisionComparison {
    const changes: RevisionChange[] = [];
    let truncated = false;
    const visit = (left: unknown, right: unknown, path: string): void => {
        if (Object.is(left, right)) return;
        if (changes.length === MAX_COMPARISON_CHANGES) {
            truncated = true;
            return;
        }
        if (Array.isArray(left) && Array.isArray(right)) {
            const length = Math.max(left.length, right.length);
            for (let index = 0; index < length && !truncated; index += 1) {
                visit(left[index], right[index], `${path}[${String(index)}]`);
            }
            return;
        }
        if (isRecord(left) && isRecord(right)) {
            const keys = [
                ...new Set([...Object.keys(left), ...Object.keys(right)]),
            ].sort();
            for (const key of keys) {
                if (truncated) break;
                visit(left[key], right[key], `${path}.${key}`);
            }
            return;
        }
        const kind: RevisionChangeKind =
            left === undefined
                ? 'inserted'
                : right === undefined
                  ? 'removed'
                  : 'changed';
        changes.push(
            Object.freeze({
                ...(right === undefined ? {} : { after: display(right) }),
                ...(left === undefined ? {} : { before: display(left) }),
                kind,
                path,
            }),
        );
    };
    visit(before, after, root);
    return Object.freeze({
        changes: Object.freeze(changes),
        equivalent: changes.length === 0 && !truncated,
        format,
        truncated,
    });
}

function semanticNode(node: HtmlNode): unknown {
    switch (node.type) {
        case 'document':
        case 'document-fragment':
            return {
                type: node.type,
                children: node.children.map(semanticNode),
            };
        case 'element':
            return {
                type: node.type,
                tagName: node.tagName,
                namespace: node.namespace,
                attributes: [...node.attributes]
                    .map(semanticAttribute)
                    .sort((left, right) => left.key.localeCompare(right.key)),
                children: node.children.map(semanticNode),
            };
        case 'text':
        case 'comment':
            return { type: node.type, value: node.value };
        case 'doctype':
            return {
                type: node.type,
                name: node.name,
                publicId: node.publicId,
                systemId: node.systemId,
            };
    }
}

function semanticAttribute(
    attribute: HtmlAttribute,
): Readonly<{ readonly key: string; readonly value: string }> {
    const key = [
        attribute.namespace ?? '',
        attribute.prefix ?? '',
        attribute.name,
    ].join(':');
    return Object.freeze({ key, value: attribute.value });
}

function isCompleteDocument(source: string): boolean {
    return /^(?:\s|<!--[\s\S]*?-->)*(?:<!doctype\b[^>]*>\s*)?<html(?:\s|>)/i.test(
        source,
    );
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function display(value: unknown): string {
    if (typeof value === 'string') return value;
    return JSON.stringify(value) ?? String(value);
}
