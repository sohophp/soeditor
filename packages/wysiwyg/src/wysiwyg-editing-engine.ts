import {
    EditorDestroyedError,
    ServiceAlreadyRegisteredError,
    type Editor,
} from '@soeditor/core';
import {
    SOEDITOR_CLIPBOARD_MIME,
    groupHistoryTransaction,
    pastePipelineServiceToken,
    visualEditingServiceToken,
    type EditingEngine,
    type EditingPoint,
    type EditingSelection,
    type EditingStructuredBlock,
    type EditingStructuredBlockContent,
    type VisualBlockTag,
    type VisualEditingService,
    type VisualHtmlInsertionOptions,
    type VisualInlineStyle,
    type VisualInlineStyleProperty,
    type VisualLinkAttributes,
    type VisualListProperties,
    type VisualTextMark,
} from '@soeditor/engine';
import {
    parseHtmlFragment,
    serializeHtmlFragment,
    type HtmlAttribute,
    type HtmlChildNode,
} from '@soeditor/html';
import {
    projectionCoordinatorServiceToken,
    type ProjectionActivity,
} from '@soeditor/projections';

export interface WysiwygEditingEngineOptions {
    readonly activateOnFocus?: boolean;
    readonly ariaLabel?: string;
    readonly editor: Editor;
    readonly element: HTMLElement;
}

export type WysiwygContentStylePreset =
    'browser' | 'minimal' | 'article' | 'email' | 'custom';

export function setWysiwygContentStylePreset(
    element: HTMLElement,
    preset: WysiwygContentStylePreset,
): void {
    if (
        !['browser', 'minimal', 'article', 'email', 'custom'].includes(preset)
    ) {
        throw new TypeError(
            `Unknown WYSIWYG content style preset "${preset}".`,
        );
    }
    element.dataset.soeditorContentStyle = preset;
}

export class WysiwygEditingEngineDestroyedError extends Error {
    constructor() {
        super('The WYSIWYG editing engine has been destroyed.');
        this.name = 'WysiwygEditingEngineDestroyedError';
    }
}

interface SelectionBookmark {
    readonly start: readonly number[];
    readonly startOffset: number;
    readonly end: readonly number[];
    readonly endOffset: number;
}

interface TableCellRange {
    readonly anchor: { readonly column: number; readonly row: number };
    readonly focus: { readonly column: number; readonly row: number };
    readonly kind?: 'cells' | 'columns' | 'rows' | 'table';
}

interface NativeTableSelection {
    readonly range: TableCellRange;
    readonly table: HTMLTableElement;
}

interface PreservedAttribute {
    readonly name: string;
    readonly value: string;
}

const blockSelector =
    'address,article,aside,blockquote,div,figcaption,figure,footer,h1,h2,h3,h4,h5,h6,header,li,main,nav,p,pre,section,td,th';
const formatBlockSelector = 'address,blockquote,div,h1,h2,h3,h4,h5,h6,p,pre';

const standardTags = new Set([
    'a',
    'abbr',
    'address',
    'article',
    'aside',
    'b',
    'bdi',
    'bdo',
    'blockquote',
    'br',
    'caption',
    'cite',
    'code',
    'col',
    'colgroup',
    'data',
    'dd',
    'del',
    'details',
    'dfn',
    'div',
    'dl',
    'dt',
    'em',
    'figcaption',
    'figure',
    'footer',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'header',
    'hr',
    'i',
    'img',
    'ins',
    'kbd',
    'li',
    'main',
    'mark',
    'nav',
    'ol',
    'p',
    'picture',
    'pre',
    'q',
    'rp',
    'rt',
    'ruby',
    's',
    'samp',
    'section',
    'small',
    'source',
    'span',
    'strong',
    'sub',
    'summary',
    'sup',
    'table',
    'tbody',
    'td',
    'tfoot',
    'th',
    'thead',
    'time',
    'tr',
    'u',
    'ul',
    'var',
    'video',
    'wbr',
]);

const preservedTags = new Set([
    'base',
    'embed',
    'iframe',
    'link',
    'meta',
    'noscript',
    'object',
    'script',
    'style',
    'template',
]);

const voidTags = new Set([
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'link',
    'meta',
    'param',
    'source',
    'track',
    'wbr',
]);

/** Native HTML authoring surface, independent from Developer Visual. */
export class WysiwygEditingEngine implements EditingEngine {
    readonly editor: Editor;
    readonly element: HTMLElement;
    readonly #activateOnFocus: boolean;
    readonly #document: Document;
    readonly #previousAttributes: ReadonlyMap<string, string | null>;
    readonly #previousHidden: boolean;
    readonly #service: VisualEditingService;
    readonly #disposeDocumentChange: () => void;
    readonly #disposeEditorDestroy: () => void;
    readonly #disposeModeChange: () => void;
    readonly #disposeStateChange: () => void;
    readonly #mutationObserver: MutationObserver | undefined;
    readonly #unsafeAttributes = new WeakMap<
        Element,
        readonly PreservedAttribute[]
    >();
    readonly #tableProjectionAttributes = new WeakMap<
        Element,
        Readonly<{ className: string | null; style: string | null }>
    >();
    readonly #preservedNodes = new Map<string, HtmlChildNode>();
    #activeCell: HTMLTableCellElement | undefined;
    #compositionGroup: string | undefined;
    #compositionSequence = 0;
    #destroyed = false;
    #inputGroup: string | undefined;
    #inputGroupKind: string | undefined;
    #inputSequence = 0;
    #locked = false;
    #pendingInputGroup: string | undefined;
    #pendingMark: VisualTextMark | undefined;
    #pendingSource: string | undefined;
    #preservedSequence = 0;
    #programmaticFocus = false;
    #projectionActivity: ProjectionActivity | undefined;
    #disposeProjection: (() => void) | undefined;
    #reportedSelection: EditingSelection | undefined;
    #savedRange: Range | undefined;
    readonly #selectionTarget: EventTarget;
    #selectedElement: Element | undefined;
    #tableSelection: NativeTableSelection | undefined;
    #tableDragAnchor: HTMLTableCellElement | undefined;
    #tableDragMoved = false;

