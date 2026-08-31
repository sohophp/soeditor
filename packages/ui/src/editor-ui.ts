import {
    defaultToolbarConfiguration,
    destroyToolbarItems,
} from './defaults.js';
import { EditorUiDestroyedError } from './errors.js';
import { resolveUiTranslation } from './localization.js';
import { createOverlayServices } from './overlays.js';
import { createPanelService } from './panels.js';
import { matchesShortcut } from './shortcuts.js';
import { getUiRegistryRecord, uiRegistryServiceToken } from './ui-plugin.js';
import type {
    BalloonOptions,
    BalloonService,
    CreateEditorUiOptions,
    DialogAction,
    DialogHandle,
    DialogOptions,
    DialogService,
    EditorUi,
    EditorUiTheme,
    EditorUiThemeVariables,
    StatusItemFactory,
    StatusItemInstance,
    ToolbarConfiguration,
    ToolbarItemContext,
    ToolbarItemFactory,
    ToolbarItemInstance,
    ToolbarLayoutOptions,
} from './types.js';
import { createSvgIcon } from './icons.js';

const attachedHosts = new WeakMap<HTMLElement, EditorUi>();

/** Reports an unknown configured toolbar item. */
export class ToolbarItemNotRegisteredError extends Error {
    constructor(id: string) {
        super(`Toolbar item "${id}" is not registered.`);
        this.name = 'ToolbarItemNotRegisteredError';
    }
}

/** Reports a second UI attachment to the same host. */
export class EditorUiAlreadyAttachedError extends Error {
    constructor() {
        super('An editor UI is already attached to this host.');
        this.name = 'EditorUiAlreadyAttachedError';
    }
}

