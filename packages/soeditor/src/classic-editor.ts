import {
    Editor,
    type EditorConfig,
    type PluginConstructor,
    type TransactionOrigin,
} from '@soeditor/core';
import {
    pastePipelineServiceToken,
    visualEditingServiceToken,
} from '@soeditor/engine';
import type {
    HtmlFormattingOptions,
    HtmlFormattingService,
} from '@soeditor/html-tools';
import {
    loadSourceRecovery,
    type SourceRecoveryRuntime,
} from '@soeditor/source/recovery';
import type { SourceEngine } from '@soeditor/source';
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
    type EditorUi,
    type EditorUiDirection,
    type EditorUiIconResource,
    type EditorUiTheme,
    type EditorUiThemeVariables,
    type EditorUiTranslationResource,
    type ToolbarConfiguration,
    type ToolbarLayoutOptions,
    type UiRegistryService,
} from '@soeditor/ui';
import {
    createCmsEditorUi,
    resolveUiTranslationResources,
    uiRegistryServiceToken,
} from '@soeditor/ui/cms';
import { loadBuiltInUiTranslations } from './ui-translation-loader.js';
import { createClassicHost, type ClassicHost } from './classic-host.js';
import type {
    EditorSaveAdapter,
    EditorSaveResult,
    EditorSaveState,
    EditorSaveWorkflow,
} from '@soeditor/workspace';
import {
    ClassicEditorAlreadyAttachedError,
    ClassicEditorDestroyedError,
} from './classic-editor-errors.js';
import { attachLazyClassicDialogWindows } from './classic-dialog-loader.js';
import type { ClassicPreviewWindow } from '@soeditor/preview';
import { attachClassicSourceFormatting } from './classic-source-formatting.js';

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
const SHOW_BLOCK_TAGS = [
    'address',
    'article',
    'aside',
    'blockquote',
    'div',
    'figure',
    'footer',
    'form',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'header',
    'hr',
    'li',
    'main',
    'nav',
    'ol',
    'p',
    'pre',
    'section',
    'table',
    'ul',
] as const;
const SHOW_BLOCKS_ROOT =
    ".soeditor-wysiwyg-content[data-soeditor-show-blocks='true']";