    constructor(options: WysiwygEditingEngineOptions) {
        this.editor = options.editor;
        this.element = options.element;
        this.#document = options.element.ownerDocument;
        const selectionRoot = options.element.getRootNode();
        this.#selectionTarget =
            selectionRoot === this.#document ? this.#document : selectionRoot;
        this.#activateOnFocus = options.activateOnFocus ?? false;
        if (this.editor.state.document.format !== 'html') {
            throw new TypeError('WYSIWYG requires an HTML document.');
        }
        if (this.editor.services.has(visualEditingServiceToken)) {
            throw new ServiceAlreadyRegisteredError(
                visualEditingServiceToken.id,
            );
        }
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
        this.element.setAttribute(
            'aria-label',
            options.ariaLabel?.trim() || 'WYSIWYG editor',
        );
        this.element.setAttribute('aria-multiline', 'true');
        this.#render(this.editor.getData());

        const service: VisualEditingService = {
            adjustIndent: (delta) => this.#adjustIndent(delta),
            applyBlockAttributes: (attributes) =>
                this.#applyBlockAttributes(attributes),
            applyInlineStyle: (style) => this.#applyInlineStyle(style),
            areBlockAttributesActive: (attributes) =>
                this.#areBlockAttributesActive(attributes),
            canEdit: () => this.#canEdit(),
            getLinkAttributes: () => this.#getLinkAttributes(),
            getSelectedStructuredBlock: (type) =>
                this.#getSelectedStructuredBlock(type),
            getSelection: () => this.#getSelection(),
            getStructuredSelection: (type) =>
                type === 'soeditor.table'
                    ? this.#readTableCellRange()
                    : undefined,
            setStructuredSelection: (type, selection) =>
                this.#setStructuredSelection(type, selection),
            insertHtml: (html, insertionOptions) =>
                this.#insertHtml(html, insertionOptions),
            isAlignmentActive: (alignment) =>
                this.#isAlignmentActive(alignment),
            isBlockActive: (tagName) => this.#isBlockActive(tagName),
            isInlineStyleActive: (style) => this.#isInlineStyleActive(style),
            isLinkActive: () => this.#closestFromSelection('a') !== undefined,
            isListActive: (list) => this.#isListActive(list),
            isMarkActive: (mark) => this.#isMarkActive(mark),
            isStructuredBlockSelected: (type) =>
                this.#structuredElement(type) !== undefined,
            removeFormat: () => this.#removeFormat(),
            removeInlineStyleProperty: (property) =>
                this.#removeInlineStyleProperty(property),
            removeSelectedStructuredBlock: (type) =>
                this.#removeStructuredBlock(type),
            replaceStructuredBlockContent: (type, content) =>
                this.#replaceStructuredBlockContent(type, content),
            setAlignment: (alignment) => this.#setAlignment(alignment),
            setBlock: (tagName) => this.#setBlock(tagName),
            setLink: (attributes) => this.#setLink(attributes),
            setListProperties: (properties) =>
                this.#setListProperties(properties),
            setSelection: (selection, focus) =>
                this.setSelection(selection, focus),
            setStructuredBlockAttributes: (type, attributes) =>
                this.#setStructuredBlockAttributes(type, attributes),
            toggleList: (list) => this.#toggleList(list),
            toggleMark: (mark) => this.#toggleMark(mark),
        };
        this.#service = Object.freeze(service);
        this.editor.services.register(visualEditingServiceToken, this.#service);

        this.element.addEventListener('beforeinput', this.#handleBeforeInput);
        this.element.addEventListener('input', this.#handleInput);
        this.element.addEventListener(
            'compositionstart',
            this.#handleCompositionStart,
        );
        this.element.addEventListener(
            'compositionend',
            this.#handleCompositionEnd,
        );
        this.element.addEventListener('keydown', this.#handleKeyDown);
        this.element.addEventListener('paste', this.#handlePaste);
        this.element.addEventListener('drop', this.#handleDrop);
        this.element.addEventListener('focusin', this.#handleFocusIn);
        this.element.addEventListener('pointerdown', this.#handlePointerDown);
        this.element.addEventListener('pointerover', this.#handlePointerOver);
        this.element.addEventListener('pointerup', this.#handlePointerUp);
        this.element.addEventListener('dblclick', this.#handleDoubleClick);
        this.#document.addEventListener(
            'selectionchange',
            this.#handleSelectionChange,
        );
        if (this.#selectionTarget !== this.#document) {
            this.#selectionTarget.addEventListener(
                'selectionchange',
                this.#handleSelectionChange,
            );
        }
        const MutationObserverConstructor =
            this.#document.defaultView?.MutationObserver;
        this.#mutationObserver =
            MutationObserverConstructor === undefined
                ? undefined
                : new MutationObserverConstructor((records) => {
                      if (
                          records.some(
                              ({ target }) =>
                                  target === this.element ||
                                  this.element.contains(target),
                          )
                      ) {
                          this.#repairExternalMutation();
                      }
                  });
        this.#mutationObserver?.observe(this.element, {
            attributes: true,
            characterData: true,
            childList: true,
            subtree: true,
        });
        this.#disposeDocumentChange = this.editor.events.on(
            'document:change',
            ({ current }) => this.#handleDocumentChange(current.source),
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
                if (current.readonly !== previous.readonly) {
                    this.#updateEditableState();
                }
            },
        );
        this.#disposeProjection = this.editor.services
            .tryGet(projectionCoordinatorServiceToken)
            ?.attach({
                id: 'wysiwyg',
                update: (activity) => {
                    this.#projectionActivity = activity;
                    this.#updateEditableState();
                },
            });
        this.#updateEditableState();
    }

    focus(): void {
        this.#assertAlive();
        this.#programmaticFocus = true;
        try {
            this.element.focus();
            this.#restoreRange();
        } finally {
            this.#programmaticFocus = false;
        }
    }

    setSelection(selection: EditingSelection, focus = true): boolean {
        this.#assertAlive();
        if (
            this.#reportedSelection !== undefined &&
            sameEditingSelection(this.#reportedSelection, selection) &&
            this.#savedRange?.startContainer.isConnected === true
        ) {
            if (focus) this.element.focus({ preventScroll: true });
            return this.#restoreRange();
        }
        const blocks = this.#blocks();
        const anchorBlock = blocks[selection.anchor.block];
        const focusBlock = blocks[selection.focus.block];
        if (anchorBlock === undefined || focusBlock === undefined) return false;
        const anchor = resolveTextPoint(anchorBlock, selection.anchor.offset);
        const target = resolveTextPoint(focusBlock, selection.focus.offset);
        if (anchor === undefined || target === undefined) return false;
        const native = selectionFor(this.element, this.#document);
        if (native === null) return false;
        if (focus) this.element.focus({ preventScroll: true });
        native.setBaseAndExtent(
            anchor.node,
            anchor.offset,
            target.node,
            target.offset,
        );
        this.#captureRange();
        return true;
    }

    destroy(): void {
        if (this.#destroyed) return;
        this.#destroyed = true;
        this.element.removeEventListener(
            'beforeinput',
            this.#handleBeforeInput,
        );
        this.element.removeEventListener('input', this.#handleInput);
        this.element.removeEventListener(
            'compositionstart',
            this.#handleCompositionStart,
        );
        this.element.removeEventListener(
            'compositionend',
            this.#handleCompositionEnd,
        );
        this.element.removeEventListener('keydown', this.#handleKeyDown);
        this.element.removeEventListener('paste', this.#handlePaste);
        this.element.removeEventListener('drop', this.#handleDrop);
        this.element.removeEventListener('focusin', this.#handleFocusIn);
        this.element.removeEventListener(
            'pointerdown',
            this.#handlePointerDown,
        );
        this.element.removeEventListener(
            'pointerover',
            this.#handlePointerOver,
        );
        this.element.removeEventListener('pointerup', this.#handlePointerUp);
        this.element.removeEventListener('dblclick', this.#handleDoubleClick);
        this.#document.removeEventListener(
            'selectionchange',
            this.#handleSelectionChange,
        );
        if (this.#selectionTarget !== this.#document) {
            this.#selectionTarget.removeEventListener(
                'selectionchange',
                this.#handleSelectionChange,
            );
        }
        this.#mutationObserver?.disconnect();
        this.#disposeProjection?.();
        this.#disposeProjection = undefined;
        this.#disposeDocumentChange();
        this.#disposeEditorDestroy();
        this.#disposeModeChange();
        this.#disposeStateChange();
        try {
            if (
                this.editor.services.tryGet(visualEditingServiceToken) ===
                this.#service
            ) {
                this.editor.services.unregister(visualEditingServiceToken);
            }
        } catch (error: unknown) {
            if (!(error instanceof EditorDestroyedError)) throw error;
        }
        this.element.replaceChildren();
        this.element.hidden = this.#previousHidden;
        for (const [name, value] of this.#previousAttributes) {
            if (value === null) this.element.removeAttribute(name);
            else this.element.setAttribute(name, value);
        }
    }

    readonly #handleBeforeInput = (event: InputEvent): void => {
        if (event.inputType === 'historyUndo') {
            event.preventDefault();
            this.#executeHistory('editor.undo');
            return;
        }
        if (event.inputType === 'historyRedo') {
            event.preventDefault();
            this.#executeHistory('editor.redo');
            return;
        }
        if (
            (event.inputType === 'deleteContentBackward' ||
                event.inputType === 'deleteContentForward') &&
            this.#mergeParagraphBoundary(
                event.inputType === 'deleteContentBackward',
            )
        ) {
            event.preventDefault();
            this.#resetInputHistory();
            return;
        }
        this.#prepareInputHistory(event);
        if (
            this.#pendingMark !== undefined &&
            event.inputType === 'insertText' &&
            event.data !== null
        ) {
            const range = this.#range();
            if (range === undefined || !range.collapsed) return;
            event.preventDefault();
            const wrapper = this.#document.createElement(this.#pendingMark);
            const text = this.#document.createTextNode(event.data);
            wrapper.append(text);
            range.insertNode(wrapper);
            range.setStart(text, text.data.length);
            range.collapse(true);
            this.#selectRange(range);
            this.#pendingMark = undefined;
            const historyGroup = this.#pendingInputGroup;
            this.#pendingInputGroup = undefined;
            this.#commit(historyGroup);
        }
    };

    readonly #handleInput = (event: Event): void => {
        const isComposing =
            'isComposing' in event && event.isComposing === true;
        const historyGroup =
            isComposing || this.#compositionGroup !== undefined
                ? this.#compositionGroup
                : this.#pendingInputGroup;
        this.#pendingInputGroup = undefined;
        this.#captureRange();
        this.#commit(historyGroup);
    };

    readonly #handleCompositionStart = (): void => {
        this.#resetInputHistory();
        this.#compositionGroup = this.#nextCompositionGroup();
    };

    readonly #handleCompositionEnd = (): void => {
        const completedGroup = this.#compositionGroup;
        this.#captureRange();
        this.#commit(completedGroup);
        queueMicrotask(() => {
            if (this.#compositionGroup === completedGroup) {
                this.#compositionGroup = undefined;
            }
        });
    };

    #nextCompositionGroup(): string {
        this.#compositionSequence += 1;
        return `wysiwyg-composition-${String(this.#compositionSequence)}`;
    }

    readonly #handleKeyDown = (event: KeyboardEvent): void => {
        if (
            event.key.length !== 1 ||
            event.ctrlKey ||
            event.metaKey ||
            event.altKey
        ) {
            this.#resetInputHistory();
        }
        if (event.key === 'Escape' && this.#tableSelection !== undefined) {
            const { focus } = this.#tableSelection.range;
            const cell = tableCellAt(
                this.#tableSelection.table,
                focus.row,
                focus.column,
            );
            if (cell !== undefined) {
                this.#tableSelection = {
                    range: { anchor: focus, focus },
                    table: this.#tableSelection.table,
                };
                this.#paintTableSelection();
                this.#announceTableSelection(cell);
            }
        }
        if (event.key === 'Tab' && this.#moveTableCaret(event.shiftKey)) {
            event.preventDefault();
            return;
        }
        if (
            event.key === 'Tab' &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey &&
            this.#selectedBlock()?.tagName === 'LI'
        ) {
            event.preventDefault();
            this.#adjustIndent(event.shiftKey ? -1 : 1);
        }
    };

    readonly #handlePaste = (event: ClipboardEvent): void => {
        this.#resetInputHistory();
        if (!this.#canEdit() || event.clipboardData === null) return;
        event.preventDefault();
        const transfer = event.clipboardData;
        const custom = transfer.getData(SOEDITOR_CLIPBOARD_MIME);
        const internalHtml = custom.startsWith('soeditor/1\n')
            ? custom.slice('soeditor/1\n'.length)
            : undefined;
        const result = this.editor.services
            .tryGet(pastePipelineServiceToken)
            ?.process({
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
                ...(internalHtml === undefined ? {} : { internalHtml }),
                source: 'paste',
                text: transfer.getData('text/plain'),
                types: Object.freeze(Array.from(transfer.types)),
            });
        if (result?.consumed === true) return;
        const html =
            result?.html ?? internalHtml ?? transfer.getData('text/html');
        const text = result?.text ?? transfer.getData('text/plain');
        this.#insertHtml(
            result?.policy === 'plain-text' || html.length === 0
                ? escapeText(text).replaceAll('\n', '<br>')
                : html,
        );
    };

    readonly #handleDrop = (event: DragEvent): void => {
        this.#resetInputHistory();
        const transfer = event.dataTransfer;
        if (
            this.#destroyed ||
            this.#locked ||
            !this.element.isContentEditable ||
            transfer === null
        ) {
            return;
        }
        let caret: Range | undefined =
            this.#document.caretRangeFromPoint?.(
                event.clientX,
                event.clientY,
            ) ?? undefined;
        if (
            caret === undefined ||
            !this.element.contains(caret.commonAncestorContainer)
        ) {
            const target = event.target;
            caret =
                target instanceof Element && this.element.contains(target)
                    ? rangeAtEnd(this.#document, target)
                    : undefined;
        }
        if (caret !== undefined) this.#selectRange(caret);
        if (this.#range() === undefined) return;
        const input = {
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
            source: 'drop' as const,
            text: transfer.getData('text/plain'),
            types: Object.freeze(Array.from(transfer.types)),
        };
        const result = this.editor.services
            .tryGet(pastePipelineServiceToken)
            ?.process(input);
        if (result?.consumed === true) {
            event.preventDefault();
            return;
        }
        const html = result?.html ?? input.html;
        const text = result?.text ?? input.text;
        if (html.length === 0 && text.length === 0) return;
        event.preventDefault();
        this.#insertHtml(
            result?.policy === 'plain-text' || html.length === 0
                ? escapeText(text)
                : html,
        );
    };

    readonly #handleFocusIn = (): void => {
        this.#activateFromUserIntent();
        this.#captureRange();
    };

    readonly #handlePointerDown = (event: PointerEvent): void => {
        this.#resetInputHistory();
        this.#pendingMark = undefined;
        this.#activateFromUserIntent();
        const target = event.target;
        this.#tableDragAnchor =
            event.button === 0 && target instanceof Element
                ? (target.closest<HTMLTableCellElement>('td,th') ?? undefined)
                : undefined;
        this.#tableDragMoved = false;
    };

    readonly #handlePointerOver = (event: PointerEvent): void => {
        const anchor = this.#tableDragAnchor;
        const target = event.target;
        const cell =
            target instanceof Element
                ? target.closest<HTMLTableCellElement>('td,th')
                : null;
        if (
            anchor === undefined ||
            cell === null ||
            cell === anchor ||
            (event.buttons & 1) !== 1 ||
            anchor.closest('table') !== cell.closest('table')
        ) {
            return;
        }
        if (!this.#tableDragMoved) this.#activateCell(anchor);
        this.#tableDragMoved = true;
        this.#activateCell(cell, true);
    };

    readonly #handlePointerUp = (event: PointerEvent): void => {
        this.#captureRange();
        const target = event.target;
        const cell =
            target instanceof Element
                ? target.closest<HTMLTableCellElement>('td,th')
                : null;
        if (
            event.button === 2 &&
            cell?.classList.contains('is-structurally-selected') === true &&
            this.#tableSelection?.table === cell.closest('table')
        ) {
            this.#announceTableSelection(cell);
            this.#tableDragAnchor = undefined;
            this.#tableDragMoved = false;
            return;
        }
        if (
            !this.#tableDragMoved &&
            cell !== null &&
            this.element.contains(cell)
        ) {
            this.#activateCell(cell, event.shiftKey);
        }
        this.#tableDragAnchor = undefined;
        this.#tableDragMoved = false;
    };

