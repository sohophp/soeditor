import {
    Editor,
    type EditorConfig,
    type PluginConstructor,
    type TransactionOrigin,
} from '@soeditor/core';
import { pastePipelineServiceToken } from '@soeditor/engine';
import type { HtmlFormattingOptions } from '@soeditor/html-tools';
import type { PreviewConfiguration } from '@soeditor/preview';
import {
    createWysiwygEditingEngine,
    setWysiwygContentStylePreset,
    type WysiwygContentStylePreset,
} from '@soeditor/wysiwyg';

import wysiwygContentStyles from './wysiwyg-content.css?inline';
import type { EditorPreset } from '@soeditor/presets';
import {
    projectionCoordinatorServiceToken,
    type ProjectionId,
} from '@soeditor/projections';
import {
    createEditorUi,
    type EditorUi,
    type EditorUiDirection,
    type EditorUiIconResource,
    type EditorUiTheme,
    type EditorUiThemeVariables,
    type EditorUiTranslationResource,
    type ToolbarConfiguration,
    type ToolbarLayoutOptions,
    type UiRegistryService,
    uiRegistryServiceToken,
    resolveUiTranslation,
} from '@soeditor/ui';
import {
    createEditorWorkspace,
    type EditorSaveAdapter,
    type EditorSaveResult,
    type EditorSaveState,
    type EditorSaveWorkflow,
    type EditorWorkspace,
} from '@soeditor/workspace';
import {
    ClassicEditorAlreadyAttachedError,
    ClassicEditorDestroyedError,
} from './classic-editor-errors.js';
import type { ClassicPreviewWindow } from '@soeditor/preview';

const attachedHosts = new WeakMap<HTMLElement, ClassicEditor>();
const maximizedDocuments = new WeakMap<
    Document,
    { readonly owners: Set<object>; readonly previousOverflow: string }
>();
const protectedWindows = new WeakMap<
    Window,
    {
        readonly listener: (event: BeforeUnloadEvent) => void;
        readonly owners: Set<() => boolean>;
    }
>();
const EMPTY_HTML = /^(?:\s*|<p(?:\s[^>]*)?>\s*(?:<br\s*\/?>)?\s*<\/p>)$/iu;
const OPTIONAL_CLASSIC_FEATURES =
    import.meta.env.SOEDITOR_OPTIONAL_CLASSIC !== 'false';
const CLASSIC_TABLE_CONTEXT =
    import.meta.env.SOEDITOR_TABLE_CONTEXT !== 'false';
const HIDDEN_CLASSIC_TOOLBAR_ITEMS = new Set([
    'pageBreak',
    'placeholder',
    'redo',
    'source',
    'sourceFind',
    'specialCharacter',
    'undo',
]);
const CLASSIC_TRANSLATIONS: readonly EditorUiTranslationResource[] =
    OPTIONAL_CLASSIC_FEATURES
        ? [
              {
                  locale: 'zh-CN',
                  messages: {
                      'Preview in new window': '在新窗口中预览',
                      'Preview template': '预览模板',
                      'Web page': '网页',
                      'Email newsletter': 'Email 电子报',
                      'Email newsletter preview': 'Email 电子报预览',
                      'Word document': 'Word 文档',
                      'Word document preview': 'Word 文档预览',
                      'The preview window was blocked by the browser.':
                          '浏览器阻止了预览窗口。',
                      'Resize WYSIWYG and Source height':
                          '调整所见即所得与源码高度',
                      'Resize WYSIWYG and Source width':
                          '调整所见即所得与源码宽度',
                      'WYSIWYG + Source (side by side)':
                          '所见即所得 + 源码（左右）',
                      'WYSIWYG + Source (stacked)': '所见即所得 + 源码（上下）',
                  },
              },
              {
                  locale: 'zh-TW',
                  messages: {
                      'Preview in new window': '在新視窗中預覽',
                      'Preview template': '預覽範本',
                      'Web page': '網頁',
                      'Email newsletter': 'Email 電子報',
                      'Email newsletter preview': 'Email 電子報預覽',
                      'Word document': 'Word 文件',
                      'Word document preview': 'Word 文件預覽',
                      'The preview window was blocked by the browser.':
                          '瀏覽器阻止了預覽視窗。',
                      'Resize WYSIWYG and Source height':
                          '調整所見即所得與原始碼高度',
                      'Resize WYSIWYG and Source width':
                          '調整所見即所得與原始碼寬度',
                      'WYSIWYG + Source (side by side)':
                          '所見即所得 + 原始碼（左右）',
                      'WYSIWYG + Source (stacked)':
                          '所見即所得 + 原始碼（上下）',
                  },
              },
          ]
        : [];

/** One canonical document change observed by a classic host. */
export interface ClassicEditorChange {
    readonly origin: TransactionOrigin;
    readonly previousSource: string;
    readonly source: string;
}

/** Optional host-owned persistence configuration for one classic editor. */
export interface ClassicEditorSaveOptions {
    readonly adapter: EditorSaveAdapter;
    readonly autoSaveDelay?: number;
    readonly initialRevisionToken?: string;
    readonly leavePageProtection?: boolean;
    readonly onStateChange?: (state: EditorSaveState) => void;
}

/** Optional automatic formatting for the Classic HTML Source projection. */
export interface ClassicSourceOptions {
    /** Formats canonical HTML after debounced WYSIWYG-originated changes. */
    readonly autoFormat?: boolean;
    /** Idle delay before automatic formatting. Defaults to 300 milliseconds. */
    readonly autoFormatDelay?: number;
    readonly formatting?: HtmlFormattingOptions;
}

/** Optional isolated preview rendered in a reusable browser window. */
export interface ClassicPreviewOptions extends PreviewConfiguration {
    /** Template selected when the preview window first opens. */
    readonly initialTemplateId?: string;
    /** Additional application-owned preview templates. */
    readonly templates?: readonly ClassicPreviewTemplate[];
    /** Features passed to window.open for the per-instance preview window. */
    readonly windowFeatures?: string;
    /** Includes the active WYSIWYG stylesheet before configured preview CSS. */
    readonly wysiwygStyles?: boolean;
}

/** One application-owned choice shown beside the built-in preview templates. */
export interface ClassicPreviewTemplate extends PreviewConfiguration {
    readonly id: string;
    readonly label: string;
    readonly wysiwygStyles?: boolean;
}

/** Options for the complete textarea/element-hosted classic editor. */
export interface CreateClassicEditorOptions {
    readonly ariaLabel?: string;
    readonly autoGrow?: boolean;
    readonly config?: EditorConfig;
    readonly cspNonce?: string;
    /** Content presentation independent from the host page stylesheet. */
    readonly contentStylePreset?: WysiwygContentStylePreset;
    /** Trusted custom CSS used when `contentStylePreset` is `custom`. */
    readonly contentStyles?: string;
    readonly data?: string;
    /** Editing projections mounted for this instance. */
    readonly editingModes?: readonly ClassicEditingMode[];
    /** Editing projection activated after startup. */
    readonly initialEditingMode?: ClassicEditingMode;
    readonly initialHeight?: number;
    readonly icons?: EditorUiIconResource;
    readonly direction?: EditorUiDirection;
    readonly locale?: string;
    readonly maxHeight?: number;
    readonly minHeight?: number;
    readonly maximizable?: boolean;
    readonly onBlur?: (editor: ClassicEditor) => void;
    readonly onChange?: (change: ClassicEditorChange) => void;
    readonly onError?: (error: unknown) => void;
    readonly onFocus?: (editor: ClassicEditor) => void;
    readonly onReady?: (editor: ClassicEditor) => void;
    readonly placeholder?: string;
    readonly plugins?: readonly PluginConstructor[];
    /** Enables a per-instance popup preview. */
    readonly preview?: boolean | ClassicPreviewOptions;
    readonly preset?: EditorPreset;
    readonly readonly?: boolean;
    readonly resizable?: boolean;
    readonly save?: ClassicEditorSaveOptions;
    readonly source?: ClassicSourceOptions;
    readonly theme?: EditorUiTheme;
    readonly themeVariables?: EditorUiThemeVariables;
    readonly toolbar?: ToolbarConfiguration;
    readonly toolbarLayout?: ToolbarLayoutOptions;
    readonly translations?: readonly EditorUiTranslationResource[];
}

/** Configurable authoring projections available to a Classic instance. */
export type ClassicEditingMode = 'wysiwyg' | 'source';

