import type { SourceRange } from '@soeditor/html';

/** Severity of a UI-independent SoEditor problem. */
export type ProblemSeverity = 'error' | 'warning' | 'info' | 'hint';

/** Immutable diagnostic result published by a named provider. */
export interface Problem {
    readonly severity: ProblemSeverity;
    readonly message: string;
    readonly code: string;
    readonly provider: string;
    readonly source?: SourceRange;
}

/** Provider result before the registry assigns provider identity. */
export interface Diagnostic {
    readonly severity: ProblemSeverity;
    readonly message: string;
    readonly code: string;
    readonly source?: SourceRange;
}

/** UI-independent source diagnostic extension point. */
export interface DiagnosticProvider {
    readonly id: string;
    provide(
        source: string,
    ): readonly Diagnostic[] | PromiseLike<readonly Diagnostic[]>;
}

/** Thrown when two providers use the same ID in one editor. */
export class DiagnosticProviderAlreadyRegisteredError extends Error {
    constructor(id: string) {
        super(`Diagnostic provider "${id}" is already registered.`);
        this.name = 'DiagnosticProviderAlreadyRegisteredError';
    }
}

/** Thrown when a provider returns a malformed diagnostic at runtime. */
export class InvalidDiagnosticError extends TypeError {
    constructor(provider: string, message: string) {
        super(`Diagnostic provider "${provider}" ${message}`);
        this.name = 'InvalidDiagnosticError';
    }
}
