import type { Editor, Transaction } from '@soeditor/core';
import { parseHtmlFragment, serializeHtmlFragment } from '@soeditor/html';

import { DomProjection } from './dom-projection.js';
import { createClipboardPayload, createPastedModel } from './clipboard.js';
import {
    readReplaySelection,
    setHistoryMetadata,
    type HistoryMetadata,
} from './history-metadata.js';
import {
    createEditingModel,
    freezeModel,
    freezeSelection,
    serializeEditingModel,
    type EditingModel,
    type EditingSelection,
} from './model.js';
import {
    deleteBackward,
    deleteForward,
    deleteSelection,
    insertModel,
    insertParagraph,
    insertText,
    toggleMark,
    type EditingResult,
    UnsupportedEditingSelectionError,
    validateSelection,
} from './operations.js';

export interface VisualEditingEngineOptions {
    readonly editor: Editor;
    readonly element: HTMLElement;
}

export interface EditingEngine {
    destroy(): void;
}

export class VisualEditingEngineDestroyedError extends Error {
    constructor() {
        super('The visual editing engine has been destroyed.');
        this.name = 'VisualEditingEngineDestroyedError';
    }
}

export class VisualEditingEngine implements EditingEngine {
    readonly editor: Editor;
    readonly element: HTMLElement;
    readonly #disposeDocumentChange: () => void;
    readonly #disposeEditorDestroy: () => void;
    readonly #mutationObserver: MutationObserver;
    readonly #previousAttributes: ReadonlyMap<string, string | null>;
    readonly #projection: DomProjection;
    #compositionSelection: EditingSelection | undefined;
    #destroyed = false;
    #lockedDocument = false;
    #model: EditingModel;
    #pending:
        | {
              readonly model: EditingModel;
              readonly selection: EditingSelection;
              readonly source: string;
          }
        | undefined;

    constructor(options: VisualEditingEngineOptions) {
        this.editor = options.editor;
        this.element = options.element;
        const initial = createVisualModel(this.editor.getData());
        this.#model = initial.model;
        this.#lockedDocument = initial.locked;
        this.#previousAttributes = new Map(
            ['contenteditable', 'role', 'aria-multiline', 'aria-readonly'].map(
                (name) => [name, this.element.getAttribute(name)],
            ),
        );
        this.#updateEditableState();
        this.element.setAttribute('role', 'textbox');
        this.element.setAttribute('aria-multiline', 'true');
        this.#projection = new DomProjection(this.element, this.#model);
        this.#projection.render(this.#model);

