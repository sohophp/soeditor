export { DiagnosticsPlugin, diagnosticsServiceToken } from './diagnostics.js';
export type { DiagnosticsService } from './diagnostics.js';
export {
    HtmlFormattingPlugin,
    htmlFormattingServiceToken,
    InvalidHtmlFormattingSourceError,
    StaleHtmlFormattingError,
} from './formatting.js';
export type {
    HtmlFormattingOptions,
    HtmlFormattingService,
} from './formatting.js';
export {
    DiagnosticProviderAlreadyRegisteredError,
    InvalidDiagnosticError,
} from './problems.js';
export type {
    Diagnostic,
    DiagnosticProvider,
    Problem,
    ProblemSeverity,
} from './problems.js';