/** Attaches one configurable, framework-independent DOM UI. */
export function createEditorUi(options: CreateEditorUiOptions): EditorUi {
    if (attachedHosts.has(options.element)) {
        throw new EditorUiAlreadyAttachedError();
    }
    const registryService = options.editor.services.get(uiRegistryServiceToken);
    const registry = getUiRegistryRecord(registryService);
    const document = options.element.ownerDocument;
    const icons = readIcons(options.icons);
    const translation = resolveUiTranslation(
        options.locale,
        options.translations,
        options.direction,
    );
    const shell = document.createElement('div');
    shell.className = 'soeditor-ui__chrome';
    shell.lang = translation.locale;
    shell.dir = translation.direction;
    const toolbar = document.createElement('div');
    toolbar.className = 'soeditor-ui__toolbar';
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('aria-label', 'Editor toolbar');
    const toolbarLayout = validateToolbarLayout(options.toolbarLayout);
    toolbar.dataset.overflow = toolbarLayout.overflow;
    toolbar.dataset.expanded = 'true';
    toolbar.classList.toggle('is-sticky', toolbarLayout.sticky);
    const status = document.createElement('div');
    status.className = 'soeditor-ui__status-bar';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    const primaryStatus = document.createElement('span');
    primaryStatus.className = 'soeditor-ui__status';
    const contributedStatus = document.createElement('span');
    contributedStatus.className = 'soeditor-ui__status-items';
    const documentStatus = document.createElement('span');
    documentStatus.className = 'soeditor-ui__document-status';
    documentStatus.hidden = options.documentStatus !== true;
    status.append(primaryStatus, documentStatus, contributedStatus);
    const panelLayer = document.createElement('div');
    panelLayer.className = 'soeditor-ui__panels';
    const notificationRegion = document.createElement('div');
    notificationRegion.className = 'soeditor-ui__notifications';
    notificationRegion.setAttribute('role', 'log');
    notificationRegion.setAttribute('aria-live', 'polite');
    notificationRegion.setAttribute('aria-label', 'Editor notifications');
    const overlayLayer = document.createElement('div');
    overlayLayer.className = 'soeditor-ui__overlays';
    shell.append(toolbar, panelLayer, status, notificationRegion, overlayLayer);

    const overlays = createOverlayServices(
        document,
        overlayLayer,
        notificationRegion,
    );
    const panelService = createPanelService(document, panelLayer);
    const items: ToolbarItemInstance[] = [];
    const statusItems: StatusItemInstance[] = [];
    let editingSelection: SelectionBookmark | undefined;
    let editingRange: Range | undefined;
    let editingSelectionFrozen = false;
    let selectionHighlightElements: HTMLElement[] = [];
    let destroyed = false;
    let manualStatus: string | undefined;
    let theme = validateTheme(options.theme ?? 'auto');
    let toolbarExpanded = true;
    let collapseButton: HTMLButtonElement | undefined;
    let helpButton: HTMLButtonElement | undefined;
    let contextMenu: ReturnType<typeof overlays.balloons.show> | undefined;
    let contextMenuTarget: Element | undefined;
    let localizationObserver: MutationObserver | undefined;
    const hadUiClass = options.element.classList.contains('soeditor-ui');
    const previousTheme = options.element.getAttribute('data-soeditor-theme');
    const previousThemeVariables = new Map<string, PreviousThemeValue>();
    const selectionAwareDialogs: DialogService = Object.freeze({
        open: (dialogOptions: DialogOptions) => {
            freezeEditingSelection();
            const actions = dialogOptions.actions?.map(
                (action: DialogAction): DialogAction => ({
                    ...action,
                    run: (handle: DialogHandle) => {
                        restoreEditingSelection();
                        try {
                            const result = action.run(handle);
                            if (isPromiseLike(result)) {
                                return Promise.resolve(result).finally(() => {
                                    if (handle.element.isConnected) {
                                        freezeEditingSelection();
                                    }
                                });
                            }
                            if (handle.element.isConnected) {
                                freezeEditingSelection();
                            }
                            return result;
                        } catch (error: unknown) {
                            if (handle.element.isConnected) {
                                freezeEditingSelection();
                            }
                            throw error;
                        }
                    },
                }),
            );
            const handle = overlays.dialogs.open({
                ...dialogOptions,
                ...(actions === undefined ? {} : { actions }),
            });
            showEditingSelectionHighlight();
            return handle;
        },
    });
    const selectionAwareBalloons: BalloonService = Object.freeze({
        // Merely rendering a contextual balloon must not freeze selection:
        // authors still need to drag and reposition inside the related content
        // (especially table cells). The document-level pointer/focus boundary
        // freezes the range only when the user actually enters balloon UI.
        show: (balloonOptions: BalloonOptions) =>
            overlays.balloons.show(balloonOptions),
    });
    const ui: EditorUi = Object.freeze({
        balloons: selectionAwareBalloons,
        dialogs: selectionAwareDialogs,
        element: options.element,
        direction: translation.direction,
        locale: translation.locale,
        notifications: overlays.notifications,
        panels: panelService.panels,
        statusElement: primaryStatus,
        toolbarElement: toolbar,
        get toolbarExpanded() {
            return toolbarExpanded;
        },
        get theme() {
            return theme;
        },
        get destroyed() {
            return destroyed;
        },
        destroy: () => destroy(),
        icon: (id: string, fallback: string) =>
            resolveIcon(icons, id, fallback),
        setIcon: (element: HTMLElement, id: string, fallback: string) => {
            const custom = icons.get(id);
            element.replaceChildren(
                createSvgIcon(
                    document,
                    custom === undefined ? id : '',
                    custom ?? boundedPlainText(fallback, 'icon fallback', 128),
                ),
            );
        },
        refresh: () => update(),
        restoreEditingSelection: () => restoreEditingSelection(),
        setToolbarExpanded: (expanded: boolean) => {
            assertAlive();
            if (typeof expanded !== 'boolean') {
                throw new TypeError(
                    'Toolbar expanded state must be a boolean.',
                );
            }
            if (!toolbarLayout.collapsible && !expanded) {
                throw new TypeError('This editor toolbar is not collapsible.');
            }
            toolbarExpanded = expanded;
            toolbar.dataset.expanded = String(expanded);
            collapseButton?.setAttribute('aria-expanded', String(expanded));
            collapseButton?.setAttribute(
                'aria-label',
                translation.translate(
                    expanded
                        ? 'Collapse editor toolbar'
                        : 'Expand editor toolbar',
                ),
            );
        },
        setStatus: (message?: string) => {
            assertAlive();
            manualStatus = message;
            renderStatus();
        },
        setTheme: (value: EditorUiTheme) => {
            assertAlive();
            theme = validateTheme(value);
            options.element.dataset.soeditorTheme = theme;
        },
        setThemeVariables: (variables?: EditorUiThemeVariables) => {
            assertAlive();
            applyThemeVariables(
                options.element,
                readThemeVariables(variables),
                previousThemeVariables,
            );
        },
        translate: (message: string) => translation.translate(message),
    });

    const update = (): void => {
        if (destroyed) {
            return;
        }
        for (const item of items) {
            try {
                item.update?.();
            } catch (error: unknown) {
                showError(error);
            }
        }
        for (const item of statusItems) {
            try {
                item.update?.();
            } catch (error: unknown) {
                showError(error);
            }
        }
        resetToolbarTabStop(toolbar);
        renderStatus();
    };
    const keydown = (event: KeyboardEvent): void => {
        if (event.key === 'Escape') {
            const openMenu = Array.from(
                options.element.querySelectorAll<HTMLDetailsElement>(
                    'details.soeditor-ui__menu[open]',
                ),
            ).at(-1);
            if (openMenu !== undefined) {
                event.preventDefault();
                openMenu.open = false;
                openMenu.querySelector<HTMLElement>('summary')?.focus();
                return;
            }
        }
        const editingTarget = event
            .composedPath()
            .find(
                (candidate): candidate is Element =>
                    candidate instanceof Element &&
                    isEditingNode(candidate, options.element),
            );
        if (
            event.shiftKey &&
            event.key === 'F10' &&
            editingTarget !== undefined
        ) {
            event.preventDefault();
            event.stopPropagation();
            restoreEditingSelection();
            const selectionNode = selectionForNode(
                editingTarget,
                document,
            )?.anchorNode;
            const selectionTarget =
                selectionNode?.nodeType === 1
                    ? (selectionNode as Element)
                    : selectionNode?.parentElement;
            const selectedTarget =
                selectionTarget !== undefined &&
                selectionTarget !== null &&
                shadowIncludingContains(options.element, selectionTarget)
                    ? selectionTarget
                    : undefined;
            const target =
                selectedTarget !== undefined &&
                selectedTarget !== editingHost(selectedTarget)
                    ? selectedTarget
                    : contextMenuTarget?.isConnected === true &&
                        shadowIncludingContains(
                            options.element,
                            contextMenuTarget,
                        )
                      ? contextMenuTarget
                      : editingTarget;
            if (target === contextMenuTarget) {
                const range = document.createRange();
                range.selectNodeContents(target);
                const selection = selectionForNode(target, document);
                editingHost(target)?.focus({ preventScroll: true });
                selection?.removeAllRanges();
                selection?.addRange(range);
                editingSelection = selectionBookmarkForNode(target, document);
            }
            target.dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                    composed: true,
                    view: document.defaultView,
                }),
            );
            return;
        }
        if (handleToolbarNavigation(event, toolbar)) {
            return;
        }
        for (const shortcut of registry.shortcuts.values()) {
            if (!matchesShortcut(shortcut.parsed, event)) {
                continue;
            }
            if (
                !options.editor.commands.has(shortcut.command) ||
                !options.editor.commands.canExecute(shortcut.command)
            ) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            try {
                restoreEditingSelection();
                const result = options.editor.execute(
                    shortcut.command,
                    ...(shortcut.args ?? []),
                );
                if (isPromiseLike(result)) {
                    void Promise.resolve(result).catch(showError);
                }
            } catch (error: unknown) {
                showError(error);
            }
            return;
        }
    };
    const dismissMenus = (event: Event): void => {
        const path = event.composedPath();
        const restoreAfterBlankPointer =
            event.type === 'pointerdown' &&
            !path.some(
                (candidate) =>
                    candidate instanceof Element &&
                    candidate.matches(
                        'a[href],button,input,select,summary,textarea,[contenteditable="true"],[tabindex]:not([tabindex="-1"])',
                    ),
            );
        let restoreSelection = false;
        for (const menu of Array.from(
            options.element.querySelectorAll<HTMLDetailsElement>(
                'details.soeditor-ui__menu[open]',
            ),
        )) {
            if (!path.includes(menu)) {
                restoreSelection ||=
                    restoreAfterBlankPointer &&
                    menu.contains(deepActiveElement(document));
                menu.open = false;
            }
        }
        if (restoreSelection) {
            document.defaultView?.setTimeout(
                () => restoreEditingSelection(),
                0,
            );
        }
    };
    const disposeState = options.editor.events.on('state:change', update);
    const disposeCommand = options.editor.events.on(
        'command:afterExecute',
        update,
    );
    const disposeDestroy = options.editor.events.on('editor:destroy', () =>
        destroy(),
    );
    const selectionTargets = selectionEventTargets(options.element, document);
    const selectionChange = (): void => {
        if (editingSelectionFrozen) return;
        const activeElement = deepActiveElement(document);
        if (
            editingSelection !== undefined &&
            activeElement !== null &&
            shell.contains(activeElement)
        ) {
            // Keyboard focus can enter chrome without a preceding pointer
            // boundary. Preserve the last author range until focus/pointer
            // returns to an editing surface; the explicit frozen state remains
            // the primary lifecycle for pointer and overlay interactions.
            return;
        }
        const selection = selectionTargets
            .map((target) => selectionForTarget(target, document))
            .find((candidate) => {
                const anchor = candidate?.anchorNode;
                const focus = candidate?.focusNode;
                return (
                    anchor !== null &&
                    anchor !== undefined &&
                    focus !== null &&
                    focus !== undefined &&
                    isEditingNode(anchor, options.element) &&
                    isEditingNode(focus, options.element)
                );
            });
        const anchor = selection?.anchorNode;
        const focus = selection?.focusNode;
        if (
            selection === null ||
            selection === undefined ||
            anchor === null ||
            anchor === undefined ||
            focus === null ||
            focus === undefined ||
            !isEditingNode(anchor, options.element) ||
            !isEditingNode(focus, options.element)
        ) {
            return;
        }
        editingSelection = Object.freeze({
            anchor,
            anchorOffset: selection.anchorOffset,
            focus,
            focusOffset: selection.focusOffset,
        });
        editingRange =
            selection.rangeCount === 0
                ? undefined
                : selection.getRangeAt(0).cloneRange();
        update();
    };
    const selectionHighlightFocusIn = (event: FocusEvent): void => {
        const path = event.composedPath();
        const focusEnteredEditorUi = path.includes(shell);
        const focusEnteredEditingSurface = path.some(
            (candidate) =>
                candidate instanceof Element &&
                isEditingNode(candidate, options.element),
        );
        if (focusEnteredEditorUi && !focusEnteredEditingSurface) {
            freezeEditingSelection();
        } else if (focusEnteredEditingSurface) {
            releaseEditingSelection();
        } else {
            clearEditingSelectionHighlight();
        }
    };
    const selectionSessionPointerDown = (event: PointerEvent): void => {
        if (event.button !== 0) return;
        const path = event.composedPath();
        if (path.includes(shell)) {
            freezeEditingSelection();
            return;
        }
        if (
            path.some(
                (candidate) =>
                    candidate instanceof Element &&
                    isEditingNode(candidate, options.element),
            )
        ) {
            releaseEditingSelection();
        } else {
            clearEditingSelectionHighlight();
        }
    };
    const selectionHighlightViewportChange = (): void => {
        if (editingSelectionFrozen) showEditingSelectionHighlight();
    };
    const toolbarPointerDown = (event: PointerEvent): void => {
        if (event.button !== 0) return;
        const action = event
            .composedPath()
            .find(
                (candidate): candidate is Element =>
                    candidate instanceof Element &&
                    candidate.matches('button,summary'),
            );
        if (
            action !== undefined &&
            action.closest('[data-toolbar-item]') !== null &&
            toolbar.contains(action)
        ) {
            // Rich-text toolbar pointer actions operate on the current editing
            // range. Keep that native range visible and intact; keyboard users
            // can still focus every control normally.
            event.preventDefault();
        }
    };
    const contextmenu = (event: MouseEvent): void => {
        const eventTarget = event
            .composedPath()
            .find(
                (candidate): candidate is Element =>
                    candidate instanceof Element &&
                    isEditingNode(candidate, options.element),
            );
        if (eventTarget === undefined) {
            return;
        }
        const target =
            event.button !== 2 &&
            eventTarget === editingHost(eventTarget) &&
            contextMenuTarget?.isConnected === true
                ? contextMenuTarget
                : eventTarget;
        if (target === contextMenuTarget && eventTarget !== target) {
            const range = document.createRange();
            range.selectNodeContents(target);
            const selection = selectionForNode(target, document);
            editingHost(target)?.focus({ preventScroll: true });
            selection?.removeAllRanges();
            selection?.addRange(range);
            editingSelection = selectionBookmarkForNode(target, document);
        }
        const available = [...registry.contextMenuItems.entries()].filter(
            ([, definition]) => {
                try {
                    if (
                        !options.editor.commands.has(definition.command) ||
                        !options.editor.commands.canExecute(definition.command)
                    ) {
                        return false;
                    }
                    return (
                        definition.when?.({
                            document,
                            editor: options.editor,
                            target,
                            ui,
                        }) ?? true
                    );
                } catch (error: unknown) {
                    showError(error);
                    return false;
                }
            },
        );
        if (available.length === 0) return;
        event.preventDefault();
        contextMenu?.close();
        contextMenuTarget = target;
        const returnSelection =
            editingSelection ?? selectionBookmarkForNode(target, document);
        const menu = document.createElement('div');
        menu.className = 'soeditor-ui__context-menu';
        menu.setAttribute('role', 'menu');
        menu.setAttribute('aria-label', 'Editor context menu');
        const buttons: HTMLButtonElement[] = [];
        for (const [id, definition] of available) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'soeditor-ui__menu-item';
            button.dataset.contextMenuItem = id;
            button.setAttribute('role', 'menuitem');
            button.textContent = translation.translate(definition.label);
            button.addEventListener('click', () => {
                restoreEditingSelection();
                try {
                    const result = options.editor.execute(
                        definition.command,
                        ...(definition.args ?? []),
                    );
                    if (isPromiseLike(result)) {
                        void Promise.resolve(result).catch(showError);
                    }
                } catch (error: unknown) {
                    showError(error);
                }
                contextMenu?.close();
                contextMenu = undefined;
            });
            menu.append(button);
            buttons.push(button);
        }
        menu.addEventListener('keydown', (keyboardEvent) => {
            const current = buttons.indexOf(
                document.activeElement as HTMLButtonElement,
            );
            let next: number | undefined;
            if (
                keyboardEvent.key === 'ArrowDown' ||
                keyboardEvent.key === 'ArrowRight'
            ) {
                next = (Math.max(current, 0) + 1) % buttons.length;
            } else if (
                keyboardEvent.key === 'ArrowUp' ||
                keyboardEvent.key === 'ArrowLeft'
            ) {
                next =
                    (Math.max(current, 0) - 1 + buttons.length) %
                    buttons.length;
            } else if (keyboardEvent.key === 'Home') {
                next = 0;
            } else if (keyboardEvent.key === 'End') {
                next = buttons.length - 1;
            } else if (keyboardEvent.key === 'Escape') {
                keyboardEvent.preventDefault();
                keyboardEvent.stopPropagation();
                contextMenu?.close();
                contextMenu = undefined;
                const restoreMenuFocus = (): void => {
                    if (returnSelection !== undefined) {
                        editingSelection = returnSelection;
                    }
                    if (!restoreEditingSelection()) {
                        editingHost(target)?.focus({ preventScroll: true });
                    }
                };
                restoreMenuFocus();
                document.defaultView?.setTimeout(restoreMenuFocus, 0);
                return;
            }
            if (next !== undefined) {
                keyboardEvent.preventDefault();
                buttons[next]?.focus();
            }
        });
        contextMenu = overlays.balloons.show({ anchor: target, content: menu });
        contextMenu.element.classList.add('soeditor-ui__context-balloon');
        menu.querySelector<HTMLButtonElement>('button')?.focus();
    };

    const destroy = (): void => {
        if (destroyed) {
            return;
        }
        destroyed = true;
        const errors: unknown[] = [];
        options.element.removeEventListener('keydown', keydown, true);
        options.element.removeEventListener('contextmenu', contextmenu);
        toolbar.removeEventListener('pointerdown', toolbarPointerDown, true);
        document.removeEventListener('pointerdown', dismissMenus, true);
        document.removeEventListener(
            'pointerdown',
            selectionSessionPointerDown,
            true,
        );
        document.removeEventListener('focusin', dismissMenus, true);
        document.removeEventListener(
            'focusin',
            selectionHighlightFocusIn,
            true,
        );
        document.removeEventListener(
            'scroll',
            selectionHighlightViewportChange,
            true,
        );
        document.defaultView?.removeEventListener(
            'resize',
            selectionHighlightViewportChange,
        );
        for (const target of selectionTargets) {
            target.removeEventListener('selectionchange', selectionChange);
        }
        localizationObserver?.disconnect();
        localizationObserver = undefined;
        clearEditingSelectionHighlight();
        disposeState();
        disposeCommand();
        disposeDestroy();
        captureCleanupError(errors, () => destroyToolbarItems(items));
        captureCleanupError(errors, () => destroyStatusItems(statusItems));
        captureCleanupError(errors, () => overlays.destroy());
        captureCleanupError(errors, () => panelService.destroy());
        shell.remove();
        if (!hadUiClass) {
            options.element.classList.remove('soeditor-ui');
        }
        if (previousTheme === null) {
            options.element.removeAttribute('data-soeditor-theme');
        } else {
            options.element.setAttribute('data-soeditor-theme', previousTheme);
        }
        restoreThemeVariables(options.element, previousThemeVariables);
        attachedHosts.delete(options.element);
        if (errors.length > 0) {
            throw new AggregateError(errors, 'Editor UI cleanup failed.');
        }
    };
    const assertAlive = (): void => {
        if (destroyed) {
            throw new EditorUiDestroyedError();
        }
    };
    function restoreEditingSelection(): boolean {
        editingSelectionFrozen = false;
        clearEditingSelectionHighlight();
        const bookmark = editingSelection;
        if (
            bookmark === undefined ||
            !bookmark.anchor.isConnected ||
            !bookmark.focus.isConnected ||
            !shadowIncludingContains(options.element, bookmark.anchor) ||
            !shadowIncludingContains(options.element, bookmark.focus)
        ) {
            return false;
        }
        try {
            editingHost(bookmark.anchor)?.focus({ preventScroll: true });
            const selection = selectionForNode(bookmark.anchor, document);
            selection?.setBaseAndExtent(
                bookmark.anchor,
                bookmark.anchorOffset,
                bookmark.focus,
                bookmark.focusOffset,
            );
            if (
                selection?.anchorNode !== bookmark.anchor ||
                selection.anchorOffset !== bookmark.anchorOffset ||
                selection.focusNode !== bookmark.focus ||
                selection.focusOffset !== bookmark.focusOffset
            ) {
                const range = editingRange;
                if (
                    range === undefined ||
                    !range.startContainer.isConnected ||
                    !range.endContainer.isConnected
                ) {
                    return false;
                }
                selection?.removeAllRanges();
                selection?.addRange(range.cloneRange());
            }
            return selection !== null && selection !== undefined;
        } catch {
            editingSelection = undefined;
            return false;
        }
    }
    function freezeEditingSelection(): void {
        if (!editingSelectionFrozen) {
            selectionChange();
            editingSelectionFrozen = true;
        }
        showEditingSelectionHighlight();
    }
    function releaseEditingSelection(): void {
        editingSelectionFrozen = false;
        clearEditingSelectionHighlight();
    }
    function showEditingSelectionHighlight(): void {
        clearEditingSelectionHighlight();
        const range = editingRange;
        if (
            range === undefined ||
            range.collapsed ||
            !range.startContainer.isConnected ||
            !range.endContainer.isConnected
        ) {
            return;
        }
        try {
            const root = range.commonAncestorContainer.getRootNode();
            const container = root instanceof ShadowRoot ? root : document.body;
            selectionHighlightElements = Array.from(
                range.getClientRects(),
                (rectangle) => {
                    const highlight = document.createElement('span');
                    highlight.dataset.soeditorSelectionHighlight = 'true';
                    highlight.setAttribute('aria-hidden', 'true');
                    highlight.style.position = 'fixed';
                    highlight.style.pointerEvents = 'none';
                    highlight.style.zIndex = '2147483000';
                    highlight.style.left = `${String(rectangle.left)}px`;
                    highlight.style.top = `${String(rectangle.top)}px`;
                    highlight.style.width = `${String(rectangle.width)}px`;
                    highlight.style.height = `${String(rectangle.height)}px`;
                    highlight.style.background = 'Highlight';
                    highlight.style.opacity = '0.42';
                    highlight.style.mixBlendMode = 'multiply';
                    container.append(highlight);
                    return highlight;
                },
            );
        } catch {
            clearEditingSelectionHighlight();
        }
    }
    function clearEditingSelectionHighlight(): void {
        for (const element of selectionHighlightElements) element.remove();
        selectionHighlightElements = [];
    }
    const renderStatus = (): void => {
        primaryStatus.textContent =
            manualStatus ??
            `${translation.translate(capitalize(options.editor.state.mode))} · ${translation.translate(
                options.editor.state.dirty ? 'Unsaved' : 'Saved',
            )}`;
        if (options.documentStatus === true) {
            const snapshot = renderDocumentStatus(
                document,
                options.element,
                options.editor.getData(),
                translation.translate,
            );
            documentStatus.textContent = snapshot.text;
            documentStatus.dataset.words = String(snapshot.words);
            documentStatus.dataset.characters = String(snapshot.characters);
            documentStatus.dataset.sourceCharacters = String(
                snapshot.sourceCharacters,
            );
            documentStatus.dataset.editorMode = options.editor.state.mode;
        }
    };
    const showError = (error: unknown): void => {
        if (!destroyed) {
            overlays.notifications.show({
                message: error instanceof Error ? error.message : String(error),
                severity: 'error',
            });
        }
    };

    try {
        mountToolbar(
            options.toolbar ?? defaultToolbarConfiguration,
            toolbar,
            registry.toolbarItems,
            { document, editor: options.editor, ui },
            items,
        );
        collapseButton = toolbarLayout.collapsible
            ? createCollapseButton(document, ui)
            : undefined;
        if (collapseButton !== undefined) toolbar.append(collapseButton);
        helpButton = options.accessibilityHelp
            ? createAccessibilityHelpButton(document, ui)
            : undefined;
        if (helpButton !== undefined) toolbar.append(helpButton);
        mountStatusItems(
            contributedStatus,
            registry.statusItems,
            { document, editor: options.editor, ui },
            statusItems,
        );
        options.element.classList.add('soeditor-ui');
        options.element.dataset.soeditorTheme = theme;
        applyThemeVariables(
            options.element,
            readThemeVariables(options.themeVariables),
            previousThemeVariables,
        );
        options.element.prepend(shell);
        localizeUiTree(shell, translation.translate);
        const Observer = document.defaultView?.MutationObserver;
        if (Observer !== undefined) {
            localizationObserver = new Observer((records) => {
                for (const record of records) {
                    if (record.type === 'characterData') {
                        localizeUiNode(record.target, translation.translate);
                    } else if (record.type === 'attributes') {
                        localizeUiNode(record.target, translation.translate);
                    }
                    for (const node of Array.from(record.addedNodes)) {
                        localizeUiNode(node, translation.translate);
                    }
                }
            });
            localizationObserver.observe(shell, {
                attributeFilter: ['aria-label', 'placeholder', 'title'],
                attributes: true,
                characterData: true,
                childList: true,
                subtree: true,
            });
        }
        options.element.addEventListener('keydown', keydown, true);
        options.element.addEventListener('contextmenu', contextmenu);
        toolbar.addEventListener('pointerdown', toolbarPointerDown, true);
        document.addEventListener(
            'pointerdown',
            selectionSessionPointerDown,
            true,
        );
        document.addEventListener('pointerdown', dismissMenus, true);
        document.addEventListener('focusin', dismissMenus, true);
        document.addEventListener('focusin', selectionHighlightFocusIn, true);
        document.addEventListener(
            'scroll',
            selectionHighlightViewportChange,
            true,
        );
        document.defaultView?.addEventListener(
            'resize',
            selectionHighlightViewportChange,
        );
        for (const target of selectionTargets) {
            target.addEventListener('selectionchange', selectionChange);
        }
        attachedHosts.set(options.element, ui);
        update();
        return ui;
    } catch (error: unknown) {
        destroy();
        throw error;
    }
}

