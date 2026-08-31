import { Plugin, createServiceToken } from '@soeditor/core';

export type PasteInputClassification =
    | 'cross-editor'
    | 'files'
    | 'google-docs'
    | 'internal'
    | 'libreoffice'
    | 'office'
    | 'plain-text'
    | 'web';

export type ExternalPastePolicy = 'plain-text' | 'preserve' | 'semantic';

export interface PasteInputFile {
    readonly data?: Blob;
    readonly name: string;
    readonly size: number;
    readonly type: string;
}

export interface PastePipelineInput {
    readonly files: readonly PasteInputFile[];
    readonly html: string;
    readonly internalHtml?: string;
    readonly source: 'drop' | 'paste';
    readonly text: string;
    readonly types: readonly string[];
}

export interface PasteProcessorContext extends PastePipelineInput {
    readonly classification: PasteInputClassification;
    readonly consumed: boolean;
    readonly policy: ExternalPastePolicy;
}

export interface PasteProcessorResult {
    readonly consumed?: boolean;
    readonly html?: string;
    readonly policy?: ExternalPastePolicy;
    readonly text?: string;
}

export interface PasteProcessor {
    readonly id: string;
    readonly priority?: number;
    process(context: PasteProcessorContext): PasteProcessorResult | undefined;
}

export interface PastePipelineResult {
    readonly classification: PasteInputClassification;
    readonly consumed: boolean;
    readonly html: string;
    readonly policy: ExternalPastePolicy;
    readonly text: string;
}

export interface PasteDiagnostic {
    readonly classification: PasteInputClassification;
    readonly code: 'input-too-large' | 'output-too-large' | 'processor-failed';
    readonly message: string;
    readonly processorId?: string;
}

export interface PastePipelineService {
    process(input: PastePipelineInput): PastePipelineResult;
    register(processor: PasteProcessor): () => void;
    subscribe(listener: (diagnostic: PasteDiagnostic) => void): () => void;
}

export class PasteRejectedError extends Error {
    readonly diagnostic: PasteDiagnostic;

    constructor(diagnostic: PasteDiagnostic) {
        super(diagnostic.message);
        this.name = 'PasteRejectedError';
        this.diagnostic = diagnostic;
    }
}

export const pastePipelineServiceToken =
    createServiceToken<PastePipelineService>('soeditor.paste-pipeline');

export const SOEDITOR_CLIPBOARD_MIME = 'application/x-soeditor-html';

/** Owns the ordered instance-scoped processor and rejection boundary. */
export class PastePipelinePlugin extends Plugin {
    static readonly id = 'paste-pipeline';

    readonly #listeners = new Set<(diagnostic: PasteDiagnostic) => void>();
    readonly #processors = new Map<string, PasteProcessor>();
    #destroyed = false;
    #maximumInput = 1_000_000;
    #maximumOutput = 1_000_000;
    #officePolicy: ExternalPastePolicy | undefined;
    #policy: ExternalPastePolicy = 'semantic';
    #service: PastePipelineService | undefined;
    #webPolicy: ExternalPastePolicy | undefined;

