import {
    EditorDestroyedError,
    ServiceAlreadyRegisteredError,
    type Editor,
} from '@soeditor/core';
import { groupHistoryTransaction } from '@soeditor/engine';
import {
    projectionCoordinatorServiceToken,
    type ProjectionActivity,
} from '@soeditor/projections';
import { markdown } from '@codemirror/lang-markdown';
import {
    Compartment,
    EditorState,
    Transaction as CodeMirrorTransaction,
} from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { basicSetup } from 'codemirror';

import {
    markdownEditingServiceToken,
    type MarkdownEditingService,
} from './markdown-service.js';

const accessibleActiveLineTheme = EditorView.theme({
    '.cm-activeLine': { backgroundColor: 'transparent' },
});

/** Options for attaching canonical Markdown editing to one host. */
export interface MarkdownEditingEngineOptions {
    readonly activateOnFocus?: boolean;
    readonly ariaLabel?: string;
    /** CSP nonce applied to CodeMirror's generated style element. */
    readonly cspNonce?: string;
    readonly editor: Editor;
    readonly element: HTMLElement;
}

/** Minimal lifecycle of an attached Markdown editing surface. */
export interface MarkdownEditingEngineHandle {
    destroy(): void;
}

/** Reports use of an independently destroyed Markdown engine. */
export class MarkdownEditingEngineDestroyedError extends Error {
    constructor() {
        super('The Markdown editing engine has been destroyed.');
        this.name = 'MarkdownEditingEngineDestroyedError';
    }
}

/** Reports attachment to a document whose canonical format is not Markdown. */
export class UnsupportedMarkdownDocumentFormatError extends Error {
    constructor(format: string) {
        super(
            `The Markdown editing engine does not support "${format}" documents.`,
        );
        this.name = 'UnsupportedMarkdownDocumentFormatError';
    }
}

/** CodeMirror-backed exact Markdown source surface for one editor. */
export class MarkdownEditingEngine implements MarkdownEditingEngineHandle {
    readonly #activateOnFocus: boolean;
    readonly editor: Editor;
    readonly element: HTMLElement;
    readonly #disposeDocumentChange: () => void;
    readonly #disposeEditorDestroy: () => void;
    readonly #disposeModeChange: () => void;
    readonly #disposeStateChange: () => void;
    readonly #editable = new Compartment();
    readonly #previousHidden: boolean;
    readonly #service: MarkdownEditingService;
    readonly #view: EditorView;
    #destroyed = false;
    #disposeProjection: (() => void) | undefined;
    #programmaticFocus = false;
    #projectionActivity: ProjectionActivity | undefined;
    #synchronizing = false;

    constructor(options: MarkdownEditingEngineOptions) {
        this.editor = options.editor;
        this.element = options.element;
        this.#activateOnFocus = options.activateOnFocus ?? false;
        if (this.editor.state.document.format !== 'markdown') {
            throw new UnsupportedMarkdownDocumentFormatError(
                this.editor.state.document.format,
            );
        }
        if (this.element.ownerDocument.defaultView === null) {
            throw new Error(
                'The Markdown editing host is not attached to a window.',
            );
        }
        if (this.editor.services.has(markdownEditingServiceToken)) {
            throw new ServiceAlreadyRegisteredError(
                markdownEditingServiceToken.id,
            );
        }

        this.#previousHidden = this.element.hidden;
        const readonly = this.#isReadonly();
        const cspNonce = readCspNonce(options.cspNonce);
        this.#view = new EditorView({
            doc: this.editor.getData(),
            extensions: [
                basicSetup,
                accessibleActiveLineTheme,
                ...(cspNonce === undefined
                    ? []
                    : [EditorView.cspNonce.of(cspNonce)]),
                markdown(),
                this.#editable.of([
                    EditorState.readOnly.of(readonly),
                    EditorView.editable.of(!readonly),
                ]),
                EditorView.contentAttributes.of({
                    'aria-label': options.ariaLabel ?? 'Markdown editor',
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
        this.#view.scrollDOM.setAttribute('aria-label', 'Markdown scroll area');
        this.#service = Object.freeze({ focus: () => this.focus() });
        this.editor.services.register(
            markdownEditingServiceToken,
            this.#service,
        );
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
            id: 'markdown',
            update: (activity) => {
                this.#projectionActivity = activity;
                this.#updateMode();
            },
        });
        if (coordinator === undefined) {
            this.#updateMode();
        }
    }

    focus(): void {
        this.#assertAlive();
        this.#programmaticFocus = true;
        try {
            this.#view.focus();
        } finally {
            this.#programmaticFocus = false;
        }
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
                this.editor.services.tryGet(markdownEditingServiceToken) ===
                this.#service
            ) {
                this.editor.services.unregister(markdownEditingServiceToken);
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
                'Markdown editing engine cleanup failed.',
            );
        }
    }

    #handleSourceChange(source: string): void {
        if (this.#isReadonly()) {
            return;
        }
        this.editor.update(
            (transaction) => {
                transaction.replaceDocument(source);
                groupHistoryTransaction(transaction, 'markdown-editing');
            },
            { origin: 'source' },
        );
    }

    #executeCoreHistory(command: 'editor.redo' | 'editor.undo'): boolean {
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
            this.editor.execute('projection.activate', 'markdown');
        }
    }

    #synchronizeSource(source: string): void {
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
            this.editor.state.mode === 'markdown'
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
            (this.editor.state.readonly ||
                this.editor.state.mode !== 'markdown')
        );
    }

    #assertAlive(): void {
        if (this.#destroyed) {
            throw new MarkdownEditingEngineDestroyedError();
        }
    }
}

function readCspNonce(value: string | undefined): string | undefined {
    if (value === undefined) return undefined;
    if (value.trim().length === 0) {
        throw new TypeError(
            'The Markdown editing CSP nonce must not be empty.',
        );
    }
    return value;
}

/** Attaches a CodeMirror Markdown surface to an editor. */
export function createMarkdownEditingEngine(
    options: MarkdownEditingEngineOptions,
): MarkdownEditingEngine {
    return new MarkdownEditingEngine(options);
}