/** Complete classic editor handle returned to CMS integrations. */
export interface ClassicEditor {
    readonly destroyed: boolean;
    readonly editor: Editor;
    readonly element: HTMLElement;
    readonly host: HTMLElement;
    readonly contentStylePreset: WysiwygContentStylePreset;
    readonly maximized: boolean;
    readonly saveWorkflow: EditorSaveWorkflow | undefined;
    destroy(): Promise<void>;
    focus(): void;
    getData(): string;
    maximize(maximized?: boolean): void;
    openPreview(): boolean;
    setWorkspaceView(view: ClassicWorkspaceView): void;
    retrySave(): Promise<EditorSaveResult>;
    save(): Promise<EditorSaveResult>;
    setData(source: string): void;
    setContentStylePreset(preset: WysiwygContentStylePreset): void;
    setReadonly(readonly: boolean): void;
}

/** Built-in Classic projection arrangements. */
export type ClassicWorkspaceView =
    | 'single'
    | 'wysiwyg'
    | 'source'
    | 'wysiwyg-source-horizontal'
    | 'wysiwyg-source-vertical';

interface ClassicDom {
    readonly paneResizeHandle?: HTMLDivElement;
    readonly resizeHandle?: HTMLDivElement;
    readonly root: HTMLDivElement;
    readonly source: HTMLDivElement;
    readonly surfaces: HTMLDivElement;
    readonly visual: HTMLDivElement;
    readonly visualContent: HTMLDivElement;
    readonly visualShadow: ShadowRoot;
}

interface Heights {
    readonly autoGrow: boolean;
    readonly initial?: number;
    readonly maximum?: number;
    readonly minimum?: number;
}

