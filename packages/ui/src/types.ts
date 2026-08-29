import type { Editor } from '@soeditor/core';

/** Ordered toolbar item IDs with `|` group separators. */
export type ToolbarConfiguration = readonly (string | '|')[];

/** Light, dark, or operating-system-derived editor chrome. */
export type EditorUiTheme = 'auto' | 'light' | 'dark';

/** One mounted toolbar contribution owned by its factory. */
export interface ToolbarItemInstance {
    readonly element: HTMLElement;
    update?(): void;
    destroy?(): void;
}

/** Capabilities supplied to a toolbar item factory. */
export interface ToolbarItemContext {
    readonly document: Document;
    readonly editor: Editor;
    readonly ui: EditorUi;
}

/** Creates one toolbar item for one attached editor UI. */
export type ToolbarItemFactory = (
    context: ToolbarItemContext,
) => ToolbarItemInstance;

/** A host-scoped keyboard chord that invokes a shared editor command. */
export interface KeyboardShortcutDefinition {
    readonly id: string;
    readonly chord: string;
    readonly command: string;
    readonly args?: readonly unknown[];
}

/** Severity used to style an accessible transient notification. */
export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';

/** Options for one transient plain-text notification. */
export interface NotificationOptions {
    readonly message: string;
    readonly severity?: NotificationSeverity;
    readonly duration?: number;
}

/** Handle shared by dismissible UI overlays. */
export interface DismissibleUiHandle {
    readonly element: HTMLElement;
    close(): void;
}

/** Accessible notification capability. */
export interface NotificationService {
    show(options: NotificationOptions): DismissibleUiHandle;
}

/** Plain text, a caller-owned node, or a safe DOM construction callback. */
export type UiContent = string | Node | ((container: HTMLElement) => void);

/** One native dialog footer action. */
export interface DialogAction {
    readonly label: string;
    readonly kind?: 'default' | 'primary';
    run(handle: DialogHandle): unknown | PromiseLike<unknown>;
}

/** Options for a modal editor dialog. */
export interface DialogOptions {
    readonly title: string;
    readonly content?: UiContent;
    readonly actions?: readonly DialogAction[];
}

/** Handle for one open modal dialog. */
export interface DialogHandle extends DismissibleUiHandle {
    readonly element: HTMLDialogElement;
}

/** Modal dialog capability. */
export interface DialogService {
    open(options: DialogOptions): DialogHandle;
}

/** Options for a simple anchored floating surface. */
export interface BalloonOptions {
    readonly anchor: Element;
    readonly content: UiContent;
}

/** Anchored floating-surface capability. */
export interface BalloonService {
    show(options: BalloonOptions): DismissibleUiHandle;
}

/** Public capabilities of one attached editor UI. */
export interface EditorUi {
    readonly balloons: BalloonService;
    readonly dialogs: DialogService;
    readonly element: HTMLElement;
    readonly notifications: NotificationService;
    readonly toolbarElement: HTMLElement;
    readonly theme: EditorUiTheme;
    destroy(): void;
    /** Restores the latest selection captured inside an owned editing surface. */
    restoreEditingSelection(): boolean;
    setStatus(message?: string): void;
    setTheme(theme: EditorUiTheme): void;
}

/** Options used to attach a reusable UI to one host. */
export interface CreateEditorUiOptions {
    readonly editor: Editor;
    readonly element: HTMLElement;
    readonly theme?: EditorUiTheme;
    readonly toolbar?: ToolbarConfiguration;
}

/** Per-editor UI contribution registry exposed to plugins. */
export interface UiRegistryService {
    registerShortcut(definition: KeyboardShortcutDefinition): () => void;
    registerToolbarItem(id: string, factory: ToolbarItemFactory): () => void;
}