    readonly #handleDoubleClick = (event: MouseEvent): void => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const image = target.closest<HTMLImageElement>('img');
        if (image !== null && this.element.contains(image)) {
            event.preventDefault();
            this.#selectedElement = image;
            const EventConstructor =
                this.#document.defaultView?.CustomEvent ?? CustomEvent;
            image.dispatchEvent(
                new EventConstructor('soeditor:image-activate', {
                    bubbles: true,
                    detail: Object.freeze({
                        element: image,
                        remove: () => {
                            image.remove();
                            this.#selectedElement = undefined;
                            this.#commit();
                        },
                        update: (values: unknown) =>
                            this.#updateImage(image, values),
                    }),
                }),
            );
            return;
        }
    };

    readonly #handleSelectionChange = (): void => this.#captureRange();

    #activateFromUserIntent(): void {
        if (
            this.#activateOnFocus &&
            !this.#programmaticFocus &&
            this.#projectionActivity?.visible === true &&
            this.#projectionActivity.primary === false
        ) {
            this.editor.execute('projection.activate', 'wysiwyg');
        }
    }

    #prepareInputHistory(event: InputEvent): void {
        const kind =
            event.inputType === 'insertText'
                ? 'insertText'
                : event.inputType === 'deleteContentBackward'
                  ? 'deleteContentBackward'
                  : event.inputType === 'deleteContentForward'
                    ? 'deleteContentForward'
                    : undefined;
        if (kind === undefined || event.isComposing) {
            this.#resetInputHistory();
            return;
        }
        if (this.#inputGroup === undefined || this.#inputGroupKind !== kind) {
            this.#inputSequence += 1;
            this.#inputGroup = `wysiwyg-${kind}-${String(this.#inputSequence)}`;
            this.#inputGroupKind = kind;
        }
        this.#pendingInputGroup = this.#inputGroup;
    }

    #resetInputHistory(): void {
        this.#inputGroup = undefined;
        this.#inputGroupKind = undefined;
        this.#pendingInputGroup = undefined;
    }

    #mergeParagraphBoundary(backward: boolean): boolean {
        const range = this.#range();
        if (range === undefined || !range.collapsed) return false;
        const block = closestElement(range.startContainer, 'p');
        if (block === undefined || block.parentElement !== this.element) {
            return false;
        }
        const boundary = this.#document.createRange();
        boundary.selectNodeContents(block);
        if (backward) {
            boundary.setEnd(range.startContainer, range.startOffset);
        } else {
            boundary.setStart(range.startContainer, range.startOffset);
        }
        if (boundary.toString().length !== 0) return false;
        const adjacent = backward
            ? block.previousElementSibling
            : block.nextElementSibling;
        if (!(adjacent instanceof HTMLParagraphElement)) return false;
        const target = backward ? adjacent : block;
        const removed = backward ? block : adjacent;
        const joinOffset = target.textContent?.length ?? 0;
        this.#mutate(() => {
            target.append(...Array.from(removed.childNodes));
            removed.remove();
            const point = resolveTextPoint(target, joinOffset);
            if (point === undefined) return rangeAtEnd(this.#document, target);
            const joined = this.#document.createRange();
            joined.setStart(point.node, point.offset);
            joined.collapse(true);
            return joined;
        });
        return true;
    }

    #activateCell(cell: HTMLTableCellElement, extend = false): void {
        this.#activeCell?.classList.remove('is-editing');
        this.#activeCell = cell;
        cell.classList.add('is-editing');
        this.#selectedElement = cell;
        const table = cell.closest<HTMLTableElement>('table');
        const focus =
            table === null ? undefined : tableCellPosition(table, cell);
        if (table !== null && focus !== undefined) {
            const anchor =
                extend && this.#tableSelection?.table === table
                    ? this.#tableSelection.range.anchor
                    : focus;
            this.#tableSelection = {
                range: {
                    anchor,
                    focus,
                    ...(anchor.row === focus.row &&
                    anchor.column === focus.column
                        ? {}
                        : { kind: 'cells' as const }),
                },
                table,
            };
            this.#paintTableSelection();
        }
        const range = this.#savedRange?.cloneRange();
        const activate = (): void => {
            if (
                range !== undefined &&
                cell.contains(range.commonAncestorContainer)
            ) {
                this.element.focus({ preventScroll: true });
                this.#selectRange(range);
            }
        };
        this.#announceTableSelection(cell, activate);
    }

    #announceTableSelection(
        cell: HTMLTableCellElement,
        activate: () => void = () => {
            this.element.focus({ preventScroll: true });
        },
    ): void {
        const selected = this.#readTableCellRange();
        const EventConstructor =
            this.#document.defaultView?.CustomEvent ?? CustomEvent;
        cell.dispatchEvent(
            new EventConstructor('soeditor:table-selection', {
                bubbles: true,
                detail: Object.freeze({
                    ...(selected?.focus ?? { column: 0, row: 0 }),
                    activate,
                    range:
                        selected === undefined
                            ? undefined
                            : Object.freeze({
                                  anchor: Object.freeze({
                                      ...selected.anchor,
                                  }),
                                  focus: Object.freeze({ ...selected.focus }),
                                  ...(selected.kind === undefined
                                      ? {}
                                      : { kind: selected.kind }),
                              }),
                }),
            }),
        );
    }

    #setStructuredSelection(type: string, value: unknown): boolean {
        if (type !== 'soeditor.table') return false;
        const range = readNativeTableRange(value);
        const table =
            this.#activeCell?.closest<HTMLTableElement>('table') ??
            this.#selectedElement?.closest<HTMLTableElement>('table');
        if (range === undefined || table === null || table === undefined)
            return false;
        const focus = tableCellAt(table, range.focus.row, range.focus.column);
        if (
            tableCellAt(table, range.anchor.row, range.anchor.column) ===
                undefined ||
            focus === undefined
        )
            return false;
        this.#tableSelection = { range, table };
        this.#activeCell = focus;
        this.#selectedElement = focus;
        this.#paintTableSelection();
        this.#announceTableSelection(focus);
        return true;
    }

    #moveTableCaret(backward: boolean): boolean {
        const range = this.#range();
        const origin =
            range === undefined
                ? undefined
                : closestElement(range.commonAncestorContainer, 'td,th');
        const table = origin?.closest<HTMLTableElement>('table');
        if (
            origin === undefined ||
            !(origin instanceof HTMLTableCellElement) ||
            table === null ||
            table === undefined ||
            !this.element.contains(table)
        ) {
            return false;
        }
        const cells = Array.from(
            table.querySelectorAll<HTMLTableCellElement>('th,td'),
        );
        const index = cells.indexOf(origin);
        const target = cells[index + (backward ? -1 : 1)];
        if (target === undefined) return false;
        this.#activateCell(target);
        const next = this.#document.createRange();
        next.selectNodeContents(target);
        next.collapse(backward);
        this.#selectRange(next);
        return true;
    }

    #paintTableSelection(): void {
        for (const selected of Array.from(
            this.element.querySelectorAll('.is-structurally-selected'),
        )) {
            selected.classList.remove('is-structurally-selected');
            selected.removeAttribute('aria-selected');
        }
        const selection = this.#tableSelection;
        if (selection === undefined) return;
        const top = Math.min(
            selection.range.anchor.row,
            selection.range.focus.row,
        );
        const bottom = Math.max(
            selection.range.anchor.row,
            selection.range.focus.row,
        );
        const left = Math.min(
            selection.range.anchor.column,
            selection.range.focus.column,
        );
        const right = Math.max(
            selection.range.anchor.column,
            selection.range.focus.column,
        );
        if (top === bottom && left === right) return;
        for (let row = top; row <= bottom; row += 1) {
            for (let column = left; column <= right; column += 1) {
                const cell = tableCellAt(selection.table, row, column);
                cell?.classList.add('is-structurally-selected');
                cell?.setAttribute('aria-selected', 'true');
            }
        }
    }

    #render(source: string): void {
        const parsed = parseHtmlFragment(source);
        if (
            parsed.diagnostics.some(
                (diagnostic) => diagnostic.severity === 'error',
            )
        ) {
            this.#locked = true;
            this.#updateEditableState();
            return;
        }
        const bookmark = this.#bookmark();
        this.#pendingMark = undefined;
        this.#locked = false;
        this.#activeCell?.classList.remove('is-editing');
        this.#activeCell = undefined;
        const selectedTable = this.#selectedElement?.closest('table');
        if (selectedTable !== null && selectedTable !== undefined) {
            this.#selectedElement = undefined;
        }
        this.#tableSelection = undefined;
        this.#tableDragAnchor = undefined;
        this.#tableDragMoved = false;
        this.#preservedNodes.clear();
        this.#preservedSequence = 0;
        this.element.replaceChildren(
            ...parsed.document.children.map((node) => this.#renderNode(node)),
        );
        if (this.element.childNodes.length === 0) {
            const paragraph = this.#document.createElement('p');
            paragraph.append(this.#document.createElement('br'));
            this.element.append(paragraph);
        }
        this.#decorateTables();
        if (bookmark !== undefined) this.#restoreBookmark(bookmark);
        this.#updateEditableState();
        // Rendering replaces and decorates the projection DOM deliberately.
        // Those records must not be mistaken for an out-of-band mutation on
        // the next microtask. Formatted source commonly contains indentation
        // text that the WYSIWYG projection serializes canonically; replaying
        // the same source in response to our own records would otherwise form
        // an endless render/observe loop.
        this.#mutationObserver?.takeRecords();
    }

    #renderNode(node: HtmlChildNode): Node {
        if (node.type === 'text') {
            return this.#document.createTextNode(node.value);
        }
        if (node.type === 'comment') {
            return this.#document.createComment(node.value);
        }
        if (
            node.namespace !== 'html' ||
            preservedTags.has(node.tagName) ||
            !standardTags.has(node.tagName)
        ) {
            return this.#preserveNode(node);
        }
        const element = this.#document.createElement(node.tagName);
        const unsafe: PreservedAttribute[] = [];
        for (const attribute of node.attributes) {
            if (isSafeEditingAttribute(node.tagName, attribute)) {
                element.setAttribute(attribute.name, attribute.value);
            } else {
                unsafe.push({ name: attribute.name, value: attribute.value });
            }
        }
        if (unsafe.length > 0) {
            this.#unsafeAttributes.set(element, Object.freeze(unsafe));
        }
        if (!voidTags.has(node.tagName)) {
            element.append(
                ...node.children.map((child) => this.#renderNode(child)),
            );
        }
        return element;
    }

    #preserveNode(node: HtmlChildNode): Comment {
        this.#preservedSequence += 1;
        const id = String(this.#preservedSequence);
        this.#preservedNodes.set(id, node);
        return this.#document.createComment(`soeditor-preserved:${id}`);
    }

    #decorateTables(): void {
        for (const table of Array.from(
            this.element.querySelectorAll('table'),
        )) {
            this.#rememberTableProjectionAttributes(table);
            table.classList.add('soeditor-table-widget');
            addClassTokens(
                table,
                table.getAttribute('data-soeditor-responsive-class'),
            );
            const width = table.getAttribute('data-soeditor-width');
            if (
                width !== null &&
                /^(?:[1-9][0-9]{0,3}px|(?:100|[1-9]?[0-9])%)$/u.test(width)
            ) {
                table.style.width = width;
            }
            const alignment = table.getAttribute('data-soeditor-align');
            if (alignment === 'center') {
                table.style.marginInline = 'auto';
            } else if (alignment === 'right') {
                table.style.marginInlineStart = 'auto';
            } else if (alignment === 'left') {
                table.style.marginInlineEnd = 'auto';
            }
            for (const column of Array.from(
                table.querySelectorAll<HTMLTableColElement>('colgroup col'),
            )) {
                this.#rememberTableProjectionAttributes(column);
                const projectedWidth = Number(
                    column.getAttribute('data-soeditor-width'),
                );
                if (
                    Number.isInteger(projectedWidth) &&
                    projectedWidth >= 40 &&
                    projectedWidth <= 1200
                ) {
                    column.style.width = `${String(projectedWidth)}px`;
                }
            }
            for (const row of Array.from(table.rows)) {
                this.#rememberTableProjectionAttributes(row);
                addClassTokens(row, row.getAttribute('data-soeditor-class'));
                const height = Number(row.getAttribute('data-soeditor-height'));
                if (
                    Number.isInteger(height) &&
                    height >= 20 &&
                    height <= 2000
                ) {
                    row.style.height = `${String(height)}px`;
                }
            }
            for (const cell of Array.from(
                table.querySelectorAll<HTMLTableCellElement>('td,th'),
            )) {
                this.#rememberTableProjectionAttributes(cell);
                cell.classList.add('soeditor-table-cell');
                addClassTokens(cell, cell.getAttribute('data-soeditor-class'));
                const horizontal = cell.getAttribute('data-soeditor-align');
                if (
                    horizontal === 'center' ||
                    horizontal === 'left' ||
                    horizontal === 'right'
                ) {
                    cell.style.textAlign = horizontal;
                }
                const vertical = cell.getAttribute(
                    'data-soeditor-vertical-align',
                );
                if (
                    vertical === 'baseline' ||
                    vertical === 'bottom' ||
                    vertical === 'middle' ||
                    vertical === 'top'
                ) {
                    cell.style.verticalAlign = vertical;
                }
            }
        }
    }

    #rememberTableProjectionAttributes(element: Element): void {
        if (this.#tableProjectionAttributes.has(element)) return;
        this.#tableProjectionAttributes.set(
            element,
            Object.freeze({
                className: element.getAttribute('class'),
                style: element.getAttribute('style'),
            }),
        );
    }

    #serialize(): string {
        const children = Array.from(this.element.childNodes).flatMap((node) => {
            const converted = this.#serializeNode(node);
            return converted === undefined ? [] : [converted];
        });
        return serializeHtmlFragment({
            children: Object.freeze(children),
            type: 'document-fragment',
        });
    }

    #serializeNode(node: Node): HtmlChildNode | undefined {
        if (node.nodeType === 3) {
            return { type: 'text', value: node.nodeValue ?? '' };
        }
        if (node.nodeType === 8) {
            const value = node.nodeValue ?? '';
            const match = /^soeditor-preserved:(\d+)$/u.exec(value);
            return match?.[1] === undefined
                ? { type: 'comment', value }
                : this.#preservedNodes.get(match[1]);
        }
        const view = this.#document.defaultView;
        if (view === null || !(node instanceof view.Element)) return undefined;
        const tagName = node.tagName.toLowerCase();
        const projected = this.#tableProjectionAttributes.get(node);
        const attributes = Array.from(node.attributes)
            .filter(
                ({ name }) =>
                    name !== 'contenteditable' &&
                    name !== 'class' &&
                    !(
                        name === 'aria-selected' &&
                        node.classList.contains('soeditor-table-cell')
                    ) &&
                    !(projected !== undefined && name === 'style'),
            )
            .map(({ name, value }) => ({ name, value }));
        if (projected !== undefined) {
            if (projected.className !== null) {
                attributes.push({ name: 'class', value: projected.className });
            }
            if (projected.style !== null) {
                attributes.push({ name: 'style', value: projected.style });
            }
        } else if (node.hasAttribute('class')) {
            const value = node.className
                .split(/\s+/u)
                .filter(
                    (name) =>
                        name.length > 0 &&
                        ![
                            'soeditor-table-widget',
                            'soeditor-table-cell',
                            'is-editing',
                            'is-structurally-selected',
                        ].includes(name),
                )
                .join(' ');
            if (value.length > 0) attributes.push({ name: 'class', value });
        }
        for (const attribute of this.#unsafeAttributes.get(node) ?? []) {
            if (!attributes.some(({ name }) => name === attribute.name)) {
                attributes.push(attribute);
            }
        }
        return {
            attributes: Object.freeze(attributes),
            children: Object.freeze(
                Array.from(node.childNodes).flatMap((child) => {
                    const converted = this.#serializeNode(child);
                    return converted === undefined ? [] : [converted];
                }),
            ),
            namespace: 'html',
            tagName,
            type: 'element',
        };
    }

    #commit(historyGroup?: string): void {
        if (!this.#canEdit()) return;
        const source = this.#serialize();
        if (source === this.editor.getData()) return;
        this.#pendingSource = source;
        try {
            this.editor.update(
                (transaction) => {
                    transaction.replaceDocument(source);
                    if (historyGroup !== undefined) {
                        groupHistoryTransaction(transaction, historyGroup);
                    }
                },
                { origin: 'user' },
            );
        } finally {
            this.#pendingSource = undefined;
        }
    }

    #handleDocumentChange(source: string): void {
        if (this.#pendingSource !== source) this.#render(source);
    }

    #repairExternalMutation(): void {
        if (
            this.#destroyed ||
            this.#locked ||
            this.#pendingSource !== undefined
        ) {
            return;
        }
        const source = this.editor.getData();
        const parsed = parseHtmlFragment(source);
        const canonicalSource = parsed.diagnostics.some(
            (diagnostic) => diagnostic.severity === 'error',
        )
            ? source
            : serializeHtmlFragment(parsed.document);
        if (this.#serialize() !== canonicalSource) {
            this.#render(source);
        }
    }

    #updateEditableState(): void {
        const visible =
            this.#projectionActivity?.visible ??
            this.editor.state.mode === 'wysiwyg';
        const readonly =
            this.#locked ||
            (this.#projectionActivity?.readonly ??
                (this.editor.state.readonly ||
                    this.editor.state.mode !== 'wysiwyg'));
        this.element.hidden = !visible;
        this.element.contentEditable = readonly ? 'false' : 'true';
        this.element.setAttribute('aria-readonly', String(readonly));
    }

    #canEdit(): boolean {
        return (
            !this.#destroyed &&
            !this.#locked &&
            this.element.isContentEditable &&
            this.#range() !== undefined
        );
    }

    #range(): Range | undefined {
        const range = selectionRangeFor(this.element, this.#document);
        if (
            range !== undefined &&
            this.element.contains(range.commonAncestorContainer)
        ) {
            this.#savedRange = range.cloneRange();
            return range;
        }
        return this.#savedRange?.cloneRange();
    }

    #captureRange(): void {
        const range = selectionRangeFor(this.element, this.#document);
        if (range === undefined) return;
        if (!this.element.contains(range.commonAncestorContainer)) return;
        this.#savedRange = range.cloneRange();
        const selected =
            range.commonAncestorContainer instanceof Element
                ? range.commonAncestorContainer
                : range.commonAncestorContainer.parentElement;
        if (selected !== null) this.#selectedElement = selected;
    }

    #restoreRange(): boolean {
        const range = this.#savedRange;
        if (range === undefined || !range.startContainer.isConnected) {
            return false;
        }
        this.#selectRange(range);
        return true;
    }

    #selectRange(range: Range): void {
        const selection = selectionFor(this.element, this.#document);
        selection?.setBaseAndExtent(
            range.startContainer,
            range.startOffset,
            range.endContainer,
            range.endOffset,
        );
        this.#savedRange = range.cloneRange();
    }

    #toggleMark(mark: VisualTextMark): void {
        const range = this.#range();
        if (range === undefined) return;
        if (range.collapsed) {
            this.#pendingMark = this.#pendingMark === mark ? undefined : mark;
            return;
        }
        this.#mutateRange(range, (current) => {
            const active = closestElement(
                current.commonAncestorContainer,
                mark,
            );
            if (active !== undefined && this.element.contains(active)) {
                unwrap(active);
                return current;
            }
            return this.#wrapBlockRanges(current, () =>
                this.#document.createElement(mark),
            );
        });
    }

    #isMarkActive(mark: VisualTextMark): boolean {
        return (
            this.#pendingMark === mark ||
            this.#closestFromSelection(mark) !== undefined
        );
    }

    #applyInlineStyle(style: VisualInlineStyle): void {
        const range = this.#range();
        if (range === undefined || range.collapsed) return;
        this.#mutateRange(range, (current) =>
            this.#wrapBlockRanges(
                current,
                () => {
                    const wrapper = this.#document.createElement(style.tagName);
                    applyAttributes(wrapper, style.attributes);
                    return wrapper;
                },
                consolidateStyleSpan,
            ),
        );
    }

    #isInlineStyleActive(style: VisualInlineStyle): boolean {
        const element = this.#closestFromSelection(style.tagName);
        return (
            element !== undefined &&
            style.attributes.every(
                ({ name, value }) => element.getAttribute(name) === value,
            )
        );
    }

    #removeInlineStyleProperty(property: VisualInlineStyleProperty): void {
        const range = this.#range();
        if (range === undefined || range.collapsed) return;
        this.#mutateRange(range, (current) => {
            const wrappers: HTMLElement[] = [];
            const selected = this.#wrapBlockRanges(
                current,
                () => {
                    const wrapper = this.#document.createElement('span');
                    wrapper.style.setProperty(property, 'initial');
                    return wrapper;
                },
                (wrapper) => {
                    const consolidated = consolidateStyleSpan(wrapper);
                    wrappers.push(consolidated);
                    return consolidated;
                },
            );
            const retainedSelectionNodes: Node[] = [];
            for (const wrapper of wrappers) {
                removeInlineStyleDeclaration(wrapper, property);
                if (wrapper.attributes.length === 0) {
                    retainedSelectionNodes.push(
                        ...Array.from(wrapper.childNodes),
                    );
                    unwrap(wrapper);
                } else {
                    retainedSelectionNodes.push(wrapper);
                }
            }
            const first = retainedSelectionNodes[0];
            const last = retainedSelectionNodes.at(-1);
            if (
                first === undefined ||
                last === undefined ||
                !first.isConnected ||
                !last.isConnected
            ) {
                return selected;
            }
            const restored = this.#document.createRange();
            restored.setStartBefore(first);
            restored.setEndAfter(last);
            return restored;
        });
    }

    #removeFormat(): void {
        const range = this.#range();
        if (range === undefined || range.collapsed) return;
        this.#mutateRange(range, (current) => {
            const marker = this.#document.createElement('span');
            marker.dataset.soeditorRemoveFormat = 'true';
            marker.textContent = current.toString();
            current.deleteContents();
            current.insertNode(marker);
            let parent = marker.parentElement;
            while (
                parent !== null &&
                parent !== this.element &&
                !parent.matches(blockSelector) &&
                parent.matches(
                    'b,strong,i,em,u,s,strike,sub,sup,font,span[style],span[class]',
                )
            ) {
                splitInlineAncestorAround(marker, parent);
                parent = marker.parentElement;
            }
            const text = this.#document.createTextNode(
                marker.textContent ?? '',
            );
            const cleanupRoot =
                marker.closest<HTMLElement>(blockSelector) ??
                marker.parentElement;
            marker.replaceWith(text);
            if (cleanupRoot !== null) {
                const emptyFormatting = Array.from(
                    cleanupRoot.querySelectorAll(
                        'b,strong,i,em,u,s,strike,sub,sup,font,span',
                    ),
                ).reverse();
                for (const element of emptyFormatting) {
                    if (
                        (element.textContent ?? '').length === 0 &&
                        element.querySelector(
                            'img,video,audio,iframe,object,embed,svg,math,br',
                        ) === null
                    ) {
                        element.remove();
                    }
                }
            }
            current.selectNodeContents(text);
            return current;
        });
    }

    #setBlock(tagName: VisualBlockTag): void {
        const blocks = this.#selectedFormatBlocks();
        const targetTagName = tagName.toUpperCase();
        if (
            blocks.length === 0 ||
            blocks.every((block) => block.tagName === targetTagName)
        ) {
            return;
        }
        const bookmark = this.#bookmark();
        this.#mutate(() => {
            let lastReplacement: HTMLElement | undefined;
            for (const block of blocks) {
                if (!block.isConnected || block.tagName === targetTagName) {
                    continue;
                }
                const replacement = this.#document.createElement(tagName);
                for (const attribute of Array.from(block.attributes)) {
                    replacement.setAttribute(attribute.name, attribute.value);
                }
                replacement.append(...Array.from(block.childNodes));
                block.replaceWith(replacement);
                lastReplacement = replacement;
            }
            const restored =
                bookmark === undefined
                    ? undefined
                    : this.#rangeFromBookmark(bookmark);
            if (restored !== undefined) return restored;
            return lastReplacement === undefined
                ? this.#range()
                : rangeAtEnd(this.#document, lastReplacement);
        });
    }

    #isBlockActive(tagName: VisualBlockTag): boolean {
        const blocks = this.#selectedFormatBlocks();
        return (
            blocks.length > 0 &&
            blocks.every((block) => block.tagName === tagName.toUpperCase())
        );
    }

    #applyBlockAttributes(attributes: readonly HtmlAttribute[]): void {
        const blocks = this.#selectedBlocks();
        if (blocks.length === 0) return;
        this.#mutate(() => {
            for (const block of blocks) applyAttributes(block, attributes);
            return this.#range();
        });
    }

    #areBlockAttributesActive(attributes: readonly HtmlAttribute[]): boolean {
        const block = this.#selectedBlock();
        return (
            block !== undefined &&
            attributes.every(
                ({ name, value }) => block.getAttribute(name) === value,
            )
        );
    }

    #setAlignment(
        alignment: 'center' | 'justify' | 'left' | 'right' | undefined,
    ): void {
        const blocks = this.#selectedBlocks();
        if (blocks.length === 0) return;
        this.#mutate(() => {
            for (const block of blocks) {
                block.style.textAlign = alignment ?? '';
            }
            return this.#range();
        });
    }

    #isAlignmentActive(
        alignment: 'center' | 'justify' | 'left' | 'right' | undefined,
    ): boolean {
        return (
            (this.#selectedBlock()?.style.textAlign || undefined) === alignment
        );
    }

    #adjustIndent(delta: -1 | 1): void {
        const blocks = this.#selectedBlocks();
        if (blocks.length === 0) return;
        if (blocks.every((block) => block.tagName === 'LI')) {
            const selection = this.#getSelection();
            this.#mutate(() => {
                let focus: HTMLElement | undefined;
                for (const block of blocks) {
                    if (delta > 0) {
                        const previous = block.previousElementSibling;
                        const parentList = block.parentElement;
                        if (
                            previous instanceof HTMLElement &&
                            previous.tagName === 'LI' &&
                            parentList !== null
                        ) {
                            let nested = Array.from(previous.children).find(
                                (
                                    child,
                                ): child is
                                    HTMLOListElement | HTMLUListElement =>
                                    child.tagName === 'OL' ||
                                    child.tagName === 'UL',
                            );
                            if (nested === undefined) {
                                nested = this.#document.createElement(
                                    parentList.tagName.toLowerCase() as
                                        'ol' | 'ul',
                                );
                                previous.append(nested);
                            }
                            nested.append(block);
                            focus = block;
                        }
                    } else {
                        const parentList = block.parentElement;
                        const parentItem = parentList?.parentElement;
                        if (
                            parentList !== null &&
                            parentList !== undefined &&
                            parentItem instanceof HTMLElement &&
                            parentItem.tagName === 'LI'
                        ) {
                            parentItem.after(block);
                            if (parentList.children.length === 0) {
                                parentList.remove();
                            }
                            focus = block;
                        }
                    }
                }
                return (
                    (selection === undefined
                        ? undefined
                        : this.#rangeFromEditingSelection(selection)) ??
                    (focus === undefined
                        ? this.#range()
                        : rangeAtEnd(this.#document, focus))
                );
            });
            return;
        }
        this.#mutate(() => {
            for (const block of blocks) {
                const current =
                    Number.parseFloat(block.style.marginInlineStart) || 0;
                block.style.marginInlineStart = `${String(
                    Math.max(0, current + delta * 2),
                )}em`;
            }
            return this.#range();
        });
    }

    #toggleList(list: 'ol' | 'ul'): void {
        const block = this.#selectedBlock();
        if (block === undefined) return;
        const existing = block.closest('ol,ul');
        const selection = this.#getSelection();
        this.#mutate(() => {
            if (existing !== null && existing.tagName.toLowerCase() === list) {
                const replacement = this.#document.createElement('p');
                replacement.append(...Array.from(block.childNodes));
                existing.replaceWith(replacement);
                return (
                    (selection === undefined
                        ? undefined
                        : this.#rangeFromEditingSelection(selection)) ??
                    rangeAtEnd(this.#document, replacement)
                );
            }
            const container = this.#document.createElement(list);
            const item = this.#document.createElement('li');
            item.append(...Array.from(block.childNodes));
            container.append(item);
            block.replaceWith(container);
            return (
                (selection === undefined
                    ? undefined
                    : this.#rangeFromEditingSelection(selection)) ??
                rangeAtEnd(this.#document, item)
            );
        });
    }

    #isListActive(list: 'ol' | 'ul'): boolean {
        return this.#selectedBlock()?.closest(list) !== null;
    }

    #setListProperties(properties: VisualListProperties): void {
        const list = this.#selectedBlock()?.closest<HTMLOListElement>('ol,ul');
        if (list === null || list === undefined) return;
        this.#mutate(() => {
            if (properties.start === undefined) list.removeAttribute('start');
            else list.setAttribute('start', String(properties.start));
            if (properties.type === undefined) list.removeAttribute('type');
            else list.setAttribute('type', properties.type);
            return this.#range();
        });
    }

    #setLink(attributes: VisualLinkAttributes | undefined): void {
        const range = this.#range();
        if (range === undefined) return;
        const active = this.#closestFromSelection('a');
        this.#mutateRange(range, (current) => {
            if (attributes === undefined) {
                if (active !== undefined) unwrap(active);
                return current;
            }
            const link = active ?? this.#document.createElement('a');
            link.setAttribute('href', attributes.href);
            setOptional(link, 'target', attributes.target);
            setOptional(link, 'rel', attributes.rel);
            setOptional(link, 'title', attributes.title);
            if (attributes.customAttributes !== undefined) {
                for (const name of link.getAttributeNames()) {
                    if (!['href', 'rel', 'target', 'title'].includes(name)) {
                        link.removeAttribute(name);
                    }
                }
                for (const attribute of attributes.customAttributes) {
                    link.setAttribute(attribute.name, attribute.value);
                }
            }
            if (active === undefined) {
                if (current.collapsed) link.textContent = attributes.href;
                else link.append(current.extractContents());
                current.insertNode(link);
            }
            current.selectNodeContents(link);
            return current;
        });
    }

    #getLinkAttributes(): VisualLinkAttributes | undefined {
        const link = this.#closestFromSelection('a');
        const href = link?.getAttribute('href');
        if (link === undefined || href === null || href === undefined) {
            return undefined;
        }
        return {
            href,
            ...(link.hasAttribute('target')
                ? { target: link.getAttribute('target') ?? '' }
                : {}),
            ...(link.hasAttribute('rel')
                ? { rel: link.getAttribute('rel') ?? '' }
                : {}),
            ...(link.hasAttribute('title')
                ? { title: link.getAttribute('title') ?? '' }
                : {}),
            ...(() => {
                const customAttributes = link
                    .getAttributeNames()
                    .filter(
                        (name) =>
                            !['href', 'rel', 'target', 'title'].includes(name),
                    )
                    .map((name) =>
                        Object.freeze({
                            name,
                            value: link.getAttribute(name) ?? '',
                        }),
                    );
                return customAttributes.length === 0
                    ? {}
                    : { customAttributes: Object.freeze(customAttributes) };
            })(),
        };
    }

    #insertHtml(html: string, options?: VisualHtmlInsertionOptions): void {
        const selectedRange = this.#range();
        if (selectedRange === undefined) return;
        const range = selectedRange.cloneRange();
        if (options?.placement === 'selection-start') range.collapse(true);
        const parsed = parseHtmlFragment(html);
        const fragment = this.#document.createDocumentFragment();
        fragment.append(
            ...parsed.document.children.map((node) => this.#renderNode(node)),
        );
        const blockInsertion = Array.from(fragment.childNodes).some(
            (node) => node instanceof Element && isBlockInsertion(node),
        );
        const lastInserted = fragment.lastChild;
        this.#mutate(() => {
            const cell = closestElement(range.commonAncestorContainer, 'td,th');
            if (cell !== undefined && this.element.contains(cell)) {
                range.deleteContents();
                range.insertNode(fragment);
            } else if (blockInsertion) {
                const block = this.#selectedBlock();
                if (block !== undefined) block.after(fragment);
                else range.insertNode(fragment);
            } else {
                range.deleteContents();
                range.insertNode(fragment);
            }
            this.#decorateTables();
            const next = this.#document.createRange();
            if (lastInserted !== null && lastInserted.isConnected) {
                next.setStartAfter(lastInserted);
            } else {
                next.selectNodeContents(this.element);
                next.collapse(false);
            }
            next.collapse(true);
            return next;
        });
    }

    #structuredElement(type?: string): Element | undefined {
        const range = this.#range();
        const origin =
            this.#selectedElement ??
            (range?.commonAncestorContainer instanceof Element
                ? range.commonAncestorContainer
                : range?.commonAncestorContainer.parentElement);
        if (origin === undefined || origin === null) return undefined;
        const selector =
            type === 'soeditor.table'
                ? 'table'
                : type === 'soeditor.media'
                  ? 'figure[data-soeditor-media],figure:has(img)'
                  : type === 'soeditor.video'
                    ? 'figure[data-soeditor-video],video'
                    : type === 'soeditor.cms-embed'
                      ? '[data-soeditor-embed]'
                      : type?.startsWith('soeditor.cms-object.') === true
                        ? '[data-soeditor-object]'
                        : 'table,figure,video,[data-soeditor-object],[data-soeditor-embed]';
        const element = origin.closest(selector);
        return element !== null && this.element.contains(element)
            ? element
            : undefined;
    }

    #getSelectedStructuredBlock(
        requestedType?: string,
    ): EditingStructuredBlock | undefined {
        const element = this.#structuredElement(requestedType);
        if (element === undefined) return undefined;
        const parsed = this.#serializeNode(element);
        if (parsed?.type !== 'element') return undefined;
        const type = requestedType ?? structuredType(element);
        if (type === undefined) return undefined;
        return Object.freeze({
            attributes: parsed.attributes,
            behavior: 'atomic',
            children: parsed.children,
            kind: 'structured-block',
            type,
        });
    }

    #replaceStructuredBlockContent(
        type: string,
        content: EditingStructuredBlockContent,
    ): void {
        const current = this.#structuredElement(type);
        if (current === undefined) return;
        const parsed = parseHtmlFragment(
            serializeHtmlFragment({
                children: [
                    {
                        attributes: content.attributes,
                        children: content.children,
                        namespace: 'html',
                        tagName: current.tagName.toLowerCase(),
                        type: 'element',
                    },
                ],
                type: 'document-fragment',
            }),
        ).document.children[0];
        if (parsed === undefined) return;
        const replacement = this.#renderNode(parsed);
        if (!(replacement instanceof Element)) return;
        const cellRange = this.#readTableCellRange();
        let restoredCell: HTMLTableCellElement | undefined;
        this.#mutate(() => {
            current.replaceWith(replacement);
            this.#decorateTables();
            const cell =
                cellRange === undefined
                    ? undefined
                    : tableCellAt(
                          replacement,
                          cellRange.anchor.row,
                          cellRange.anchor.column,
                      );
            if (cell !== undefined) {
                restoredCell = cell;
                this.#activeCell = cell;
                const table = cell.closest<HTMLTableElement>('table');
                if (table !== null && cellRange !== undefined) {
                    this.#tableSelection = {
                        range: {
                            anchor: cellRange.anchor,
                            focus: cellRange.anchor,
                        },
                        table,
                    };
                }
                this.#selectedElement = cell;
                return rangeAtEnd(this.#document, cell);
            }
            this.#selectedElement = replacement;
            const range = this.#document.createRange();
            range.selectNode(replacement);
            return range;
        });
        if (restoredCell !== undefined) {
            this.#announceTableSelection(restoredCell);
        }
    }

    #setStructuredBlockAttributes(
        type: string,
        attributes: readonly HtmlAttribute[],
    ): void {
        const element = this.#structuredElement(type);
        if (element === undefined) return;
        this.#mutate(() => {
            for (const attribute of Array.from(element.attributes)) {
                element.removeAttribute(attribute.name);
            }
            applyAttributes(element, attributes);
            return this.#range();
        });
    }

    #removeStructuredBlock(type: string): void {
        const element = this.#structuredElement(type);
        if (element === undefined) return;
        this.#mutate(() => {
            const range = this.#document.createRange();
            range.setStartBefore(element);
            range.collapse(true);
            element.remove();
            this.#selectedElement = undefined;
            this.#activeCell = undefined;
            this.#tableSelection = undefined;
            return range;
        });
    }

    #readTableCellRange(): TableCellRange | undefined {
        const selection = this.#tableSelection;
        return selection?.table.isConnected === true
            ? selection.range
            : undefined;
    }

    #editingFeedback(message: string, severity: 'error' | 'warning'): void {
        const EventConstructor =
            this.#document.defaultView?.CustomEvent ?? CustomEvent;
        this.element.dispatchEvent(
            new EventConstructor('soeditor:editing-feedback', {
                bubbles: true,
                detail: Object.freeze({ message, severity }),
            }),
        );
    }

    #updateImage(image: HTMLImageElement, candidate: unknown): void {
        if (typeof candidate !== 'object' || candidate === null) return;
        const value = candidate as Record<string, unknown>;
        const source = readImageString(value.src);
        if (
            source !== undefined &&
            (source.length === 0 || !safeUrl(source, true))
        ) {
            this.#editingFeedback('Image URL is not safe.', 'error');
            return;
        }
        const linkValue = readImageString(value.link);
        if (
            linkValue !== undefined &&
            linkValue.length > 0 &&
            !safeUrl(linkValue, false)
        ) {
            this.#editingFeedback('Image link URL is not safe.', 'error');
            return;
        }
        const sourceSet = readImageString(value.srcset);
        if (sourceSet !== undefined && !safeSourceSet(sourceSet)) {
            this.#editingFeedback(
                'Responsive image sources are not safe.',
                'error',
            );
            return;
        }
        const responsiveClass = readImageString(value.responsiveClass);
        if (
            responsiveClass !== undefined &&
            responsiveClass.length > 0 &&
            !/^[a-z][a-z0-9_-]*(?:\s+[a-z][a-z0-9_-]*){0,7}$/iu.test(
                responsiveClass,
            )
        ) {
            this.#editingFeedback('Image CSS classes are invalid.', 'error');
            return;
        }
        const requestedAlignment = readImageString(value.alignment);
        if (
            requestedAlignment !== undefined &&
            !['', 'left', 'center', 'right', 'wide'].includes(
                requestedAlignment,
            )
        ) {
            this.#editingFeedback('Image alignment is invalid.', 'error');
            return;
        }
        this.#mutate(() => {
            const originalWidth = positiveImageDimension(
                image.getAttribute('width'),
            );
            const originalHeight = positiveImageDimension(
                image.getAttribute('height'),
            );
            const widthChanged =
                value.width !== undefined &&
                String(value.width) !== String(originalWidth ?? '');
            const heightChanged =
                value.height !== undefined &&
                String(value.height) !== String(originalHeight ?? '');
            setImageAttribute(image, 'src', source, false);
            setImageAttribute(image, 'alt', readImageString(value.alt), true);
            setImageAttribute(
                image,
                'title',
                readImageString(value.title),
                false,
            );
            setImageDimension(image, 'width', value.width);
            setImageDimension(image, 'height', value.height);
            if (
                value.aspectLocked === true &&
                originalWidth !== undefined &&
                originalHeight !== undefined
            ) {
                const width = positiveImageDimension(
                    image.getAttribute('width'),
                );
                const height = positiveImageDimension(
                    image.getAttribute('height'),
                );
                if (widthChanged && !heightChanged && width !== undefined) {
                    image.setAttribute(
                        'height',
                        String(
                            Math.max(
                                1,
                                Math.round(
                                    (width * originalHeight) / originalWidth,
                                ),
                            ),
                        ),
                    );
                } else if (
                    heightChanged &&
                    !widthChanged &&
                    height !== undefined
                ) {
                    image.setAttribute(
                        'width',
                        String(
                            Math.max(
                                1,
                                Math.round(
                                    (height * originalWidth) / originalHeight,
                                ),
                            ),
                        ),
                    );
                }
            }
            setImageAttribute(image, 'srcset', sourceSet, false);
            setImageAttribute(
                image,
                'sizes',
                readImageString(value.sizes),
                false,
            );
            setImageAttribute(image, 'class', responsiveClass, false);

            let figure = image.closest('figure');
            const captionValue = readImageString(value.caption);
            const alignment = requestedAlignment;
            const needsFigure =
                captionValue !== undefined ||
                (alignment !== undefined && alignment.length > 0) ||
                typeof value.aspectLocked === 'boolean';
            if (figure === null && needsFigure) {
                figure = this.#document.createElement('figure');
                figure.dataset.soeditorMedia = 'image';
                const wrapper =
                    image.parentElement?.tagName === 'A'
                        ? image.parentElement
                        : image;
                const paragraph = wrapper.parentElement;
                if (
                    paragraph?.tagName === 'P' &&
                    paragraph.textContent?.trim().length === 0 &&
                    paragraph.children.length === 1
                ) {
                    paragraph.replaceWith(figure);
                } else {
                    wrapper.replaceWith(figure);
                }
                figure.append(wrapper);
            }
            if (figure !== null) {
                setOptional(figure, 'data-align', alignment);
                if (typeof value.aspectLocked === 'boolean') {
                    setOptional(
                        figure,
                        'data-aspect-lock',
                        value.aspectLocked ? 'true' : undefined,
                    );
                }
                if (captionValue !== undefined) {
                    let caption = figure.querySelector(':scope > figcaption');
                    if (captionValue.length === 0) {
                        caption?.remove();
                    } else {
                        caption ??= this.#document.createElement('figcaption');
                        caption.textContent = captionValue;
                        figure.append(caption);
                    }
                }
            }
            if (linkValue !== undefined) {
                const currentLink =
                    image.parentElement?.tagName === 'A'
                        ? (image.parentElement as HTMLAnchorElement)
                        : undefined;
                if (linkValue.length === 0) {
                    currentLink?.replaceWith(image);
                } else if (currentLink === undefined) {
                    const link = this.#document.createElement('a');
                    link.href = linkValue;
                    image.replaceWith(link);
                    link.append(image);
                } else {
                    currentLink.setAttribute('href', linkValue);
                }
            }
            this.#selectedElement = image;
            const range = this.#document.createRange();
            range.selectNode(image);
            return range;
        });
    }

    #mutateRange(range: Range, operation: (range: Range) => Range): void {
        this.#mutate(() => operation(range));
    }

    #mutate(operation: () => Range | undefined): void {
        if (!this.#canEdit()) return;
        this.#restoreRange();
        const range = operation();
        if (range !== undefined) this.#selectRange(range);
        this.#commit();
    }

    #selectedBlock(): HTMLElement | undefined {
        const range = this.#range();
        if (range === undefined) return undefined;
        const element =
            range.commonAncestorContainer instanceof Element
                ? range.commonAncestorContainer
                : range.commonAncestorContainer.parentElement;
        const block = element?.closest<HTMLElement>(blockSelector);
        return block !== this.element &&
            block !== null &&
            block !== undefined &&
            this.element.contains(block)
            ? block
            : undefined;
    }

    #selectedBlocks(): readonly HTMLElement[] {
        const range = this.#range();
        if (range === undefined) return [];
        return this.#blocks().filter((block) => range.intersectsNode(block));
    }

    #selectedFormatBlocks(): readonly HTMLElement[] {
        const range = this.#range();
        if (range === undefined) return [];
        const blocks = range.collapsed
            ? [this.#selectedBlock()]
            : this.#selectedBlocks();
        return blocks.filter(
            (block): block is HTMLElement =>
                block !== undefined && block.matches(formatBlockSelector),
        );
    }

    #wrapBlockRanges(
        range: Range,
        createWrapper: () => HTMLElement,
        normalizeWrapper?: (wrapper: HTMLElement) => HTMLElement,
    ): Range {
        const wrappers: HTMLElement[] = [];
        for (const segment of this.#blockRanges(range)) {
            if (segment.collapsed) continue;
            const wrapper = createWrapper();
            wrapper.append(segment.extractContents());
            segment.insertNode(wrapper);
            wrappers.push(normalizeWrapper?.(wrapper) ?? wrapper);
        }
        if (wrappers.length === 0) return range;
        const selected = this.#document.createRange();
        selected.setStartBefore(wrappers[0]!);
        selected.setEndAfter(wrappers.at(-1)!);
        return selected;
    }

    #blockRanges(range: Range): readonly Range[] {
        const startBlock = closestElement(range.startContainer, blockSelector);
        const endBlock = closestElement(range.endContainer, blockSelector);
        if (
            startBlock !== undefined &&
            startBlock === endBlock &&
            this.element.contains(startBlock)
        ) {
            return [range.cloneRange()];
        }
        return this.#selectedBlocks().map((block) => {
            const segment = this.#document.createRange();
            segment.selectNodeContents(block);
            if (block.contains(range.startContainer)) {
                segment.setStart(range.startContainer, range.startOffset);
            }
            if (block.contains(range.endContainer)) {
                segment.setEnd(range.endContainer, range.endOffset);
            }
            return segment;
        });
    }

    #closestFromSelection(selector: string): HTMLElement | undefined {
        const range = this.#range();
        if (range === undefined) return undefined;
        const element = closestElement(range.commonAncestorContainer, selector);
        return element !== undefined && this.element.contains(element)
            ? element
            : undefined;
    }

    #getSelection(): EditingSelection | undefined {
        const range = this.#range();
        if (range === undefined) return undefined;
        const blocks = this.#blocks();
        const anchor = editingPointFor(
            blocks,
            range.startContainer,
            range.startOffset,
        );
        const focus = editingPointFor(
            blocks,
            range.endContainer,
            range.endOffset,
        );
        if (anchor === undefined || focus === undefined) return undefined;
        const selection = { anchor, focus };
        this.#reportedSelection = selection;
        return selection;
    }

    #blocks(): readonly HTMLElement[] {
        const view = this.#document.defaultView;
        if (view === null) return [];
        const blocks: HTMLElement[] = [];
        for (const element of Array.from(this.element.children)) {
            if (!(element instanceof view.HTMLElement)) continue;
            if (element.tagName === 'OL' || element.tagName === 'UL') {
                blocks.push(
                    ...Array.from(element.querySelectorAll('li')).filter(
                        (item): item is HTMLLIElement =>
                            item instanceof view.HTMLLIElement,
                    ),
                );
            } else {
                blocks.push(element);
            }
        }
        return blocks;
    }

    #bookmark(): SelectionBookmark | undefined {
        const range = this.#range();
        if (range === undefined) return undefined;
        return {
            end: nodePath(this.element, range.endContainer),
            endOffset: range.endOffset,
            start: nodePath(this.element, range.startContainer),
            startOffset: range.startOffset,
        };
    }

    #restoreBookmark(bookmark: SelectionBookmark): void {
        const range = this.#rangeFromBookmark(bookmark);
        if (range !== undefined) this.#selectRange(range);
    }

    #rangeFromBookmark(bookmark: SelectionBookmark): Range | undefined {
        const start = nodeFromPath(this.element, bookmark.start);
        const end = nodeFromPath(this.element, bookmark.end);
        if (start === undefined || end === undefined) return undefined;
        const range = this.#document.createRange();
        try {
            range.setStart(
                start,
                Math.min(bookmark.startOffset, nodeLength(start)),
            );
            range.setEnd(end, Math.min(bookmark.endOffset, nodeLength(end)));
            return range;
        } catch {
            // An external source edit can invalidate a previous DOM path.
            return undefined;
        }
    }

    #rangeFromEditingSelection(selection: EditingSelection): Range | undefined {
        const blocks = this.#blocks();
        const anchorBlock = blocks[selection.anchor.block];
        const focusBlock = blocks[selection.focus.block];
        if (anchorBlock === undefined || focusBlock === undefined) {
            return undefined;
        }
        const anchor = resolveTextPoint(anchorBlock, selection.anchor.offset);
        const focus = resolveTextPoint(focusBlock, selection.focus.offset);
        if (anchor === undefined || focus === undefined) return undefined;
        const anchorBeforeFocus =
            selection.anchor.block < selection.focus.block ||
            (selection.anchor.block === selection.focus.block &&
                selection.anchor.offset <= selection.focus.offset);
        const start = anchorBeforeFocus ? anchor : focus;
        const end = anchorBeforeFocus ? focus : anchor;
        const range = this.#document.createRange();
        try {
            range.setStart(start.node, start.offset);
            range.setEnd(end.node, end.offset);
            return range;
        } catch {
            return undefined;
        }
    }

    #executeHistory(command: 'editor.undo' | 'editor.redo'): void {
        if (
            this.editor.commands.has(command) &&
            this.editor.commands.canExecute(command)
        ) {
            this.editor.execute(command);
        }
    }

    #assertAlive(): void {
        if (this.#destroyed) throw new WysiwygEditingEngineDestroyedError();
    }
}