    override init(): void {
        this.#policy = readPolicy(
            this.editor.config.get<unknown>('cms.paste.policy'),
        );
        this.#officePolicy = readOptionalPolicy(
            this.editor.config.get<unknown>('cms.paste.officePolicy'),
            'cms.paste.officePolicy',
        );
        this.#webPolicy = readOptionalPolicy(
            this.editor.config.get<unknown>('cms.paste.webPolicy'),
            'cms.paste.webPolicy',
        );
        this.#maximumInput = readBound(
            this.editor.config.get<unknown>('cms.paste.maxInputCharacters'),
            1_000_000,
            'cms.paste.maxInputCharacters',
        );
        this.#maximumOutput = readBound(
            this.editor.config.get<unknown>('cms.paste.maxOutputCharacters'),
            1_000_000,
            'cms.paste.maxOutputCharacters',
        );
        const service: PastePipelineService = {
            process: (input) => this.#process(input),
            register: (processor) => this.#register(processor),
            subscribe: (listener) => this.#subscribe(listener),
        };
        this.#service = Object.freeze(service);
        this.editor.services.register(pastePipelineServiceToken, this.#service);
    }

    override destroy(): void {
        this.#destroyed = true;
        this.#listeners.clear();
        this.#processors.clear();
        if (
            this.editor.services.tryGet(pastePipelineServiceToken) ===
            this.#service
        ) {
            this.editor.services.unregister(pastePipelineServiceToken);
        }
        this.#service = undefined;
    }

    #process(input: PastePipelineInput): PastePipelineResult {
        this.#assertAlive();
        validateInput(input);
        const classification = classifyPasteInput(input);
        if (
            input.html.length +
                input.text.length +
                (input.internalHtml?.length ?? 0) >
            this.#maximumInput
        ) {
            this.#reject({
                classification,
                code: 'input-too-large',
                message: `Paste input exceeds ${String(this.#maximumInput)} characters.`,
            });
        }
        let context: PasteProcessorContext = Object.freeze({
            ...input,
            classification,
            consumed: false,
            policy:
                classification === 'internal'
                    ? 'preserve'
                    : this.#policyFor(classification),
        });
        for (const processor of [...this.#processors.values()].sort(
            (left, right) =>
                (right.priority ?? 0) - (left.priority ?? 0) ||
                left.id.localeCompare(right.id),
        )) {
            try {
                const result = processor.process(context);
                if (result !== undefined) {
                    context = Object.freeze({
                        ...context,
                        ...(result.html === undefined
                            ? {}
                            : { html: result.html }),
                        ...(result.text === undefined
                            ? {}
                            : { text: result.text }),
                        ...(result.policy === undefined
                            ? {}
                            : { policy: result.policy }),
                        ...(result.consumed === undefined
                            ? {}
                            : { consumed: result.consumed }),
                    });
                }
                if (context.consumed) break;
            } catch (error: unknown) {
                this.#reject({
                    classification,
                    code: 'processor-failed',
                    message: `Paste processor "${processor.id}" failed: ${errorMessage(error)}`,
                    processorId: processor.id,
                });
            }
        }
        const html =
            classification === 'internal' && input.internalHtml !== undefined
                ? input.internalHtml
                : context.html;
        if (html.length + context.text.length > this.#maximumOutput) {
            this.#reject({
                classification,
                code: 'output-too-large',
                message: `Paste output exceeds ${String(this.#maximumOutput)} characters.`,
            });
        }
        return Object.freeze({
            classification,
            consumed: context.consumed,
            html,
            policy: context.policy,
            text: context.text,
        });
    }

    #register(processor: PasteProcessor): () => void {
        this.#assertAlive();
        if (
            typeof processor !== 'object' ||
            processor === null ||
            !/^[a-z][a-z0-9.-]{0,95}$/u.test(processor.id) ||
            typeof processor.process !== 'function' ||
            (processor.priority !== undefined &&
                !Number.isFinite(processor.priority))
        ) {
            throw new TypeError(
                'A paste processor requires a valid id and process function.',
            );
        }
        if (this.#processors.has(processor.id)) {
            throw new Error(
                `Paste processor "${processor.id}" is already registered.`,
            );
        }
        this.#processors.set(processor.id, processor);
        let active = true;
        return () => {
            if (!active) return;
            active = false;
            this.#processors.delete(processor.id);
        };
    }

    #policyFor(classification: PasteInputClassification): ExternalPastePolicy {
        if (
            classification === 'office' ||
            classification === 'google-docs' ||
            classification === 'libreoffice'
        ) {
            return this.#officePolicy ?? this.#policy;
        }
        if (classification === 'web' || classification === 'cross-editor') {
            return this.#webPolicy ?? this.#policy;
        }
        return this.#policy;
    }

    #subscribe(listener: (diagnostic: PasteDiagnostic) => void): () => void {
        this.#assertAlive();
        this.#listeners.add(listener);
        return () => this.#listeners.delete(listener);
    }

    #reject(diagnostic: PasteDiagnostic): never {
        const frozen = Object.freeze({ ...diagnostic });
        for (const listener of [...this.#listeners]) listener(frozen);
        throw new PasteRejectedError(frozen);
    }

    #assertAlive(): void {
        if (this.#destroyed) {
            throw new Error('The paste pipeline has been destroyed.');
        }
    }
}

export function classifyPasteInput(
    input: PastePipelineInput,
): PasteInputClassification {
    if (input.files.length > 0) return 'files';
    if (input.internalHtml !== undefined) return 'internal';
    if (input.types.includes(SOEDITOR_CLIPBOARD_MIME)) return 'cross-editor';
    if (/docs-internal-guid|id="docs-internal-guid/iu.test(input.html)) {
        return 'google-docs';
    }
    if (/libreoffice|urn:org:documentfoundation/iu.test(input.html)) {
        return 'libreoffice';
    }
    if (
        /mso-|urn:schemas-microsoft-com:office|microsoft\s+(?:word|excel)/iu.test(
            input.html,
        )
    ) {
        return 'office';
    }
    return input.html.length > 0 ? 'web' : 'plain-text';
}

function validateInput(input: PastePipelineInput): void {
    if (
        typeof input !== 'object' ||
        input === null ||
        typeof input.html !== 'string' ||
        typeof input.text !== 'string' ||
        (input.source !== 'paste' && input.source !== 'drop') ||
        !Array.isArray(input.types) ||
        !input.types.every((type) => typeof type === 'string') ||
        !Array.isArray(input.files) ||
        !input.files.every(
            (file) =>
                typeof file === 'object' &&
                file !== null &&
                typeof file.name === 'string' &&
                typeof file.type === 'string' &&
                Number.isFinite(file.size) &&
                file.size >= 0,
        ) ||
        (input.internalHtml !== undefined &&
            typeof input.internalHtml !== 'string')
    ) {
        throw new TypeError('Paste pipeline input is malformed.');
    }
}

function readPolicy(value: unknown): ExternalPastePolicy {
    if (value === undefined) return 'semantic';
    if (
        value === 'preserve' ||
        value === 'semantic' ||
        value === 'plain-text'
    ) {
        return value;
    }
    throw new TypeError(
        'cms.paste.policy must be "preserve", "semantic", or "plain-text".',
    );
}

function readOptionalPolicy(
    value: unknown,
    path: string,
): ExternalPastePolicy | undefined {
    if (value === undefined || value === 'inherit') return undefined;
    if (
        value === 'preserve' ||
        value === 'semantic' ||
        value === 'plain-text'
    ) {
        return value;
    }
    throw new TypeError(
        `${path} must be "inherit", "preserve", "semantic", or "plain-text".`,
    );
}

function readBound(value: unknown, fallback: number, path: string): number {
    if (value === undefined) return fallback;
    if (
        !Number.isInteger(value) ||
        Number(value) < 1 ||
        Number(value) > 5_000_000
    ) {
        throw new TypeError(`${path} must be an integer from 1 to 5000000.`);
    }
    return Number(value);
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
