import { cloneConfig } from '../internal/value.js';

/** Immutable instance configuration accepted by an editor. */
export interface EditorConfig {
    /** Configuration values must be immutable JSON-like plain data. */
    readonly [key: string]: unknown;
}

/** Read-only access to an editor instance's defensive config copy. */
export class Config {
    readonly #values: EditorConfig;

    /** Creates an immutable defensive copy of supported configuration data. */
    constructor(values: EditorConfig = {}) {
        this.#values = cloneConfig(values);
    }

    /** Returns whether a dotted configuration path exists. */
    has(path: string): boolean {
        return this.#find(path).found;
    }

    /** Returns a value at a dotted path, or undefined when absent. */
    get<T = unknown>(path: string): T | undefined {
        const result = this.#find(path);
        return result.found ? (result.value as T) : undefined;
    }

    #find(path: string): { found: boolean; value?: unknown } {
        if (path.length === 0) {
            return { found: false };
        }

        let current: unknown = this.#values;

        for (const segment of path.split('.')) {
            if (
                typeof current !== 'object' ||
                current === null ||
                !Object.prototype.hasOwnProperty.call(current, segment)
            ) {
                return { found: false };
            }

            current = (current as Record<string, unknown>)[segment];
        }

        return { found: true, value: current };
    }
}
