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

/** Current lifecycle state of the diagnostics workflow. */
export type DiagnosticsStatus = 'idle' | 'validating' | 'ready';

/** Optional provider and severity selection for Problems queries. */
export interface DiagnosticFilter {
    readonly providers?: readonly string[];
    readonly severities?: readonly ProblemSeverity[];
}

/** Stable immutable counts for one filtered Problems query. */
export interface DiagnosticCounts {
    readonly total: number;
    readonly byProvider: Readonly<Record<string, number>>;
    readonly bySeverity: Readonly<Record<ProblemSeverity, number>>;
}

/** One isolated provider failure from the latest published validation. */
export interface DiagnosticProviderFailure {
    readonly provider: string;
    readonly error: unknown;
}

/** Immutable observable diagnostics workflow snapshot. */
export interface DiagnosticsSnapshot {
    readonly counts: DiagnosticCounts;
    readonly failures: readonly DiagnosticProviderFailure[];
    readonly problems: readonly Problem[];
    readonly status: DiagnosticsStatus;
}

/** Manual is the default; debounced validation is explicitly opt-in. */
export type DiagnosticsValidationPolicy =
    | { readonly mode: 'manual' }
    | { readonly delay?: number; readonly mode: 'debounced' };

/** Per-instance settings at `htmlTools.diagnostics.validation`. */
export interface DiagnosticsWorkflowConfig {
    readonly validation?: DiagnosticsValidationPolicy;
}

/** Per-editor diagnostics registry and validation capability. */
export interface DiagnosticsService {
    readonly failures: readonly DiagnosticProviderFailure[];
    readonly problems: readonly Problem[];
    readonly snapshot: DiagnosticsSnapshot;
    getCounts(filter?: DiagnosticFilter): DiagnosticCounts;
    getProblems(filter?: DiagnosticFilter): readonly Problem[];
    register(provider: DiagnosticProvider): () => void;
    subscribe(listener: (snapshot: DiagnosticsSnapshot) => void): () => void;
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
    readonly #listeners = new Set<(snapshot: DiagnosticsSnapshot) => void>();
    #autoDelay: number | undefined;
    #autoTimer: unknown;
    #disposeDocumentChange: (() => void) | undefined;
    #generation = 0;
    #snapshot = createSnapshot('idle', [], []);
    #destroyed = false;