export function createWysiwygEditingEngine(
    options: WysiwygEditingEngineOptions,
): WysiwygEditingEngine {
    return new WysiwygEditingEngine(options);
}

function isSafeEditingAttribute(
    tagName: string,
    attribute: HtmlAttribute,
): boolean {
    const name = attribute.name.toLowerCase();
    if (name.startsWith('on') || name === 'contenteditable') return false;
    if (name === 'style') {
        return !/(?:expression|url\s*\(|behavior\s*:|-moz-binding)/iu.test(
            attribute.value,
        );
    }
    if (['href', 'src', 'poster', 'action', 'formaction'].includes(name)) {
        return safeUrl(attribute.value, tagName === 'img');
    }
    return attribute.namespace === undefined;
}

function safeUrl(value: string, image: boolean): boolean {
    const source = value.trim();
    if (/^(?:https?:|blob:|mailto:|tel:)/iu.test(source)) return true;
    if (
        image &&
        /^data:image\/(?:png|jpe?g|gif|webp|avif);base64,/iu.test(source)
    ) {
        return true;
    }
    return /^(?!\/\/)(?![a-z][a-z\d+.-]*:)[^\s]*$/iu.test(source);
}

function safeSourceSet(value: string): boolean {
    if (value.trim().length === 0) return true;
    return value.split(',').every((candidate) => {
        const source = candidate.trim().split(/\s+/u, 1)[0];
        return (
            source !== undefined && source.length > 0 && safeUrl(source, true)
        );
    });
}

function readImageString(value: unknown): string | undefined {
    if (value === undefined) return undefined;
    if (value === null) return '';
    return typeof value === 'string' ? value : undefined;
}

function setImageAttribute(
    image: HTMLImageElement,
    name: string,
    value: string | undefined,
    preserveEmpty: boolean,
): void {
    if (value === undefined) return;
    if (value.length === 0 && !preserveEmpty) image.removeAttribute(name);
    else image.setAttribute(name, value);
}

function setImageDimension(
    image: HTMLImageElement,
    name: 'height' | 'width',
    value: unknown,
): void {
    if (value === undefined) return;
    const normalized = typeof value === 'number' ? String(value) : value;
    if (
        typeof normalized === 'string' &&
        /^\d+$/u.test(normalized) &&
        Number(normalized) > 0
    ) {
        image.setAttribute(name, normalized);
    } else if (normalized === '' || normalized === null) {
        image.removeAttribute(name);
    }
}

function positiveImageDimension(value: string | null): number | undefined {
    if (value === null || !/^\d+$/u.test(value)) return undefined;
    const dimension = Number(value);
    return dimension > 0 ? dimension : undefined;
}

function applyAttributes(
    element: Element,
    attributes: readonly HtmlAttribute[],
): void {
    for (const { name, value } of attributes) element.setAttribute(name, value);
}

/**
 * Collapses redundant style-only spans when a range exactly covers an existing
 * inline-style wrapper. The newly applied declaration wins, while unrelated
 * font/color/background declarations are retained on the single resulting
 * span. Partial selections split the previous wrapper into styled siblings so
 * surrounding text keeps its old style without creating nested spans.
 */
function consolidateStyleSpan(wrapper: HTMLElement): HTMLElement {
    const current = wrapper;
    while (
        current.childNodes.length === 1 &&
        isStyleOnlySpan(current.firstElementChild)
    ) {
        const child = current.firstElementChild;
        copyMissingStyles(child, current);
        child.replaceWith(...Array.from(child.childNodes));
    }
    while (isStyleOnlySpan(current.parentElement)) {
        const parent = current.parentElement;
        removeEmptyTextChildren(parent);
        const children = Array.from(parent.childNodes);
        const position = children.indexOf(current);
        if (position < 0) break;
        copyMissingStyles(parent, current);
        const before = parent.cloneNode(false) as HTMLElement;
        before.append(...children.slice(0, position));
        const after = parent.cloneNode(false) as HTMLElement;
        after.append(...children.slice(position + 1));
        current.remove();
        parent.replaceWith(
            ...(hasMeaningfulContent(before) ? [before] : []),
            current,
            ...(hasMeaningfulContent(after) ? [after] : []),
        );
    }
    return current;
}

function removeEmptyTextChildren(element: HTMLElement): void {
    for (const child of Array.from(element.childNodes)) {
        if (child.nodeType === 3 && child.nodeValue?.length === 0) {
            child.remove();
        }
    }
}

function hasMeaningfulContent(element: HTMLElement): boolean {
    removeEmptyTextChildren(element);
    return element.childNodes.length > 0;
}

function isStyleOnlySpan(element: Element | null): element is HTMLSpanElement {
    return (
        element?.tagName === 'SPAN' &&
        element.attributes.length === 1 &&
        element.hasAttribute('style')
    );
}

function copyMissingStyles(source: HTMLElement, target: HTMLElement): void {
    for (let index = 0; index < source.style.length; index += 1) {
        const property = source.style.item(index);
        if (
            property.length > 0 &&
            target.style.getPropertyValue(property).length === 0
        ) {
            target.style.setProperty(
                property,
                source.style.getPropertyValue(property),
                source.style.getPropertyPriority(property),
            );
        }
    }
}

function removeInlineStyleDeclaration(
    element: HTMLElement,
    property: VisualInlineStyleProperty,
): void {
    const retained = (element.getAttribute('style') ?? '')
        .split(';')
        .map((declaration) => declaration.trim())
        .filter((declaration) => {
            if (declaration.length === 0) return false;
            const separator = declaration.indexOf(':');
            if (separator < 0) return false;
            return (
                declaration.slice(0, separator).trim().toLowerCase() !==
                property
            );
        });
    if (retained.length === 0) {
        element.removeAttribute('style');
    } else {
        element.setAttribute('style', `${retained.join('; ')};`);
    }
}

function setOptional(
    element: Element,
    name: string,
    value: string | undefined,
): void {
    if (value === undefined) element.removeAttribute(name);
    else element.setAttribute(name, value);
}

function closestElement(node: Node, selector: string): HTMLElement | undefined {
    const element = node instanceof Element ? node : node.parentElement;
    return element?.closest<HTMLElement>(selector) ?? undefined;
}

function selectionFor(
    element: HTMLElement,
    document: Document,
): Selection | null {
    const root = element.getRootNode();
    const getSelection: unknown = Reflect.get(root, 'getSelection');
    if (typeof getSelection === 'function') {
        const selection: unknown = Reflect.apply(getSelection, root, []);
        const SelectionConstructor = document.defaultView?.Selection;
        if (
            SelectionConstructor !== undefined &&
            selection instanceof SelectionConstructor
        ) {
            return selection;
        }
    }
    return document.getSelection();
}

function selectionRangeFor(
    element: HTMLElement,
    document: Document,
): Range | undefined {
    const selection = selectionFor(element, document);
    if (selection === null) return undefined;
    const direct = safeSelectionRange(selection, document);
    if (
        direct !== undefined &&
        element.contains(direct.commonAncestorContainer)
    ) {
        return direct;
    }
    const root = element.getRootNode();
    if (!(root instanceof ShadowRoot)) return direct;
    const getter: unknown = Reflect.get(selection, 'getComposedRanges');
    if (typeof getter !== 'function') return direct;
    let ranges: unknown;
    try {
        ranges = Reflect.apply(getter, selection, [{ shadowRoots: [root] }]);
    } catch {
        return direct;
    }
    if (!Array.isArray(ranges) || ranges.length === 0) return direct;
    const candidate: unknown = ranges[0];
    if (typeof candidate !== 'object' || candidate === null) return direct;
    const startContainer: unknown = Reflect.get(candidate, 'startContainer');
    const endContainer: unknown = Reflect.get(candidate, 'endContainer');
    const startOffset: unknown = Reflect.get(candidate, 'startOffset');
    const endOffset: unknown = Reflect.get(candidate, 'endOffset');
    const NodeConstructor = document.defaultView?.Node;
    if (
        NodeConstructor === undefined ||
        !(startContainer instanceof NodeConstructor) ||
        !(endContainer instanceof NodeConstructor) ||
        typeof startOffset !== 'number' ||
        typeof endOffset !== 'number'
    ) {
        return direct;
    }
    const range = document.createRange();
    try {
        range.setStart(startContainer, startOffset);
        range.setEnd(endContainer, endOffset);
        return range;
    } catch {
        return direct;
    }
}

function safeSelectionRange(
    selection: Selection,
    document: Document,
): Range | undefined {
    if (selection.rangeCount === 0) return undefined;
    try {
        const range: unknown = selection.getRangeAt(0);
        const RangeConstructor = document.defaultView?.Range;
        const NodeConstructor = document.defaultView?.Node;
        if (
            RangeConstructor === undefined ||
            NodeConstructor === undefined ||
            !(range instanceof RangeConstructor) ||
            !(range.commonAncestorContainer instanceof NodeConstructor)
        ) {
            return undefined;
        }
        return range;
    } catch {
        return undefined;
    }
}

function unwrap(element: Element): void {
    element.replaceWith(...Array.from(element.childNodes));
}

function splitInlineAncestorAround(
    marker: HTMLElement,
    ancestor: Element,
): void {
    if (marker.parentElement !== ancestor) return;
    const before = ancestor.cloneNode(false) as Element;
    const after = ancestor.cloneNode(false) as Element;
    while (ancestor.firstChild !== null && ancestor.firstChild !== marker) {
        before.append(ancestor.firstChild);
    }
    while (marker.nextSibling !== null) after.append(marker.nextSibling);
    ancestor.replaceWith(
        ...(before.hasChildNodes() ? [before] : []),
        marker,
        ...(after.hasChildNodes() ? [after] : []),
    );
}

function rangeAtEnd(document: Document, element: Element): Range {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    return range;
}

function addClassTokens(element: Element, value: string | null): void {
    if (value === null) return;
    const tokens = value.split(/\s+/u).filter((token) => token.length > 0);
    if (tokens.length > 0) element.classList.add(...tokens);
}

function isBlockInsertion(element: Element): boolean {
    return element.matches(
        'address,article,aside,blockquote,div,figure,footer,h1,h2,h3,h4,h5,h6,header,hr,main,nav,ol,p,pre,section,table,ul,video',
    );
}

function structuredType(element: Element): string | undefined {
    if (element.matches('table')) return 'soeditor.table';
    if (element.matches('figure[data-soeditor-media],figure:has(img)')) {
        return 'soeditor.media';
    }
    if (element.matches('figure[data-soeditor-video],video')) {
        return 'soeditor.video';
    }
    if (element.hasAttribute('data-soeditor-embed')) {
        return 'soeditor.cms-embed';
    }
    const object = element.getAttribute('data-soeditor-object');
    return object === null ? undefined : `soeditor.cms-object.${object}`;
}

function tableCellAt(
    table: Element,
    row: number,
    column: number,
): HTMLTableCellElement | undefined {
    return nativeTableGrid(table)[row]?.[column];
}

function tableCellPosition(
    table: HTMLTableElement,
    cell: HTMLTableCellElement,
): { readonly column: number; readonly row: number } | undefined {
    for (const [row, cells] of nativeTableGrid(table).entries()) {
        const column = cells.indexOf(cell);
        if (column >= 0) return { column, row };
    }
    return undefined;
}

function nativeTableGrid(table: Element): HTMLTableCellElement[][] {
    const rows = Array.from(table.querySelectorAll('tr')).filter(
        (row) => row.closest('table') === table,
    );
    const grid: HTMLTableCellElement[][] = rows.map(() => []);
    for (const [rowIndex, row] of rows.entries()) {
        let column = 0;
        for (const cell of Array.from(row.cells)) {
            while (grid[rowIndex]?.[column] !== undefined) column += 1;
            const rowspan = Math.max(1, cell.rowSpan);
            const colspan = Math.max(1, cell.colSpan);
            for (
                let coveredRow = rowIndex;
                coveredRow < Math.min(rows.length, rowIndex + rowspan);
                coveredRow += 1
            ) {
                for (
                    let coveredColumn = column;
                    coveredColumn < column + colspan;
                    coveredColumn += 1
                ) {
                    const targetRow = grid[coveredRow];
                    if (targetRow !== undefined)
                        targetRow[coveredColumn] = cell;
                }
            }
            column += colspan;
        }
    }
    return grid;
}

function readNativeTableRange(value: unknown): TableCellRange | undefined {
    if (typeof value !== 'object' || value === null) return undefined;
    const anchor = Reflect.get(value, 'anchor');
    const focus = Reflect.get(value, 'focus');
    const readPosition = (
        candidate: unknown,
    ): TableCellRange['anchor'] | undefined => {
        if (typeof candidate !== 'object' || candidate === null)
            return undefined;
        const row = Reflect.get(candidate, 'row');
        const column = Reflect.get(candidate, 'column');
        return Number.isInteger(row) &&
            Number(row) >= 0 &&
            Number.isInteger(column) &&
            Number(column) >= 0
            ? { column: Number(column), row: Number(row) }
            : undefined;
    };
    const nextAnchor = readPosition(anchor);
    const nextFocus = readPosition(focus);
    if (nextAnchor === undefined || nextFocus === undefined) return undefined;
    const kind = Reflect.get(value, 'kind');
    return ['cells', 'columns', 'rows', 'table'].includes(String(kind))
        ? {
              anchor: nextAnchor,
              focus: nextFocus,
              kind: kind as 'cells' | 'columns' | 'rows' | 'table',
          }
        : { anchor: nextAnchor, focus: nextFocus };
}

function nodePath(root: Node, node: Node): readonly number[] {
    const path: number[] = [];
    let current: Node | null = node;
    while (current !== root && current?.parentNode !== null) {
        const parent: Node = current.parentNode;
        path.unshift(Array.prototype.indexOf.call(parent.childNodes, current));
        current = parent;
    }
    return current === root ? path : [];
}

function nodeFromPath(root: Node, path: readonly number[]): Node | undefined {
    let current: Node = root;
    for (const index of path) {
        const child = current.childNodes.item(index);
        if (child === null) return undefined;
        current = child;
    }
    return current;
}

function nodeLength(node: Node): number {
    return node.nodeType === 3
        ? (node.nodeValue?.length ?? 0)
        : node.childNodes.length;
}

function resolveTextPoint(
    root: Node,
    requestedOffset: number,
): { readonly node: Node; readonly offset: number } | undefined {
    if (!Number.isInteger(requestedOffset) || requestedOffset < 0)
        return undefined;
    const document = root.ownerDocument;
    if (document === null) return undefined;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let remaining = requestedOffset;
    let current = walker.nextNode();
    while (current !== null) {
        const length = current.nodeValue?.length ?? 0;
        if (remaining <= length) return { node: current, offset: remaining };
        remaining -= length;
        current = walker.nextNode();
    }
    return remaining === 0
        ? { node: root, offset: root.childNodes.length }
        : undefined;
}

function editingPointFor(
    blocks: readonly HTMLElement[],
    node: Node,
    offset: number,
): EditingPoint | undefined {
    const block = blocks.findIndex(
        (candidate) => candidate === node || candidate.contains(node),
    );
    if (block < 0) return undefined;
    const range = node.ownerDocument?.createRange();
    if (range === undefined) return undefined;
    range.setStart(blocks[block]!, 0);
    range.setEnd(node, offset);
    return { block, offset: range.toString().length };
}

function sameEditingSelection(
    left: EditingSelection,
    right: EditingSelection,
): boolean {
    return (
        left.anchor.block === right.anchor.block &&
        left.anchor.offset === right.anchor.offset &&
        left.focus.block === right.focus.block &&
        left.focus.offset === right.focus.offset
    );
}

function escapeText(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}