const themeProperties: Readonly<Record<keyof EditorUiThemeVariables, string>> =
    Object.freeze({
        accent: '--soeditor-accent',
        accentContrast: '--soeditor-accent-contrast',
        background: '--soeditor-bg',
        border: '--soeditor-border',
        controlSize: '--soeditor-control-size',
        danger: '--soeditor-danger',
        focusRing: '--soeditor-focus-ring',
        muted: '--soeditor-muted',
        panelBackground: '--soeditor-panel-bg',
        radius: '--soeditor-radius',
        text: '--soeditor-text',
    });

function readIcons(
    value: CreateEditorUiOptions['icons'],
): ReadonlyMap<string, string> {
    if (value === undefined) return new Map();
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new TypeError('Editor UI icons must be a plain object.');
    }
    const result = new Map<string, string>();
    for (const [id, icon] of Object.entries(value)) {
        if (!/^[a-z][a-zA-Z0-9._-]{0,95}$/u.test(id)) {
            throw new TypeError(`Editor UI icon ID "${id}" is invalid.`);
        }
        result.set(id, boundedPlainText(icon, `icon "${id}"`, 16));
    }
    return result;
}

function resolveIcon(
    icons: ReadonlyMap<string, string>,
    id: string,
    fallback: string,
): string {
    if (!/^[a-z][a-zA-Z0-9._-]{0,95}$/u.test(id)) {
        throw new TypeError(`Editor UI icon ID "${id}" is invalid.`);
    }
    return icons.get(id) ?? boundedPlainText(fallback, 'icon fallback', 128);
}