/** Mounts one complete classic HTML editor on a textarea or ordinary element. */
export async function createClassicEditor(
    host: HTMLElement,
    options: CreateClassicEditorOptions = {},
): Promise<ClassicEditor> {
    validateHost(host);
    if (attachedHosts.has(host)) {
        throw new ClassicEditorAlreadyAttachedError();
    }
    validateCallbacks(options);
    validateClassicSaveOptions(options.save);
    if (OPTIONAL_CLASSIC_FEATURES) validateClassicSourceOptions(options.source);
    const previewOptions = OPTIONAL_CLASSIC_FEATURES
        ? readClassicPreviewOptions(options.preview)
        : undefined;
    if (options.preset === undefined) {
        throw new TypeError('Classic editor requires a CMS preset.');
    }
    const preset = readPreset(options.preset);
    const placeholder = optionalNonEmptyString(
        options.placeholder,
        'placeholder',
    );
    const locale = optionalNonEmptyString(options.locale, 'locale') ?? 'en';
    const translations = [
        ...CLASSIC_TRANSLATIONS,
        ...(options.translations ?? []),
    ];
    const translation = resolveUiTranslation(
        locale,
        translations,
        options.direction,
    );
    const ariaLabel =
        optionalNonEmptyString(options.ariaLabel, 'ariaLabel') ??
        hostAriaLabel(host, translation.translate);
    const heights = readHeights(options);
    const maximizable = optionalBoolean(
        options.maximizable,
        'maximizable',
        true,
    );
    const resizable = optionalBoolean(options.resizable, 'resizable', true);
    const editingModes = OPTIONAL_CLASSIC_FEATURES
        ? readEditingModes(options.editingModes)
        : new Set<ClassicEditingMode>(['wysiwyg']);
    const sourceModule =
        OPTIONAL_CLASSIC_FEATURES && editingModes.has('source')
            ? await import('@soeditor/source')
            : undefined;
    const htmlToolsModule =
        OPTIONAL_CLASSIC_FEATURES && editingModes.has('source')
            ? await import('@soeditor/html-tools')
            : undefined;
    const previewWindowModule =
        !OPTIONAL_CLASSIC_FEATURES || previewOptions === undefined
            ? undefined
            : await import('@soeditor/preview');
    const configuredPlugins = options.plugins ?? preset.plugins;
    const sourcePlugins: readonly PluginConstructor[] = [
        ...(sourceModule === undefined
            ? []
            : [sourceModule.SourceEditingPlugin]),
        ...(htmlToolsModule === undefined
            ? []
            : [
                  htmlToolsModule.DiagnosticsPlugin,
                  htmlToolsModule.HtmlFormattingPlugin,
              ]),
    ];
    const plugins = sourcePlugins.reduce<readonly PluginConstructor[]>(
        (current, plugin) =>
            current.some((candidate) => candidate.id === plugin.id)
                ? current
                : [...current, plugin],
        configuredPlugins,
    );
    const initialEditingMode = readInitialEditingMode(
        options.initialEditingMode,
        editingModes,
    );
    let workspaceView: ClassicWorkspaceView = initialEditingMode;
    let paneRatio = 50;
    const document = host.ownerDocument;
    const dom = createDom(
        document,
        ariaLabel,
        placeholder,
        heights,
        resizable,
        editingModes,
        options.cspNonce,
    );
    let contentStylePreset = options.contentStylePreset ?? 'browser';
    setWysiwygContentStylePreset(dom.visualContent, contentStylePreset);
    setWysiwygContentStylePreset(dom.visual, contentStylePreset);
    const customContentStyle = createCustomContentStyle(
        dom.visualShadow,
        dom.visualContent,
        options.contentStyles,
        options.cspNonce,
    );
    const previousHidden = host.hidden;
    const textarea = isTextArea(host) ? host : undefined;
    const originalTextareaValue = textarea?.value;
    const form = textarea?.form ?? undefined;
    let destroyed = false;
    let destroying: Promise<void> | undefined;
    let initialized = false;
    let latestSource = initialSource(host, options.data);
    let animationFrame: number | undefined;
    let workspace: EditorWorkspace | undefined;
    let coreEditor: Editor | undefined;
    let disposeEditorDestroy: (() => void) | undefined;
    let focusWithin = false;
    let maximized = false;
    const maximizeOwner = Object.freeze({});
    let ui: EditorUi | undefined;
    let saveWorkflow: EditorSaveWorkflow | undefined;
    let disposeLeaveProtection: (() => void) | undefined;
    let disposeTableContext: (() => void) | undefined;
    let disposeLinkContext: (() => void) | undefined;
    let disposeImageContext: (() => void) | undefined;
    let disposePasteDiagnostics: (() => void) | undefined;
    let disposeEditingFeedback: (() => void) | undefined;
    let disposeModeChrome: (() => void) | undefined;
    let disposeProjectionChrome: (() => void) | undefined;
    let refreshWorkspaceChrome = (): void => undefined;
    let disposeSourceEnhancements: (() => void) | undefined;
    let previewWindow: ClassicPreviewWindow | undefined;
    let manualHeight = false;
    let resizeStart:
        { readonly height: number; readonly y: number } | undefined;
    let paneResizeStart = false;

    host.after(dom.root);
    host.hidden = true;

    const updateHost = (source: string): void => {
        latestSource = source;
        dom.visualContent.dataset.soeditorEmpty = String(
            EMPTY_HTML.test(source),
        );
        if (textarea !== undefined) textarea.value = source;
        scheduleAutoGrow();
    };
    const reportError = (error: unknown): unknown | undefined => {
        try {
            options.onError?.(error);
            return undefined;
        } catch (callbackError: unknown) {
            return callbackError;
        }
    };
    const onFocusIn = (): void => {
        if (focusWithin || destroyed) return;
        focusWithin = true;
        options.onFocus?.(publicApi());
    };
    const onFocusOut = (event: FocusEvent): void => {
        const next = event.relatedTarget;
        if (next instanceof Node && dom.root.contains(next)) return;
        if (!focusWithin || destroyed) return;
        focusWithin = false;
        options.onBlur?.(publicApi());
    };
    const onSubmit = (): void => {
        if (textarea !== undefined && coreEditor !== undefined) {
            textarea.value = coreEditor.getData();
        }
    };
    const onReset = (event: Event): void => {
        const view = document.defaultView;
        view?.setTimeout(() => {
            if (
                event.defaultPrevented ||
                destroyed ||
                textarea === undefined ||
                coreEditor === undefined
            ) {
                return;
            }
            coreEditor.setData(textarea.value);
            coreEditor.markClean();
        }, 0);
    };
    dom.root.addEventListener('focusin', onFocusIn);
    dom.root.addEventListener('focusout', onFocusOut);
    form?.addEventListener('submit', onSubmit, true);
    form?.addEventListener('reset', onReset);
    const resizeHandle = dom.resizeHandle;
    const resizeSurface = (height: number): void => {
        const minimum = heights.minimum ?? 80;
        const maximum = heights.maximum ?? 100_000;
        const bounded = Math.min(Math.max(height, minimum), maximum);
        manualHeight = true;
        dom.visual.style.height = `${String(bounded)}px`;
        dom.source.style.height = `${String(bounded)}px`;
        if (classicSplitOrientation(workspaceView) !== undefined) {
            dom.surfaces.style.height = `${String(bounded)}px`;
        }
        resizeHandle?.setAttribute(
            'aria-valuenow',
            String(Math.round(bounded)),
        );
    };
    const onResizeMove = (event: PointerEvent): void => {
        if (resizeStart === undefined || maximized) return;
        resizeSurface(resizeStart.height + event.clientY - resizeStart.y);
    };
    const onResizeEnd = (): void => {
        resizeStart = undefined;
        document.removeEventListener('pointermove', onResizeMove);
        document.removeEventListener('pointerup', onResizeEnd);
        document.removeEventListener('pointercancel', onResizeEnd);
    };
    const onResizeStart = (event: PointerEvent): void => {
        if (maximized || event.button !== 0) return;
        event.preventDefault();
        resizeStart = {
            height: dom.visual.getBoundingClientRect().height,
            y: event.clientY,
        };
        document.addEventListener('pointermove', onResizeMove);
        document.addEventListener('pointerup', onResizeEnd);
        document.addEventListener('pointercancel', onResizeEnd);
    };
    const onResizeKeydown = (event: KeyboardEvent): void => {
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
        event.preventDefault();
        const step = event.shiftKey ? 50 : 10;
        resizeSurface(
            dom.visual.getBoundingClientRect().height +
                (event.key === 'ArrowDown' ? step : -step),
        );
    };
    resizeHandle?.addEventListener('pointerdown', onResizeStart);
    resizeHandle?.addEventListener('keydown', onResizeKeydown);
    const paneResizeHandle = dom.paneResizeHandle;
    const setPaneRatio = (ratio: number): void => {
        paneRatio = Math.max(20, Math.min(80, Math.round(ratio)));
        dom.surfaces.style.setProperty(
            '--soeditor-classic-pane-ratio',
            `${String(paneRatio)}%`,
        );
        dom.surfaces.style.setProperty(
            '--soeditor-classic-pane-inverse-ratio',
            `${String(100 - paneRatio)}%`,
        );
        paneResizeHandle?.setAttribute('aria-valuenow', String(paneRatio));
    };
    const onPaneResizeMove = (event: PointerEvent): void => {
        const orientation = classicSplitOrientation(workspaceView);
        if (!paneResizeStart || orientation === undefined) return;
        const rectangle = dom.surfaces.getBoundingClientRect();
        const size =
            orientation === 'horizontal' ? rectangle.width : rectangle.height;
        if (size <= 0) return;
        const offset =
            orientation === 'horizontal'
                ? event.clientX - rectangle.left
                : event.clientY - rectangle.top;
        setPaneRatio((offset / size) * 100);
    };
    const onPaneResizeEnd = (): void => {
        paneResizeStart = false;
        document.removeEventListener('pointermove', onPaneResizeMove);
        document.removeEventListener('pointerup', onPaneResizeEnd);
        document.removeEventListener('pointercancel', onPaneResizeEnd);
    };
    const onPaneResizeStart = (event: PointerEvent): void => {
        if (
            event.button !== 0 ||
            classicSplitOrientation(workspaceView) === undefined
        ) {
            return;
        }
        event.preventDefault();
        paneResizeStart = true;
        document.addEventListener('pointermove', onPaneResizeMove);
        document.addEventListener('pointerup', onPaneResizeEnd);
        document.addEventListener('pointercancel', onPaneResizeEnd);
    };
    const onPaneResizeKeydown = (event: KeyboardEvent): void => {
        const orientation = classicSplitOrientation(workspaceView);
        if (orientation === undefined) return;
        const decrease = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
        const increase =
            event.key === 'ArrowRight' || event.key === 'ArrowDown';
        const next =
            event.key === 'Home'
                ? 20
                : event.key === 'End'
                  ? 80
                  : decrease
                    ? paneRatio - (event.shiftKey ? 10 : 5)
                    : increase
                      ? paneRatio + (event.shiftKey ? 10 : 5)
                      : undefined;
        if (next === undefined) return;
        event.preventDefault();
        setPaneRatio(next);
    };
    paneResizeHandle?.addEventListener('pointerdown', onPaneResizeStart);
    paneResizeHandle?.addEventListener('keydown', onPaneResizeKeydown);
    setPaneRatio(paneRatio);
    updateHost(latestSource);

    const publicValue: ClassicEditor = Object.freeze({
        get destroyed() {
            return destroyed;
        },
        get editor() {
            return requireEditor();
        },
        element: dom.root,
        host,
        get contentStylePreset() {
            return contentStylePreset;
        },
        get maximized() {
            return maximized;
        },
        get saveWorkflow() {
            return saveWorkflow;
        },
        destroy: () => destroy(),
        focus: () => {
            assertAlive();
            const primary = requireEditor().services.get(
                projectionCoordinatorServiceToken,
            ).snapshot.primary;
            const surface =
                primary === 'source' ? dom.source : dom.visualContent;
            const focusTarget = surface.querySelector<HTMLElement>(
                '[contenteditable="true"], textarea, input',
            );
            (focusTarget ?? surface).focus();
        },
        getData: () => coreEditor?.getData() ?? latestSource,
        maximize: (value = !maximized) => {
            assertAlive();
            if (!maximizable && value) {
                throw new TypeError('This classic editor is not maximizable.');
            }
            setMaximized(value);
        },
        openPreview: () => {
            assertAlive();
            if (previewWindow === undefined) {
                throw new Error('Classic popup preview is not enabled.');
            }
            return previewWindow.open();
        },
        setWorkspaceView: (view: ClassicWorkspaceView) => {
            assertAlive();
            requireEditor().execute('classic.workspace.set', view);
        },
        retrySave: () => requireSaveWorkflow().retry(),
        save: () => requireSaveWorkflow().save(),
        setData: (source: string) => {
            assertAlive();
            requireString(source, 'Classic editor data');
            const editor = requireEditor();
            editor.setData(source);
            updateHost(editor.getData());
        },
        setContentStylePreset: (preset: WysiwygContentStylePreset) => {
            assertAlive();
            setWysiwygContentStylePreset(dom.visualContent, preset);
            setWysiwygContentStylePreset(dom.visual, preset);
            contentStylePreset = preset;
        },
        setReadonly: (readonly: boolean) => {
            assertAlive();
            requireEditor().setReadonly(readonly);
        },
    });

    function publicApi(): ClassicEditor {
        return publicValue;
    }

    function requireEditor(): Editor {
        if (coreEditor === undefined) {
            throw new Error(
                'The classic editor has not finished initializing.',
            );
        }
        return coreEditor;
    }

    function requireSaveWorkflow(): EditorSaveWorkflow {
        assertAlive();
        if (saveWorkflow === undefined) {
            throw new Error(
                'This classic editor has no configured save adapter.',
            );
        }
        return saveWorkflow;
    }

    function assertAlive(): void {
        if (destroyed || destroying !== undefined) {
            throw new ClassicEditorDestroyedError();
        }
    }

    function scheduleAutoGrow(): void {
        if (!heights.autoGrow || manualHeight || animationFrame !== undefined)
            return;
        const view = document.defaultView;
        if (view === null) return;
        animationFrame = view.requestAnimationFrame(() => {
            animationFrame = undefined;
            if (destroyed) return;
            const contentHeight = dom.visualContent.scrollHeight;
            const minimum = heights.minimum ?? heights.initial ?? 0;
            const maximum = heights.maximum ?? Number.POSITIVE_INFINITY;
            const height = Math.min(Math.max(contentHeight, minimum), maximum);
            if (height > 0 && Number.isFinite(height)) {
                dom.visual.style.height = `${String(height)}px`;
                dom.source.style.height = `${String(height)}px`;
            }
        });
    }

    function setMaximized(value: boolean): void {
        if (maximized === value) return;
        maximized = value;
        dom.root.classList.toggle('is-maximized', value);
        const button = dom.root.querySelector<HTMLButtonElement>(
            '[data-classic-action="maximize"]',
        );
        button?.setAttribute('aria-pressed', String(value));
        if (button !== null) {
            const label =
                ui?.translate(value ? 'Restore' : 'Maximize') ??
                (value ? 'Restore' : 'Maximize');
            if (ui === undefined) {
                button.textContent = label;
            } else {
                ui.setIcon(
                    button,
                    value ? 'editor.maximize.restore' : 'editor.maximize',
                    label,
                );
            }
            button.title =
                ui?.translate(
                    value ? 'Restore editor size' : 'Maximize editor',
                ) ?? (value ? 'Restore editor size' : 'Maximize editor');
            button.setAttribute(
                'aria-label',
                ui?.translate(
                    value ? 'Restore editor size' : 'Maximize editor',
                ) ?? (value ? 'Restore editor size' : 'Maximize editor'),
            );
        }
        if (value) {
            enterMaximizedDocument(document, maximizeOwner);
        } else {
            leaveMaximizedDocument(document, maximizeOwner);
        }
    }

    function setWorkspaceView(view: ClassicWorkspaceView): void {
        const editor = requireEditor();
        const coordinator = editor.services.get(
            projectionCoordinatorServiceToken,
        );
        const orientation = classicSplitOrientation(view);
        if (orientation !== undefined) {
            for (const id of ['wysiwyg', 'source'] as const) {
                if (!editingModes.has(id) || !coordinator.isAttached(id)) {
                    throw new Error(
                        `Classic workspace view "${view}" requires disabled editing mode "${id}".`,
                    );
                }
            }
            if (classicSplitOrientation(workspaceView) === undefined) {
                const current =
                    coordinator.snapshot.primary === 'source'
                        ? dom.source
                        : dom.visual;
                const height = current.getBoundingClientRect().height;
                if (height > 0) {
                    dom.surfaces.style.height = `${String(height)}px`;
                }
            }
            workspaceView = view;
            for (const id of ['wysiwyg', 'source'] as const) {
                if (!coordinator.get(id).visible) {
                    editor.execute('projection.show', id);
                }
            }
            applyClassicWorkspaceLayout();
            refreshWorkspaceChrome();
            return;
        }
        const target =
            view === 'single'
                ? coordinator.snapshot.primary
                : view === 'wysiwyg' || view === 'source'
                  ? view
                  : undefined;
        if (target === undefined) {
            throw new TypeError(`Unknown Classic workspace view "${view}".`);
        }
        if (!isClassicEditingMode(target) || !editingModes.has(target)) {
            throw new Error(
                `Classic workspace view "${view}" requires disabled editing mode "${target}".`,
            );
        }
        if (!coordinator.isAttached(target)) {
            throw new Error(
                `Classic workspace view "${view}" is not attached.`,
            );
        }
        if (!coordinator.get(target).visible) {
            editor.execute('projection.show', target);
        }
        workspaceView = target;
        editor.execute('projection.activate', target);
        for (const id of ['wysiwyg', 'source'] as const) {
            if (!coordinator.isAttached(id)) continue;
            const activity = coordinator.get(id);
            if (id !== target && activity.visible) {
                editor.execute('projection.hide', id);
            }
        }
        applyClassicWorkspaceLayout();
        refreshWorkspaceChrome();
    }

    function applyClassicWorkspaceLayout(): void {
        const orientation = classicSplitOrientation(workspaceView);
        const handle = dom.paneResizeHandle;
        if (orientation === undefined) {
            delete dom.surfaces.dataset.orientation;
            delete dom.root.dataset.soeditorSplitOrientation;
            dom.surfaces.style.removeProperty('height');
            if (handle !== undefined) handle.hidden = true;
            return;
        }
        dom.surfaces.dataset.orientation = orientation;
        dom.root.dataset.soeditorSplitOrientation = orientation;
        if (handle !== undefined) {
            handle.hidden = false;
            handle.setAttribute(
                'aria-orientation',
                orientation === 'horizontal' ? 'vertical' : 'horizontal',
            );
            const dimension = orientation === 'horizontal' ? 'width' : 'height';
            handle.setAttribute(
                'aria-label',
                ui?.translate(`Resize WYSIWYG and Source ${dimension}`) ??
                    `Resize WYSIWYG and Source ${dimension}`,
            );
        }
        setPaneRatio(paneRatio);
    }

    async function destroy(): Promise<void> {
        if (destroying !== undefined) return destroying;
        const operation = performDestroy();
        destroying = operation;
        return operation;
    }

    async function performDestroy(): Promise<void> {
        const errors: unknown[] = [];
        try {
            latestSource = coreEditor?.getData() ?? latestSource;
            if (textarea !== undefined) {
                textarea.value = initialized
                    ? latestSource
                    : (originalTextareaValue ?? '');
            }
            saveWorkflow?.destroy();
            saveWorkflow = undefined;
            disposeLeaveProtection?.();
            disposeLeaveProtection = undefined;
            disposeTableContext?.();
            disposeTableContext = undefined;
            disposeLinkContext?.();
            disposeLinkContext = undefined;
            disposeImageContext?.();
            disposeImageContext = undefined;
            disposePasteDiagnostics?.();
            disposePasteDiagnostics = undefined;
            disposeEditingFeedback?.();
            disposeEditingFeedback = undefined;
            disposeModeChrome?.();
            disposeModeChrome = undefined;
            disposeProjectionChrome?.();
            disposeProjectionChrome = undefined;
            refreshWorkspaceChrome = () => undefined;
            disposeSourceEnhancements?.();
            disposeSourceEnhancements = undefined;
            previewWindow?.destroy();
            previewWindow = undefined;
            if (workspace !== undefined) await workspace.destroy();
        } catch (error: unknown) {
            errors.push(error);
        } finally {
            setMaximized(false);
            destroyed = true;
            disposeEditorDestroy?.();
            disposeEditorDestroy = undefined;
            const view = document.defaultView;
            if (animationFrame !== undefined && view !== null) {
                view.cancelAnimationFrame(animationFrame);
            }
            animationFrame = undefined;
            dom.root.removeEventListener('focusin', onFocusIn);
            dom.root.removeEventListener('focusout', onFocusOut);
            onResizeEnd();
            onPaneResizeEnd();
            resizeHandle?.removeEventListener('pointerdown', onResizeStart);
            resizeHandle?.removeEventListener('keydown', onResizeKeydown);
            paneResizeHandle?.removeEventListener(
                'pointerdown',
                onPaneResizeStart,
            );
            paneResizeHandle?.removeEventListener(
                'keydown',
                onPaneResizeKeydown,
            );
            form?.removeEventListener('submit', onSubmit, true);
            form?.removeEventListener('reset', onReset);
            dom.root.remove();
            customContentStyle?.remove();
            host.hidden = previousHidden;
            attachedHosts.delete(host);
        }
        if (errors.length > 0) {
            throw new AggregateError(errors, 'Classic editor cleanup failed.');
        }
    }

    attachedHosts.set(host, publicValue);
    try {
        workspace = await createEditorWorkspace({
            attachments: [
                {
                    id: 'classic.wysiwyg',
                    requirements: { formats: ['html'] as const },
                    attach: ({ editor }: { editor: Editor }) =>
                        createWysiwygEditingEngine({
                            activateOnFocus: true,
                            ariaLabel,
                            editor,
                            element: dom.visualContent,
                        }),
                },
                ...(editingModes.has('source')
                    ? [
                          {
                              id: 'classic.source',
                              requirements: { formats: ['html'] as const },
                              attach: ({ editor }: { editor: Editor }) => {
                                  if (sourceModule === undefined) {
                                      throw new Error(
                                          'HTML Source failed to load.',
                                      );
                                  }
                                  return sourceModule.createSourceEditingEngine(
                                      {
                                          activateOnFocus: true,
                                          ...(options.cspNonce === undefined
                                              ? {}
                                              : { cspNonce: options.cspNonce }),
                                          ariaLabel: `${ariaLabel} HTML source`,
                                          editor,
                                          element: dom.source,
                                      },
                                  );
                              },
                          },
                      ]
                    : []),
                {
                    id: 'classic.ui',
                    requirements: { formats: ['html'] },
                    attach: ({ editor }) => attachClassicUi(editor),
                },
            ],
            createEditor: ({ source }) =>
                Editor.create({
                    ...(options.config === undefined
                        ? {}
                        : { config: options.config }),
                    data: source,
                    format: 'html' as const,
                    plugins,
                    readonly:
                        options.readonly ??
                        (textarea?.readOnly === true ||
                            textarea?.disabled === true),
                }),
            onDiagnostic: (diagnostic) => {
                if (diagnostic.severity === 'error') {
                    const callbackError = reportError(
                        diagnostic.error ?? diagnostic.message,
                    );
                    if (callbackError !== undefined) throw callbackError;
                }
            },
            value: {
                initialValue: latestSource,
                kind: 'uncontrolled',
                onChange: (change) => {
                    updateHost(change.source);
                    options.onChange?.(Object.freeze({ ...change }));
                },
            },
        });
        coreEditor = workspace.editor;
        if (previewOptions !== undefined && previewWindowModule !== undefined) {
            const owner = document.defaultView;
            if (owner === null) {
                throw new Error('Classic popup preview requires a window.');
            }
            previewWindow = previewWindowModule.createClassicPreviewWindow({
                editor: coreEditor,
                ...(previewOptions.windowFeatures === undefined
                    ? {}
                    : { features: previewOptions.windowFeatures }),
                getTemplates: () =>
                    previewWindowModule.createClassicPreviewTemplates(
                        previewOptions,
                        contentStylePreset,
                        wysiwygContentStyles,
                        options.contentStyles,
                        translation.translate,
                    ),
                initialTemplateId:
                    previewOptions.initialTemplateId ?? 'webpage',
                owner,
                reportError: (error) => {
                    reportError(error);
                },
                templatePickerLabel: translation.translate('Preview template'),
            });
        }
        const coordinator = coreEditor.services.get(
            projectionCoordinatorServiceToken,
        );
        if (!coordinator.get(initialEditingMode).visible) {
            coreEditor.execute('projection.show', initialEditingMode);
        }
        coreEditor.execute('projection.activate', initialEditingMode);
        if (sourceModule !== undefined) {
            const sourceOptions = options.source;
            const formattingService = (() => {
                if (sourceOptions?.autoFormat !== true) return undefined;
                if (htmlToolsModule === undefined) {
                    throw new Error(
                        'Classic Source auto-format requires the "source" editing mode.',
                    );
                }
                return coreEditor.services.get(
                    htmlToolsModule.htmlFormattingServiceToken,
                );
            })();
            disposeSourceEnhancements =
                sourceModule.attachClassicSourceEnhancements({
                    document,
                    editor: coreEditor,
                    ...(formattingService === undefined
                        ? {}
                        : {
                              format: (source) =>
                                  formattingService.format(
                                      source,
                                      sourceOptions?.formatting,
                                  ),
                              formatDelay:
                                  sourceOptions?.autoFormatDelay ?? 300,
                          }),
                    isDestroyed: () => destroyed,
                    isSelectionSyncActive: () =>
                        classicSplitOrientation(workspaceView) !== undefined &&
                        coordinator.snapshot.primary === 'wysiwyg',
                    reportError: (error) => {
                        reportError(error);
                    },
                    visual: dom.visualContent,
                    visualShadow: dom.visualShadow,
                });
        }
        if (OPTIONAL_CLASSIC_FEATURES && options.save !== undefined) {
            const { createEditorSaveWorkflow } =
                await import('@soeditor/workspace');
            saveWorkflow = createEditorSaveWorkflow({
                adapter: options.save.adapter,
                ...(options.save.autoSaveDelay === undefined
                    ? {}
                    : { autoSaveDelay: options.save.autoSaveDelay }),
                editor: coreEditor,
                ...(options.save.initialRevisionToken === undefined
                    ? {}
                    : {
                          initialRevisionToken:
                              options.save.initialRevisionToken,
                      }),
                onError: (error) => {
                    reportError(error);
                },
                onStateChange: (state) => {
                    updateSaveStatus(state);
                    options.save?.onStateChange?.(state);
                },
            });
            coreEditor.commands.register({
                id: 'editor.save',
                canExecute: () =>
                    saveWorkflow?.state.dirty === true &&
                    saveWorkflow.state.status !== 'saving' &&
                    saveWorkflow.state.status !== 'destroyed',
                execute: () => {
                    const workflow = requireSaveWorkflow();
                    return workflow.state.status === 'error' ||
                        workflow.state.status === 'conflict'
                        ? workflow.retry()
                        : workflow.save();
                },
            });
            if (options.save.leavePageProtection === true) {
                const view = document.defaultView;
                if (view !== null) {
                    disposeLeaveProtection = protectWindowFromDirtyLeave(
                        view,
                        () => saveWorkflow?.state.dirty === true,
                    );
                }
            }
        }
        disposeEditorDestroy = coreEditor.events.on('editor:destroy', () => {
            if (!destroyed && destroying === undefined) {
                globalThis.queueMicrotask(
                    () => void destroy().catch(reportError),
                );
            }
        });
        updateHost(coreEditor.getData());
        options.onReady?.(publicValue);
        initialized = true;
        return publicValue;
    } catch (error: unknown) {
        const callbackError = reportError(error);
        try {
            await performDestroy();
        } catch (cleanupError: unknown) {
            throw new AggregateError(
                [
                    error,
                    ...(callbackError === undefined ? [] : [callbackError]),
                    cleanupError,
                ],
                'Classic editor initialization and cleanup failed.',
            );
        }
        if (callbackError !== undefined) {
            throw new AggregateError(
                [error, callbackError],
                'Classic editor initialization and error reporting failed.',
            );
        }
        throw error;
    }

    function attachClassicUi(editor: Editor): EditorUi {
        const registry = editor.services.get(uiRegistryServiceToken);
        const commandSurface = dom.visualContent;
        if (previewOptions !== undefined) {
            registerClassicPreviewTool(registry, () => previewWindow?.open());
        }
        ui = createEditorUi({
            accessibilityHelp: true,
            documentStatus: true,
            direction: translation.direction,
            editor,
            element: dom.root,
            ...(options.icons === undefined ? {} : { icons: options.icons }),
            locale: translation.locale,
            ...(options.theme === undefined ? {} : { theme: options.theme }),
            themeVariables: {
                controlSize: '1.875rem',
                ...options.themeVariables,
            },
            toolbar: compactClassicToolbar(
                options.toolbar ??
                    withClassicPreviewTool(
                        preset.toolbar,
                        previewOptions !== undefined,
                    ),
            ),
            toolbarLayout: options.toolbarLayout ?? {
                collapsible: true,
                overflow: 'wrap',
                sticky: true,
            },
            translations,
        });
        if (CLASSIC_TABLE_CONTEXT) {
            disposeTableContext = attachClassicTableContext(
                editor,
                ui,
                commandSurface,
            );
        }
        disposeLinkContext = attachClassicLinkContext(
            editor,
            ui,
            commandSurface,
        );
        disposeImageContext = attachClassicImageContext(ui, commandSurface);
        disposePasteDiagnostics = editor.services
            .tryGet(pastePipelineServiceToken)
            ?.subscribe((diagnostic) => {
                ui?.notifications.show({
                    message: `Paste was not applied: ${diagnostic.message}`,
                    severity: 'error',
                });
            });
        const editingFeedback = (event: Event): void => {
            const detail: unknown = Reflect.get(event, 'detail');
            if (typeof detail !== 'object' || detail === null) return;
            const message: unknown = Reflect.get(detail, 'message');
            const severity: unknown = Reflect.get(detail, 'severity');
            if (typeof message !== 'string' || message.length === 0) return;
            ui?.notifications.show({
                message,
                severity: severity === 'error' ? 'error' : 'warning',
            });
        };
        commandSurface.addEventListener(
            'soeditor:editing-feedback',
            editingFeedback,
        );
        disposeEditingFeedback = () =>
            commandSurface.removeEventListener(
                'soeditor:editing-feedback',
                editingFeedback,
            );
        const updateModeChrome = (): void => {
            dom.root.dataset.soeditorMode = editor.state.mode;
            if (editingModes.has('source')) {
                if (classicSplitOrientation(workspaceView) !== undefined) {
                    applyClassicWorkspaceLayout();
                    return;
                }
                const target =
                    editor.state.mode === 'source' ? 'source' : 'wysiwyg';
                const visible = editor.services
                    .get(projectionCoordinatorServiceToken)
                    .snapshot.activities.filter((activity) => activity.visible);
                if (visible.length !== 1 || visible[0]?.id !== target) {
                    setWorkspaceView(target);
                }
            }
        };
        attachWorkspaceControls(editor);
        dom.root.dataset.soeditorMode = editor.state.mode;
        disposeModeChrome = editor.events.on('mode:change', updateModeChrome);
        dom.resizeHandle?.setAttribute(
            'aria-label',
            ui.translate('Resize editor height'),
        );
        if (maximizable) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'soeditor-ui__button';
            button.dataset.classicAction = 'maximize';
            ui.setIcon(button, 'editor.maximize', ui.translate('Maximize'));
            button.title = ui.translate('Maximize editor');
            button.setAttribute('aria-label', ui.translate('Maximize editor'));
            button.setAttribute('aria-pressed', 'false');
            button.addEventListener('click', () => setMaximized(!maximized));
            ui.toolbarElement.append(button);
            ui.refresh();
        }
        groupClassicToolbarActions(ui.toolbarElement);
        return ui;
    }

    function attachWorkspaceControls(editor: Editor): void {
        const coordinator = editor.services.tryGet(
            projectionCoordinatorServiceToken,
        );
        if (coordinator === undefined) return;
        editor.commands.register({
            id: 'classic.workspace.set',
            execute: (_context, view: unknown) => {
                if (!isClassicWorkspaceView(view)) {
                    throw new TypeError(
                        `Unknown Classic workspace view "${String(view)}".`,
                    );
                }
                setWorkspaceView(view);
            },
        });
        if (!editingModes.has('source')) return;
        const controls: readonly (readonly [ClassicWorkspaceView, string])[] = [
            ['wysiwyg', 'WYSIWYG'],
            ['source', 'Source'],
            ['wysiwyg-source-horizontal', 'WYSIWYG + Source (side by side)'],
            ['wysiwyg-source-vertical', 'WYSIWYG + Source (stacked)'],
        ];
        const workspacePicker = document.createElement('div');
        workspacePicker.className = 'soeditor-classic__workspace-picker';
        workspacePicker.dataset.classicAction = 'workspace-view';
        workspacePicker.setAttribute('role', 'group');
        workspacePicker.setAttribute(
            'aria-label',
            ui?.translate('Editing view') ?? 'Editing view',
        );
        const icons: Readonly<Record<ClassicWorkspaceView, string>> = {
            single: 'editor.visual',
            source: 'editor.source',
            wysiwyg: 'editor.visual',
            'wysiwyg-source-horizontal': 'editor.view.sideBySide',
            'wysiwyg-source-vertical': 'editor.view.stacked',
        };
        const workspaceButtons = new Map<
            ClassicWorkspaceView,
            HTMLButtonElement
        >();
        for (const [view, label] of controls) {
            const button = document.createElement('button');
            const translated = ui?.translate(label) ?? label;
            button.type = 'button';
            button.className = 'soeditor-ui__button';
            button.dataset.workspaceView = view;
            button.title = translated;
            button.setAttribute('aria-label', translated);
            button.setAttribute('aria-pressed', 'false');
            ui?.setIcon(button, icons[view], translated);
            button.addEventListener('click', () => {
                editor.execute('classic.workspace.set', view);
            });
            workspaceButtons.set(view, button);
            workspacePicker.append(button);
        }
        ui?.toolbarElement.append(workspacePicker);
        const update = (): void => {
            const visible = coordinator.snapshot.activities.filter(
                (activity) =>
                    activity.visible && coordinator.isAttached(activity.id),
            );
            dom.root.dataset.soeditorPaneCount = String(visible.length);
            dom.root.dataset.soeditorProjections = visible
                .map((activity) => activity.id)
                .join(' ');
            const visibleIds = new Set(visible.map((activity) => activity.id));
            if (editingModes.has('wysiwyg')) {
                dom.visual.hidden = !visibleIds.has('wysiwyg');
            }
            if (editingModes.has('source')) {
                dom.source.hidden = !visibleIds.has('source');
            }
            for (const [view, button] of workspaceButtons) {
                const active = view === workspaceView;
                button.setAttribute('aria-pressed', String(active));
                button.classList.toggle('is-active', active);
            }
            dom.root.dataset.soeditorWorkspaceView = workspaceView;
            applyClassicWorkspaceLayout();
        };
        refreshWorkspaceChrome = update;
        update();
        disposeProjectionChrome = coordinator.subscribe(update);
        ui?.refresh();
    }

    function updateSaveStatus(state: EditorSaveState): void {
        if (ui === undefined) return;
        if (state.status === 'saved') {
            ui.notifications.show({
                message: ui.translate('Changes saved'),
                severity: 'success',
            });
        } else if (state.status === 'error') {
            ui.notifications.show({
                message: ui.translate('Save failed'),
                severity: 'error',
            });
        } else if (state.status === 'conflict') {
            ui.notifications.show({
                message: ui.translate('Save conflict'),
                severity: 'warning',
            });
        }
    }
}

