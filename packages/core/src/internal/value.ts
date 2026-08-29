import {
    CyclicConfigurationError,
    UnsupportedConfigValueError,
} from '../errors/errors.js';

function isRecord(value: object): value is Record<string, unknown> {
    const prototype = Object.getPrototypeOf(value) as unknown;
    return prototype === Object.prototype || prototype === null;
}

/** @internal Creates an immutable copy of supported plain configuration data. */
export function cloneConfig<T>(
    value: T,
    path = 'config',
    ancestors = new Set<object>(),
): T {
    if (
        value === null ||
        typeof value === 'boolean' ||
        typeof value === 'number' ||
        typeof value === 'string'
    ) {
        return value;
    }

    if (typeof value !== 'object') {
        throw new UnsupportedConfigValueError(path, typeof value);
    }

    if (ancestors.has(value)) {
        throw new CyclicConfigurationError(path);
    }

    ancestors.add(value);

    if (Array.isArray(value)) {
        try {
            return cloneConfigArray(value, path, ancestors) as T;
        } finally {
            ancestors.delete(value);
        }
    }

    if (!isRecord(value)) {
        ancestors.delete(value);
        throw new UnsupportedConfigValueError(path, 'non-plain object');
    }

    try {
        if (Object.getOwnPropertySymbols(value).length > 0) {
            throw new UnsupportedConfigValueError(path, 'symbol-keyed object');
        }

        const copy: Record<string, unknown> = {};

        for (const [key, descriptor] of Object.entries(
            Object.getOwnPropertyDescriptors(value),
        )) {
            if (!('value' in descriptor)) {
                throw new UnsupportedConfigValueError(
                    `${path}.${key}`,
                    'accessor',
                );
            }

            if (!descriptor.enumerable) {
                continue;
            }

            Object.defineProperty(copy, key, {
                enumerable: true,
                value: cloneConfig(
                    descriptor.value,
                    `${path}.${key}`,
                    ancestors,
                ),
                writable: true,
            });
        }

        return Object.freeze(copy) as T;
    } finally {
        ancestors.delete(value);
    }
}

function cloneConfigArray(
    value: readonly unknown[],
    path: string,
    ancestors: Set<object>,
): readonly unknown[] {
    if (Object.getOwnPropertySymbols(value).length > 0) {
        throw new UnsupportedConfigValueError(path, 'symbol-keyed array');
    }

    const propertyNames = Object.getOwnPropertyNames(value);
    const indexNames = propertyNames.filter((name) => name !== 'length');

    for (const name of indexNames) {
        const index = Number(name);

        if (!Number.isInteger(index) || index < 0 || String(index) !== name) {
            throw new UnsupportedConfigValueError(
                `${path}.${name}`,
                'custom array property',
            );
        }
    }

    if (indexNames.length !== value.length) {
        throw new UnsupportedConfigValueError(path, 'sparse array');
    }

    const copy: unknown[] = [];

    for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(
            value,
            String(index),
        );

        if (
            descriptor === undefined ||
            !descriptor.enumerable ||
            !('value' in descriptor)
        ) {
            throw new UnsupportedConfigValueError(
                `${path}[${index}]`,
                descriptor !== undefined && !('value' in descriptor)
                    ? 'accessor'
                    : 'nonstandard array index',
            );
        }

        copy.push(
            cloneConfig(descriptor.value, `${path}[${index}]`, ancestors),
        );
    }

    return Object.freeze(copy);
}