function readThemeVariables(
    value: EditorUiThemeVariables | undefined,
): ReadonlyMap<string, string> {
    if (value === undefined) return new Map();
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new TypeError(
            'Editor UI theme variables must be a plain object.',
        );
    }
    const result = new Map<string, string>();
    for (const [key, candidate] of Object.entries(value)) {
        const property = Reflect.get(themeProperties, key);
        if (typeof property !== 'string') {
            throw new TypeError(
                `Editor UI theme variable "${key}" is unsupported.`,
            );
        }
        result.set(
            property,
            boundedPlainText(candidate, `theme variable "${key}"`, 256),
        );
    }
    return result;
}

function boundedPlainText(
    value: unknown,
    label: string,
    maximum: number,
): string {
    if (
        typeof value !== 'string' ||
        value.length === 0 ||
        value.length > maximum ||
        Array.from(value).some((character) => {
            const code = character.codePointAt(0)!;
            return code < 32 || code === 127;
        })
    ) {
        throw new TypeError(
            `Editor UI ${label} must be bounded printable text.`,
        );
    }
    return value;
}

function applyThemeVariables(
    element: HTMLElement,
    variables: ReadonlyMap<string, string>,
    previous: Map<string, PreviousThemeValue>,
): void {
    for (const property of Object.values(themeProperties)) {
        if (!previous.has(property)) {
            previous.set(
                property,
                Object.freeze({
                    priority: element.style.getPropertyPriority(property),
                    value: element.style.getPropertyValue(property),
                }),
            );
        }
        const value = variables.get(property);
        if (value === undefined) {
            const original = previous.get(property)!;
            if (original.value.length === 0)
                element.style.removeProperty(property);
            else
                element.style.setProperty(
                    property,
                    original.value,
                    original.priority,
                );
        } else element.style.setProperty(property, value);
    }
}

