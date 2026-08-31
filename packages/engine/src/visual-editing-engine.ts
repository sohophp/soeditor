import {
    EditorDestroyedError,
    ServiceAlreadyRegisteredError,
    type Editor,
    type Transaction,
} from '@soeditor/core';
import {
    parseHtmlFragment,
    serializeHtmlFragment,
    type HtmlAttribute,
} from '@soeditor/html';
import {
    projectionCoordinatorServiceToken,
    type ProjectionActivity,
} from '@soeditor/projections';

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
    paragraphLength,
    serializeEditingModel,
    type EditingPoint,
    type EditingModel,
    type EditingSelection,
    type EditingStructuredBlock,
    type EditingStructuredBlockContent,
} from './model.js';
import {
    applyBlockAttributes,
    applyInlineStyle,
    adjustBlockIndent,
    areBlockAttributesActive,
    deleteBackward,
    deleteForward,
    deleteSelection,
    insertModel,
    insertParagraph,
    insertText,
    isBlockTagActive,
    isBlockAlignmentActive,
    isInlineStyleActive,
    isLinkActive,
    getLinkAttributes,
    isListActive,
    isTextMarkActive,
    isStructuredBlockSelected,
    moveStructuredBlock,
    getSelectedStructuredBlock,
    replaceStructuredBlockContent,
    removeFormat,
    setBlockTag,
    setBlockAlignment,
    setEditingOperations,
    setLink,
    setListAttributes,
    setStructuredBlockAttributes,
    toggleMark,
    toggleList,
    type EditingResult,
    UnsupportedEditingSelectionError,
    validateSelection,
} from './operations.js';
import {
    PasteRejectedError,
    SOEDITOR_CLIPBOARD_MIME,
    pastePipelineServiceToken,
    type PastePipelineInput,
} from './paste-pipeline.js';
import {
    sealStructuredEditingRegistry,
    snapshotStructuredEditingRegistry,
    structuredEditingRegistryToken,
    type StructuredEditingSchema,
} from './structured-editing.js';
import {
    visualEditingServiceToken,
    type VisualBlockTag,
    type VisualEditingService,
    type VisualHtmlInsertionOptions,
    type VisualInlineStyle,
    type VisualListProperties,
    type VisualLinkAttributes,
    type VisualTextMark,
} from './visual-editing-service.js';
import {
    visualDecorationsServiceToken,
    type VisualDecorationsService,
} from './visual-decorations.js';

export interface VisualEditingEngineOptions {
    readonly activateOnFocus?: boolean;
    readonly editor: Editor;
    readonly element: HTMLElement;
    readonly ariaLabel?: string;
    /** Projection identity used by this controlled HTML editing surface. */
    readonly projectionId?: VisualEditingProjectionId;
    /**
     * Registers the command-facing editing service. Disable this for a
     * secondary Developer Visual surface shown beside a WYSIWYG writer.
     */
    readonly registerEditingService?: boolean;
}

export type VisualEditingProjectionId = 'visual' | 'wysiwyg';

export interface EditingEngine {
    destroy(): void;
}

export class VisualEditingEngineDestroyedError extends Error {
    constructor() {
        super('The visual editing engine has been destroyed.');
        this.name = 'VisualEditingEngineDestroyedError';
    }
}

/** Reports attachment of the HTML visual engine to another document format. */
export class UnsupportedVisualDocumentFormatError extends Error {
    constructor(format: string) {
        super(
            `The visual editing engine does not support "${format}" documents.`,
        );
        this.name = 'UnsupportedVisualDocumentFormatError';
    }
}

function announceEditingFeedback(element: HTMLElement, message: string): void {
    const EventConstructor =
        element.ownerDocument.defaultView?.CustomEvent ?? CustomEvent;
    element.dispatchEvent(
        new EventConstructor('soeditor:editing-feedback', {
            bubbles: true,
            detail: Object.freeze({ message, severity: 'warning' }),
        }),
    );
}

export class VisualEditingEngine implements EditingEngine {
    readonly editor: Editor;
    readonly element: HTMLElement;
    readonly #disposeDocumentChange: () => void;
    readonly #disposeEditorDestroy: () => void;
    readonly #disposeModeChange: () => void;
    readonly #disposeStateChange: () => void;
    readonly #mutationObserver: MutationObserver;
    readonly #previousAttributes: ReadonlyMap<string, string | null>;
    readonly #previousHidden: boolean;
    readonly #projection: DomProjection;
    readonly #service: VisualEditingService;
    readonly #schema: StructuredEditingSchema;
    readonly #visualDecorations: VisualDecorationsService | undefined;
    readonly #activateOnFocus: boolean;
    readonly #projectionId: VisualEditingProjectionId;
    readonly #registerEditingService: boolean;
    #compositionSelection: EditingSelection | undefined;
    #compositionGroup: string | undefined;
    #compositionSequence = 0;
    #draggedStructuredBlock: number | undefined;
    #destroyed = false;
    #lockedDocument = false;
    #lastValidModel: EditingModel | undefined;
    #model: EditingModel;
    #pending:
        | {
              readonly model: EditingModel;
              readonly selection: EditingSelection;
              readonly source: string;
          }
        | undefined;
    #disposeProjection: (() => void) | undefined;
    #disposeVisualDecorations: (() => void) | undefined;
    #programmaticFocus = false;
    #projectionActivity: ProjectionActivity | undefined;
    #retainedSelection: EditingSelection | undefined;