const SHOW_BLOCKS_STYLES = OPTIONAL_CLASSIC_FEATURES
    ? `${SHOW_BLOCKS_ROOT} :is(${SHOW_BLOCK_TAGS.join(',')}){outline:1px dashed color-mix(in srgb,var(--soeditor-accent,#0969da) 65%,transparent);outline-offset:-1px;position:relative}${SHOW_BLOCKS_ROOT} :is(${SHOW_BLOCK_TAGS.join(',')})::before{background:color-mix(in srgb,var(--soeditor-accent,#0969da) 88%,#000);border-radius:0 0 .2rem 0;color:#fff;display:block;font:600 9px/1.35 ui-monospace,SFMono-Regular,Consolas,monospace;inset-block-start:0;inset-inline-start:0;letter-spacing:.02em;padding:0 .25rem;pointer-events:none;position:absolute;text-transform:lowercase;z-index:2}${SHOW_BLOCK_TAGS.map((tag) => `${SHOW_BLOCKS_ROOT} ${tag}::before{content:'${tag}'}`).join('')}`
    : '';
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
                      'HTML Source contains errors. Repair Source before saving.':
                          'HTML 源码包含错误，请修复源码后再保存。',
                      'HTML Source contains errors. WYSIWYG stays read-only until Source is repaired.':
                          'HTML 源码包含错误，修复前所见即所得视图保持只读。',
                      'Loading preview…': '正在加载预览…',
                      'Preview failed to load. Your content is preserved.':
                          '预览加载失败，编辑内容已保留。',
                      'Loading HTML Source…': '正在加载 HTML 源码…',
                      'HTML Source failed to load. Select Source to retry.':
                          'HTML 源码加载失败，请再次选择源码重试。',
                      'Preview in new window': '在新窗口中预览',
                      'Preview template': '预览模板',
                      'Web page': '网页',
                      'Email newsletter': 'Email 电子报',
                      'Email newsletter preview': 'Email 电子报预览',
                      'Word document': 'Word 文档',
                      'Word document preview': 'Word 文档预览',
                      'The preview window was blocked by the browser.':
                          '浏览器阻止了预览窗口。',
                      'Hide block boundaries': '隐藏区块边界',
                      'Show block boundaries': '显示区块边界',
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
                      'HTML Source contains errors. Repair Source before saving.':
                          'HTML 原始碼包含錯誤，請修復原始碼後再儲存。',
                      'HTML Source contains errors. WYSIWYG stays read-only until Source is repaired.':
                          'HTML 原始碼包含錯誤，修復前所見即所得檢視保持唯讀。',
                      'Loading preview…': '正在載入預覽…',
                      'Preview failed to load. Your content is preserved.':
                          '預覽載入失敗，編輯內容已保留。',
                      'Loading HTML Source…': '正在載入 HTML 原始碼…',
                      'HTML Source failed to load. Select Source to retry.':
                          'HTML 原始碼載入失敗，請再次選擇原始碼重試。',
                      'Preview in new window': '在新視窗中預覽',
                      'Preview template': '預覽範本',
                      'Web page': '網頁',
                      'Email newsletter': 'Email 電子報',
                      'Email newsletter preview': 'Email 電子報預覽',
                      'Word document': 'Word 文件',
                      'Word document preview': 'Word 文件預覽',
                      'The preview window was blocked by the browser.':
                          '瀏覽器阻止了預覽視窗。',
                      'Hide block boundaries': '隱藏區塊邊界',
                      'Show block boundaries': '顯示區塊邊界',
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
    /** Proportionally mirrors scrolling while WYSIWYG and Source are both visible. */
    readonly scrollSync?: boolean;
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
    setWorkspaceView(view: ClassicWorkspaceView): void | Promise<void>;
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
    const builtInTranslations = await loadBuiltInUiTranslations(locale);
    const translations = [
        ...builtInTranslations,
        ...CLASSIC_TRANSLATIONS,
        ...(options.translations ?? []),
    ];
    const translation = resolveUiTranslationResources(
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
    let sourceModule: SourceRecoveryRuntime | undefined;
    let sourceEngine: SourceEngine | undefined;
    let sourceLoading: Promise<void> | undefined;
    let sourceAttempts = 0;
    let visualChangedWhileSourceLoads = false;
    let formattingService: HtmlFormattingService | undefined;
    let viewRequest = 0;
    const plugins = options.plugins ?? preset.plugins;
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
    let workspace: ClassicHost | undefined;
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
    let disposeBlockParagraphContext: (() => void) | undefined;
    let disposeDialogWindows: (() => void) | undefined;
    let disposePasteDiagnostics: (() => void) | undefined;
    let disposeEditingFeedback: (() => void) | undefined;
    let disposeModeChrome: (() => void) | undefined;
    let disposeProjectionChrome: (() => void) | undefined;
    let refreshWorkspaceChrome = (): void => undefined;
    let disposeSourceEnhancements: (() => void) | undefined;
    let previewWindow: ClassicPreviewWindow | undefined;
    let pendingPreview: Window | undefined;
    let manualHeight = false;
    let resizeStart:
        { readonly height: number; readonly y: number } | undefined;
    let paneResizeStart = false;

    if (editingModes.has('source'))
        dom.root.dataset.soeditorSourceState = 'unloaded';
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
    const onSubmit = (event: Event): void => {
        if (OPTIONAL_CLASSIC_FEATURES && hasInvalidSource()) {
            event.preventDefault();
            reportError(invalidSourceError());
        }
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
        openPreview: () => openPreview(),
        setWorkspaceView: (view: ClassicWorkspaceView) => {
            assertAlive();
            return setWorkspaceView(view);
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

    function hasInvalidSource(): boolean {
        return (
            sourceModule !== undefined &&
            sourceEngine !== undefined &&
            requireEditor()
                .services.get(sourceModule.sourceEditingServiceToken)
                .getDiagnostics()
                .some((diagnostic) => diagnostic.severity === 'error')
        );
    }

    function invalidSourceError(): Error {
        const message = translation.translate(
            'HTML Source contains errors. Repair Source before saving.',
        );
        ui?.notifications.show({ message, severity: 'error' });
        const error = new Error(message);
        error.name = 'ClassicInvalidSourceError';
        return error;
    }

    function openPreview(): boolean {
        assertAlive();
        if (!OPTIONAL_CLASSIC_FEATURES || previewOptions === undefined)
            throw new Error('Classic popup preview is not enabled.');
        if (previewWindow !== undefined) return previewWindow.open();
        if (pendingPreview !== undefined && !pendingPreview.closed) {
            pendingPreview.focus();
            return true;
        }
        const owner = document.defaultView;
        if (owner === null)
            throw new Error('Classic popup preview requires a window.');
        // Reserve the window inside the user gesture, before awaiting optional code.
        const popup = owner.open(
            'about:blank',
            '_blank',
            previewOptions.windowFeatures ??
                'popup=yes,width=1024,height=768,resizable=yes,scrollbars=yes',
        );
        if (popup === null) return false;
        pendingPreview = popup;
        popup.document.title = translation.translate('Loading preview…');
        popup.document.body.textContent =
            translation.translate('Loading preview…');
        void import('@soeditor/preview')
            .then((module) => {
                if (destroyed || popup.closed || pendingPreview !== popup) {
                    popup.close();
                    return;
                }
                previewWindow = module.createClassicPreviewWindow({
                    editor: requireEditor(),
                    popup,
                    ...(previewOptions.windowFeatures === undefined
                        ? {}
                        : { features: previewOptions.windowFeatures }),
                    getTemplates: () =>
                        module.createClassicPreviewTemplates(
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
                    templatePickerLabel:
                        translation.translate('Preview template'),
                });
                pendingPreview = undefined;
                previewWindow.open();
            })
            .catch((error: unknown) => {
                popup.close();
                if (pendingPreview === popup) pendingPreview = undefined;
                if (!destroyed) {
                    ui?.notifications.show({
                        message: ui.translate(
                            'Preview failed to load. Your content is preserved.',
                        ),
                        severity: 'error',
                    });
                    reportError(error);
                }
            });
        return true;
    }

    function ensureSource(): Promise<void> {
        if (sourceEngine !== undefined) return Promise.resolve();
        if (sourceLoading !== undefined) return sourceLoading;
        visualChangedWhileSourceLoads = false;
        dom.root.dataset.soeditorSourceState = 'loading';
        dom.root.setAttribute('aria-busy', 'true');
        ui?.notifications.show({
            message: ui.translate('Loading HTML Source…'),
            severity: 'info',
        });
        const load =
            sourceAttempts++ === 0
                ? import('@soeditor/source')
                : loadSourceRecovery(sourceAttempts);
        sourceLoading = load
            .then((module) => {
                assertAlive();
                const editor = requireEditor();
                sourceModule = module;
                sourceEngine = module.createSourceEditingEngine({
                    activateOnFocus: true,
                    ...(options.cspNonce === undefined
                        ? {}
                        : { cspNonce: options.cspNonce }),
                    ariaLabel: `${ariaLabel} HTML source`,
                    editor,
                    element: dom.source,
                });
                const coordinator = editor.services.get(
                    projectionCoordinatorServiceToken,
                );
                if (coordinator.get('source').visible)
                    editor.execute('projection.hide', 'source');
                const sourceOptions = options.source;
                const formatter = formattingService;
                disposeSourceEnhancements =
                    module.attachClassicSourceEnhancements({
                        document,
                        editor,
                        ...(sourceOptions?.autoFormat === true &&
                        formatter !== undefined
                            ? {
                                  format: (source: string) =>
                                      formatter.format(
                                          source,
                                          sourceOptions.formatting,
                                      ),
                                  formatDelay:
                                      sourceOptions.autoFormatDelay ?? 300,
                              }
                            : {}),
                        formatOnAttach: visualChangedWhileSourceLoads,
                        isDestroyed: () => destroyed,
                        isSelectionSyncActive: () =>
                            classicSplitOrientation(workspaceView) !==
                                undefined &&
                            coordinator.snapshot.primary === 'wysiwyg',
                        isScrollSyncActive: () =>
                            classicSplitOrientation(workspaceView) !==
                            undefined,
                        reportError: (error) => {
                            reportError(error);
                        },
                        scrollSync: sourceOptions?.scrollSync === true,
                        source: dom.source,
                        visual: dom.visualContent,
                        visualScroller: dom.visual,
                        visualShadow: dom.visualShadow,
                    });
                dom.root.dataset.soeditorSourceState = 'ready';
                ui?.refresh();
            })
            .catch((error: unknown) => {
                disposeSourceEnhancements?.();
                disposeSourceEnhancements = undefined;
                sourceEngine?.destroy();
                sourceEngine = undefined;
                sourceLoading = undefined;
                if (!destroyed) {
                    dom.root.dataset.soeditorSourceState = 'failed';
                    ui?.notifications.show({
                        message: ui.translate(
                            'HTML Source failed to load. Select Source to retry.',
                        ),
                        severity: 'error',
                    });
                    reportError(error);
                }
                throw error;
            })
            .finally(() => {
                dom.root.removeAttribute('aria-busy');
            });
        return sourceLoading;
    }

    function attachSourceCommands(editor: Editor): void {
        for (const [id, view] of [
            ['editor.source', 'source'],
            ['editor.visual', 'wysiwyg'],
        ] as const) {
            if (editor.commands.has(id)) continue;
            editor.commands.register({
                id,
                canExecute: () => !destroyed,
                isActive: () => editor.state.mode === view,
                execute: (_context, ...args) => {
                    if (args.length !== 0)
                        throw new TypeError(
                            `Command "${id}" does not accept arguments.`,
                        );
                    return setWorkspaceView(view);
                },
            });
        }
        if (!editor.commands.has('editor.source.find')) {
            editor.commands.register({
                id: 'editor.source.find',
                execute: async (_context, ...args) => {
                    const query = args[0];
                    if (
                        args.length > 1 ||
                        (query !== undefined && typeof query !== 'string')
                    )
                        throw new TypeError(
                            'Source find accepts one optional string.',
                        );
                    await setWorkspaceView('source');
                    assertAlive();
                    if (
                        sourceModule !== undefined &&
                        editor.state.mode === 'source'
                    )
                        editor.services
                            .get(sourceModule.sourceEditingServiceToken)
                            .openSearchPanel(query);
                },
            });
        }
    }

    function setWorkspaceView(
        view: ClassicWorkspaceView,
    ): void | Promise<void> {
        const request = ++viewRequest;
        const needsSource =
            view === 'source' || classicSplitOrientation(view) !== undefined;
        if (needsSource && !editingModes.has('source')) {
            throw new Error('HTML Source is not enabled.');
        }
        if (
            OPTIONAL_CLASSIC_FEATURES &&
            needsSource &&
            sourceEngine === undefined
        ) {
            return ensureSource().then(() => {
                if (!destroyed && request === viewRequest)
                    applyWorkspaceView(view);
            });
        }
        applyWorkspaceView(view);
    }

    function applyWorkspaceView(view: ClassicWorkspaceView): void {
        if (
            OPTIONAL_CLASSIC_FEATURES &&
            view !== 'source' &&
            hasInvalidSource()
        ) {
            ui?.notifications.show({
                message: translation.translate(
                    'HTML Source contains errors. WYSIWYG stays read-only until Source is repaired.',
                ),
                severity: 'error',
            });
        }
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
        destroyed = true;
        ++viewRequest;
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
            disposeBlockParagraphContext?.();
            disposeBlockParagraphContext = undefined;
            disposeImageContext?.();
            disposeImageContext = undefined;
            disposeDialogWindows?.();
            disposeDialogWindows = undefined;
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
            sourceEngine?.destroy();
            sourceEngine = undefined;
            previewWindow?.destroy();
            previewWindow = undefined;
            pendingPreview?.close();
            pendingPreview = undefined;
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
        workspace = await createClassicHost({
            attachments: [
                (editor) =>
                    createWysiwygEditingEngine({
                        activateOnFocus: true,
                        ariaLabel,
                        editor,
                        element: dom.visualContent,
                    }),
                (editor) => attachClassicUi(editor),
            ],
            createEditor: () =>
                Editor.create({
                    ...(options.config === undefined
                        ? {}
                        : { config: options.config }),
                    data: latestSource,
                    format: 'html',
                    plugins,
                    readonly:
                        options.readonly ??
                        (textarea?.readOnly === true ||
                            textarea?.disabled === true),
                }),
            isDestroyed: () => destroyed,
            onChange: (change) => {
                if (OPTIONAL_CLASSIC_FEATURES && sourceLoading !== undefined)
                    visualChangedWhileSourceLoads = change.origin === 'user';
                updateHost(change.source);
                options.onChange?.(change);
            },
        });
        coreEditor = workspace.editor;
        if (OPTIONAL_CLASSIC_FEATURES && initialEditingMode === 'source')
            await ensureSource();
        const coordinator = coreEditor.services.get(
            projectionCoordinatorServiceToken,
        );
        if (!coordinator.get(initialEditingMode).visible) {
            coreEditor.execute('projection.show', initialEditingMode);
        }
        coreEditor.execute('projection.activate', initialEditingMode);
        if (OPTIONAL_CLASSIC_FEATURES && options.save !== undefined) {
            const saveOptions = options.save;
            const { createEditorSaveWorkflow } =
                await import('@soeditor/workspace/save');
            saveWorkflow = createEditorSaveWorkflow({
                adapter: {
                    save: (request) => {
                        if (hasInvalidSource()) throw invalidSourceError();
                        return saveOptions.adapter.save(request);
                    },
                },
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
        if (OPTIONAL_CLASSIC_FEATURES && editingModes.has('source')) {
            formattingService = attachClassicSourceFormatting(
                editor,
                () => destroyed,
            );
            attachSourceCommands(editor);
        }
        if (previewOptions !== undefined) {
            registerClassicPreviewTool(registry, openPreview);
        }
        if (OPTIONAL_CLASSIC_FEATURES) {
            registerClassicShowBlocksTool(editor, registry, commandSurface);
        }
        ui = createCmsEditorUi({
            readFormatStates: () =>
                editor.services
                    .tryGet(visualEditingServiceToken)
                    ?.getFormatStates?.() ?? {},
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
        const statusBar = ui.statusElement.closest<HTMLElement>(
            '.soeditor-ui__status-bar',
        );
        if (statusBar !== null) dom.surfaces.after(statusBar);
        if (OPTIONAL_CLASSIC_FEATURES) {
            disposeDialogWindows = attachLazyClassicDialogWindows(
                dom.root,
                ui.translate,
                translation.locale,
            );
        }
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
        const blockUi = ui;
        disposeBlockParagraphContext = attachLazyBlockContext(
            ui,
            commandSurface,
            [
                'soeditor:image-select',
                'soeditor:table-selection',
                'soeditor:block-hover',
            ],
            () =>
                import('./classic-block-paragraph.js').then(
                    (module) => (event: Pick<Event, 'target' | 'type'>) =>
                        module.attachBlockParagraphContext(
                            blockUi,
                            commandSurface,
                            event,
                        ),
                ),
        );
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
                    // Loading errors are already reported by ensureSource.
                    void Promise.resolve(setWorkspaceView(target)).catch(
                        () => undefined,
                    );
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
                return setWorkspaceView(view);
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
                void Promise.resolve(
                    editor.execute('classic.workspace.set', view),
                ).catch(() => undefined);
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
    visualStyle.textContent = wysiwygContentStyles + SHOW_BLOCKS_STYLES;
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

function attachLazyBlockContext(
    ui: EditorUi,
    visual: HTMLElement,
    events: readonly string[],
    load: () => Promise<(event: Pick<Event, 'target' | 'type'>) => () => void>,
): () => void {
    let destroyed = false;
    let dispose: (() => void) | undefined;
    let loading = false;
    let pending:
        | { detail: unknown; target: EventTarget | null; type: string }
        | undefined;
    const leave = (event: Event): void => {
        if (pending?.type !== 'soeditor:block-hover') return;
        const block = pending.target;
        if (
            event instanceof MouseEvent &&
            block instanceof Element &&
            !(
                event.relatedTarget instanceof Node &&
                block.contains(event.relatedTarget)
            )
        ) {
            pending = undefined;
        }
    };
    const listen = (enabled: boolean): void => {
        if (enabled) visual.addEventListener('pointerout', leave);
        else visual.removeEventListener('pointerout', leave);
        for (const type of events) {
            if (enabled) visual.addEventListener(type, activate);
            else visual.removeEventListener(type, activate);
        }
    };
    const activate = (event: Event): void => {
        if (dispose !== undefined) return;
        pending = {
            detail: Reflect.get(event, 'detail'),
            target: event.target,
            type: event.type,
        };
        if (loading) return;
        loading = true;
        void load()
            .then((attach) => {
                if (destroyed) return;
                const replay = pending;
                pending = undefined;
                loading = false;
                if (replay !== undefined) {
                    listen(false);
                    dispose = attach(replay);
                }
            })
            .catch(() => {
                if (destroyed) return;
                loading = false;
                listen(true);
                ui.notifications.show({
                    message: 'Block tools failed to load. Please try again.',
                    severity: 'error',
                });
            });
    };
    listen(true);
    return () => {
        destroyed = true;
        listen(false);
        dispose?.();
    };
}

function attachClassicImageContext(
    ui: EditorUi,
    visual: HTMLElement,
): () => void {
    return attachLazyBlockContext(
        ui,
        visual,
        ['soeditor:image-activate', 'soeditor:image-select'],
        () =>
            import('./classic-image-context.js').then(
                (module) => (event: Pick<Event, 'target' | 'type'>) =>
                    module.attachClassicImageContext(ui, visual, event),
            ),
    );
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
        if (origin instanceof Element && origin.closest('img') !== null) return;
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
    return attachLazyBlockContext(
        ui,
        visual,
        ['soeditor:table-selection'],
        () =>
            import('./classic-table-context.js').then(
                (module) => (event: Pick<Event, 'target' | 'type'>) =>
                    module.attachClassicTableContext(editor, ui, visual, event),
            ),
    );
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
    const visible: Array<ToolbarConfiguration[number]> = [];
    for (const item of toolbar) {
        if (typeof item === 'string' && HIDDEN_CLASSIC_TOOLBAR_ITEMS.has(item))
            continue;
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
        ':scope > [data-toolbar-item="popupPreview"]',
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
        const item = toolbar.querySelector<HTMLElement>(`:scope > ${selector}`);
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

function registerClassicShowBlocksTool(
    editor: Editor,
    registry: UiRegistryService,
    visual: HTMLElement,
): void {
    let visible = false;
    editor.commands.register({
        id: 'classic.blocks.toggle',
        label: 'Show block boundaries',
        execute: (_context, ...args) => {
            if (args.length !== 0) {
                throw new TypeError(
                    'Command "classic.blocks.toggle" does not accept arguments.',
                );
            }
            visible = !visible;
            visual.dataset.soeditorShowBlocks = String(visible);
            return visible;
        },
        isActive: () => visible,
    });
    registry.registerToolbarItem('showBlocks', ({ document, ui }) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'soeditor-ui__button';
        button.dataset.classicAction = 'show-blocks';
        ui.setIcon(
            button,
            'view.blocks',
            ui.translate('Show block boundaries'),
        );
        const update = (): void => {
            const active = editor.commands.isActive('classic.blocks.toggle');
            const label = ui.translate(
                active ? 'Hide block boundaries' : 'Show block boundaries',
            );
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-pressed', String(active));
            button.setAttribute('aria-label', label);
            button.title = label;
        };
        const click = (): void => {
            editor.execute('classic.blocks.toggle');
            update();
        };
        button.addEventListener('click', click);
        update();
        return {
            destroy: () => button.removeEventListener('click', click),
            element: button,
            update,
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
        options.scrollSync !== undefined &&
        typeof options.scrollSync !== 'boolean'
    ) {
        throw new TypeError('Classic Source scrollSync must be a boolean.');
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