    override init(): void {
        this.#autoDelay = readValidationDelay(
            this.editor.config.get<unknown>('htmlTools.diagnostics.validation'),
        );
        this.#register(parserDiagnosticProvider);
        this.#register(structuralDiagnosticProvider);
        const getSnapshot = (): DiagnosticsSnapshot => this.#getSnapshot();
        const serviceValue: DiagnosticsService = {
            get failures() {
                return getSnapshot().failures;
            },
            get problems() {
                return getSnapshot().problems;
            },
            get snapshot() {
                return getSnapshot();
            },
            getCounts: (filter) => this.#getCounts(filter),
            getProblems: (filter) => this.#getProblems(filter),
            register: (provider) => this.#register(provider),
            subscribe: (listener) => this.#subscribe(listener),
            validate: (source) => this.#validate(source),
        };
        const service = Object.freeze(serviceValue);
        this.editor.services.register(diagnosticsServiceToken, service);
        this.editor.commands.register({
            id: 'document.validate',
            label: 'Validate HTML',
            execute: (_context, ...args) => {
                if (args.length !== 0) {
                    throw new TypeError(
                        'Command "document.validate" does not accept arguments.',
                    );
                }
                return this.#validate();
            },
        });
        if (this.#autoDelay !== undefined) {
            this.#disposeDocumentChange = this.editor.events.on(
                'document:change',
                () => this.#scheduleAutomaticValidation(),
            );
            this.#scheduleAutomaticValidation();
        }
    }

    override destroy(): void {
        this.#destroyed = true;
        this.#disposeDocumentChange?.();
        this.#disposeDocumentChange = undefined;
        if (this.#autoTimer !== undefined) {
            timerHost.clearTimeout(this.#autoTimer);
            this.#autoTimer = undefined;
        }
        this.#providers.clear();
        this.#listeners.clear();
        this.#snapshot = createSnapshot('idle', [], []);
        this.#generation += 1;
    }

    #register(provider: DiagnosticProvider): () => void {
        this.#assertAlive();
        if (typeof provider !== 'object' || provider === null) {
            throw new TypeError('A diagnostic provider must be an object.');
        }
        if (
            typeof provider.id !== 'string' ||
            provider.id.trim().length === 0
        ) {
            throw new TypeError(
                'A diagnostic provider ID must be a non-empty string.',
            );
        }
        if (typeof provider.provide !== 'function') {
            throw new TypeError(
                `Diagnostic provider "${provider.id}" requires a provide function.`,
            );
        }
        if (this.#providers.has(provider.id)) {
            throw new DiagnosticProviderAlreadyRegisteredError(provider.id);
        }
        this.#providers.set(provider.id, provider);
        this.#generation += 1;
        this.#scheduleAutomaticValidation();
        let active = true;
        return () => {
            if (active && this.#providers.get(provider.id) === provider) {
                this.#providers.delete(provider.id);
                this.#generation += 1;
                this.#scheduleAutomaticValidation();
            }
            active = false;
        };
    }

    async #validate(
        source = this.editor.getData(),
    ): Promise<readonly Problem[]> {
        this.#assertAlive();
        const generation = ++this.#generation;
        const publishable = source === this.editor.getData();
        const providers = [...this.#providers.values()];
        if (publishable) {
            this.#publish(
                createSnapshot(
                    'validating',
                    this.#snapshot.problems,
                    this.#snapshot.failures,
                ),
            );
        }

        const outcomes = await Promise.all(
            providers.map((provider) => runProvider(provider, source)),
        );
        const problems = outcomes.flatMap((outcome) => outcome.problems);
        const failures = outcomes.flatMap((outcome) => outcome.failures);

        const result = Object.freeze(problems);
        if (
            generation === this.#generation &&
            source === this.editor.getData()
        ) {
            this.#publish(createSnapshot('ready', result, failures));
        }
        return result;
    }

    #getSnapshot(): DiagnosticsSnapshot {
        this.#assertAlive();
        return this.#snapshot;
    }

    #getProblems(filter?: DiagnosticFilter): readonly Problem[] {
        this.#assertAlive();
        if (filter === undefined) {
            return this.#snapshot.problems;
        }
        const normalized = normalizeFilter(filter);
        return Object.freeze(
            this.#snapshot.problems.filter(
                (problem) =>
                    (normalized.providers === undefined ||
                        normalized.providers.has(problem.provider)) &&
                    (normalized.severities === undefined ||
                        normalized.severities.has(problem.severity)),
            ),
        );
    }

    #getCounts(filter?: DiagnosticFilter): DiagnosticCounts {
        return countProblems(this.#getProblems(filter));
    }

    #subscribe(listener: (snapshot: DiagnosticsSnapshot) => void): () => void {
        this.#assertAlive();
        if (typeof listener !== 'function') {
            throw new TypeError('A diagnostics listener must be a function.');
        }
        this.#listeners.add(listener);
        let active = true;
        return () => {
            if (active) {
                this.#listeners.delete(listener);
            }
            active = false;
        };
    }

    #publish(snapshot: DiagnosticsSnapshot): void {
        this.#snapshot = snapshot;
        for (const listener of [...this.#listeners]) {
            listener(snapshot);
        }
    }

    #scheduleAutomaticValidation(): void {
        if (this.#autoDelay === undefined || this.#destroyed) {
            return;
        }
        if (this.#autoTimer !== undefined) {
            timerHost.clearTimeout(this.#autoTimer);
        }
        this.#autoTimer = timerHost.setTimeout(() => {
            this.#autoTimer = undefined;
            void this.#validate();
        }, this.#autoDelay);
    }

    #assertAlive(): void {
        if (this.#destroyed) {
            throw new EditorDestroyedError();
        }
    }
}

interface TimerHost {
    clearTimeout(handle: unknown): void;
    setTimeout(handler: () => void, delay: number): unknown;
}

const timerHost = globalThis as unknown as TimerHost;