    constructor(options: VisualEditingEngineOptions) {
        this.editor = options.editor;
        this.element = options.element;
        this.#activateOnFocus = options.activateOnFocus ?? false;
        this.#projectionId = options.projectionId ?? 'visual';
        this.#registerEditingService = options.registerEditingService ?? true;
        if (this.editor.state.document.format !== 'html') {
            throw new UnsupportedVisualDocumentFormatError(
                this.editor.state.document.format,
            );
        }
        const ariaLabel =
            options.ariaLabel ??
            (this.#projectionId === 'wysiwyg'
                ? 'WYSIWYG editor'
                : 'Developer Visual editor');
        if (typeof ariaLabel !== 'string' || ariaLabel.trim().length === 0) {
            throw new TypeError('A visual editor ariaLabel must not be empty.');
        }
        const view = this.element.ownerDocument.defaultView;
        if (view === null) {
            throw new Error(
                'The visual editing host is not attached to a window.',
            );
        }
        if (
            this.#registerEditingService &&
            this.editor.services.has(visualEditingServiceToken)
        ) {
            throw new ServiceAlreadyRegisteredError(
                visualEditingServiceToken.id,
            );
        }
        const structuredRegistry = this.editor.services.tryGet(
            structuredEditingRegistryToken,
        );
        this.#schema = snapshotStructuredEditingRegistry(structuredRegistry);
        this.#visualDecorations = this.editor.services.tryGet(
            visualDecorationsServiceToken,
        );
        const initial = createVisualModel(this.editor.getData(), this.#schema);
        sealStructuredEditingRegistry(structuredRegistry);
        this.#model = initial.model;
        this.#lockedDocument = initial.locked;
        this.#lastValidModel = initial.valid ? initial.model : undefined;
        this.#previousHidden = this.element.hidden;
        this.#previousAttributes = new Map(
            [
                'contenteditable',
                'role',
                'aria-label',
                'aria-multiline',
                'aria-readonly',
            ].map((name) => [name, this.element.getAttribute(name)]),
        );
        this.element.setAttribute('role', 'textbox');
        this.element.setAttribute('aria-label', ariaLabel);
        this.element.setAttribute('aria-multiline', 'true');
        this.#projection = new DomProjection(this.element, this.#model, {
            decorations: () => this.#visualDecorations?.snapshot ?? [],
            executeCommand: (commandId, args) =>
                this.editor.execute(commandId, ...args),
            hasCommand: (commandId) => this.editor.commands.has(commandId),
            insertParagraphAfter: (block) =>
                this.#insertParagraphAfterOpaque(block),
            projectionId: this.#projectionId,
            readonly: this.#isReadonly() || this.#lockedDocument,
            schema: this.#schema,
        });
        this.#projection.render(this.#model);
        const service: VisualEditingService = {
            adjustIndent: (delta) => this.#adjustIndent(delta),
            applyBlockAttributes: (attributes) =>
                this.#applyBlockAttributes(attributes),
            applyInlineStyle: (style) => this.#applyInlineStyle(style),
            areBlockAttributesActive: (attributes) =>
                this.#areBlockAttributesActive(attributes),
            canEdit: () => this.#canEdit(),
            getSelection: () => {
                this.#assertAlive();
                const selection =
                    this.#projection.readRetainedSelection() ??
                    this.#retainedSelection;
                if (selection !== undefined) {
                    this.#retainedSelection = freezeSelection(selection);
                }
                return selection === undefined
                    ? undefined
                    : freezeSelection(selection);
            },
            getSelectedStructuredBlock: (type) =>
                this.#getSelectedStructuredBlock(type),
            getLinkAttributes: () => this.#getLinkAttributes(),
            insertHtml: (html, options) => this.#insertHtml(html, options),
            isBlockActive: (tagName) => this.#isBlockActive(tagName),
            isAlignmentActive: (alignment) =>
                this.#isAlignmentActive(alignment),
            isLinkActive: () => this.#isLinkActive(),
            isListActive: (list) => this.#isListActive(list),
            isMarkActive: (mark) => this.#isMarkActive(mark),
            isInlineStyleActive: (style) => this.#isInlineStyleActive(style),
            isStructuredBlockSelected: (type) =>
                this.#isStructuredBlockSelected(type),
            replaceStructuredBlockContent: (type, content) =>
                this.#replaceStructuredBlockContent(type, content),
            removeSelectedStructuredBlock: (type) =>
                this.#removeSelectedStructuredBlock(type),
            removeFormat: () => this.#removeFormat(),
            setBlock: (tagName) => this.#setBlock(tagName),
            setAlignment: (alignment) => this.#setAlignment(alignment),
            setLink: (attributes) => this.#setLink(attributes),
            setListProperties: (properties) =>
                this.#setListProperties(properties),
            setSelection: (selection, focus) => {
                if (focus === true) this.focus();
                const restored = this.setSelection(selection);
                if (restored) {
                    this.#retainedSelection = freezeSelection(selection);
                }
                return restored;
            },
            setStructuredBlockAttributes: (type, attributes) =>
                this.#setStructuredBlockAttributes(type, attributes),
            toggleList: (list) => this.#toggleList(list),
            toggleMark: (mark) => this.#toggleMark(mark),
        };
        this.#service = Object.freeze(service);
        if (this.#registerEditingService) {
            this.editor.services.register(
                visualEditingServiceToken,
                this.#service,
            );
        }
        this.#disposeVisualDecorations = this.#visualDecorations?.subscribe(
            () => this.#render(this.#model, this.#retainedSelection),
        );

        this.#mutationObserver = new view.MutationObserver((records) => {
            if (
                !this.#destroyed &&
                records.some(
                    (record) => !this.#projection.ownsNodeViewMutation(record),
                )
            ) {
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
        this.element.addEventListener('dragstart', this.#handleDragStart);
        this.element.addEventListener('dragend', this.#handleDragEnd);
        this.element.addEventListener('dragover', this.#handleDragOver);
        this.element.addEventListener('drop', this.#handleDrop);
        this.element.addEventListener('focusin', this.#handleFocusIn);
        this.element.addEventListener('pointerdown', this.#handlePointerDown);
        this.#disposeDocumentChange = this.editor.events.on(
            'document:change',
            ({ current, transaction }) =>
                this.#handleDocumentChange(current.source, transaction),
        );
        this.#disposeEditorDestroy = this.editor.events.on(
            'editor:destroy',
            () => this.destroy(),
        );
        this.#disposeModeChange = this.editor.events.on('mode:change', () =>
            this.#updateEditableState(),
        );
        this.#disposeStateChange = this.editor.events.on(
            'state:change',
            ({ current, previous }) => {
                if (
                    current.readonly !== previous.readonly &&
                    this.#projectionActivity === undefined
                ) {
                    this.#updateEditableState();
                }
            },
        );
        const coordinator = this.editor.services.tryGet(
            projectionCoordinatorServiceToken,
        );
        this.#disposeProjection = coordinator?.attach({
            id: this.#projectionId,
            update: (activity) => {
                this.#projectionActivity = activity;
                this.#updateEditableState();
            },
        });
        if (coordinator === undefined) {
            this.#updateEditableState();
        }
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
        this.#programmaticFocus = true;
        try {
            this.element.focus();
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
        this.element.removeEventListener('dragstart', this.#handleDragStart);
        this.element.removeEventListener('dragend', this.#handleDragEnd);
        this.element.removeEventListener('dragover', this.#handleDragOver);
        this.element.removeEventListener('drop', this.#handleDrop);
        this.element.removeEventListener('focusin', this.#handleFocusIn);
        this.element.removeEventListener(
            'pointerdown',
            this.#handlePointerDown,
        );
        try {
            this.#projection.destroy();
        } catch (error: unknown) {
            errors.push(error);
        }
        try {
            this.#disposeProjection?.();
        } catch (error: unknown) {
            errors.push(error);
        }
        this.#disposeProjection = undefined;
        try {
            this.#disposeVisualDecorations?.();
        } catch (error: unknown) {
            errors.push(error);
        }
        this.#disposeVisualDecorations = undefined;
        this.#disposeDocumentChange();
        this.#disposeEditorDestroy();
        this.#disposeModeChange();
        this.#disposeStateChange();
        try {
            if (
                this.#registerEditingService &&
                this.editor.services.tryGet(visualEditingServiceToken) ===
                    this.#service
            ) {
                this.editor.services.unregister(visualEditingServiceToken);
            }
        } catch (error: unknown) {
            if (!(error instanceof EditorDestroyedError)) {
                errors.push(error);
            }
        }
        this.element.replaceChildren();
        this.element.hidden = this.#previousHidden;
        for (const [name, value] of this.#previousAttributes) {
            if (value === null) {
                this.element.removeAttribute(name);
            } else {
                this.element.setAttribute(name, value);
            }
        }
        if (errors.length > 0) {
            throw new AggregateError(
                errors,
                'Visual editing engine cleanup failed.',
            );
        }
    }

    readonly #handleBeforeInput = (event: InputEvent): void => {
        if (this.#destroyed) {
            return;
        }

        if (this.#projection.isInsideStructuredView(event.target)) {
            return;
        }

        event.preventDefault();
        if (this.#isReadonly() || this.#lockedDocument) {
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
                        if (event.inputType === 'insertCompositionText') {
                            this.#compositionGroup ??=
                                this.#nextCompositionGroup();
                            group = this.#compositionGroup;
                        } else {
                            group = 'typing';
                        }
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
                this.#compositionGroup = undefined;
            }
        }
    };

    readonly #handleCompositionStart = (event: CompositionEvent): void => {
        if (this.#projection.isInsideStructuredView(event.target)) {
            return;
        }
        this.#compositionSelection = this.#projection.readSelection();
        this.#compositionGroup = this.#nextCompositionGroup();
    };

    readonly #handleCompositionEnd = (event: CompositionEvent): void => {
        if (this.#projection.isInsideStructuredView(event.target)) {
            return;
        }
        this.#compositionSelection = undefined;
        this.#compositionGroup = undefined;
    };

    #nextCompositionGroup(): string {
        this.#compositionSequence += 1;
        return `composition-${String(this.#compositionSequence)}`;
    }

    readonly #handleFocusIn = (event: FocusEvent): void => {
        this.#projection.selectStructuredBlockFromNode(event.target);
        this.#activateFromUserIntent();
    };

    readonly #handlePointerDown = (event: PointerEvent): void => {
        this.#projection.selectStructuredBlockFromNode(event.target);
        this.#activateFromUserIntent();
    };

    #activateFromUserIntent(): void {
        if (
            this.#activateOnFocus &&
            !this.#programmaticFocus &&
            this.#projectionActivity?.visible === true &&
            this.#projectionActivity.primary === false
        ) {
            this.editor.execute('projection.activate', this.#projectionId);
        }
    }

    readonly #handleKeyDown = (event: KeyboardEvent): void => {
        const selection = this.#projection.readSelection();
        const selectedBlock =
            selection === undefined
                ? undefined
                : this.#model.blocks[selection.focus.block];
        if (
            event.key === 'Tab' &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey &&
            selectedBlock?.kind === 'paragraph' &&
            selectedBlock.list !== undefined
        ) {
            const command = event.shiftKey ? 'format.outdent' : 'format.indent';
            if (this.editor.commands.canExecute(command)) {
                event.preventDefault();
                this.editor.execute(command);
                return;
            }
        }
        if (
            selection !== undefined &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey &&
            (event.key === 'ArrowLeft' ||
                event.key === 'ArrowUp' ||
                event.key === 'ArrowRight' ||
                event.key === 'ArrowDown')
        ) {
            const direction =
                event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
            if (
                this.#projection.moveIntoStructuredBlock(selection, direction)
            ) {
                event.preventDefault();
                return;
            }
        }
        if (
            selection !== undefined &&
            isStructuredBlockSelected(this.#model, selection) &&
            this.#projection.isStructuredBoundary(event.target)
        ) {
            if (
                !event.ctrlKey &&
                !event.metaKey &&
                !event.altKey &&
                (event.key === 'ArrowLeft' || event.key === 'ArrowUp')
            ) {
                event.preventDefault();
                this.#projection.moveFromStructuredBlock(-1);
                return;
            }
            if (
                !event.ctrlKey &&
                !event.metaKey &&
                !event.altKey &&
                (event.key === 'ArrowRight' ||
                    event.key === 'ArrowDown' ||
                    event.key === 'Enter')
            ) {
                event.preventDefault();
                this.#projection.moveFromStructuredBlock(1);
                return;
            }
            if (
                !event.ctrlKey &&
                !event.metaKey &&
                !event.altKey &&
                (event.key === 'Backspace' || event.key === 'Delete')
            ) {
                event.preventDefault();
                if (!this.#isReadonly() && !this.#lockedDocument) {
                    try {
                        const result = deleteSelection(this.#model, selection);
                        this.#commit(result, {
                            afterSelection: result.selection,
                            beforeSelection: selection,
                        });
                    } catch (error: unknown) {
                        if (
                            !(error instanceof UnsupportedEditingSelectionError)
                        ) {
                            throw error;
                        }
                    }
                }
                return;
            }
        }

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
        if (this.#projection.isInsideStructuredView(event.target)) {
            return;
        }
        this.#writeClipboard(event);
    };

    readonly #handleCut = (event: ClipboardEvent): void => {
        if (this.#projection.isInsideStructuredView(event.target)) {
            return;
        }
        const selection = this.#writeClipboard(event);
        if (
            selection === undefined ||
            this.#isReadonly() ||
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
        if (this.#projection.isInsideStructuredView(event.target)) {
            return;
        }
        event.preventDefault();
        if (this.#isReadonly() || this.#lockedDocument) {
            return;
        }

        const clipboard = event.clipboardData;
        const selection = this.#projection.readSelection();
        if (clipboard === null || selection === undefined) {
            return;
        }

        try {
            const inserted = this.#createTransferModel(clipboard, 'paste');
            if (inserted === undefined) return;
            const result = insertModel(this.#model, selection, inserted);
            this.#commit(result, {
                afterSelection: result.selection,
                beforeSelection: selection,
            });
        } catch (error: unknown) {
            if (error instanceof UnsupportedEditingSelectionError) {
                announceEditingFeedback(
                    this.element,
                    'Paste cannot replace a selection that crosses preserved HTML.',
                );
            }
            if (
                !(error instanceof UnsupportedEditingSelectionError) &&
                !(error instanceof PasteRejectedError)
            ) {
                throw error;
            }
        }
    };

    readonly #handleDragStart = (event: DragEvent): void => {
        const transfer = event.dataTransfer;
        if (
            transfer === null ||
            this.#isReadonly() ||
            this.#lockedDocument ||
            !this.#projection.selectStructuredBlockFromNode(event.target, true)
        ) {
            event.preventDefault();
            return;
        }
        const selection = this.#projection.readSelection();
        if (
            selection === undefined ||
            !isStructuredBlockSelected(this.#model, selection)
        ) {
            event.preventDefault();
            return;
        }
        const draggedNode = this.#model.blocks[selection.anchor.block];
        if (
            draggedNode?.kind !== 'structured-block' ||
            draggedNode.behavior !== 'atomic'
        ) {
            event.preventDefault();
            return;
        }
        const payload = createClipboardPayload(
            this.#model,
            selection,
            this.#schema,
        );
        transfer.effectAllowed = 'move';
        transfer.setData('text/html', payload.html);
        transfer.setData('text/plain', payload.text);
        transfer.setData(
            SOEDITOR_CLIPBOARD_MIME,
            `soeditor/1\n${payload.html}`,
        );
        this.#draggedStructuredBlock = selection.anchor.block;
    };

    readonly #handleDragEnd = (): void => {
        this.#draggedStructuredBlock = undefined;
    };

    readonly #handleDragOver = (event: DragEvent): void => {
        if (
            !this.#isReadonly() &&
            !this.#lockedDocument &&
            this.#projection.readDropTarget(event.target, event.clientY) !==
                undefined
        ) {
            event.preventDefault();
            if (event.dataTransfer !== null) {
                event.dataTransfer.dropEffect =
                    this.#draggedStructuredBlock === undefined
                        ? 'copy'
                        : 'move';
            }
        }
    };

    readonly #handleDrop = (event: DragEvent): void => {
        const transfer = event.dataTransfer;
        const target = this.#projection.readDropTarget(
            event.target,
            event.clientY,
        );
        if (
            transfer === null ||
            target === undefined ||
            this.#isReadonly() ||
            this.#lockedDocument
        ) {
            return;
        }
        event.preventDefault();
        const dragged = this.#draggedStructuredBlock;
        this.#draggedStructuredBlock = undefined;
        if (dragged !== undefined) {
            const selection: EditingSelection = {
                anchor: { block: dragged, offset: 0 },
                focus: { block: dragged, offset: 1 },
            };
            const result = moveStructuredBlock(
                this.#model,
                selection,
                target.block,
                target.placement,
            );
            this.#commit(result, {
                afterSelection: result.selection,
                beforeSelection: selection,
            });
            return;
        }

        const targetBlock = this.#model.blocks[target.block];
        if (targetBlock?.kind !== 'paragraph') {
            return;
        }
        const offset =
            target.placement === 'before' ? 0 : paragraphLength(targetBlock);
        const selection: EditingSelection = {
            anchor: { block: target.block, offset },
            focus: { block: target.block, offset },
        };
        try {
            const inserted = this.#createTransferModel(transfer, 'drop');
            if (inserted === undefined) return;
            const result = insertModel(this.#model, selection, inserted);
            this.#commit(result, {
                afterSelection: result.selection,
                beforeSelection: selection,
            });
        } catch (error: unknown) {
            if (
                !(error instanceof UnsupportedEditingSelectionError) &&
                !(error instanceof PasteRejectedError)
            ) {
                throw error;
            }
        }
    };

    #commit(result: EditingResult, history: HistoryMetadata): void {
        const source = serializeHtmlFragment(
            serializeEditingModel(result.model, this.#schema),
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
                    setEditingOperations(transaction, result.operations);
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

    #canEdit(): boolean {
        return (
            !this.#destroyed &&
            !this.#isReadonly() &&
            !this.#lockedDocument &&
            this.#projection.readSelection() !== undefined
        );
    }

    #selection(): EditingSelection {
        this.#assertAlive();
        const selection = this.#projection.readSelection();
        if (
            selection === undefined ||
            this.#isReadonly() ||
            this.#lockedDocument
        ) {
            throw new UnsupportedEditingSelectionError(
                'A compatible editable selection is required.',
            );
        }
        return selection;
    }

    #applyFeature(
        transform: (selection: EditingSelection) => EditingResult,
    ): void {
        const selection = this.#selection();
        const result = transform(selection);
        this.#commit(result, {
            afterSelection: result.selection,
            beforeSelection: selection,
        });
    }

    #toggleMark(mark: VisualTextMark): void {
        this.#applyFeature((selection) =>
            toggleMark(this.#model, selection, mark),
        );
    }

    #isMarkActive(mark: VisualTextMark): boolean {
        const selection = this.#projection.readSelection();
        return selection === undefined
            ? false
            : isTextMarkActive(this.#model, selection, mark);
    }

    #applyInlineStyle(style: VisualInlineStyle): void {
        this.#applyFeature((selection) =>
            applyInlineStyle(this.#model, selection, {
                attributes: style.attributes,
                kind: 'element',
                tagName: style.tagName,
            }),
        );
    }

    #isInlineStyleActive(style: VisualInlineStyle): boolean {
        const selection = this.#projection.readSelection();
        return selection === undefined
            ? false
            : isInlineStyleActive(this.#model, selection, {
                  attributes: style.attributes,
                  kind: 'element',
                  tagName: style.tagName,
              });
    }

    #removeFormat(): void {
        this.#applyFeature((selection) => removeFormat(this.#model, selection));
    }

    #setBlock(tagName: VisualBlockTag): void {
        this.#applyFeature((selection) =>
            setBlockTag(this.#model, selection, tagName),
        );
    }

    #isBlockActive(tagName: VisualBlockTag): boolean {
        const selection = this.#projection.readSelection();
        return selection === undefined
            ? false
            : isBlockTagActive(this.#model, selection, tagName);
    }

    #applyBlockAttributes(attributes: readonly HtmlAttribute[]): void {
        this.#applyFeature((selection) =>
            applyBlockAttributes(this.#model, selection, attributes),
        );
    }

    #setAlignment(
        alignment: 'center' | 'justify' | 'left' | 'right' | undefined,
    ): void {
        this.#applyFeature((selection) =>
            setBlockAlignment(this.#model, selection, alignment),
        );
    }

    #isAlignmentActive(
        alignment: 'center' | 'justify' | 'left' | 'right' | undefined,
    ): boolean {
        const selection = this.#projection.readSelection();
        return selection === undefined
            ? false
            : isBlockAlignmentActive(this.#model, selection, alignment);
    }

    #adjustIndent(delta: -1 | 1): void {
        this.#applyFeature((selection) =>
            adjustBlockIndent(this.#model, selection, delta),
        );
    }

    #areBlockAttributesActive(attributes: readonly HtmlAttribute[]): boolean {
        const selection = this.#projection.readSelection();
        return selection === undefined
            ? false
            : areBlockAttributesActive(this.#model, selection, attributes);
    }

    #toggleList(list: 'ol' | 'ul'): void {
        this.#applyFeature((selection) =>
            toggleList(this.#model, selection, list),
        );
    }

    #isListActive(list: 'ol' | 'ul'): boolean {
        const selection = this.#projection.readSelection();
        return selection === undefined
            ? false
            : isListActive(this.#model, selection, list);
    }

    #setListProperties(properties: VisualListProperties): void {
        const attributes: HtmlAttribute[] = [];
        if (properties.start !== undefined) {
            if (
                !Number.isInteger(properties.start) ||
                properties.start < -999_999 ||
                properties.start > 999_999
            ) {
                throw new RangeError('List start must be a bounded integer.');
            }
            attributes.push({ name: 'start', value: String(properties.start) });
        }
        if (properties.type !== undefined) {
            attributes.push({ name: 'type', value: properties.type });
        }
        this.#applyFeature((selection) =>
            setListAttributes(this.#model, selection, attributes),
        );
    }

    #setLink(attributes: VisualLinkAttributes | undefined): void {
        const htmlAttributes =
            attributes === undefined
                ? undefined
                : Object.freeze(
                      Object.entries(attributes).flatMap(([name, value]) =>
                          value === undefined
                              ? []
                              : [Object.freeze({ name, value })],
                      ),
                  );
        this.#applyFeature((selection) =>
            setLink(this.#model, selection, htmlAttributes),
        );
    }

    #isLinkActive(): boolean {
        const selection = this.#projection.readSelection();
        return selection === undefined
            ? false
            : isLinkActive(this.#model, selection);
    }

    #getLinkAttributes(): VisualLinkAttributes | undefined {
        const selection = this.#projection.readSelection();
        if (selection === undefined) return undefined;
        const attributes = getLinkAttributes(this.#model, selection);
        if (attributes === undefined) return undefined;
        const values = Object.fromEntries(
            attributes
                .filter((attribute) =>
                    ['href', 'rel', 'target', 'title'].includes(attribute.name),
                )
                .map((attribute) => [attribute.name, attribute.value]),
        );
        const href = values.href;
        return typeof href === 'string'
            ? Object.freeze({
                  href,
                  ...(typeof values.rel === 'string'
                      ? { rel: values.rel }
                      : {}),
                  ...(typeof values.target === 'string'
                      ? { target: values.target }
                      : {}),
                  ...(typeof values.title === 'string'
                      ? { title: values.title }
                      : {}),
              })
            : undefined;
    }

    #setStructuredBlockAttributes(
        type: string,
        attributes: readonly HtmlAttribute[],
    ): void {
        this.#applyFeature((selection) =>
            setStructuredBlockAttributes(
                this.#model,
                selection,
                type,
                attributes,
            ),
        );
    }

    #replaceStructuredBlockContent(
        type: string,
        content: EditingStructuredBlockContent,
    ): void {
        this.#applyFeature((selection) =>
            replaceStructuredBlockContent(
                this.#model,
                selection,
                type,
                content,
            ),
        );
    }

    #removeSelectedStructuredBlock(type: string): void {
        this.#applyFeature((selection) => {
            if (!isStructuredBlockSelected(this.#model, selection, type)) {
                throw new Error(
                    `A structured block of type "${type}" is not selected.`,
                );
            }
            return deleteSelection(this.#model, selection);
        });
    }

    #getSelectedStructuredBlock(
        type?: string,
    ): EditingStructuredBlock | undefined {
        const selection = this.#projection.readSelection();
        return selection === undefined
            ? undefined
            : getSelectedStructuredBlock(this.#model, selection, type);
    }

    #isStructuredBlockSelected(type?: string): boolean {
        const selection = this.#projection.readSelection();
        return selection === undefined
            ? false
            : isStructuredBlockSelected(this.#model, selection, type);
    }

    #insertHtml(html: string, options?: VisualHtmlInsertionOptions): void {
        this.#applyFeature((selection) =>
            insertModel(
                this.#model,
                options?.placement === 'selection-start'
                    ? collapseAtSelectionStart(selection)
                    : selection,
                createPastedModel(html, '', this.#schema),
            ),
        );
    }

    #insertParagraphAfterOpaque(block: number): void {
        this.#assertAlive();
        if (this.#isReadonly() || this.#lockedDocument) return;
        if (this.#model.blocks[block]?.kind !== 'opaque-block') {
            throw new UnsupportedEditingSelectionError(
                'An unsupported block is required before inserting a continuation paragraph.',
            );
        }
        const blocks = [...this.#model.blocks];
        blocks.splice(block + 1, 0, {
            attributes: [],
            inlines: [],
            kind: 'paragraph',
            tagName: 'p',
        });
        const point = { block: block + 1, offset: 0 };
        const selection = { anchor: point, focus: point };
        this.#commit(
            {
                model: freezeModel({ blocks }),
                operations: [
                    {
                        from: { block, offset: 1 },
                        insertedEnd: point,
                        kind: 'replace-range',
                        to: { block, offset: 1 },
                    },
                ],
                selection,
            },
            { afterSelection: selection },
        );
        this.focus();
        this.#projection.restoreSelection(selection);
    }

    #handleDocumentChange(source: string, transaction: Transaction): void {
        const pending = this.#pending;
        if (pending !== undefined && pending.source === source) {
            this.#pending = undefined;
            this.#model = pending.model;
            this.#render(pending.model, pending.selection);
            return;
        }

        let next: ReturnType<typeof createVisualModel>;
        try {
            next = createVisualModel(
                source,
                this.#schema,
                this.#lastValidModel,
            );
        } catch (error: unknown) {
            this.#lockedDocument = true;
            this.#updateEditableState();
            this.#render(this.#model, readReplaySelection(transaction));
            throw error;
        }
        this.#model = next.model;
        this.#lockedDocument = next.locked;
        if (next.valid) {
            this.#lastValidModel = next.model;
        }
        this.#updateEditableState();
        this.#render(this.#model, readReplaySelection(transaction));
    }

    #render(model: EditingModel, selection?: EditingSelection): void {
        this.#retainedSelection =
            selection === undefined ? undefined : freezeSelection(selection);
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

    #createTransferModel(
        transfer: DataTransfer,
        source: PastePipelineInput['source'],
    ): EditingModel | undefined {
        const custom = transfer.getData(SOEDITOR_CLIPBOARD_MIME);
        const prefix = 'soeditor/1\n';
        const input: PastePipelineInput = Object.freeze({
            files: Object.freeze(
                Array.from(transfer.files, (file) =>
                    Object.freeze({
                        data: file,
                        name: file.name,
                        size: file.size,
                        type: file.type,
                    }),
                ),
            ),
            html: transfer.getData('text/html'),
            ...(custom.startsWith(prefix)
                ? { internalHtml: custom.slice(prefix.length) }
                : {}),
            source,
            text: transfer.getData('text/plain'),
            types: Object.freeze(Array.from(transfer.types)),
        });
        const pipeline = this.editor.services.tryGet(pastePipelineServiceToken);
        const result = pipeline?.process(input);
        if (result?.consumed === true) return undefined;
        return createPastedModel(
            result?.html ?? input.internalHtml ?? input.html,
            result?.policy === 'plain-text'
                ? result.text
                : (result?.text ?? input.text),
            this.#schema,
            result?.policy === 'plain-text',
        );
    }

    #writeClipboard(event: ClipboardEvent): EditingSelection | undefined {
        const clipboard = event.clipboardData;
        const selection = this.#projection.readSelection();
        if (clipboard === null || selection === undefined) {
            return undefined;
        }

        try {
            const payload = createClipboardPayload(
                this.#model,
                selection,
                this.#schema,
            );
            clipboard.setData('text/plain', payload.text);
            clipboard.setData('text/html', payload.html);
            clipboard.setData(
                SOEDITOR_CLIPBOARD_MIME,
                `soeditor/1\n${payload.html}`,
            );
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
            !this.#isReadonly() &&
            this.editor.commands.has(command) &&
            this.editor.commands.canExecute(command)
        ) {
            this.editor.execute(command);
        }
    }

    #updateEditableState(): void {
        const visible =
            this.#projectionActivity?.visible ??
            this.editor.state.mode === this.#projectionId;
        const readonly = this.#isReadonly() || this.#lockedDocument || !visible;
        this.element.hidden = !visible;
        this.element.contentEditable = readonly ? 'false' : 'true';
        this.element.setAttribute('aria-readonly', String(readonly));
        this.#projection.setReadonly(readonly);
    }

    #isReadonly(): boolean {
        return (
            this.#projectionActivity?.readonly ??
            (this.editor.state.readonly ||
                this.editor.state.mode !== this.#projectionId)
        );
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

function collapseAtSelectionStart(
    selection: EditingSelection,
): EditingSelection {
    const start = pointComesBefore(selection.anchor, selection.focus)
        ? selection.anchor
        : selection.focus;
    return Object.freeze({ anchor: start, focus: start });
}

function pointComesBefore(left: EditingPoint, right: EditingPoint): boolean {
    return (
        left.block < right.block ||
        (left.block === right.block && left.offset <= right.offset)
    );
}

function ensureEditableModel(model: EditingModel): EditingModel {
    return model.blocks.length === 0
        ? freezeModel({
              blocks: [
                  {
                      attributes: [],
                      inlines: [],
                      kind: 'paragraph',
                      tagName: 'p',
                  },
              ],
          })
        : model;
}

function createVisualModel(
    source: string,
    schema: StructuredEditingSchema,
    fallback?: EditingModel,
): {
    readonly locked: boolean;
    readonly model: EditingModel;
    readonly valid: boolean;
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
            valid: false,
        });
    }

    const parsed = parseHtmlFragment(source);
    if (
        parsed.diagnostics.some((diagnostic) => diagnostic.severity === 'error')
    ) {
        return Object.freeze({
            locked: true,
            model:
                fallback ??
                freezeModel({
                    blocks: [
                        {
                            kind: 'opaque-block',
                            node: Object.freeze({
                                type: 'comment',
                                value: 'Invalid HTML preserved in source',
                            }),
                        },
                    ],
                }),
            valid: false,
        });
    }

    return Object.freeze({
        locked: false,
        model: ensureEditableModel(createEditingModel(parsed.document, schema)),
        valid: true,
    });
}
