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
} from '@soeditor/html';
import { html } from '@codemirror/lang-html';
import {
    lintGutter,
    linter,
    type Diagnostic as CodeMirrorDiagnostic,
} from '@codemirror/lint';
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

/** Options for attaching a source surface to one editor and host. */
export interface SourceEditingEngineOptions {
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

/** CodeMirror-backed exact-source editing surface for one editor instance. */
export class SourceEditingEngine implements SourceEngine {
    readonly editor: Editor;
    readonly element: HTMLElement;
    readonly #disposeDocumentChange: () => void;
    readonly #disposeEditorDestroy: () => void;
    readonly #disposeModeChange: () => void;
    readonly #editable = new Compartment();
    readonly #previousHidden: boolean;
    readonly #service: SourceEditingService;
    readonly #view: EditorView;
    #destroyed = false;
    #diagnostics: readonly HtmlParseDiagnostic[];
    #synchronizing = false;

    constructor(options: SourceEditingEngineOptions) {
        this.editor = options.editor;
        this.element = options.element;
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
        this.#view = new EditorView({
            doc: source,
            extensions: [
                basicSetup,
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

        const service: SourceEditingService = {
            focus: () => this.focus(),
            getDiagnostics: () => this.diagnostics,
        };
        this.#service = Object.freeze(service);
        this.editor.services.register(sourceEditingServiceToken, this.#service);
        this.element.addEventListener('keydown', this.#handleKeyDown, true);
        this.#updateMode();
        this.#disposeDocumentChange = this.editor.events.on(
            'document:change',
            ({ current }) => this.#synchronizeSource(current.source),
        );
        this.#disposeModeChange = this.editor.events.on('mode:change', () =>
            this.#updateMode(),
        );
        this.#disposeEditorDestroy = this.editor.events.on(
            'editor:destroy',
            () => this.destroy(),
        );
    }

    get diagnostics(): readonly HtmlParseDiagnostic[] {
        this.#assertAlive();
        return this.#diagnostics;
    }

    focus(): void {
        this.#assertAlive();
        this.#view.focus();
    }

    destroy(): void {
        if (this.#destroyed) {
            return;
        }

        this.#destroyed = true;
        this.#disposeDocumentChange();
        this.#disposeModeChange();
        this.#disposeEditorDestroy();
        this.element.removeEventListener('keydown', this.#handleKeyDown, true);
        try {
            if (
                this.editor.services.tryGet(sourceEditingServiceToken) ===
                this.#service
            ) {
                this.editor.services.unregister(sourceEditingServiceToken);
            }
        } catch (error: unknown) {
            if (!(error instanceof EditorDestroyedError)) {
                throw error;
            }
        }
        this.#view.destroy();
        this.element.replaceChildren();
        this.element.hidden = this.#previousHidden;
    }

    #handleSourceChange(source: string): void {
        this.#diagnostics = readDiagnostics(source);
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
        this.element.hidden = this.editor.state.mode !== 'source';
        this.#view.dispatch({
            effects: this.#editable.reconfigure([
                EditorState.readOnly.of(readonly),
                EditorView.editable.of(!readonly),
            ]),
        });
    }

    #isReadonly(): boolean {
        return (
            this.editor.state.readonly || this.editor.state.mode !== 'source'
        );
    }

    #assertAlive(): void {
        if (this.#destroyed) {
            throw new SourceEditingEngineDestroyedError();
        }
    }
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

function isCompleteDocument(source: string): boolean {
    return /<!doctype\s|<\/?(?:html|head|body)(?:\s|>)/iu.test(source);
}
