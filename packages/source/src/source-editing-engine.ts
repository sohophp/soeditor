import {
    EditorDestroyedError,
    ServiceAlreadyRegisteredError,
    type Editor,
} from '@soeditor/core';
import { groupHistoryTransaction } from '@soeditor/engine';
import {
    parseHtmlDocument,
    parseHtmlFragment,
    type HtmlParseDiagnostic,
    type SourceRange,
} from '@soeditor/html';
import {
    projectionCoordinatorServiceToken,
    type ProjectionActivity,
} from '@soeditor/projections';
import { html } from '@codemirror/lang-html';
import {
    lintGutter,
    linter,
    type Diagnostic as CodeMirrorDiagnostic,
} from '@codemirror/lint';
import {
    findNext,
    openSearchPanel,
    SearchQuery,
    setSearchQuery,
} from '@codemirror/search';
import {
    Compartment,
    EditorState,
    Transaction as CodeMirrorTransaction,
} from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { basicSetup } from 'codemirror';

import {
    sourceEditingServiceToken,
    type SourceEditingService,
} from './source-editing-service.js';

const accessibleActiveLineTheme = EditorView.theme({
    '.cm-activeLine': { backgroundColor: 'transparent' },
});

/** Options for attaching a source surface to one editor and host. */
export interface SourceEditingEngineOptions {
    readonly activateOnFocus?: boolean;
    /** CSP nonce applied to CodeMirror's generated style element. */
    readonly cspNonce?: string;
    readonly editor: Editor;
    readonly element: HTMLElement;
    readonly ariaLabel?: string;
}

/** Minimal lifecycle shared by source editing engine implementations. */
export interface SourceEngine {
    destroy(): void;
}

/** Thrown when an independently destroyed source engine is used. */
export class SourceEditingEngineDestroyedError extends Error {
    constructor() {
        super('The source editing engine has been destroyed.');
        this.name = 'SourceEditingEngineDestroyedError';
    }
}

/** Reports attachment of the HTML source engine to another document format. */
export class UnsupportedSourceDocumentFormatError extends Error {
    constructor(format: string) {
        super(`The HTML source engine does not support "${format}" documents.`);
        this.name = 'UnsupportedSourceDocumentFormatError';
    }
}

/** CodeMirror-backed exact-source editing surface for one editor instance. */
export class SourceEditingEngine implements SourceEngine {
    readonly #activateOnFocus: boolean;
    readonly editor: Editor;
    readonly element: HTMLElement;
    readonly #disposeDocumentChange: () => void;
    readonly #disposeEditorDestroy: () => void;
    readonly #disposeModeChange: () => void;
    readonly #disposeStateChange: () => void;
    readonly #editable = new Compartment();
    readonly #previousHidden: boolean;
    readonly #service: SourceEditingService;
    readonly #view: EditorView;
    #destroyed = false;
    #diagnostics: readonly HtmlParseDiagnostic[];
    #disposeProjection: (() => void) | undefined;
    #programmaticFocus = false;
    #projectionActivity: ProjectionActivity | undefined;
    #synchronizing = false;