interface ProviderOutcome {
    readonly failures: readonly DiagnosticProviderFailure[];
    readonly problems: readonly Problem[];
}

async function runProvider(
    provider: DiagnosticProvider,
    source: string,
): Promise<ProviderOutcome> {
    try {
        const diagnostics = await provider.provide(source);
        if (!Array.isArray(diagnostics)) {
            throw new InvalidDiagnosticError(
                provider.id,
                'must return an array of diagnostics.',
            );
        }
        return {
            failures: [],
            problems: diagnostics.map((diagnostic, index) =>
                freezeProblem(provider.id, diagnostic, index, source.length),
            ),
        };
    } catch (error: unknown) {
        return {
            failures: Object.freeze([
                Object.freeze({ provider: provider.id, error }),
            ]),
            problems: Object.freeze([]),
        };
    }
}

function createSnapshot(
    status: DiagnosticsStatus,
    problems: readonly Problem[],
    failures: readonly DiagnosticProviderFailure[],
): DiagnosticsSnapshot {
    const frozenProblems = Object.isFrozen(problems)
        ? problems
        : Object.freeze([...problems]);
    const frozenFailures = Object.isFrozen(failures)
        ? failures
        : Object.freeze([...failures]);
    return Object.freeze({
        counts: countProblems(frozenProblems),
        failures: frozenFailures,
        problems: frozenProblems,
        status,
    });
}

function countProblems(problems: readonly Problem[]): DiagnosticCounts {
    const byProvider: Record<string, number> = Object.create(null) as Record<
        string,
        number
    >;
    const bySeverity: Record<ProblemSeverity, number> = {
        error: 0,
        warning: 0,
        info: 0,
        hint: 0,
    };
    for (const problem of problems) {
        byProvider[problem.provider] = (byProvider[problem.provider] ?? 0) + 1;
        bySeverity[problem.severity] += 1;
    }
    return Object.freeze({
        total: problems.length,
        byProvider: Object.freeze(byProvider),
        bySeverity: Object.freeze(bySeverity),
    });
}

function normalizeFilter(filter: DiagnosticFilter): {
    readonly providers?: ReadonlySet<string>;
    readonly severities?: ReadonlySet<ProblemSeverity>;
} {
    if (typeof filter !== 'object' || filter === null) {
        throw new TypeError('A diagnostic filter must be an object.');
    }
    if (filter.providers !== undefined && !Array.isArray(filter.providers)) {
        throw new TypeError('Diagnostic filter providers must be an array.');
    }
    if (filter.severities !== undefined && !Array.isArray(filter.severities)) {
        throw new TypeError('Diagnostic filter severities must be an array.');
    }
    const providers = filter.providers?.map((provider) => {
        if (typeof provider !== 'string' || provider.trim().length === 0) {
            throw new TypeError(
                'Diagnostic filter providers must be non-empty strings.',
            );
        }
        return provider;
    });
    const severities = filter.severities?.map((severity) => {
        if (!isSeverity(severity)) {
            throw new TypeError(
                'Diagnostic filter severities must be supported severities.',
            );
        }
        return severity;
    });
    return {
        ...(providers === undefined
            ? {}
            : { providers: new Set(providers) as ReadonlySet<string> }),
        ...(severities === undefined
            ? {}
            : {
                  severities: new Set(
                      severities,
                  ) as ReadonlySet<ProblemSeverity>,
              }),
    };
}

function readValidationDelay(value: unknown): number | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new TypeError(
            '"htmlTools.diagnostics.validation" must be a validation policy object.',
        );
    }
    const mode = Reflect.get(value, 'mode');
    if (mode === 'manual') {
        return undefined;
    }
    if (mode !== 'debounced') {
        throw new TypeError(
            'Diagnostics validation mode must be "manual" or "debounced".',
        );
    }
    const delay = Reflect.get(value, 'delay') ?? 300;
    if (
        !Number.isInteger(delay) ||
        Number(delay) < 0 ||
        Number(delay) > 60_000
    ) {
        throw new TypeError(
            'Diagnostics debounce delay must be an integer from 0 to 60000 milliseconds.',
        );
    }
    return Number(delay);
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
