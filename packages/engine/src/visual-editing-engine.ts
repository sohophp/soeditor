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
    type EditingModel,
    type EditingSelection,
    type EditingStructuredBlock,
    type EditingStructuredBlockContent,
} from './model.js';
import {
    deleteBackward,
    deleteForward,
    deleteSelection,
    insertModel,
    insertParagraph,
    insertText,
    isBlockTagActive,
    isLinkActive,
    isListActive,
    isTextMarkActive,
    isStructuredBlockSelected,
    moveStructuredBlock,
    getSelectedStructuredBlock,
    replaceStructuredBlockContent,
    setBlockTag,
    setEditingOperations,
    setLink,
    setStructuredBlockAttributes,
    toggleMark,
    toggleList,
    type EditingResult,
    UnsupportedEditingSelectionError,
    validateSelection,
} from './operations.js';
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
    type VisualLinkAttributes,
    type VisualTextMark,
} from './visual-editing-service.js';

export interface VisualEditingEngineOptions {
    readonly activateOnFocus?: boolean;
    readonly editor: Editor;
    readonly element: HTMLElement;
    readonly ariaLabel?: string;
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

/** Reports attachment of the HTML visual engine to another document format. */
export class UnsupportedVisualDocumentFormatError extends Error {
    constructor(format: string) {
        super(
            `The visual editing engine does not support "${format}" documents.`,
        );
        this.name = 'UnsupportedVisualDocumentFormatError';
    }
}

export class VisualEditingEngine implements EditingEngine {
    readonly editor: Editor;
    readonly element: HTMLElement;
    readonly #disposeDocumentChange: () => void;
    readonly #disposeEditorDestroy: () => void;
    readonly #disposeModeChange: () => void;
    readonly #mutationObserver: MutationObserver;
    readonly #previousAttributes: ReadonlyMap<string, string | null>;
    readonly #previousHidden: boolean;
    readonly #projection: DomProjection;
    readonly #service: VisualEditingService;
    readonly #schema: StructuredEditingSchema;
    readonly #activateOnFocus: boolean;
    #compositionSelection: EditingSelection | undefined;
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
    #programmaticFocus = false;
    #projectionActivity: ProjectionActivity | undefined;

    constructor(options: VisualEditingEngineOptions) {
        this.editor = options.editor;
        this.element = options.element;
        this.#activateOnFocus = options.activateOnFocus ?? false;
        if (this.editor.state.document.format !== 'html') {
            throw new UnsupportedVisualDocumentFormatError(
                this.editor.state.document.format,
            );
        }
        const ariaLabel = options.ariaLabel ?? 'Visual editor';
        if (typeof ariaLabel !== 'string' || ariaLabel.trim().length === 0) {
            throw new TypeError('A visual editor ariaLabel must not be empty.');
        }
        const view = this.element.ownerDocument.defaultView;
        if (view === null) {
            throw new Error(
                'The visual editing host is not attached to a window.',
            );
        }
        if (this.editor.services.has(visualEditingServiceToken)) {
            throw new ServiceAlreadyRegisteredError(
                visualEditingServiceToken.id,
            );
        }
        const structuredRegistry = this.editor.services.tryGet(
            structuredEditingRegistryToken,
        );
        this.#schema = snapshotStructuredEditingRegistry(structuredRegistry);
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
            executeCommand: (commandId, args) =>
                this.editor.execute(commandId, ...args),
            readonly: this.#isReadonly() || this.#lockedDocument,
            schema: this.#schema,
        });
        this.#projection.render(this.#model);
        const service: VisualEditingService = {
            canEdit: () => this.#canEdit(),
            getSelectedStructuredBlock: (type) =>
                this.#getSelectedStructuredBlock(type),
            insertHtml: (html) => this.#insertHtml(html),
            isBlockActive: (tagName) => this.#isBlockActive(tagName),
            isLinkActive: () => this.#isLinkActive(),
            isListActive: (list) => this.#isListActive(list),
            isMarkActive: (mark) => this.#isMarkActive(mark),
            isStructuredBlockSelected: (type) =>
                this.#isStructuredBlockSelected(type),
            replaceStructuredBlockContent: (type, content) =>
                this.#replaceStructuredBlockContent(type, content),
            setBlock: (tagName) => this.#setBlock(tagName),
            setLink: (attributes) => this.#setLink(attributes),
            setStructuredBlockAttributes: (type, attributes) =>
                this.#setStructuredBlockAttributes(type, attributes),
            toggleList: (list) => this.#toggleList(list),
            toggleMark: (mark) => this.#toggleMark(mark),
        };
        this.#service = Object.freeze(service);
        this.editor.services.register(visualEditingServiceToken, this.#service);

        this.#mutationObserver = new view.MutationObserver((records) => {
            if (
                !this.#destroyed &&
                records.some(
                    (record) =>
                        !this.#projection.ownsNodeViewMutation(record.target),
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
        const coordinator = this.editor.services.tryGet(
            projectionCoordinatorServiceToken,
        );
        this.#disposeProjection = coordinator?.attach({
            id: 'visual',
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
        this.#disposeDocumentChange();
        this.#disposeEditorDestroy();
        this.#disposeModeChange();
        try {
            if (
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

    readonly #handleCompositionStart = (event: CompositionEvent): void => {
        if (this.#projection.isInsideStructuredView(event.target)) {
            return;
        }
        this.#compositionSelection = this.#projection.readSelection();
    };

    readonly #handleCompositionEnd = (event: CompositionEvent): void => {
        if (this.#projection.isInsideStructuredView(event.target)) {
            return;
        }
        this.#compositionSelection = undefined;
    };

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
            this.editor.execute('projection.activate', 'visual');
        }
    }

    readonly #handleKeyDown = (event: KeyboardEvent): void => {
        const selection = this.#projection.readSelection();
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
            const inserted = createPastedModel(
                clipboard.getData('text/html'),
                clipboard.getData('text/plain'),
                this.#schema,
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
            const result = insertModel(
                this.#model,
                selection,
                createPastedModel(
                    transfer.getData('text/html'),
                    transfer.getData('text/plain'),
                    this.#schema,
                ),
            );
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

    #insertHtml(html: string): void {
        this.#applyFeature((selection) =>
            insertModel(
                this.#model,
                selection,
                createPastedModel(html, '', this.#schema),
            ),
        );
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
            const payload = createClipboardPayload(
                this.#model,
                selection,
                this.#schema,
            );
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
            !this.#isReadonly() &&
            this.editor.commands.has(command) &&
            this.editor.commands.canExecute(command)
        ) {
            this.editor.execute(command);
        }
    }

    #updateEditableState(): void {
        const visual =
            this.#projectionActivity?.visible ??
            this.editor.state.mode === 'visual';
        const readonly = this.#isReadonly() || this.#lockedDocument || !visual;
        this.element.hidden = !visual;
        this.element.contentEditable = readonly ? 'false' : 'true';
        this.element.setAttribute('aria-readonly', String(readonly));
        this.#projection.setReadonly(readonly);
    }

    #isReadonly(): boolean {
        return (
            this.#projectionActivity?.readonly ??
            (this.editor.state.readonly || this.editor.state.mode !== 'visual')
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