    constructor(options: SourceEditingEngineOptions) {
        this.editor = options.editor;
        this.element = options.element;
        this.#activateOnFocus = options.activateOnFocus ?? false;
        if (this.editor.state.document.format !== 'html') {
            throw new UnsupportedSourceDocumentFormatError(
                this.editor.state.document.format,
            );
        }
        if (this.element.ownerDocument.defaultView === null) {
            throw new Error(
                'The source editing host is not attached to a window.',
            );
        }
        if (this.editor.services.has(sourceEditingServiceToken)) {
            throw new ServiceAlreadyRegisteredError(
                sourceEditingServiceToken.id,
            );
        }

        this.#previousHidden = this.element.hidden;
        const source = this.editor.getData();
        this.#diagnostics = readDiagnostics(source);
        const readonly = this.#isReadonly();
        const cspNonce = readCspNonce(options.cspNonce);
        this.#view = new EditorView({
            doc: source,
            extensions: [
                basicSetup,
                accessibleActiveLineTheme,
                ...(cspNonce === undefined
                    ? []
                    : [EditorView.cspNonce.of(cspNonce)]),
                html({ autoCloseTags: false }),
                lintGutter(),
                linter(
                    (view) =>
                        toCodeMirrorDiagnostics(view.state.doc.toString()),
                    {
                        delay: 0,
                    },
                ),
                this.#editable.of([
                    EditorState.readOnly.of(readonly),
                    EditorView.editable.of(!readonly),
                ]),
                EditorView.contentAttributes.of({
                    'aria-label': options.ariaLabel ?? 'HTML source editor',
                }),
                EditorView.updateListener.of((update) => {
                    if (update.docChanged && !this.#synchronizing) {
                        this.#handleSourceChange(update.state.doc.toString());
                    }
                }),
            ],
            parent: this.element,
        });
        this.#view.scrollDOM.tabIndex = 0;
        this.#view.scrollDOM.setAttribute('role', 'region');
        this.#view.scrollDOM.setAttribute(
            'aria-label',
            'HTML source scroll area',
        );

        const service: SourceEditingService = {
            focus: () => this.focus(),
            getDiagnostics: () => this.diagnostics,
            openSearchPanel: (query) => this.openSearchPanel(query),
            reveal: (range) => this.reveal(range),
        };
        this.#service = Object.freeze(service);
        this.editor.services.register(sourceEditingServiceToken, this.#service);
        this.element.addEventListener('keydown', this.#handleKeyDown, true);
        this.element.addEventListener('focusin', this.#handleFocusIn);
        this.element.addEventListener('pointerdown', this.#handlePointerDown);
        this.#disposeDocumentChange = this.editor.events.on(
            'document:change',
            ({ current }) => this.#synchronizeSource(current.source),
        );
        this.#disposeModeChange = this.editor.events.on('mode:change', () =>
            this.#updateMode(),
        );
        this.#disposeStateChange = this.editor.events.on(
            'state:change',
            ({ current, previous }) => {
                if (
                    current.readonly !== previous.readonly &&
                    this.#projectionActivity === undefined
                ) {
                    this.#updateMode();
                }
            },
        );
        this.#disposeEditorDestroy = this.editor.events.on(
            'editor:destroy',
            () => this.destroy(),
        );
        const coordinator = this.editor.services.tryGet(
            projectionCoordinatorServiceToken,
        );
        this.#disposeProjection = coordinator?.attach({
            id: 'source',
            update: (activity) => {
                this.#projectionActivity = activity;
                this.#updateMode();
            },
        });
        if (coordinator === undefined) {
            this.#updateMode();
        }
    }

    get diagnostics(): readonly HtmlParseDiagnostic[] {
        this.#assertAlive();
        return this.#diagnostics;
    }

    focus(): void {
        this.#assertAlive();
        this.#withoutFocusActivation(() => this.#view.focus());
    }

    openSearchPanel(query?: string): void {
        this.#assertAlive();
        if (query !== undefined && typeof query !== 'string') {
            throw new TypeError('A source search query must be a string.');
        }
        this.#withoutFocusActivation(() => {
            openSearchPanel(this.#view);
            if (query !== undefined) {
                this.#view.dispatch({
                    effects: setSearchQuery.of(
                        new SearchQuery({ search: query }),
                    ),
                });
                if (query.length > 0) {
                    findNext(this.#view);
                }
            }
        });
    }

    reveal(range: SourceRange): void {
        this.#assertAlive();
        const length = this.#view.state.doc.length;
        const from = clampSourceOffset(range.start.offset, length);
        const to = Math.max(from, clampSourceOffset(range.end.offset, length));
        this.#withoutFocusActivation(() => {
            this.#view.dispatch({
                effects: EditorView.scrollIntoView(from, { y: 'center' }),
                selection: { anchor: from, head: to },
            });
            this.#view.focus();
        });
    }

    destroy(): void {
        if (this.#destroyed) {
            return;
        }

        this.#destroyed = true;
        const errors: unknown[] = [];
        this.#disposeDocumentChange();
        this.#disposeModeChange();
        this.#disposeStateChange();
        this.#disposeEditorDestroy();
        this.element.removeEventListener('keydown', this.#handleKeyDown, true);
        this.element.removeEventListener('focusin', this.#handleFocusIn);
        this.element.removeEventListener(
            'pointerdown',
            this.#handlePointerDown,
        );
        try {
            this.#disposeProjection?.();
        } catch (error: unknown) {
            errors.push(error);
        }
        this.#disposeProjection = undefined;
        try {
            if (
                this.editor.services.tryGet(sourceEditingServiceToken) ===
                this.#service
            ) {
                this.editor.services.unregister(sourceEditingServiceToken);
            }
        } catch (error: unknown) {
            if (!(error instanceof EditorDestroyedError)) {
                errors.push(error);
            }
        }
        this.#view.destroy();
        this.element.replaceChildren();
        this.element.hidden = this.#previousHidden;
        if (errors.length > 0) {
            throw new AggregateError(
                errors,
                'Source editing engine cleanup failed.',
            );
        }
    }

    #handleSourceChange(source: string): void {
        this.#diagnostics = readDiagnostics(source);
        if (this.#isReadonly()) {
            return;
        }
        this.editor.update(
            (transaction) => {
                transaction.replaceDocument(source);
                groupHistoryTransaction(transaction, 'source-editing');
            },
            { origin: 'source' },
        );
    }

    #executeCoreHistory(command: 'editor.undo' | 'editor.redo'): boolean {
        if (
            !this.editor.commands.has(command) ||
            !this.editor.commands.canExecute(command)
        ) {
            return false;
        }
        this.editor.execute(command);
        return true;
    }

    readonly #handleKeyDown = (event: KeyboardEvent): void => {
        if (!(event.ctrlKey || event.metaKey) || event.altKey) {
            return;
        }
        const key = event.key.toLowerCase();
        const command =
            key === 'z'
                ? event.shiftKey
                    ? 'editor.redo'
                    : 'editor.undo'
                : key === 'y' && !event.shiftKey
                  ? 'editor.redo'
                  : undefined;
        if (command !== undefined && this.#executeCoreHistory(command)) {
            event.preventDefault();
            event.stopPropagation();
        }
    };

    readonly #handleFocusIn = (): void => {
        this.#activateFromUserIntent();
    };

    readonly #handlePointerDown = (): void => {
        this.#activateFromUserIntent();
    };

    #activateFromUserIntent(): void {
        if (
            this.#activateOnFocus &&
            !this.#programmaticFocus &&
            this.#projectionActivity?.visible === true &&
            this.#projectionActivity.primary === false
        ) {
            this.editor.execute('projection.activate', 'source');
        }
    }

    #synchronizeSource(source: string): void {
        this.#diagnostics = readDiagnostics(source);
        const current = this.#view.state.doc.toString();
        if (current === source) {
            return;
        }

        this.#synchronizing = true;
        try {
            this.#view.dispatch({
                annotations: CodeMirrorTransaction.addToHistory.of(false),
                changes: { from: 0, insert: source, to: current.length },
            });
        } finally {
            this.#synchronizing = false;
        }
    }

    #updateMode(): void {
        const readonly = this.#isReadonly();
        this.element.hidden = !(
            this.#projectionActivity?.visible ??
            this.editor.state.mode === 'source'
        );
        this.#view.dispatch({
            effects: this.#editable.reconfigure([
                EditorState.readOnly.of(readonly),
                EditorView.editable.of(!readonly),
            ]),
        });
    }

    #isReadonly(): boolean {
        return (
            this.#projectionActivity?.readonly ??
            (this.editor.state.readonly || this.editor.state.mode !== 'source')
        );
    }

    #withoutFocusActivation(callback: () => void): void {
        this.#programmaticFocus = true;
        try {
            callback();
        } finally {
            this.#programmaticFocus = false;
        }
    }

    #assertAlive(): void {
        if (this.#destroyed) {
            throw new SourceEditingEngineDestroyedError();
        }
    }
}

