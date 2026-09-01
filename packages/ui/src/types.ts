import type { Editor } from '@soeditor/core';

/** Ordered toolbar item IDs with `|` group separators. */
export type ToolbarConfiguration = readonly (string | '|')[];

/** Responsive layout policy for one editor toolbar. */
export interface ToolbarLayoutOptions {
    readonly collapsible?: boolean;
    readonly overflow?: 'scroll' | 'wrap';
    readonly sticky?: boolean;
}

/** Light, dark, or operating-system-derived editor chrome. */
export type EditorUiTheme = 'auto' | 'light' | 'dark';

/** Supported host-scoped editor-chrome design tokens. */
export type EditorUiThemeVariable =
    | 'accent'
    | 'accentContrast'
    | 'background'
    | 'border'
    | 'controlSize'
    | 'danger'
    | 'focusRing'
    | 'muted'
    | 'panelBackground'
    | 'radius'
    | 'text';

/** Per-editor chrome values; these never become document content. */
export type EditorUiThemeVariables = Readonly<
    Partial<Record<EditorUiThemeVariable, string>>
>;

/** Per-editor plain-text icon replacements keyed by a stable icon ID. */
export type EditorUiIconResource = Readonly<Record<string, string>>;

/** Logical direction used by one editor chrome without affecting content. */
export type EditorUiDirection = 'ltr' | 'rtl';

/** One immutable per-locale editor-chrome message resource. */
export interface EditorUiTranslationResource {
    readonly direction?: EditorUiDirection;
    readonly locale: string;
    readonly messages: Readonly<Record<string, string>>;
}

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

/** One mounted status contribution owned by its factory. */
export interface StatusItemInstance {
    readonly element: HTMLElement;
    update?(): void;
    destroy?(): void;
}

/** Creates one status item for one attached editor UI. */
export type StatusItemFactory = (
    context: ToolbarItemContext,
) => StatusItemInstance;

/** Context passed to a registered context-menu contribution. */
export interface ContextMenuItemContext extends ToolbarItemContext {
    readonly target: Element;
}

/** One command-backed item contributed to the editor context menu. */
export interface ContextMenuItemDefinition {
    readonly args?: readonly unknown[];
    readonly command: string;
    /** Groups adjacent commands with a visual separator. */
    readonly group?: string;
    readonly label: string;
    /** Gives destructive actions an explicit warning treatment. */
    readonly tone?: 'default' | 'danger';
    readonly when?: (context: ContextMenuItemContext) => boolean;
}

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
    readonly kind?: 'danger' | 'default' | 'primary';
    run(handle: DialogHandle): unknown | PromiseLike<unknown>;
}

/** Options for a modal editor dialog. */
export interface DialogOptions {
    readonly title: string;
    readonly content?: UiContent;
    readonly actions?: readonly DialogAction[];
    /** Connected control that receives focus when the dialog closes. */
    readonly returnFocus?: HTMLElement;
}

/** Handle for one open modal dialog. */
export interface DialogHandle extends DismissibleUiHandle {
    readonly element: HTMLDialogElement;
}

/** Modal dialog capability. */
export interface DialogService {
    open(options: DialogOptions): DialogHandle;
}

/** Options for one docked editor panel. */
export interface PanelOptions {
    readonly content?: UiContent;
    readonly title: string;
}

/** Handle for the currently docked editor panel. */
export type PanelHandle = DismissibleUiHandle;

/** Generic single-panel capability owned by one editor UI. */
export interface PanelService {
    show(options: PanelOptions): PanelHandle;
}

/** Options for a simple anchored floating surface. */
export interface BalloonOptions {
    readonly anchor: Element;
    readonly content: UiContent;
    /** Preferred side; automatically flips when that side is clipped. */
    readonly placement?: 'above' | 'below';
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
    readonly direction: EditorUiDirection;
    readonly locale: string;
    readonly notifications: NotificationService;
    readonly panels: PanelService;
    readonly statusElement: HTMLElement;
    readonly toolbarElement: HTMLElement;
    readonly toolbarExpanded: boolean;
    readonly theme: EditorUiTheme;
    readonly destroyed: boolean;
    destroy(): void;
    /** Resolves a plain-text icon without parsing markup. */
    icon(id: string, fallback: string): string;
    /** Replaces an element's contents with a safe, decorative SVG icon. */
    setIcon(element: HTMLElement, id: string, fallback: string): void;
    /** Re-evaluates mounted toolbar items and the status projection. */
    refresh(): void;
    /** Reads plain text from the latest selection captured in an editing surface. */
    getEditingSelectionText(): string;
    /** Restores the latest selection captured inside an owned editing surface. */
    restoreEditingSelection(): boolean;
    setToolbarExpanded(expanded: boolean): void;
    setStatus(message?: string): void;
    setTheme(theme: EditorUiTheme): void;
    setThemeVariables(variables?: EditorUiThemeVariables): void;
    translate(message: string): string;
}

/** Options used to attach a reusable UI to one host. */
export interface CreateEditorUiOptions {
    readonly accessibilityHelp?: boolean;
    readonly editor: Editor;
    readonly direction?: EditorUiDirection;
    readonly element: HTMLElement;
    readonly icons?: EditorUiIconResource;
    readonly theme?: EditorUiTheme;
    readonly themeVariables?: EditorUiThemeVariables;
    readonly locale?: string;
    readonly translations?: readonly EditorUiTranslationResource[];
    readonly toolbar?: ToolbarConfiguration;
    readonly toolbarLayout?: ToolbarLayoutOptions;
    /** Adds canonical element-path and text-count projections to the status. */
    readonly documentStatus?: boolean;
}

/** Per-editor UI contribution registry exposed to plugins. */
export interface UiRegistryService {
    registerContextMenuItem(
        id: string,
        definition: ContextMenuItemDefinition,
    ): () => void;
    registerShortcut(definition: KeyboardShortcutDefinition): () => void;
    registerStatusItem(id: string, factory: StatusItemFactory): () => void;
    registerToolbarItem(id: string, factory: ToolbarItemFactory): () => void;
}
