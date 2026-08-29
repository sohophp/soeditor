import {
    defaultToolbarConfiguration,
    destroyToolbarItems,
} from './defaults.js';
import { EditorUiDestroyedError } from './errors.js';
import { createOverlayServices } from './overlays.js';
import { createPanelService } from './panels.js';
import { matchesShortcut } from './shortcuts.js';
import { getUiRegistryRecord, uiRegistryServiceToken } from './ui-plugin.js';
import type {
    CreateEditorUiOptions,
    EditorUi,
    EditorUiTheme,
    ToolbarConfiguration,
    ToolbarItemContext,
    ToolbarItemFactory,
    ToolbarItemInstance,
} from './types.js';

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
    const shell = document.createElement('div');
    shell.className = 'soeditor-ui__chrome';
    const toolbar = document.createElement('div');
    toolbar.className = 'soeditor-ui__toolbar';
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('aria-label', 'Editor toolbar');
    const status = document.createElement('div');
    status.className = 'soeditor-ui__status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    const panelLayer = document.createElement('div');
    panelLayer.className = 'soeditor-ui__panels';
    const notificationRegion = document.createElement('div');
    notificationRegion.className = 'soeditor-ui__notifications';
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
    let editingSelection: SelectionBookmark | undefined;
    let destroyed = false;
    let manualStatus: string | undefined;
    let theme = validateTheme(options.theme ?? 'auto');
    const hadUiClass = options.element.classList.contains('soeditor-ui');
    const previousTheme = options.element.getAttribute('data-soeditor-theme');
    const ui: EditorUi = Object.freeze({
        balloons: overlays.balloons,
        dialogs: overlays.dialogs,
        element: options.element,
        notifications: overlays.notifications,
        panels: panelService.panels,
        statusElement: status,
        toolbarElement: toolbar,
        get theme() {
            return theme;
        },
        get destroyed() {
            return destroyed;
        },
        destroy: () => destroy(),
        refresh: () => update(),
        restoreEditingSelection: () => restoreEditingSelection(),
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
        renderStatus();
    };
    const keydown = (event: KeyboardEvent): void => {
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
    const disposeState = options.editor.events.on('state:change', update);
    const disposeCommand = options.editor.events.on(
        'command:afterExecute',
        update,
    );
    const disposeDestroy = options.editor.events.on('editor:destroy', () =>
        destroy(),
    );
    const selectionChange = (): void => {
        const selection = document.getSelection();
        const anchor = selection?.anchorNode;
        const focus = selection?.focusNode;
        if (
            selection === null ||
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
        update();
    };

    const destroy = (): void => {
        if (destroyed) {
            return;
        }
        destroyed = true;
        options.element.removeEventListener('keydown', keydown, true);
        document.removeEventListener('selectionchange', selectionChange);
        disposeState();
        disposeCommand();
        disposeDestroy();
        destroyToolbarItems(items);
        overlays.destroy();
        panelService.destroy();
        shell.remove();
        if (!hadUiClass) {
            options.element.classList.remove('soeditor-ui');
        }
        if (previousTheme === null) {
            options.element.removeAttribute('data-soeditor-theme');
        } else {
            options.element.setAttribute('data-soeditor-theme', previousTheme);
        }
        attachedHosts.delete(options.element);
    };
    const assertAlive = (): void => {
        if (destroyed) {
            throw new EditorUiDestroyedError();
        }
    };
    function restoreEditingSelection(): boolean {
        const bookmark = editingSelection;
        if (
            bookmark === undefined ||
            !bookmark.anchor.isConnected ||
            !bookmark.focus.isConnected ||
            !options.element.contains(bookmark.anchor) ||
            !options.element.contains(bookmark.focus)
        ) {
            return false;
        }
        try {
            editingHost(bookmark.anchor)?.focus({ preventScroll: true });
            document
                .getSelection()
                ?.setBaseAndExtent(
                    bookmark.anchor,
                    bookmark.anchorOffset,
                    bookmark.focus,
                    bookmark.focusOffset,
                );
            return true;
        } catch {
            editingSelection = undefined;
            return false;
        }
    }
    const renderStatus = (): void => {
        status.textContent =
            manualStatus ??
            `${capitalize(options.editor.state.mode)} · ${
                options.editor.state.dirty ? 'Unsaved' : 'Saved'
            }`;
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
        options.element.classList.add('soeditor-ui');
        options.element.dataset.soeditorTheme = theme;
        options.element.prepend(shell);
        options.element.addEventListener('keydown', keydown, true);
        document.addEventListener('selectionchange', selectionChange);
        attachedHosts.set(options.element, ui);
        update();
        return ui;
    } catch (error: unknown) {
        destroy();
        throw error;
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
    return editingElement !== undefined && host.contains(editingElement);
}

function editingHost(node: Node): HTMLElement | undefined {
    const element =
        node.nodeType === 1 ? (node as Element) : node.parentElement;
    const editingElement = element?.closest<HTMLElement>(
        '[contenteditable="true"]',
    );
    return editingElement ?? undefined;
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
