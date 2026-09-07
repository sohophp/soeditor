import type {
    FileManager,
    FileManagerOpenOptions,
    FileManagerResult,
} from '@soeditor/file-manager';
import { normalizeFileManagerResult } from '@soeditor/file-manager';

/** Selection value supplied by the host's concrete SoFinder integration. */
export interface SoFinderSelection {
    readonly assetId?: string;
    readonly alt?: string;
    readonly height?: number;
    readonly metadata?: Readonly<Record<string, unknown>>;
    readonly mimeType?: string;
    readonly name?: string;
    readonly sizes?: string;
    readonly srcset?: string;
    readonly url: string;
    readonly width?: number;
}

/** Narrow bridge implemented by the host application for its SoFinder version. */
export type SoFinderPicker = (
    options: FileManagerOpenOptions,
) => PromiseLike<SoFinderSelection | null>;

/** Options for the dependency-free SoFinder adapter. */
export interface SoFinderAdapterOptions {
    readonly pick: SoFinderPicker;
}

/** Maps an injected SoFinder picker to SoEditor's generic FileManager. */
export class SoFinderAdapter implements FileManager {
    readonly #pick: SoFinderPicker;

    constructor(options: SoFinderAdapterOptions) {
        if (typeof options !== 'object' || options === null) {
            throw new TypeError('SoFinder adapter options are required.');
        }
        const pick = read(options, 'pick');
        if (!isSoFinderPicker(pick)) {
            throw new TypeError('SoFinder adapter requires a pick function.');
        }
        this.#pick = pick;
    }

    async open(
        options: FileManagerOpenOptions,
    ): Promise<FileManagerResult | null> {
        const selected = await this.#pick(options);
        if (selected === null) {
            return null;
        }
        return normalizeFileManagerResult(normalizeSoFinderSelection(selected));
    }
}

export function normalizeSoFinderSelection(
    selected: SoFinderSelection,
): unknown {
    if (typeof selected !== 'object' || selected === null) return selected;
    const url = read(selected, 'url');
    const name = read(selected, 'name');
    const alt = read(selected, 'alt');
    const mimeType = read(selected, 'mimeType');
    const width = read(selected, 'width');
    const height = read(selected, 'height');
    const metadata = read(selected, 'metadata');
    const assetId = read(selected, 'assetId');
    const sizes = read(selected, 'sizes');
    const srcset = read(selected, 'srcset');
    return {
        url,
        ...(assetId === undefined ? {} : { assetId }),
        ...(name === undefined ? {} : { name }),
        ...(alt === undefined ? {} : { alt }),
        ...(mimeType === undefined ? {} : { mime: mimeType }),
        ...(width === undefined ? {} : { width }),
        ...(height === undefined ? {} : { height }),
        ...(metadata === undefined ? {} : { metadata }),
        ...(sizes === undefined ? {} : { sizes }),
        ...(srcset === undefined ? {} : { srcset }),
    };
}

function isSoFinderPicker(value: unknown): value is SoFinderPicker {
    return typeof value === 'function';
}

function read(
    value: object,
    key: keyof SoFinderSelection | keyof SoFinderAdapterOptions,
): unknown {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined) {
        return undefined;
    }
    if ('get' in descriptor || 'set' in descriptor) {
        throw new TypeError(
            `SoFinder selection property "${key}" must be a data property.`,
        );
    }
    return descriptor.value;
}
