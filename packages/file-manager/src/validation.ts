import type { FileManagerResult } from './file-manager.js';

const maximumMetadataDepth = 32;
const maximumMetadataValues = 10_000;

/** Reports malformed or unsafe data returned by a file manager. */
export class InvalidFileManagerResultError extends TypeError {
    constructor(message: string) {
        super(`File manager returned an invalid result: ${message}`);
        this.name = 'InvalidFileManagerResultError';
    }
}

/** Validates and freezes untrusted adapter output at the integration boundary. */
export function normalizeFileManagerResult(
    value: unknown,
): FileManagerResult | null {
    if (value === null) {
        return null;
    }
    if (typeof value !== 'object') {
        throw invalid('expected an object or null.');
    }
    const url = optionalProperty(value, 'url');
    if (typeof url !== 'string' || url.trim().length === 0) {
        throw invalid('"url" must be a non-empty string.');
    }
    if (containsControlCharacter(url)) {
        throw invalid('"url" must not contain control characters.');
    }
    if (/^\s*(?:javascript|vbscript|file):/iu.test(url)) {
        throw invalid('"url" uses a forbidden scheme.');
    }
    const width = optionalDimension(value, 'width');
    const height = optionalDimension(value, 'height');
    const name = optionalString(value, 'name');
    const alt = optionalString(value, 'alt');
    const mime = optionalString(value, 'mime');
    const metadataValue = optionalProperty(value, 'metadata');
    const metadata =
        metadataValue === undefined ? undefined : freezeMetadata(metadataValue);
    return Object.freeze({
        url,
        ...(name === undefined ? {} : { name }),
        ...(alt === undefined ? {} : { alt }),
        ...(mime === undefined ? {} : { mime }),
        ...(width === undefined ? {} : { width }),
        ...(height === undefined ? {} : { height }),
        ...(metadata === undefined ? {} : { metadata }),
    });
}

function containsControlCharacter(value: string): boolean {
    return [...value].some((character) => {
        const codePoint = character.codePointAt(0);
        return (
            codePoint !== undefined && (codePoint <= 31 || codePoint === 127)
        );
    });
}

function optionalProperty(value: object, key: string): unknown {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined) {
        return undefined;
    }
    if ('get' in descriptor || 'set' in descriptor) {
        throw invalid(`"${key}" must be a data property.`);
    }
    return descriptor.value;
}

function optionalString(value: object, key: string): string | undefined {
    const candidate = optionalProperty(value, key);
    if (candidate !== undefined && typeof candidate !== 'string') {
        throw invalid(`"${key}" must be a string when provided.`);
    }
    return candidate;
}

function optionalDimension(value: object, key: string): number | undefined {
    const candidate = optionalProperty(value, key);
    if (
        candidate !== undefined &&
        (!Number.isSafeInteger(candidate) || Number(candidate) <= 0)
    ) {
        throw invalid(`"${key}" must be a positive safe integer.`);
    }
    return typeof candidate === 'number' ? candidate : undefined;
}

function freezeMetadata(value: unknown): Readonly<Record<string, unknown>> {
    if (
        typeof value !== 'object' ||
        value === null ||
        Object.getPrototypeOf(value) !== Object.prototype
    ) {
        throw invalid('"metadata" must be a plain object.');
    }
    return freezeMetadataObject(value, new Set(), { count: 0 }, 0);
}

function freezeMetadataObject(
    value: object,
    ancestors: Set<object>,
    budget: { count: number },
    depth: number,
): Readonly<Record<string, unknown>> {
    consumeMetadataBudget(budget, depth);
    enterMetadata(value, ancestors);
    const result: Record<string, unknown> = { __proto__: null };
    for (const key of Reflect.ownKeys(value)) {
        if (typeof key !== 'string') {
            throw invalid('"metadata" must not contain symbol keys.');
        }
        result[key] = freezeMetadataValue(
            optionalProperty(value, key),
            ancestors,
            budget,
            depth + 1,
        );
    }
    ancestors.delete(value);
    return Object.freeze(result);
}

function freezeMetadataValue(
    value: unknown,
    ancestors: Set<object>,
    budget: { count: number },
    depth: number,
): unknown {
    consumeMetadataBudget(budget, depth);
    if (
        value === null ||
        typeof value === 'string' ||
        typeof value === 'boolean' ||
        (typeof value === 'number' && Number.isFinite(value))
    ) {
        return value;
    }
    if (Array.isArray(value)) {
        enterMetadata(value, ancestors);
        assertMetadataArrayShape(value);
        const result = value.map((_item, index) => {
            return freezeMetadataValue(
                optionalProperty(value, String(index)),
                ancestors,
                budget,
                depth + 1,
            );
        });
        ancestors.delete(value);
        return Object.freeze(result);
    }
    if (
        typeof value === 'object' &&
        value !== null &&
        Object.getPrototypeOf(value) === Object.prototype
    ) {
        return freezeMetadataObject(value, ancestors, budget, depth);
    }
    throw invalid('metadata values must be finite JSON-like data.');
}

function assertMetadataArrayShape(value: readonly unknown[]): void {
    const expectedKeys = new Set([
        'length',
        ...Array.from({ length: value.length }, (_item, index) =>
            String(index),
        ),
    ]);
    for (const key of Reflect.ownKeys(value)) {
        if (typeof key !== 'string' || !expectedKeys.delete(key)) {
            throw invalid('metadata arrays must not have custom properties.');
        }
    }
    if (expectedKeys.size !== 0) {
        throw invalid('metadata arrays must not be sparse.');
    }
}

function consumeMetadataBudget(budget: { count: number }, depth: number): void {
    budget.count += 1;
    if (depth > maximumMetadataDepth) {
        throw invalid('metadata nesting is too deep.');
    }
    if (budget.count > maximumMetadataValues) {
        throw invalid('metadata contains too many values.');
    }
}

function enterMetadata(value: object, ancestors: Set<object>): void {
    if (ancestors.has(value)) {
        throw invalid('"metadata" must not contain cycles.');
    }
    ancestors.add(value);
}

function invalid(message: string): InvalidFileManagerResultError {
    return new InvalidFileManagerResultError(message);
}