function createDom(
    document: Document,
    ariaLabel: string,
    placeholder: string | undefined,
    heights: Heights,
    resizable: boolean,
    editingModes: ReadonlySet<ClassicEditingMode>,
    cspNonce: string | undefined,
): ClassicDom {
    const root = document.createElement('div');
    root.className = 'soeditor-classic';
    const visual = document.createElement('div');
    visual.className = 'soeditor-classic__visual';
    visual.tabIndex = 0;
    const visualShadow = visual.attachShadow({
        delegatesFocus: true,
        mode: 'open',
    });
    const visualStyle = document.createElement('style');
    if (cspNonce !== undefined) visualStyle.nonce = cspNonce;
    visualStyle.textContent = wysiwygContentStyles;
    const visualContent = document.createElement('div');
    visualContent.className = 'soeditor-wysiwyg-content';
    if (placeholder !== undefined) {
        visualContent.dataset.soeditorPlaceholder = placeholder;
    }
    visualShadow.append(visualStyle, visualContent);
    applyHeights(visual, heights);
    const source = document.createElement('div');
    source.className = 'soeditor-classic__source';
    source.hidden = true;
    source.setAttribute('aria-label', `${ariaLabel} HTML source host`);
    applyHeights(source, heights);
    const paneResizeHandle = editingModes.has('source')
        ? document.createElement('div')
        : undefined;
    if (paneResizeHandle !== undefined) {
        paneResizeHandle.className = 'soeditor-classic__pane-resize-handle';
        paneResizeHandle.hidden = true;
        paneResizeHandle.tabIndex = 0;
        paneResizeHandle.setAttribute('role', 'separator');
        paneResizeHandle.setAttribute('aria-valuemin', '20');
        paneResizeHandle.setAttribute('aria-valuemax', '80');
        paneResizeHandle.setAttribute('aria-valuenow', '50');
    }
    const resizeHandle = resizable ? document.createElement('div') : undefined;
    if (resizeHandle !== undefined) {
        resizeHandle.className = 'soeditor-classic__resize-handle';
        resizeHandle.tabIndex = 0;
        resizeHandle.setAttribute('role', 'separator');
        resizeHandle.setAttribute('aria-label', 'Resize editor height');
        resizeHandle.setAttribute('aria-orientation', 'horizontal');
        resizeHandle.setAttribute(
            'aria-valuemin',
            String(Math.round(heights.minimum ?? 80)),
        );
        resizeHandle.setAttribute(
            'aria-valuemax',
            String(Math.round(heights.maximum ?? 100_000)),
        );
        resizeHandle.setAttribute(
            'aria-valuenow',
            String(Math.round(heights.initial ?? heights.minimum ?? 192)),
        );
    }
    const surfaces = document.createElement('div');
    surfaces.className = 'soeditor-classic__surfaces';
    surfaces.append(visual);
    if (paneResizeHandle !== undefined) {
        surfaces.append(paneResizeHandle, source);
    }
    root.append(surfaces);
    if (resizeHandle !== undefined) root.append(resizeHandle);
    return Object.freeze({
        ...(paneResizeHandle === undefined ? {} : { paneResizeHandle }),
        ...(resizeHandle === undefined ? {} : { resizeHandle }),
        root,
        source,
        surfaces,
        visual,
        visualContent,
        visualShadow,
    });
}

