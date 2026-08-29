import type { DocumentFormat } from '@soeditor/core';

const MAX_REVISION_SOURCE_LENGTH = 5_000_000;

export type RevisionKind = 'draft' | 'saved';
export type ReviewPolicy = 'edit' | 'readonly' | 'comments-only';

export interface RevisionAuthor {
    readonly id: string;
    readonly name: string;
}

export interface RevisionMetadata {
    readonly author: RevisionAuthor;
    readonly createdAt: number;
    readonly id: string;
    readonly kind: RevisionKind;
    readonly label: string;
}

export interface RevisionSnapshot extends RevisionMetadata {
    readonly format: DocumentFormat;
    readonly source: string;
}

export interface RevisionSaveInput {
    readonly author: RevisionAuthor;
    readonly format: DocumentFormat;
    readonly kind: RevisionKind;
    readonly label: string;
    readonly source: string;
}

export interface RevisionProvider {
    list(): PromiseLike<readonly RevisionMetadata[]>;
    load(id: string): PromiseLike<RevisionSnapshot>;
}

export interface RevisionStorage extends RevisionProvider {
    /** Permanently removes one host-owned revision. */
    erase?(id: string): PromiseLike<void>;
    save(input: RevisionSaveInput): PromiseLike<RevisionSnapshot>;
}

export interface RevisionDataExport {
    readonly revisions: readonly RevisionSnapshot[];
    readonly schema: 'soeditor.revisions';
    readonly version: 1;
}

export function freezeRevisionMetadata(
    metadata: RevisionMetadata,
): RevisionMetadata {
    if (typeof metadata !== 'object' || metadata === null) {
        throw new TypeError('Revision metadata must be an object.');
    }
    return Object.freeze({
        author: freezeRevisionAuthor(metadata.author),
        createdAt: timestamp(metadata.createdAt),
        id: text(metadata.id, 'ID', 256),
        kind: revisionKind(metadata.kind),
        label: text(metadata.label, 'label', 256),
    });
}

export function freezeRevisionSnapshot(
    revision: RevisionSnapshot,
): RevisionSnapshot {
    const metadata = freezeRevisionMetadata(revision);
    return Object.freeze({
        ...metadata,
        format: documentFormat(revision.format),
        source: source(revision.source),
    });
}

export function freezeRevisionList(
    revisions: readonly RevisionMetadata[],
): readonly RevisionMetadata[] {
    if (!Array.isArray(revisions)) {
        throw new TypeError('Revision list must be an array.');
    }
    const ids = new Set<string>();
    const frozen = revisions.map((revision) => {
        const value = freezeRevisionMetadata(revision);
        if (ids.has(value.id)) {
            throw new Error(`Revision "${value.id}" is duplicated.`);
        }
        ids.add(value.id);
        return value;
    });
    return Object.freeze(frozen);
}

export function freezeRevisionAuthor(author: RevisionAuthor): RevisionAuthor {
    if (typeof author !== 'object' || author === null) {
        throw new TypeError('Revision author must be an object.');
    }
    return Object.freeze({
        id: text(author.id, 'author ID', 256),
        name: text(author.name, 'author name', 256),
    });
}

export function validateReviewPolicy(policy: unknown): ReviewPolicy {
    if (
        policy !== 'edit' &&
        policy !== 'readonly' &&
        policy !== 'comments-only'
    ) {
        throw new TypeError(
            'Review policy must be edit, readonly, or comments-only.',
        );
    }
    return policy;
}

export function createRevisionSaveInput(
    input: RevisionSaveInput,
): RevisionSaveInput {
    if (typeof input !== 'object' || input === null) {
        throw new TypeError('Revision save input must be an object.');
    }
    return Object.freeze({
        author: freezeRevisionAuthor(input.author),
        format: documentFormat(input.format),
        kind: revisionKind(input.kind),
        label: text(input.label, 'label', 256),
        source: source(input.source),
    });
}

function documentFormat(value: unknown): DocumentFormat {
    if (value !== 'html' && value !== 'markdown') {
        throw new TypeError('Revision format must be html or markdown.');
    }
    return value;
}

function revisionKind(value: unknown): RevisionKind {
    if (value !== 'draft' && value !== 'saved') {
        throw new TypeError('Revision kind must be draft or saved.');
    }
    return value;
}

function source(value: unknown): string {
    if (
        typeof value !== 'string' ||
        value.length > MAX_REVISION_SOURCE_LENGTH
    ) {
        throw new TypeError(
            'Revision source must contain at most 5000000 characters.',
        );
    }
    return value;
}

function text(value: unknown, label: string, maximum: number): string {
    if (
        typeof value !== 'string' ||
        value.trim().length === 0 ||
        value.length > maximum
    ) {
        throw new TypeError(
            `Revision ${label} must contain 1 to ${String(maximum)} characters.`,
        );
    }
    return value;
}

function timestamp(value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        throw new TypeError('Revision createdAt must be a positive timestamp.');
    }
    return value;
}
