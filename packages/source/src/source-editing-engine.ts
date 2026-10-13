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
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
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
    ChangeSet,
    Compartment,
    EditorState,
    Transaction as CodeMirrorTransaction,
} from '@codemirror/state';
import { EditorView, showPanel } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { basicSetup } from 'codemirror';
import { sourcePhrases } from './source-translations.js';

import {
    sourceEditingServiceToken,
    type SourceEditingService,
    type SourceRevealOptions,
} from './source-editing-service.js';

function sourceTheme(dark: boolean) {
    const background = dark ? '#1e1e1e' : '#ffffff';
    const color = dark ? '#d4d4d4' : '#24292f';
    const accent = dark ? '#58a6ff' : '#0969da';
    const active = dark ? '#20242a' : '#eaf2ff';
    const border = dark ? '#454545' : '#d0d7de';
    const theme = EditorView.theme(
        {
            '&': {
                backgroundColor: background,
                color,
                colorScheme: dark ? 'dark' : 'light',
            },
            '&.cm-focused': {
                outline: `2px solid ${accent}`,
                outlineOffset: '-2px',
            },
            '.cm-content': { caretColor: dark ? '#ffffff' : '#24292f' },
            '.cm-cursor, .cm-dropCursor': {
                borderLeftColor: dark ? '#ffffff' : '#24292f',
                borderLeftWidth: '2px',
            },
            '.cm-activeLine': { backgroundColor: 'transparent' },
            '&.cm-focused .cm-activeLine': { backgroundColor: active },
            '.cm-gutters': {
                backgroundColor: dark ? background : '#f6f8fa',
                color,
            },
            '.cm-activeLineGutter': { backgroundColor: 'transparent' },
            '&.cm-focused .cm-activeLineGutter': {
                backgroundColor: active,
                color: dark ? '#ffffff' : '#24292f',
            },
            '&.cm-focused .cm-lineNumbers .cm-activeLineGutter': {
                boxShadow: `inset 3px 0 ${accent}`,
            },
            '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground':
                {
                    backgroundColor: dark ? '#264f78' : '#b6d7ff',
                },
            '.cm-panels': {
                backgroundColor: dark ? '#252526' : '#f6f8fa',
                color,
            },
            '.soeditor-source-theme': {
                display: 'flex',
                alignItems: 'center',
                gap: '.5rem',
                padding: '.25rem .5rem',
                borderBottom: `1px solid ${border}`,
            },
            '.soeditor-source-theme select': {
                backgroundColor: background,
                color,
                border: `1px solid ${border}`,
                borderRadius: '3px',
                padding: '.15rem .35rem',
                font: 'inherit',
            },
            '.soeditor-source-theme select:focus-visible': {
                outline: `2px solid ${accent}`,
            },
            '.cm-tooltip': {
                backgroundColor: dark ? '#252526' : '#ffffff',
                color,
                border: `1px solid ${border}`,
            },
            '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
                backgroundColor: '#0969da',
                color: '#ffffff',
            },
        },
        { dark },
    );
    const highlight = HighlightStyle.define([
        {
            tag: [tags.tagName, tags.keyword],
            color: dark ? '#569cd6' : '#116329',
        },
        {
            tag: [tags.attributeName, tags.propertyName, tags.variableName],
            color: dark ? '#9cdcfe' : '#0550ae',
        },
        {
            tag: [tags.string, tags.attributeValue],
            color: dark ? '#ce9178' : '#0a3069',
        },
        { tag: tags.comment, color: dark ? '#6a9955' : '#57606a' },
        {
            tag: [tags.number, tags.bool, tags.atom],
            color: dark ? '#b5cea8' : '#0550ae',
        },
        { tag: tags.angleBracket, color: dark ? '#808080' : '#57606a' },
        { tag: tags.invalid, color: dark ? '#f44747' : '#cf222e' },
    ]);
    return [theme, syntaxHighlighting(highlight)];
}

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
    readonly #theme = new Compartment();
    readonly #previousHidden: boolean;
    readonly #service: SourceEditingService;
    readonly #selectionListeners = new Set<() => void>();
    readonly #view: EditorView;
    #destroyed = false;
    #editorDestroying = false;
    #diagnostics: readonly HtmlParseDiagnostic[] = [];
    #diagnosticSource: string | undefined;
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
        const readonly = this.#isReadonly();
        const cspNonce = readCspNonce(options.cspNonce);
        this.#view = new EditorView({
            doc: source,
            extensions: [
                basicSetup,
                EditorState.phrases.of(sourcePhrases(this.element)),
                this.#theme.of(sourceTheme(false)),
                showPanel.of(() => this.#themePanel()),
                ...(cspNonce === undefined
                    ? []
                    : [EditorView.cspNonce.of(cspNonce)]),
                html({ autoCloseTags: false }),
                lintGutter(),
                linter(
                    (view) =>
                        toCodeMirrorDiagnostics(
                            this.#diagnosticsFor(view.state.doc.toString()),
                            view.state.doc.length,
                        ),
                    {
                        delay: 300,
                    },
                ),
                this.#editable.of([
                    EditorState.readOnly.of(readonly),
                    EditorView.editable.of(!readonly),
                ]),
                EditorView.contentAttributes.of({
                    'aria-label':
                        options.ariaLabel ??
                        sourcePhrases(this.element)['HTML source editor'] ??
                        'HTML source editor',
                }),
                EditorView.updateListener.of((update) => {
                    if (update.docChanged && !this.#synchronizing) {
                        this.#handleSourceChange(update.state.doc.toString());
                    }
                    if (update.selectionSet) {
                        for (const listener of this.#selectionListeners) {
                            listener();
                        }
                    }
                }),
            ],
            parent: this.element,
        });
        this.#view.scrollDOM.tabIndex = 0;
        this.#view.scrollDOM.setAttribute('role', 'region');
        this.#view.scrollDOM.setAttribute(
            'aria-label',
            sourcePhrases(this.element)['HTML source scroll area'] ??
                'HTML source scroll area',
        );

        const service: SourceEditingService = {
            focus: () => this.focus(),
            getDiagnostics: () => this.diagnostics,
            getSelection: () => this.#sourceSelection(),
            openSearchPanel: (query) => this.openSearchPanel(query),
            reveal: (range, revealOptions) => this.reveal(range, revealOptions),
            subscribeSelection: (listener) => {
                this.#selectionListeners.add(listener);
                return () => this.#selectionListeners.delete(listener);
            },
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
        this.#disposeModeChange = this.editor.events.on('mode:change', () => {
            if (this.#projectionActivity === undefined) this.#updateMode();
        });
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
            () => {
                this.#editorDestroying = true;
                this.destroy();
            },
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
        return this.#diagnosticsFor(this.#view.state.doc.toString());
    }

    #diagnosticsFor(source: string): readonly HtmlParseDiagnostic[] {
        if (this.#diagnosticSource !== source) {
            this.#diagnostics = readDiagnostics(source);
            this.#diagnosticSource = source;
        }
        return this.#diagnostics;
    }

    #themePanel() {
        const document = this.element.ownerDocument;
        const phrases = sourcePhrases(this.element);
        const t = (key: string): string => phrases[key] ?? key;
        const dom = document.createElement('label');
        dom.className = 'soeditor-source-theme';
        dom.append(t('Color scheme'));
        const select = document.createElement('select');
        select.setAttribute('aria-label', t('Source color scheme'));
        const choices = [
            ['light', t('Default (light)')],
            ['dark', t('Dark')],
        ] as const;
        for (const [value, label] of choices) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            select.append(option);
        }
        const change = () => {
            if (select.value !== 'light' && select.value !== 'dark') return;
            this.#view.dispatch({
                effects: this.#theme.reconfigure(
                    sourceTheme(select.value === 'dark'),
                ),
            });
        };
        select.addEventListener('change', change);
        dom.append(select);
        return {
            dom,
            top: true,
            destroy: () => select.removeEventListener('change', change),
        };
    }

    focus(): void {
        this.#assertAlive();
        this.#withoutFocusActivation(() => this.#view.focus());
    }

    #sourceSelection(): SourceRange {
        const selection = this.#view.state.selection.main;
        const start = Math.min(selection.anchor, selection.head);
        const end = Math.max(selection.anchor, selection.head);
        return Object.freeze({
            start: Object.freeze({ column: 0, line: 0, offset: start }),
            end: Object.freeze({ column: 0, line: 0, offset: end }),
        });
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

    reveal(range: SourceRange, options: SourceRevealOptions = {}): void {
        this.#assertAlive();
        const length = this.#view.state.doc.length;
        const from = clampSourceOffset(range.start.offset, length);
        const to = Math.max(from, clampSourceOffset(range.end.offset, length));
        if (options.focus === false) {
            const line = this.#view.lineBlockAt(from);
            this.#view.scrollDOM.scrollTop = Math.max(
                0,
                line.top - this.#view.scrollDOM.clientHeight / 2,
            );
            return;
        }
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
            if (
                !(error instanceof EditorDestroyedError) &&
                !(
                    this.#editorDestroying &&
                    error instanceof Error &&
                    error.name === 'EditorDestroyedError'
                )
            ) {
                errors.push(error);
            }
        }
        this.#view.destroy();
        this.#selectionListeners.clear();
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
        const current = this.#view.state.doc.toString();
        if (current === source) {
            return;
        }

        const change = minimalSourceChange(current, source);
        // Large external deletions/replacements can accumulate expensive reused
        // syntax trees. Keep ordinary insertions and small documents incremental;
        // reset large parser input while mapping selection through the real edit.
        const resetParsing =
            current.length >= 65_536 && change.to > change.from;
        const selection = resetParsing
            ? this.#view.state.selection.map(
                  ChangeSet.of(change, current.length),
              )
            : undefined;

        this.#synchronizing = true;
        try {
            this.#view.dispatch({
                annotations: CodeMirrorTransaction.addToHistory.of(false),
                changes: resetParsing
                    ? { from: 0, to: current.length, insert: source }
                    : change,
                ...(selection === undefined ? {} : { selection }),
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
        if (this.#view.state.facet(EditorState.readOnly) === readonly) return;
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

function minimalSourceChange(
    current: string,
    source: string,
): { readonly from: number; readonly insert: string; readonly to: number } {
    const sharedLimit = Math.min(current.length, source.length);
    let from = 0;
    while (from < sharedLimit && current[from] === source[from]) {
        from += 1;
    }

    let currentEnd = current.length;
    let sourceEnd = source.length;
    while (
        currentEnd > from &&
        sourceEnd > from &&
        current[currentEnd - 1] === source[sourceEnd - 1]
    ) {
        currentEnd -= 1;
        sourceEnd -= 1;
    }

    return {
        from,
        insert: source.slice(from, sourceEnd),
        to: currentEnd,
    };
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
    diagnostics: readonly HtmlParseDiagnostic[],
    length: number,
): readonly CodeMirrorDiagnostic[] {
    return diagnostics.map((diagnostic) => {
        const from = clamp(diagnostic.source?.start.offset ?? 0, length);
        const to = clamp(diagnostic.source?.end.offset ?? from, length);
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