function isClassicWorkspaceView(value: unknown): value is ClassicWorkspaceView {
    return (
        value === 'single' ||
        value === 'wysiwyg' ||
        value === 'source' ||
        value === 'wysiwyg-source-horizontal' ||
        value === 'wysiwyg-source-vertical'
    );
}

function classicSplitOrientation(
    view: ClassicWorkspaceView,
): 'horizontal' | 'vertical' | undefined {
    if (!OPTIONAL_CLASSIC_FEATURES) return undefined;
    return view === 'wysiwyg-source-horizontal'
        ? 'horizontal'
        : view === 'wysiwyg-source-vertical'
          ? 'vertical'
          : undefined;
}

function readEditingModes(
    value: readonly ClassicEditingMode[] | undefined,
): ReadonlySet<ClassicEditingMode> {
    const modes = value ?? ['wysiwyg'];
    if (!Array.isArray(modes) || modes.length === 0) {
        throw new TypeError(
            'Classic editor editingModes must contain at least one mode.',
        );
    }
    const result = new Set<ClassicEditingMode>();
    for (const mode of modes) {
        if (mode !== 'wysiwyg' && mode !== 'source') {
            throw new TypeError(
                `Unknown Classic editing mode "${String(mode)}".`,
            );
        }
        if (result.has(mode)) {
            throw new TypeError(
                `Classic editing mode "${mode}" is duplicated.`,
            );
        }
        result.add(mode);
    }
    if (!result.has('wysiwyg')) {
        throw new TypeError(
            'Classic editor requires the WYSIWYG editing mode.',
        );
    }
    return result;
}