function readCspNonce(value: string | undefined): string | undefined {
    if (value === undefined) return undefined;
    if (value.trim().length === 0) {
        throw new TypeError('The source editing CSP nonce must not be empty.');
    }
    return value;
}

/** Attaches a CodeMirror source surface to an editor. */
export function createSourceEditingEngine(
    options: SourceEditingEngineOptions,
): SourceEditingEngine {
    return new SourceEditingEngine(options);
}

function readDiagnostics(source: string): readonly HtmlParseDiagnostic[] {
    const diagnostics = isCompleteDocument(source)
        ? parseHtmlDocument(source).diagnostics
        : parseHtmlFragment(source).diagnostics;
    return Object.freeze([...diagnostics]);
}

function toCodeMirrorDiagnostics(
    source: string,
): readonly CodeMirrorDiagnostic[] {
    return readDiagnostics(source).map((diagnostic) => {
        const from = clamp(diagnostic.source?.start.offset ?? 0, source.length);
        const to = clamp(diagnostic.source?.end.offset ?? from, source.length);
        return {
            from,
            message: `${diagnostic.code}: ${diagnostic.message}`,
            severity: diagnostic.severity,
            source: '@soeditor/html',
            to: Math.max(from, to),
        };
    });
}

function clamp(value: number, length: number): number {
    return Math.max(0, Math.min(value, length));
}

function clampSourceOffset(value: number, length: number): number {
    if (!Number.isInteger(value) || value < 0) {
        throw new TypeError(
            'A source range offset must be a non-negative integer.',
        );
    }
    return Math.min(value, length);
}

function isCompleteDocument(source: string): boolean {
    return /<!doctype\s|<\/?(?:html|head|body)(?:\s|>)/iu.test(source);
}