        const view = this.element.ownerDocument.defaultView;
        if (view === null) {
            throw new Error(
                'The visual editing host is not attached to a window.',
            );
        }
        this.#mutationObserver = new view.MutationObserver(() => {
            if (!this.#destroyed) {
                this.#render(this.#model);
            }
        });
        this.#observeMutations();
        this.element.addEventListener('beforeinput', this.#handleBeforeInput);
        this.element.addEventListener(
            'compositionstart',
            this.#handleCompositionStart,
        );
        this.element.addEventListener(
            'compositionend',
            this.#handleCompositionEnd,
        );
        this.element.addEventListener('keydown', this.#handleKeyDown);
        this.element.addEventListener('copy', this.#handleCopy);
        this.element.addEventListener('cut', this.#handleCut);
        this.element.addEventListener('paste', this.#handlePaste);
        this.#disposeDocumentChange = this.editor.events.on(
            'document:change',
            ({ current, transaction }) =>
                this.#handleDocumentChange(current.source, transaction),
        );
        this.#disposeEditorDestroy = this.editor.events.on(
            'editor:destroy',
            () => this.destroy(),
        );
    }

    get selection(): EditingSelection | undefined {
        this.#assertAlive();
        const selection = this.#projection.readSelection();
        return selection === undefined ? undefined : freezeSelection(selection);
    }

    setSelection(selection: EditingSelection): boolean {
        this.#assertAlive();
        validateSelection(this.#model, selection);
        return this.#projection.restoreSelection(selection);
    }

    focus(): void {
        this.#assertAlive();
        this.element.focus();
    }

    destroy(): void {
        if (this.#destroyed) {
            return;
        }

        this.#destroyed = true;
        this.#mutationObserver.disconnect();
        this.element.removeEventListener(
            'beforeinput',
            this.#handleBeforeInput,
        );
        this.element.removeEventListener(
            'compositionstart',
            this.#handleCompositionStart,
        );
        this.element.removeEventListener(
            'compositionend',
            this.#handleCompositionEnd,
        );
        this.element.removeEventListener('keydown', this.#handleKeyDown);
        this.element.removeEventListener('copy', this.#handleCopy);
        this.element.removeEventListener('cut', this.#handleCut);
        this.element.removeEventListener('paste', this.#handlePaste);
        this.#disposeDocumentChange();
        this.#disposeEditorDestroy();
        this.element.replaceChildren();
        for (const [name, value] of this.#previousAttributes) {
            if (value === null) {
                this.element.removeAttribute(name);
            } else {
                this.element.setAttribute(name, value);
            }
        }
    }

    readonly #handleBeforeInput = (event: InputEvent): void => {
        if (this.#destroyed) {
            return;
        }

        event.preventDefault();
        if (this.editor.state.readonly || this.#lockedDocument) {
            return;
        }

        if (event.inputType === 'historyUndo') {
            this.#executeHistory('editor.undo');
            return;
        }
        if (event.inputType === 'historyRedo') {
            this.#executeHistory('editor.redo');
            return;
        }

        const nativeSelection = this.#projection.readSelection();
        const selection =
            event.inputType === 'insertCompositionText'
                ? (this.#compositionSelection ?? nativeSelection)
                : nativeSelection;
        if (selection === undefined) {
            return;
        }

        let result: EditingResult | undefined;
        let group: string | undefined;
        try {
            switch (event.inputType) {
                case 'insertText':
                case 'insertCompositionText':
                    if (event.data !== null) {
                        result = insertText(this.#model, selection, event.data);
                        group = 'typing';
                    }
                    break;
                case 'insertParagraph':
                    result = insertParagraph(this.#model, selection);
                    break;
                case 'deleteContentBackward':
                    result = deleteBackward(this.#model, selection);
                    group = 'delete-backward';
                    break;
                case 'deleteContentForward':
                    result = deleteForward(this.#model, selection);
                    group = 'delete-forward';
                    break;
                case 'formatBold':
                    result = toggleMark(this.#model, selection, 'strong');
                    break;
                case 'formatItalic':
                    result = toggleMark(this.#model, selection, 'em');
                    break;
                default:
                    break;
            }
        } catch (error: unknown) {
            if (error instanceof UnsupportedEditingSelectionError) {
                return;
            }
            throw error;
        }

        if (result !== undefined) {
            this.#commit(result, {
                afterSelection: result.selection,
                beforeSelection: nativeSelection ?? selection,
                ...(group === undefined ? {} : { group }),
            });
            if (event.inputType === 'insertCompositionText') {
                this.#compositionSelection = freezeSelection({
                    anchor: selection.anchor,
                    focus: result.selection.focus,
                });
            } else {
                this.#compositionSelection = undefined;
            }
        }
    };

    readonly #handleCompositionStart = (): void => {
        this.#compositionSelection = this.#projection.readSelection();
    };

    readonly #handleCompositionEnd = (): void => {
        this.#compositionSelection = undefined;
    };

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

        if (command === undefined) {
            return;
        }

        event.preventDefault();
        this.#executeHistory(command);
    };

    readonly #handleCopy = (event: ClipboardEvent): void => {
        this.#writeClipboard(event);
    };

    readonly #handleCut = (event: ClipboardEvent): void => {
        const selection = this.#writeClipboard(event);
        if (
            selection === undefined ||
            this.editor.state.readonly ||
            this.#lockedDocument
        ) {
            return;
        }

        try {
            const result = deleteSelection(this.#model, selection);
            this.#commit(result, {
                afterSelection: result.selection,
                beforeSelection: selection,
            });
        } catch (error: unknown) {
            if (!(error instanceof UnsupportedEditingSelectionError)) {
                throw error;
            }
        }
    };

    readonly #handlePaste = (event: ClipboardEvent): void => {
        event.preventDefault();
        if (this.editor.state.readonly || this.#lockedDocument) {
            return;
        }

        const clipboard = event.clipboardData;
        const selection = this.#projection.readSelection();
        if (clipboard === null || selection === undefined) {
            return;
        }

        try {
            const inserted = createPastedModel(
                clipboard.getData('text/html'),
                clipboard.getData('text/plain'),
            );
            const result = insertModel(this.#model, selection, inserted);
            this.#commit(result, {
                afterSelection: result.selection,
                beforeSelection: selection,
            });
        } catch (error: unknown) {
            if (!(error instanceof UnsupportedEditingSelectionError)) {
                throw error;
            }
        }
    };

    #commit(result: EditingResult, history: HistoryMetadata): void {
        const source = serializeHtmlFragment(
            serializeEditingModel(result.model),
        );
        this.#pending = {
            model: result.model,
            selection: result.selection,
            source,
        };

        try {
            this.editor.update(
                (transaction) => {
                    transaction.replaceDocument(source);
                    setHistoryMetadata(transaction, history);
                },
                { origin: 'user' },
            );

            if (this.#pending !== undefined) {
                this.#model = result.model;
                this.#render(result.model, result.selection);
            }
        } finally {
            this.#pending = undefined;
        }
    }

    #handleDocumentChange(source: string, transaction: Transaction): void {
        const pending = this.#pending;
        if (pending !== undefined && pending.source === source) {
            this.#model = pending.model;
            this.#render(pending.model, pending.selection);
            return;
        }

        const next = createVisualModel(source);
        this.#model = next.model;
        this.#lockedDocument = next.locked;
        this.#updateEditableState();
        this.#render(this.#model, readReplaySelection(transaction));
    }

    #render(model: EditingModel, selection?: EditingSelection): void {
        this.#mutationObserver.disconnect();
        try {
            this.#projection.render(model);
            if (selection !== undefined) {
                this.#projection.restoreSelection(selection);
            }
        } finally {
            this.#observeMutations();
        }
    }

    #observeMutations(): void {
        this.#mutationObserver.observe(this.element, {
            characterData: true,
            childList: true,
            subtree: true,
        });
    }

    #writeClipboard(event: ClipboardEvent): EditingSelection | undefined {
        const clipboard = event.clipboardData;
        const selection = this.#projection.readSelection();
        if (clipboard === null || selection === undefined) {
            return undefined;
        }

        try {
            const payload = createClipboardPayload(this.#model, selection);
            clipboard.setData('text/plain', payload.text);
            clipboard.setData('text/html', payload.html);
            event.preventDefault();
            return selection;
        } catch (error: unknown) {
            if (error instanceof UnsupportedEditingSelectionError) {
                event.preventDefault();
                return undefined;
            }
            throw error;
        }
    }

    #executeHistory(command: 'editor.undo' | 'editor.redo'): void {
        if (
            !this.editor.state.readonly &&
            this.editor.commands.has(command) &&
            this.editor.commands.canExecute(command)
        ) {
            this.editor.execute(command);
        }
    }

    #updateEditableState(): void {
        const readonly = this.editor.state.readonly || this.#lockedDocument;
        this.element.contentEditable = readonly ? 'false' : 'true';
        this.element.setAttribute('aria-readonly', String(readonly));
    }

    #assertAlive(): void {
        if (this.#destroyed) {
            throw new VisualEditingEngineDestroyedError();
        }
    }
}

export function createVisualEditingEngine(
    options: VisualEditingEngineOptions,
): VisualEditingEngine {
    return new VisualEditingEngine(options);
}

function ensureEditableModel(model: EditingModel): EditingModel {
    return model.blocks.length === 0
        ? freezeModel({
              blocks: [
                  {
                      attributes: [],
                      inlines: [],
                      kind: 'paragraph',
                  },
              ],
          })
        : model;
}

function createVisualModel(source: string): {
    readonly locked: boolean;
    readonly model: EditingModel;
} {
    if (/<!doctype\s|<\/?(?:html|head|body)(?:\s|>)/iu.test(source)) {
        return Object.freeze({
            locked: true,
            model: freezeModel({
                blocks: [
                    {
                        kind: 'opaque-block',
                        node: Object.freeze({
                            type: 'comment',
                            value: 'Complete HTML document preserved in source',
                        }),
                    },
                ],
            }),
        });
    }

    return Object.freeze({
        locked: false,
        model: ensureEditableModel(
            createEditingModel(parseHtmlFragment(source).document),
        ),
    });
}
