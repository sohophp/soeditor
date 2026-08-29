import {
    createServiceToken,
    EditorDestroyedError,
    Plugin,
} from '@soeditor/core';

import type { EditingPoint } from './model.js';

const MAX_VISUAL_DECORATIONS = 1000;

export type VisualDecorationStatus = 'active' | 'resolved';

/** A non-canonical editing-model range rendered by the visual projection. */
export interface VisualDecoration {
    readonly from: EditingPoint;
    readonly id: string;
    readonly label: string;
    readonly status: VisualDecorationStatus;
    readonly to: EditingPoint;
}

export interface VisualDecorationsService {
    readonly snapshot: readonly VisualDecoration[];
    clear(owner: string): void;
    replace(owner: string, decorations: readonly VisualDecoration[]): void;
    subscribe(listener: () => void): () => void;
}

export const visualDecorationsServiceToken =
    createServiceToken<VisualDecorationsService>('soeditor.visual-decorations');

/** Owns bounded dynamic visual decorations for one editor instance. */
export class VisualDecorationsPlugin extends Plugin {
    static readonly id = 'visual-decorations';
    readonly #listeners = new Set<() => void>();
    readonly #owners = new Map<string, readonly VisualDecoration[]>();
    #destroyed = false;
    #service: VisualDecorationsService | undefined;

    override init(): void {
        const readSnapshot = (): readonly VisualDecoration[] => {
            this.#assertAlive();
            return flattenDecorations(this.#owners);
        };
        const service: VisualDecorationsService = Object.freeze({
            get snapshot() {
                return readSnapshot();
            },
            clear: (owner: string) => this.#replace(owner, []),
            replace: (
                owner: string,
                decorations: readonly VisualDecoration[],
            ) => this.#replace(owner, decorations),
            subscribe: (listener: () => void) => {
                this.#assertAlive();
                if (typeof listener !== 'function') {
                    throw new TypeError(
                        'A visual-decoration listener must be a function.',
                    );
                }
                this.#listeners.add(listener);
                return () => this.#listeners.delete(listener);
            },
        });
        this.#service = service;
        this.editor.services.register(visualDecorationsServiceToken, service);
    }

    override destroy(): void {
        this.#destroyed = true;
        this.#listeners.clear();
        this.#owners.clear();
        try {
            if (
                this.#service !== undefined &&
                this.editor.services.tryGet(visualDecorationsServiceToken) ===
                    this.#service
            ) {
                this.editor.services.unregister(visualDecorationsServiceToken);
            }
        } catch (error: unknown) {
            if (!(error instanceof EditorDestroyedError)) throw error;
        }
        this.#service = undefined;
    }

    #replace(owner: string, decorations: readonly VisualDecoration[]): void {
        this.#assertAlive();
        validateIdentity(owner, 'owner');
        if (!Array.isArray(decorations)) {
            throw new TypeError('Visual decorations must be an array.');
        }
        const frozen = Object.freeze(decorations.map(freezeDecoration));
        const nextTotal =
            [...this.#owners.entries()].reduce(
                (total, [currentOwner, current]) =>
                    total + (currentOwner === owner ? 0 : current.length),
                0,
            ) + frozen.length;
        if (nextTotal > MAX_VISUAL_DECORATIONS) {
            throw new RangeError(
                `Visual decorations are limited to ${String(MAX_VISUAL_DECORATIONS)} per editor.`,
            );
        }
        const ids = new Set<string>();
        for (const decoration of frozen) {
            if (ids.has(decoration.id)) {
                throw new Error(
                    `Visual decoration "${decoration.id}" is duplicated for owner "${owner}".`,
                );
            }
            ids.add(decoration.id);
        }
        const otherIds = new Set(
            [...this.#owners.entries()].flatMap(([currentOwner, current]) =>
                currentOwner === owner ? [] : current.map(({ id }) => id),
            ),
        );
        const collision = frozen.find(({ id }) => otherIds.has(id));
        if (collision !== undefined) {
            throw new Error(
                `Visual decoration "${collision.id}" is already registered by another owner.`,
            );
        }
        if (frozen.length === 0) {
            this.#owners.delete(owner);
        } else {
            this.#owners.set(owner, frozen);
        }
        const errors: unknown[] = [];
        for (const listener of [...this.#listeners]) {
            try {
                listener();
            } catch (error: unknown) {
                errors.push(error);
            }
        }
        if (errors.length > 0) {
            throw new AggregateError(
                errors,
                'Visual-decoration listeners failed.',
            );
        }
    }

    #assertAlive(): void {
        if (this.#destroyed) {
            throw new Error(
                'The visual decorations service has been destroyed.',
            );
        }
    }
}

function flattenDecorations(
    owners: ReadonlyMap<string, readonly VisualDecoration[]>,
): readonly VisualDecoration[] {
    return Object.freeze([...owners.values()].flat());
}

function freezeDecoration(decoration: VisualDecoration): VisualDecoration {
    if (typeof decoration !== 'object' || decoration === null) {
        throw new TypeError('A visual decoration must be an object.');
    }
    validateIdentity(decoration.id, 'ID');
    if (
        typeof decoration.label !== 'string' ||
        decoration.label.trim().length === 0 ||
        decoration.label.length > 256
    ) {
        throw new TypeError(
            'A visual decoration label must contain 1 to 256 characters.',
        );
    }
    if (decoration.status !== 'active' && decoration.status !== 'resolved') {
        throw new TypeError(
            'A visual decoration status must be active or resolved.',
        );
    }
    const from = freezePoint(decoration.from);
    const to = freezePoint(decoration.to);
    if (comparePoints(from, to) >= 0) {
        throw new RangeError('A visual decoration range must not be empty.');
    }
    return Object.freeze({
        from,
        id: decoration.id,
        label: decoration.label,
        status: decoration.status,
        to,
    });
}

function freezePoint(point: EditingPoint): EditingPoint {
    if (
        typeof point !== 'object' ||
        point === null ||
        !Number.isInteger(point.block) ||
        point.block < 0 ||
        !Number.isInteger(point.offset) ||
        point.offset < 0
    ) {
        throw new TypeError(
            'A visual decoration point requires non-negative indexes.',
        );
    }
    return Object.freeze({ block: point.block, offset: point.offset });
}

function validateIdentity(value: string, label: string): void {
    if (
        typeof value !== 'string' ||
        value.trim().length === 0 ||
        value.length > 256
    ) {
        throw new TypeError(
            `A visual decoration ${label} must contain 1 to 256 characters.`,
        );
    }
}

function comparePoints(left: EditingPoint, right: EditingPoint): number {
    return left.block === right.block
        ? left.offset - right.offset
        : left.block - right.block;
}