function restoreThemeVariables(
    element: HTMLElement,
    previous: ReadonlyMap<string, PreviousThemeValue>,
): void {
    for (const [property, previousValue] of previous) {
        if (previousValue.value.length === 0)
            element.style.removeProperty(property);
        else
            element.style.setProperty(
                property,
                previousValue.value,
                previousValue.priority,
            );
    }
}

interface PreviousThemeValue {
    readonly priority: string;
    readonly value: string;
}

function mountStatusItems(
    host: HTMLElement,
    factories: ReadonlyMap<string, StatusItemFactory>,
    context: ToolbarItemContext,
    instances: StatusItemInstance[],
): void {
    for (const [id, factory] of factories) {
        const instance = factory(context);
        if (
            typeof instance !== 'object' ||
            instance === null ||
            instance.element.ownerDocument !== context.document
        ) {
            throw new TypeError(
                `Status item "${id}" returned an invalid element.`,
            );
        }
        instance.element.dataset.statusItem = id;
        host.append(instance.element);
        instances.push(instance);
    }
}

function destroyStatusItems(instances: readonly StatusItemInstance[]): void {
    const errors: unknown[] = [];
    for (const instance of [...instances].reverse()) {
        try {
            instance.destroy?.();
        } catch (error: unknown) {
            errors.push(error);
        } finally {
            instance.element.remove();
        }
    }
    if (errors.length > 0) {
        throw new AggregateError(errors, 'Status item cleanup failed.');
    }
}