function isClassicEditingMode(
    value: ProjectionId,
): value is ClassicEditingMode {
    return value === 'wysiwyg' || value === 'source';
}

function readInitialEditingMode(
    value: ClassicEditingMode | undefined,
    available: ReadonlySet<ClassicEditingMode>,
): ClassicEditingMode {
    const mode = value ?? 'wysiwyg';
    if (!available.has(mode)) {
        throw new TypeError(
            `Classic initialEditingMode "${mode}" is not included in editingModes.`,
        );
    }
    return mode;
}

function createCustomContentStyle(
    root: ShadowRoot,
    visual: HTMLElement,
    css: string | undefined,
    nonce: string | undefined,
): HTMLStyleElement | undefined {
    if (css === undefined) return undefined;
    requireString(css, 'Classic editor contentStyles');
    if (css.trim().length === 0) {
        throw new TypeError('Classic editor contentStyles must not be empty.');
    }
    const values = new Uint32Array(4);
    visual.ownerDocument.defaultView?.crypto.getRandomValues(values);
    const scope = Array.from(values, (value) => value.toString(36)).join('-');
    visual.dataset.soeditorContentScope = scope;
    const style = visual.ownerDocument.createElement('style');
    if (nonce !== undefined) style.nonce = nonce;
    style.textContent = `@scope ([data-soeditor-content-scope="${scope}"]) { ${css} }`;
    root.append(style);
    return style;
}

