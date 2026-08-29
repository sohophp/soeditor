import {
    createServiceToken,
    EditorDestroyedError,
    Plugin,
} from '@soeditor/core';
import {
    parseHtmlDocument,
    parseHtmlFragment,
    type HtmlDocumentChildNode,
    type HtmlElement,
    type SourcePosition,
    type SourceRange,
} from '@soeditor/html';

import {
    DiagnosticProviderAlreadyRegisteredError,
    InvalidDiagnosticError,
    type Diagnostic,
    type DiagnosticProvider,
    type Problem,
    type ProblemSeverity,
} from './problems.js';

/** Per-editor diagnostics registry and validation capability. */
export interface DiagnosticsService {
    readonly problems: readonly Problem[];
    register(provider: DiagnosticProvider): () => void;
    validate(source?: string): Promise<readonly Problem[]>;
}

/** Typed identity of the per-editor diagnostics service. */
export const diagnosticsServiceToken = createServiceToken<DiagnosticsService>(
    'soeditor.html-diagnostics',
);

/** Registers built-in HTML diagnostics and `document.validate`. */
export class DiagnosticsPlugin extends Plugin {
    static readonly id = 'html-diagnostics';

    readonly #providers = new Map<string, DiagnosticProvider>();
    #generation = 0;
    #problems: readonly Problem[] = Object.freeze([]);
    #destroyed = false;

    override init(): void {
        this.#register(parserDiagnosticProvider);
        this.#register(structuralDiagnosticProvider);
        const getProblems = (): readonly Problem[] => this.#getProblems();
        const serviceValue: DiagnosticsService = {
            get problems() {
                return getProblems();
            },
            register: (provider) => this.#register(provider),
            validate: (source) => this.#validate(source),
        };
        const service = Object.freeze(serviceValue);
        this.editor.services.register(diagnosticsServiceToken, service);
        this.editor.commands.register({
            id: 'document.validate',
            execute: (_context, ...args) => {
                if (args.length !== 0) {
                    throw new TypeError(
                        'Command "document.validate" does not accept arguments.',
                    );
                }
                return this.#validate();
            },
        });
    }

    override destroy(): void {
        this.#destroyed = true;
        this.#providers.clear();
        this.#problems = Object.freeze([]);
        this.#generation += 1;
    }

    #register(provider: DiagnosticProvider): () => void {
        this.#assertAlive();
        if (provider.id.length === 0) {
            throw new TypeError('A diagnostic provider ID must not be empty.');
        }
        if (this.#providers.has(provider.id)) {
            throw new DiagnosticProviderAlreadyRegisteredError(provider.id);
        }
        this.#providers.set(provider.id, provider);
        this.#generation += 1;
        let active = true;
        return () => {
            if (active && this.#providers.get(provider.id) === provider) {
                this.#providers.delete(provider.id);
                this.#generation += 1;
            }
            active = false;
        };
    }

    async #validate(
        source = this.editor.getData(),
    ): Promise<readonly Problem[]> {
        this.#assertAlive();
        const generation = ++this.#generation;
        const problems: Problem[] = [];

        for (const provider of this.#providers.values()) {
            const diagnostics = await provider.provide(source);
            if (!Array.isArray(diagnostics)) {
                throw new InvalidDiagnosticError(
                    provider.id,
                    'must return an array of diagnostics.',
                );
            }
            diagnostics.forEach((diagnostic, index) =>
                problems.push(
                    freezeProblem(
                        provider.id,
                        diagnostic,
                        index,
                        source.length,
                    ),
                ),
            );
        }

        const result = Object.freeze(problems);
        if (
            generation === this.#generation &&
            source === this.editor.getData()
        ) {
            this.#problems = result;
        }
        return result;
    }

    #getProblems(): readonly Problem[] {
        this.#assertAlive();
        return this.#problems;
    }

    #assertAlive(): void {
        if (this.#destroyed) {
            throw new EditorDestroyedError();
        }
    }
}

const parserDiagnosticProvider: DiagnosticProvider = Object.freeze({
    id: 'html.parser',
    provide: (source: string) =>
        parseSource(source).diagnostics.map((diagnostic) => ({
            code: diagnostic.code,
            message: diagnostic.message,
            severity: diagnostic.severity,
            ...(diagnostic.source === undefined
                ? {}
                : { source: diagnostic.source }),
        })),
});

const structuralDiagnosticProvider: DiagnosticProvider = Object.freeze({
    id: 'html.structure',
    provide: (source: string) => structuralDiagnostics(source),
});