function captureCleanupError(errors: unknown[], cleanup: () => void): void {
    try {
        cleanup();
    } catch (error: unknown) {
        errors.push(error);
    }
}

interface SelectionBookmark {
    readonly anchor: Node;
    readonly anchorOffset: number;
    readonly focus: Node;
    readonly focusOffset: number;
}

function isEditingNode(node: Node, host: HTMLElement): boolean {
    const editingElement = editingHost(node);
    return (
        editingElement !== undefined &&
        shadowIncludingContains(host, editingElement)
    );
}

function shadowIncludingContains(host: HTMLElement, node: Node): boolean {
    let current: Node = node;
    while (true) {
        if (host.contains(current)) return true;
        const root = current.getRootNode();
        if (!(root instanceof ShadowRoot)) return false;
        current = root.host;
    }
}

function selectionEventTargets(
    host: HTMLElement,
    document: Document,
): readonly EventTarget[] {
    const targets: EventTarget[] = [document];
    for (const element of [host, ...Array.from(host.querySelectorAll('*'))]) {
        if (element.shadowRoot !== null) targets.push(element.shadowRoot);
    }
    return Object.freeze(targets);
}

function selectionForNode(node: Node, document: Document): Selection | null {
    return selectionForTarget(node.getRootNode(), document);
}