function attachClassicImageContext(
    ui: EditorUi,
    visual: HTMLElement,
): () => void {
    let destroyed = false;
    let dispose: (() => void) | undefined;
    let loading = false;
    let pending:
        | { detail: unknown; target: EventTarget | null; type: string }
        | undefined;
    const activate = (event: Event): void => {
        const detail: unknown = Reflect.get(event, 'detail');
        if (dispose !== undefined) return;
        pending = { detail, target: event.target, type: event.type };
        if (loading) return;
        loading = true;
        void import('./classic-image-context.js')
            .then((module) => {
                if (destroyed) return;
                visual.removeEventListener('soeditor:image-activate', activate);
                visual.removeEventListener('soeditor:image-select', activate);
                dispose = module.attachClassicImageContext(ui, visual);
                const replay = pending;
                pending = undefined;
                if (replay === undefined) return;
                const { detail, target, type } = replay;
                if (!(target instanceof Element)) return;
                const EventConstructor =
                    visual.ownerDocument.defaultView?.CustomEvent ??
                    CustomEvent;
                target.dispatchEvent(
                    new EventConstructor(type, { bubbles: true, detail }),
                );
            })
            .catch(() => {
                if (destroyed) return;
                loading = false;
                visual.addEventListener('soeditor:image-activate', activate);
                visual.addEventListener('soeditor:image-select', activate);
                ui.notifications.show({
                    message: 'Image tools failed to load. Please try again.',
                    severity: 'error',
                });
            });
    };
    visual.addEventListener('soeditor:image-activate', activate);
    visual.addEventListener('soeditor:image-select', activate);
    return () => {
        destroyed = true;
        visual.removeEventListener('soeditor:image-activate', activate);
        visual.removeEventListener('soeditor:image-select', activate);
        dispose?.();
    };
}
function attachClassicLinkContext(
    editor: Editor,
    ui: EditorUi,
    visual: HTMLElement,
): () => void {
    let destroyed = false;
    let dispose: (() => void) | undefined;
    let loading = false;
    let pending: { event: MouseEvent; link: Element } | undefined;
    const activate = (event: MouseEvent): void => {
        if (dispose !== undefined || event.button !== 0) return;
        const origin = event.target;
        const link =
            origin instanceof Element
                ? origin.closest('a[data-soeditor-link="true"], a[href]')
                : null;
        if (link === null || !visual.contains(link)) return;
        event.preventDefault();
        pending = { event, link };
        if (loading) return;
        loading = true;
        void import('./classic-link-context.js')
            .then((module) => {
                if (destroyed) return;
                visual.removeEventListener('click', activate);
                dispose = module.attachClassicLinkContext(editor, ui, visual);
                const replay = pending;
                pending = undefined;
                if (replay === undefined) return;
                replay.link.dispatchEvent(
                    new MouseEvent('click', {
                        bubbles: true,
                        button: replay.event.button,
                        ctrlKey: replay.event.ctrlKey,
                        metaKey: replay.event.metaKey,
                    }),
                );
            })
            .catch(() => {
                if (destroyed) return;
                loading = false;
                visual.addEventListener('click', activate);
                ui.notifications.show({
                    message: 'Link tools failed to load. Please try again.',
                    severity: 'error',
                });
            });
    };
    visual.addEventListener('click', activate);
    return () => {
        destroyed = true;
        visual.removeEventListener('click', activate);
        dispose?.();
    };
}
function attachClassicTableContext(
    editor: Editor,
    ui: EditorUi,
    visual: HTMLElement,
): () => void {
    let destroyed = false;
    let dispose: (() => void) | undefined;
    let loading = false;
    let pending: { detail: unknown; target: EventTarget | null } | undefined;
    const activate = (event: Event): void => {
        const detail: unknown = Reflect.get(event, 'detail');
        if (dispose !== undefined) return;
        pending = { detail, target: event.target };
        if (loading) return;
        loading = true;
        void import('./classic-table-context.js')
            .then((module) => {
                if (destroyed) return;
                visual.removeEventListener(
                    'soeditor:table-selection',
                    activate,
                );
                dispose = module.attachClassicTableContext(editor, ui, visual);
                const replay = pending;
                pending = undefined;
                if (replay === undefined) return;
                const { detail, target } = replay;
                if (!(target instanceof Element)) return;
                const EventConstructor =
                    visual.ownerDocument.defaultView?.CustomEvent ??
                    CustomEvent;
                target.dispatchEvent(
                    new EventConstructor('soeditor:table-selection', {
                        bubbles: true,
                        detail,
                    }),
                );
            })
            .catch(() => {
                if (destroyed) return;
                loading = false;
                visual.addEventListener('soeditor:table-selection', activate);
                ui.notifications.show({
                    message: '表格操作工具加载失败，请重试。',
                    severity: 'error',
                });
            });
    };
    visual.addEventListener('soeditor:table-selection', activate);
    return () => {
        destroyed = true;
        visual.removeEventListener('soeditor:table-selection', activate);
        dispose?.();
    };
}

function enterMaximizedDocument(document: Document, owner: object): void {
    let state = maximizedDocuments.get(document);
    if (state === undefined) {
        state = {
            owners: new Set(),
            previousOverflow: document.body.style.overflow,
        };
        maximizedDocuments.set(document, state);
        document.body.style.overflow = 'hidden';
    }
    state.owners.add(owner);
}

function leaveMaximizedDocument(document: Document, owner: object): void {
    const state = maximizedDocuments.get(document);
    if (state === undefined) return;
    state.owners.delete(owner);
    if (state.owners.size === 0) {
        document.body.style.overflow = state.previousOverflow;
        maximizedDocuments.delete(document);
    }
}

function protectWindowFromDirtyLeave(
    view: Window,
    isDirty: () => boolean,
): () => void {
    let state = protectedWindows.get(view);
    if (state === undefined) {
        const owners = new Set<() => boolean>();
        const listener = (event: BeforeUnloadEvent): void => {
            if (![...owners].some((owner) => owner())) return;
            event.preventDefault();
            event.returnValue = '';
        };
        state = { listener, owners };
        protectedWindows.set(view, state);
        view.addEventListener('beforeunload', listener);
    }
    state.owners.add(isDirty);
    return () => {
        const current = protectedWindows.get(view);
        if (current === undefined) return;
        current.owners.delete(isDirty);
        if (current.owners.size === 0) {
            view.removeEventListener('beforeunload', current.listener);
            protectedWindows.delete(view);
        }
    };
}

function applyHeights(element: HTMLElement, heights: Heights): void {
    if (heights.initial !== undefined) {
        element.style.height = `${String(heights.initial)}px`;
    }
    if (heights.minimum !== undefined) {
        element.style.minHeight = `${String(heights.minimum)}px`;
    }
    if (heights.maximum !== undefined) {
        element.style.maxHeight = `${String(heights.maximum)}px`;
    }
}

function readHeights(options: CreateClassicEditorOptions): Heights {
    const initial = optionalPositiveNumber(
        options.initialHeight,
        'initialHeight',
    );
    const minimum = optionalPositiveNumber(options.minHeight, 'minHeight');
    const maximum = optionalPositiveNumber(options.maxHeight, 'maxHeight');
    if (minimum !== undefined && maximum !== undefined && minimum > maximum) {
        throw new TypeError(
            'Classic editor minHeight must not exceed maxHeight.',
        );
    }
    if (initial !== undefined && minimum !== undefined && initial < minimum) {
        throw new TypeError(
            'Classic editor initialHeight must not be below minHeight.',
        );
    }
    if (initial !== undefined && maximum !== undefined && initial > maximum) {
        throw new TypeError(
            'Classic editor initialHeight must not exceed maxHeight.',
        );
    }
    if (
        options.autoGrow !== undefined &&
        typeof options.autoGrow !== 'boolean'
    ) {
        throw new TypeError('Classic editor autoGrow must be a boolean.');
    }
    return Object.freeze({
        autoGrow: options.autoGrow ?? false,
        ...(initial === undefined ? {} : { initial }),
        ...(maximum === undefined ? {} : { maximum }),
        ...(minimum === undefined ? {} : { minimum }),
    });
}