function structuralDiagnostics(source: string): readonly Diagnostic[] {
    const parsed = parseSource(source);
    const diagnostics: Diagnostic[] = [];
    const ids = new Set<string>();

    visitElements(parsed.document.children, (element) => {
        if (element.namespace !== 'html') {
            return;
        }
        const id = element.attributes.find(
            (attribute) => attribute.name === 'id',
        );
        if (id !== undefined && id.value.length > 0) {
            if (ids.has(id.value)) {
                diagnostics.push({
                    code: 'html.duplicate-id',
                    message: `Duplicate HTML id "${id.value}".`,
                    severity: 'warning',
                    ...(id.source === undefined ? {} : { source: id.source }),
                });
            }
            ids.add(id.value);
        }
        if (
            element.tagName === 'img' &&
            !element.attributes.some((attribute) => attribute.name === 'alt')
        ) {
            diagnostics.push({
                code: 'html.image-alt',
                message: 'Image element is missing an alt attribute.',
                severity: 'warning',
                ...(element.source?.startTag === undefined
                    ? {}
                    : { source: element.source.startTag }),
            });
        }
    });

    if (parsed.complete) {
        const html = parsed.document.children.find(
            (node): node is HtmlElement =>
                node.type === 'element' &&
                node.namespace === 'html' &&
                node.tagName === 'html',
        );
        if (
            html !== undefined &&
            !html.attributes.some((attribute) => attribute.name === 'lang')
        ) {
            diagnostics.push({
                code: 'html.document-lang',
                message: 'HTML document root is missing a lang attribute.',
                severity: 'warning',
                ...(html.source?.startTag === undefined
                    ? {}
                    : { source: html.source.startTag }),
            });
        }
    }

    return diagnostics;
}

function parseSource(source: string): {
    readonly complete: boolean;
    readonly diagnostics: ReturnType<typeof parseHtmlFragment>['diagnostics'];
    readonly document: {
        readonly children: readonly HtmlDocumentChildNode[];
    };
} {
    const complete = isCompleteDocument(source);
    const result = complete
        ? parseHtmlDocument(source)
        : parseHtmlFragment(source);
    return {
        complete,
        diagnostics: result.diagnostics,
        document: result.document,
    };
}

function visitElements(
    nodes: readonly HtmlDocumentChildNode[],
    visit: (element: HtmlElement) => void,
): void {
    for (const node of nodes) {
        if (node.type !== 'element') {
            continue;
        }
        visit(node);
        visitElements(node.children, visit);
    }
}

function freezeProblem(
    provider: string,
    diagnostic: Diagnostic,
    index: number,
    sourceLength: number,
): Problem {
    if (
        typeof diagnostic !== 'object' ||
        diagnostic === null ||
        !isSeverity(diagnostic.severity) ||
        typeof diagnostic.code !== 'string' ||
        diagnostic.code.length === 0 ||
        typeof diagnostic.message !== 'string' ||
        diagnostic.message.length === 0
    ) {
        throw new InvalidDiagnosticError(
            provider,
            `returned an invalid diagnostic at index ${index}.`,
        );
    }
    return Object.freeze({
        code: diagnostic.code,
        message: diagnostic.message,
        provider,
        severity: diagnostic.severity,
        ...(diagnostic.source === undefined
            ? {}
            : {
                  source: freezeRange(
                      provider,
                      diagnostic.source,
                      index,
                      sourceLength,
                  ),
              }),
    });
}

function freezeRange(
    provider: string,
    range: SourceRange,
    index: number,
    sourceLength: number,
): SourceRange {
    if (typeof range !== 'object' || range === null) {
        throw invalidSourceRange(provider, index);
    }
    const start = freezePosition(provider, range.start, index, sourceLength);
    const end = freezePosition(provider, range.end, index, sourceLength);
    if (end.offset < start.offset) {
        throw invalidSourceRange(provider, index);
    }
    return Object.freeze({ start, end });
}

function freezePosition(
    provider: string,
    position: SourcePosition,
    index: number,
    sourceLength: number,
): SourcePosition {
    if (
        typeof position !== 'object' ||
        position === null ||
        !Number.isInteger(position.line) ||
        position.line < 1 ||
        !Number.isInteger(position.column) ||
        position.column < 1 ||
        !Number.isInteger(position.offset) ||
        position.offset < 0 ||
        position.offset > sourceLength
    ) {
        throw invalidSourceRange(provider, index);
    }
    return Object.freeze({ ...position });
}

function invalidSourceRange(
    provider: string,
    index: number,
): InvalidDiagnosticError {
    return new InvalidDiagnosticError(
        provider,
        `returned an invalid source range at index ${index}.`,
    );
}

function isSeverity(value: unknown): value is ProblemSeverity {
    return (
        value === 'error' ||
        value === 'warning' ||
        value === 'info' ||
        value === 'hint'
    );
}

function isCompleteDocument(source: string): boolean {
    return /<!doctype\s|<\/?(?:html|head|body)(?:\s|>)/iu.test(source);
}