function selectionBookmarkForNode(
    node: Node,
    document: Document,
): SelectionBookmark | undefined {
    const selection = selectionForNode(node, document);
    const anchor = selection?.anchorNode;
    const focus = selection?.focusNode;
    if (
        selection === null ||
        anchor === null ||
        anchor === undefined ||
        focus === null ||
        focus === undefined
    ) {
        return undefined;
    }
    return Object.freeze({
        anchor,
        anchorOffset: selection.anchorOffset,
        focus,
        focusOffset: selection.focusOffset,
    });
}

function selectionForTarget(
    target: EventTarget,
    document: Document,
): Selection | null {
    const getter: unknown = Reflect.get(target, 'getSelection');
    if (typeof getter === 'function') {
        const candidate: unknown = Reflect.apply(getter, target, []);
        const SelectionConstructor = document.defaultView?.Selection;
        if (
            SelectionConstructor !== undefined &&
            candidate instanceof SelectionConstructor
        ) {
            return candidate;
        }
    }
    return target === document ? document.getSelection() : null;
}

function editingHost(node: Node): HTMLElement | undefined {
    const element =
        node.nodeType === 1 ? (node as Element) : node.parentElement;
    const editingElement = element?.closest<HTMLElement>(
        '[contenteditable="true"]',
    );
    return editingElement ?? undefined;
}

function deepActiveElement(document: Document): Element | null {
    let active = document.activeElement;
    while (active?.shadowRoot !== null && active?.shadowRoot !== undefined) {
        const nested = active.shadowRoot.activeElement;
        if (nested === null) break;
        active = nested;
    }
    return active;
}

function mountToolbar(
    configuration: ToolbarConfiguration,
    toolbar: HTMLElement,
    factories: ReadonlyMap<string, ToolbarItemFactory>,
    context: ToolbarItemContext,
    instances: ToolbarItemInstance[],
): void {
    let previousSeparator = true;
    for (const id of configuration) {
        if (id === '|') {
            if (previousSeparator) {
                throw new TypeError(
                    'Toolbar separators must appear between toolbar items.',
                );
            }
            const separator = context.document.createElement('span');
            separator.className = 'soeditor-ui__separator';
            separator.setAttribute('role', 'separator');
            toolbar.append(separator);
            previousSeparator = true;
            continue;
        }
        if (typeof id !== 'string' || id.trim().length === 0) {
            throw new TypeError('A toolbar item ID must not be empty.');
        }
        const factory = factories.get(id);
        if (factory === undefined) {
            throw new ToolbarItemNotRegisteredError(id);
        }
        const instance = factory(context);
        if (
            typeof instance !== 'object' ||
            instance === null ||
            instance.element.ownerDocument !== context.document
        ) {
            throw new TypeError(
                `Toolbar item "${id}" returned an invalid element.`,
            );
        }
        instance.element.dataset.toolbarItem = id;
        toolbar.append(instance.element);
        instances.push(instance);
        previousSeparator = false;
    }
    if (previousSeparator && configuration.length > 0) {
        throw new TypeError('A toolbar must not end with a separator.');
    }
}

interface ValidToolbarLayout {
    readonly collapsible: boolean;
    readonly overflow: 'scroll' | 'wrap';
    readonly sticky: boolean;
}

function validateToolbarLayout(
    layout: ToolbarLayoutOptions | undefined,
): ValidToolbarLayout {
    const overflow = layout?.overflow ?? 'wrap';
    if (overflow !== 'wrap' && overflow !== 'scroll') {
        throw new TypeError('Toolbar overflow must be wrap or scroll.');
    }
    for (const [name, value] of [
        ['collapsible', layout?.collapsible],
        ['sticky', layout?.sticky],
    ] as const) {
        if (value !== undefined && typeof value !== 'boolean') {
            throw new TypeError(`Toolbar ${name} must be a boolean.`);
        }
    }
    return Object.freeze({
        collapsible: layout?.collapsible ?? false,
        overflow,
        sticky: layout?.sticky ?? false,
    });
}

function createCollapseButton(
    document: Document,
    ui: EditorUi,
): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'soeditor-ui__button soeditor-ui__toolbar-toggle';
    ui.setIcon(button, 'ui.toolbar.toggle', 'Toolbar');
    button.setAttribute('aria-expanded', 'true');
    button.setAttribute('aria-label', 'Collapse editor toolbar');
    button.title = 'Show or hide editor toolbar';
    button.addEventListener('click', () => {
        ui.setToolbarExpanded(!ui.toolbarExpanded);
    });
    return button;
}