function readPreset(preset: EditorPreset): EditorPreset {
    if (preset.format !== 'html') {
        throw new TypeError(
            'A classic editor preset must use the HTML format.',
        );
    }
    return preset;
}

function withClassicPreviewTool(
    toolbar: ToolbarConfiguration,
    enabled: boolean,
): ToolbarConfiguration {
    if (!enabled || toolbar.includes('popupPreview')) return toolbar;
    return Object.freeze([...toolbar, '|', 'popupPreview']);
}

function compactClassicToolbar(
    toolbar: ToolbarConfiguration,
): ToolbarConfiguration {
    const visible: string[] = [];
    for (const item of toolbar) {
        if (HIDDEN_CLASSIC_TOOLBAR_ITEMS.has(item)) continue;
        if (item === '|' && (visible.length === 0 || visible.at(-1) === '|')) {
            continue;
        }
        visible.push(item);
    }
    if (visible.at(-1) === '|') visible.pop();
    return Object.freeze(visible);
}

function groupClassicToolbarActions(toolbar: HTMLElement): void {
    const collapse = toolbar.querySelector<HTMLButtonElement>(
        '.soeditor-ui__toolbar-toggle',
    );
    if (collapse !== null) {
        collapse.hidden = true;
        collapse.tabIndex = -1;
    }
    const group = toolbar.ownerDocument.createElement('div');
    group.className = 'soeditor-classic__toolbar-end';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', 'Editor views and preview');
    const preview = toolbar.querySelector<HTMLElement>(
        '[data-toolbar-item="popupPreview"]',
    );
    if (
        preview?.previousElementSibling?.classList.contains(
            'soeditor-ui__separator',
        ) === true
    ) {
        preview.previousElementSibling.remove();
    }
    for (const selector of [
        '[data-toolbar-item="popupPreview"]',
        '.soeditor-ui__help-button',
        '[data-classic-action="workspace-view"]',
        '[data-classic-action="maximize"]',
    ]) {
        const item = toolbar.querySelector<HTMLElement>(selector);
        if (item !== null) group.append(item);
    }
    if (group.childElementCount > 0) toolbar.append(group);
}

function registerClassicPreviewTool(
    registry: UiRegistryService,
    open: () => boolean | undefined,
): void {
    registry.registerToolbarItem('popupPreview', ({ document, ui }) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'soeditor-ui__button';
        ui.setIcon(button, 'editor.preview', 'Preview');
        button.querySelector('svg')?.classList.add('soeditor-ui__icon--solid');
        button.title = ui.translate('Preview in new window');
        button.setAttribute(
            'aria-label',
            ui.translate('Preview in new window'),
        );
        const click = (): void => {
            if (open() === false) {
                ui.notifications.show({
                    message: ui.translate(
                        'The preview window was blocked by the browser.',
                    ),
                    severity: 'error',
                });
            }
        };
        button.addEventListener('click', click);
        return {
            destroy: () => button.removeEventListener('click', click),
            element: button,
            update: () => undefined,
        };
    });
}

function validateHost(host: HTMLElement): void {
    const view = host.ownerDocument.defaultView;
    if (view === null || !(host instanceof view.HTMLElement)) {
        throw new TypeError('A classic editor host must be an HTMLElement.');
    }
    if (!host.isConnected) {
        throw new TypeError(
            'A classic editor host must be attached to a window.',
        );
    }
}

function validateCallbacks(options: CreateClassicEditorOptions): void {
    for (const [name, callback] of [
        ['onBlur', options.onBlur],
        ['onChange', options.onChange],
        ['onError', options.onError],
        ['onFocus', options.onFocus],
        ['onReady', options.onReady],
    ] as const) {
        if (callback !== undefined && typeof callback !== 'function') {
            throw new TypeError(`Classic editor ${name} must be a function.`);
        }
    }
}

function readClassicPreviewOptions(
    value: boolean | ClassicPreviewOptions | undefined,
): ClassicPreviewOptions | undefined {
    if (value === undefined || value === false) return undefined;
    if (value === true) return Object.freeze({});
    if (typeof value !== 'object' || value === null) {
        throw new TypeError(
            'Classic preview must be a boolean or configuration object.',
        );
    }
    if (
        value.windowFeatures !== undefined &&
        (typeof value.windowFeatures !== 'string' ||
            value.windowFeatures.trim().length === 0)
    ) {
        throw new TypeError(
            'Classic preview windowFeatures must be a non-empty string.',
        );
    }
    if (
        value.wysiwygStyles !== undefined &&
        typeof value.wysiwygStyles !== 'boolean'
    ) {
        throw new TypeError('Classic preview wysiwygStyles must be a boolean.');
    }
    return value;
}

function readSourceAutoFormatDelay(options: ClassicSourceOptions): number {
    const delay = options.autoFormatDelay ?? 300;
    if (!Number.isFinite(delay) || delay < 0 || delay > 10_000) {
        throw new TypeError(
            'Classic Source autoFormatDelay must be between 0 and 10000 milliseconds.',
        );
    }
    return delay;
}

function validateClassicSourceOptions(
    options: ClassicSourceOptions | undefined,
): void {
    if (options === undefined) return;
    if (typeof options !== 'object' || options === null) {
        throw new TypeError('Classic Source options must be an object.');
    }
    if (
        options.autoFormat !== undefined &&
        typeof options.autoFormat !== 'boolean'
    ) {
        throw new TypeError('Classic Source autoFormat must be a boolean.');
    }
    if (options.autoFormatDelay !== undefined) {
        readSourceAutoFormatDelay(options);
    }
    if (
        options.formatting !== undefined &&
        (typeof options.formatting !== 'object' || options.formatting === null)
    ) {
        throw new TypeError('Classic Source formatting must be an object.');
    }
}

function validateClassicSaveOptions(
    options: ClassicEditorSaveOptions | undefined,
): void {
    if (options === undefined) return;
    if (typeof options !== 'object' || options === null) {
        throw new TypeError('Classic editor save options must be an object.');
    }
    if (
        options.leavePageProtection !== undefined &&
        typeof options.leavePageProtection !== 'boolean'
    ) {
        throw new TypeError(
            'Classic editor leavePageProtection must be a boolean.',
        );
    }
    if (
        options.onStateChange !== undefined &&
        typeof options.onStateChange !== 'function'
    ) {
        throw new TypeError(
            'Classic editor save onStateChange must be a function.',
        );
    }
}

function initialSource(
    host: HTMLElement,
    explicit: string | undefined,
): string {
    if (explicit !== undefined) {
        return requireString(explicit, 'Classic editor data');
    }
    return isTextArea(host) ? host.value : host.innerHTML;
}

function hostAriaLabel(
    host: HTMLElement,
    translate: (message: string) => string,
): string {
    const direct = host.getAttribute('aria-label')?.trim();
    if (direct !== undefined && direct.length > 0) return direct;
    if (isTextArea(host) && host.labels !== null) {
        const label = Array.from(host.labels)
            .map((element) => element.textContent?.trim() ?? '')
            .find((value) => value.length > 0);
        if (label !== undefined) return label;
    }
    return translate('Rich text editor');
}

function isTextArea(host: HTMLElement): host is HTMLTextAreaElement {
    return host.tagName.toLowerCase() === 'textarea';
}

function optionalNonEmptyString(
    value: string | undefined,
    name: string,
): string | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new TypeError(`Classic editor ${name} must not be empty.`);
    }
    return value;
}

function optionalPositiveNumber(
    value: number | undefined,
    name: string,
): number | undefined {
    if (value === undefined) return undefined;
    if (!Number.isFinite(value) || value <= 0 || value > 100_000) {
        throw new TypeError(
            `Classic editor ${name} must be a positive number up to 100000.`,
        );
    }
    return value;
}

function optionalBoolean(
    value: boolean | undefined,
    name: string,
    fallback: boolean,
): boolean {
    if (value !== undefined && typeof value !== 'boolean') {
        throw new TypeError(`Classic editor ${name} must be a boolean.`);
    }
    return value ?? fallback;
}

function requireString(value: unknown, label: string): string {
    if (typeof value !== 'string') {
        throw new TypeError(`${label} must be a string.`);
    }
    return value;
}
