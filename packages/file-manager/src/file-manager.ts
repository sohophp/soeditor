import { createServiceToken } from '@soeditor/core';

/** Initial categories understood by the generic selection boundary. */
export type FileManagerKind = 'file' | 'image' | 'media';

/** Immutable request passed to an application-provided file manager. */
export interface FileManagerOpenOptions {
    readonly accept?: readonly string[];
    readonly kind: FileManagerKind;
    readonly multiple: false;
}

/** Singular selected asset returned by a file manager. */
export interface FileManagerResult {
    readonly alt?: string;
    readonly height?: number;
    readonly metadata?: Readonly<Record<string, unknown>>;
    readonly mime?: string;
    readonly name?: string;
    readonly url: string;
    readonly width?: number;
}

/** Replaceable application capability for choosing an existing asset. */
export interface FileManager {
    open(
        options: FileManagerOpenOptions,
    ): PromiseLike<FileManagerResult | null>;
}

/** Per-editor generic file-manager identity. */
export const fileManagerServiceToken = createServiceToken<FileManager>(
    'soeditor.file-manager',
);