function createAccessibilityHelpButton(
    document: Document,
    ui: EditorUi,
): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'soeditor-ui__button soeditor-ui__help-button';
    ui.setIcon(button, 'ui.accessibility.help', 'Help');
    button.title = 'Accessibility help';
    button.setAttribute('aria-label', 'Accessibility help');
    button.addEventListener('click', () => {
        ui.dialogs.open({
            title: 'Accessibility help',
            content: (container) => {
                const introduction = document.createElement('p');
                introduction.textContent =
                    'Use Tab to enter controls and Arrow keys to move within toolbars and menus.';
                const shortcuts = document.createElement('ul');
                for (const item of [
                    'Bold: Control or Command plus B',
                    'Italic: Control or Command plus I',
                    'Undo: Control or Command plus Z',
                    'Context menu: Shift plus F10',
                    'Close a dialog or menu: Escape',
                ]) {
                    const entry = document.createElement('li');
                    entry.textContent = item;
                    shortcuts.append(entry);
                }
                container.append(introduction, shortcuts);
            },
        });
    });
    return button;
}

function toolbarControls(toolbar: HTMLElement): HTMLElement[] {
    return Array.from(
        toolbar.querySelectorAll<HTMLElement>(
            'button:not(:disabled), summary:not([aria-disabled="true"])',
        ),
    ).filter((element) => !element.closest('[hidden]'));
}

function resetToolbarTabStop(toolbar: HTMLElement): void {
    const controls = toolbarControls(toolbar);
    const focused = controls.find(
        (control) => control === toolbar.ownerDocument.activeElement,
    );
    for (const control of controls) control.tabIndex = -1;
    (focused ?? controls[0])?.setAttribute('tabindex', '0');
}

function handleToolbarNavigation(
    event: KeyboardEvent,
    toolbar: HTMLElement,
): boolean {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !toolbar.contains(target)) {
        return false;
    }
    const controls = toolbarControls(toolbar);
    const current = controls.indexOf(target);
    if (current < 0) return false;
    let next: number | undefined;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        next = (current + 1) % controls.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        next = (current - 1 + controls.length) % controls.length;
    } else if (event.key === 'Home') {
        next = 0;
    } else if (event.key === 'End') {
        next = controls.length - 1;
    }
    if (next === undefined) return false;
    event.preventDefault();
    event.stopPropagation();
    for (const control of controls) control.tabIndex = -1;
    const control = controls[next];
    if (control !== undefined) {
        control.tabIndex = 0;
        control.focus();
    }
    return true;
}

function renderDocumentStatus(
    document: Document,
    host: HTMLElement,
    source: string,
    translate: (message: string) => string,
): {
    readonly characters: number;
    readonly sourceCharacters: number;
    readonly text: string;
    readonly words: number;
} {
    const template = document.createElement('template');
    template.innerHTML = source;
    const text = template.content.textContent ?? '';
    const characters = Array.from(text).length;
    const sourceCharacters = Array.from(source).length;
    const words = countWords(text, document.documentElement.lang);
    const path = selectedElementPath(document, host);
    return Object.freeze({
        characters,
        text: `${translate(path)} · ${String(words)} ${translate(
            'words',
        )} · ${String(characters)} ${translate(
            'characters',
        )} · ${String(sourceCharacters)} ${translate('source characters')}`,
        sourceCharacters,
        words,
    });
}

function countWords(text: string, locale: string): number {
    if (text.trim().length === 0) return 0;
    try {
        const segmenter = new Intl.Segmenter(locale || undefined, {
            granularity: 'word',
        });
        return Array.from(segmenter.segment(text)).filter(
            (segment) => segment.isWordLike,
        ).length;
    } catch {
        return text.trim().split(/\s+/u).length;
    }
}

function selectedElementPath(document: Document, host: HTMLElement): string {
    const node = document.getSelection()?.anchorNode;
    let element =
        node?.nodeType === 1 ? (node as Element) : node?.parentElement;
    const parts: string[] = [];
    while (
        element !== undefined &&
        element !== null &&
        host.contains(element)
    ) {
        if (element.hasAttribute('contenteditable')) break;
        parts.unshift(element.localName);
        element = element.parentElement;
    }
    return parts.length === 0 ? 'document' : parts.join(' › ');
}

function localizeUiTree(
    root: HTMLElement,
    translate: (message: string) => string,
): void {
    localizeUiNode(root, translate);
}

function localizeUiNode(
    node: Node,
    translate: (message: string) => string,
): void {
    if (
        node.parentElement?.closest('[data-soeditor-no-translate]') !== null ||
        (node instanceof Element &&
            node.closest('[data-soeditor-no-translate]') !== null)
    ) {
        return;
    }
    if (node.nodeType === 3) {
        const value = node.nodeValue ?? '';
        const trimmed = value.trim();
        if (trimmed.length === 0) return;
        const localized = translate(trimmed);
        if (localized !== trimmed) {
            node.nodeValue = value.replace(trimmed, localized);
        }
        return;
    }
    const view = node.ownerDocument?.defaultView;
    if (view === null || view === undefined || !(node instanceof view.Element))
        return;
    for (const attribute of ['aria-label', 'placeholder', 'title'] as const) {
        const value = node.getAttribute(attribute);
        if (value !== null) {
            const localized = translate(value);
            if (localized !== value) node.setAttribute(attribute, localized);
        }
    }
    for (const child of Array.from(node.childNodes))
        localizeUiNode(child, translate);
}

function validateTheme(theme: EditorUiTheme): EditorUiTheme {
    if (theme !== 'auto' && theme !== 'light' && theme !== 'dark') {
        throw new TypeError('Editor UI theme must be auto, light, or dark.');
    }
    return theme;
}

function capitalize(value: string): string {
    return value.length === 0
        ? value
        : `${value[0]?.toUpperCase() ?? ''}${value.slice(1)}`;
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
    return (typeof value === 'object' && value !== null) ||
        typeof value === 'function'
        ? typeof Reflect.get(value, 'then') === 'function'
        : false;
}
