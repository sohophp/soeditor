import {
    Editor,
    type EditorConfig,
    type PluginConstructor,
    type TransactionOrigin,
} from '@soeditor/core';
import { pastePipelineServiceToken } from '@soeditor/engine';
import {
    createWysiwygEditingEngine,
    setWysiwygContentStylePreset,
    type WysiwygContentStylePreset,
} from '@soeditor/wysiwyg';

import wysiwygContentStyles from './wysiwyg-content.css?inline';
import { cmsPreset } from '@soeditor/presets/cms';
import type { EditorPreset } from '@soeditor/presets';
import {
    projectionCoordinatorServiceToken,
    type ProjectionId,
} from '@soeditor/projections';
import {
    createEditorUi,
    type DismissibleUiHandle,
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
    createEditorSaveWorkflow,
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
    readonly preset?: EditorPreset;
    readonly readonly?: boolean;
    readonly resizable?: boolean;
    readonly save?: ClassicEditorSaveOptions;
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
    setWorkspaceView(view: ClassicWorkspaceView): void;
    retrySave(): Promise<EditorSaveResult>;
    save(): Promise<EditorSaveResult>;
    setData(source: string): void;
    setContentStylePreset(preset: WysiwygContentStylePreset): void;
    setReadonly(readonly: boolean): void;
}

/** Built-in Classic projection arrangements. */
export type ClassicWorkspaceView = 'single' | 'wysiwyg' | 'source';

interface ClassicDom {
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

interface TableContextField {
    readonly advanced?: boolean;
    readonly key: string;
    readonly label: string;
    readonly options?: readonly string[];
    readonly type: 'number' | 'select' | 'text' | 'width';
}

interface TableWidthControl {
    readonly element: HTMLElement;
    focus(): void;
    validate(): boolean;
    value(): string;
}

type TableContextPropertyKind = 'cell' | 'row' | 'table';

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
    const preset = readPreset(options.preset ?? cmsPreset);
    const placeholder = optionalNonEmptyString(
        options.placeholder,
        'placeholder',
    );
    const locale = optionalNonEmptyString(options.locale, 'locale') ?? 'en';
    const translation = resolveUiTranslation(
        locale,
        options.translations,
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
    const editingModes = readEditingModes(options.editingModes);
    const sourceModule = editingModes.has('source')
        ? await import('@soeditor/source')
        : undefined;
    const configuredPlugins = options.plugins ?? preset.plugins;
    const plugins =
        sourceModule === undefined ||
        configuredPlugins.some(
            (plugin) => plugin.id === sourceModule.SourceEditingPlugin.id,
        )
            ? configuredPlugins
            : [...configuredPlugins, sourceModule.SourceEditingPlugin];
    const initialEditingMode = readInitialEditingMode(
        options.initialEditingMode,
        editingModes,
    );
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
    let saveButton: HTMLButtonElement | undefined;
    let disposeTableContext: (() => void) | undefined;
    let disposeLinkContext: (() => void) | undefined;
    let disposeImageContext: (() => void) | undefined;
    let disposePasteDiagnostics: (() => void) | undefined;
    let disposeEditingFeedback: (() => void) | undefined;
    let disposeModeChrome: (() => void) | undefined;
    let disposeProjectionChrome: (() => void) | undefined;
    let manualHeight = false;
    let resizeStart:
        { readonly height: number; readonly y: number } | undefined;

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
        const target = view === 'single' ? coordinator.snapshot.primary : view;
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
        editor.execute('projection.activate', target);
        for (const id of ['wysiwyg', 'source'] as const) {
            if (!coordinator.isAttached(id)) continue;
            const activity = coordinator.get(id);
            if (id !== target && activity.visible) {
                editor.execute('projection.hide', id);
            }
        }
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
            resizeHandle?.removeEventListener('pointerdown', onResizeStart);
            resizeHandle?.removeEventListener('keydown', onResizeKeydown);
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
        const coordinator = coreEditor.services.get(
            projectionCoordinatorServiceToken,
        );
        if (!coordinator.get(initialEditingMode).visible) {
            coreEditor.execute('projection.show', initialEditingMode);
        }
        coreEditor.execute('projection.activate', initialEditingMode);
        if (options.save !== undefined) {
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
                    updateSaveButton(state);
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
            attachSaveButton();
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
        registerClassicContextMenu(registry, commandSurface);
        ui = createEditorUi({
            accessibilityHelp: true,
            documentStatus: true,
            direction: translation.direction,
            editor,
            element: dom.root,
            ...(options.icons === undefined ? {} : { icons: options.icons }),
            locale: translation.locale,
            ...(options.theme === undefined ? {} : { theme: options.theme }),
            ...(options.themeVariables === undefined
                ? {}
                : { themeVariables: options.themeVariables }),
            toolbar:
                options.toolbar ??
                (editingModes.has('source')
                    ? [...preset.toolbar, '|', 'source']
                    : preset.toolbar),
            toolbarLayout: options.toolbarLayout ?? {
                collapsible: true,
                overflow: 'wrap',
                sticky: true,
            },
            ...(options.translations === undefined
                ? {}
                : { translations: options.translations }),
        });
        disposeTableContext = attachClassicTableContext(
            editor,
            ui,
            commandSurface,
        );
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
        };
        updateModeChrome();
        disposeModeChrome = editor.events.on('mode:change', updateModeChrome);
        attachWorkspaceControls(editor);
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
        ];
        const workspacePicker = document.createElement('label');
        workspacePicker.className = 'soeditor-classic__workspace-picker';
        const workspacePickerText = document.createElement('span');
        workspacePickerText.textContent =
            ui?.translate('Editing view') ?? 'Editing view';
        const workspaceSelect = document.createElement('select');
        workspaceSelect.dataset.classicAction = 'workspace-view';
        workspaceSelect.dataset.soeditorNoTranslate = 'true';
        workspaceSelect.setAttribute(
            'aria-label',
            ui?.translate('Editing view') ?? 'Editing view',
        );
        for (const [view, label] of controls) {
            const option = document.createElement('option');
            option.value = view;
            option.textContent = label;
            workspaceSelect.append(option);
        }
        workspaceSelect.addEventListener('change', () => {
            editor.execute('classic.workspace.set', workspaceSelect.value);
        });
        workspacePicker.append(workspacePickerText, workspaceSelect);
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
            const currentView = controls.find(
                ([view]) => view !== 'single' && visibleIds.has(view),
            )?.[0];
            if (currentView !== undefined) {
                workspaceSelect.value = currentView;
                dom.root.dataset.soeditorWorkspaceView = currentView;
            }
        };
        update();
        disposeProjectionChrome = coordinator.subscribe(update);
        ui?.refresh();
    }

    function attachSaveButton(): void {
        if (ui === undefined || saveWorkflow === undefined) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'soeditor-ui__button';
        button.dataset.classicAction = 'save';
        button.addEventListener('click', () => {
            void Promise.resolve(requireEditor().execute('editor.save')).catch(
                reportError,
            );
        });
        ui.toolbarElement.append(button);
        saveButton = button;
        updateSaveButton(saveWorkflow.state);
        ui.refresh();
    }

    function updateSaveButton(state: EditorSaveState): void {
        if (saveButton === undefined || ui === undefined) return;
        const label =
            state.status === 'saving'
                ? 'Saving'
                : state.status === 'error' || state.status === 'conflict'
                  ? 'Retry save'
                  : 'Save';
        ui.setIcon(saveButton, 'editor.save', ui.translate(label));
        saveButton.title = ui.translate(label);
        saveButton.setAttribute('aria-label', ui.translate(label));
        saveButton.disabled =
            !requireEditor().commands.canExecute('editor.save');
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
    if (editingModes.has('source')) surfaces.append(source);
    root.append(surfaces);
    if (resizeHandle !== undefined) root.append(resizeHandle);
    return Object.freeze({
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
    return value === 'single' || value === 'wysiwyg' || value === 'source';
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

function registerClassicContextMenu(
    registry: UiRegistryService,
    visual: HTMLElement,
): void {
    const within = (target: Element, selector: string): boolean => {
        const match = target.closest(selector);
        return match !== null && visual.contains(match);
    };
    registry.registerContextMenuItem('classic.link.remove', {
        command: 'link.remove',
        label: 'Remove link',
        when: ({ target }) => within(target, 'a'),
    });
    registry.registerContextMenuItem('classic.table.row-after', {
        command: 'table.row.insertAfter',
        label: 'Insert row after',
        when: ({ target }) => within(target, 'table'),
    });
    registry.registerContextMenuItem('classic.table.column-after', {
        command: 'table.column.insertAfter',
        label: 'Insert column after',
        when: ({ target }) => within(target, 'table'),
    });
    registry.registerContextMenuItem('classic.table.row-remove', {
        command: 'table.row.remove',
        label: 'Delete selected rows',
        when: ({ target }) => within(target, 'table'),
    });
    registry.registerContextMenuItem('classic.table.column-remove', {
        command: 'table.column.remove',
        label: 'Delete selected columns',
        when: ({ target }) => within(target, 'table'),
    });
    registry.registerContextMenuItem('classic.table.remove', {
        command: 'table.remove',
        label: 'Delete table',
        when: ({ target }) => within(target, 'table'),
    });
}

function attachClassicImageContext(
    ui: EditorUi,
    visual: HTMLElement,
): () => void {
    const document = visual.ownerDocument;
    const activate = (event: Event): void => {
        const detail: unknown = Reflect.get(event, 'detail');
        if (typeof detail !== 'object' || detail === null) return;
        const element: unknown = Reflect.get(detail, 'element');
        const update: unknown = Reflect.get(detail, 'update');
        const remove: unknown = Reflect.get(detail, 'remove');
        if (
            !(element instanceof HTMLImageElement) ||
            !visual.contains(element) ||
            typeof update !== 'function' ||
            typeof remove !== 'function'
        ) {
            return;
        }
        const figure = element.closest('figure');
        const link =
            element.parentElement?.tagName === 'A'
                ? element.parentElement
                : undefined;
        const caption = figure?.querySelector(':scope > figcaption');
        const body = document.createElement('div');
        body.className = 'soeditor-classic__image-properties';
        const controls = new Map<string, HTMLInputElement>();
        for (const [name, label, type, initial] of [
            ['src', 'Image URL', 'url', element.getAttribute('src') ?? ''],
            [
                'alt',
                'Alternative text',
                'text',
                element.getAttribute('alt') ?? '',
            ],
            ['title', 'Title', 'text', element.getAttribute('title') ?? ''],
            ['caption', 'Caption', 'text', caption?.textContent ?? ''],
            ['width', 'Width', 'number', element.getAttribute('width') ?? ''],
            [
                'height',
                'Height',
                'number',
                element.getAttribute('height') ?? '',
            ],
            ['link', 'Link URL', 'url', link?.getAttribute('href') ?? ''],
            [
                'responsiveClass',
                'Responsive CSS classes',
                'text',
                element.getAttribute('class') ?? '',
            ],
            [
                'srcset',
                'Responsive sources',
                'text',
                element.getAttribute('srcset') ?? '',
            ],
            [
                'sizes',
                'Responsive sizes',
                'text',
                element.getAttribute('sizes') ?? '',
            ],
        ] as const) {
            const field = document.createElement('label');
            const caption = document.createElement('span');
            caption.textContent = label;
            const input = document.createElement('input');
            input.type = type;
            input.value = initial;
            input.setAttribute('aria-label', label);
            if (type === 'number') input.min = '1';
            controls.set(name, input);
            field.append(caption, input);
            body.append(field);
        }
        const alignmentField = document.createElement('label');
        const alignmentCaption = document.createElement('span');
        alignmentCaption.textContent = 'Alignment';
        const alignment = document.createElement('select');
        alignment.setAttribute('aria-label', 'Alignment');
        for (const [value, label] of [
            ['', 'Default'],
            ['left', 'Left'],
            ['center', 'Center'],
            ['right', 'Right'],
            ['wide', 'Wide'],
        ] as const) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            alignment.append(option);
        }
        alignment.value = figure?.getAttribute('data-align') ?? '';
        alignmentField.append(alignmentCaption, alignment);
        body.append(alignmentField);
        const aspectField = document.createElement('label');
        const aspectLocked = document.createElement('input');
        aspectLocked.type = 'checkbox';
        aspectLocked.checked =
            figure?.getAttribute('data-aspect-lock') === 'true';
        aspectLocked.setAttribute('aria-label', 'Lock aspect ratio');
        aspectField.append(aspectLocked, ' Lock aspect ratio');
        body.append(aspectField);
        const dialog = ui.dialogs.open({
            title: 'Image properties',
            content: body,
            actions: [
                {
                    label: 'Remove image',
                    run: () => {
                        dialog.close();
                        Reflect.apply(remove, undefined, []);
                    },
                },
                {
                    kind: 'primary',
                    label: 'Update image',
                    run: () => {
                        const values = Object.fromEntries(
                            [...controls].map(([name, input]) => [
                                name,
                                input.value,
                            ]),
                        );
                        Object.assign(values, {
                            alignment: alignment.value,
                            aspectLocked: aspectLocked.checked,
                        });
                        dialog.close();
                        Reflect.apply(update, undefined, [values]);
                    },
                },
            ],
        });
        controls.get('src')?.focus();
    };
    visual.addEventListener('soeditor:image-activate', activate);
    return () =>
        visual.removeEventListener('soeditor:image-activate', activate);
}

function attachClassicLinkContext(
    editor: Editor,
    ui: EditorUi,
    visual: HTMLElement,
): () => void {
    const document = visual.ownerDocument;
    let balloon: DismissibleUiHandle | undefined;
    let activeLink: HTMLAnchorElement | undefined;
    const close = (): void => {
        balloon?.close();
        balloon = undefined;
        activeLink = undefined;
    };
    const selectLink = (link: HTMLAnchorElement): void => {
        const focusTarget =
            link.closest<HTMLElement>('.soeditor-table-cell') ?? visual;
        focusTarget.focus({ preventScroll: true });
        const range = document.createRange();
        range.selectNodeContents(link);
        const selection = document.getSelection();
        selection?.setBaseAndExtent(
            range.startContainer,
            range.startOffset,
            range.endContainer,
            range.endOffset,
        );
        document.dispatchEvent(new Event('selectionchange'));
    };
    const report = (error: unknown): void => {
        ui.notifications.show({
            message: error instanceof Error ? error.message : String(error),
            severity: 'error',
        });
    };
    const click = (event: MouseEvent): void => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey) return;
        const origin = event.target;
        const link =
            origin instanceof Element
                ? origin.closest<HTMLAnchorElement>(
                      'a[data-soeditor-link="true"], a[href]',
                  )
                : null;
        if (link === null || !visual.contains(link)) return;
        event.preventDefault();
        selectLink(link);
        close();
        activeLink = link;
        balloon = ui.balloons.show({
            anchor: link,
            placement: 'above',
            content: (container) => {
                container.setAttribute('aria-label', 'Link actions');
                const value = document.createElement('span');
                let inspected: unknown;
                try {
                    inspected = editor.execute('link.inspect');
                } catch {
                    inspected = undefined;
                }
                const href =
                    typeof inspected === 'object' && inspected !== null
                        ? Reflect.get(inspected, 'href')
                        : undefined;
                value.textContent = typeof href === 'string' ? href : '';
                const edit = document.createElement('button');
                edit.type = 'button';
                edit.className = 'soeditor-ui__button';
                ui.setIcon(edit, 'link.edit', 'Edit link');
                edit.title = 'Edit link';
                edit.setAttribute('aria-label', 'Edit link');
                edit.addEventListener('click', () => {
                    const current = activeLink;
                    close();
                    if (current === undefined) return;
                    selectLink(current);
                    ui.toolbarElement
                        .querySelector<HTMLButtonElement>(
                            '[data-toolbar-item="link"]',
                        )
                        ?.click();
                });
                const remove = document.createElement('button');
                remove.type = 'button';
                remove.className = 'soeditor-ui__button';
                ui.setIcon(remove, 'link.remove', 'Remove link');
                remove.title = 'Remove link';
                remove.setAttribute('aria-label', 'Remove link');
                remove.addEventListener('click', () => {
                    const current = activeLink;
                    close();
                    if (current === undefined) return;
                    selectLink(current);
                    try {
                        editor.execute('link.remove');
                    } catch (error: unknown) {
                        report(error);
                    }
                });
                container.append(value, edit, remove);
            },
        });
    };
    const pointerDown = (event: PointerEvent): void => {
        const target = event
            .composedPath()
            .find((candidate): candidate is Node => candidate instanceof Node);
        if (!(target instanceof Node)) return;
        if (balloon?.element.contains(target) === true) return;
        if (
            target instanceof Element &&
            target.closest('a[data-soeditor-link="true"], a[href]') ===
                activeLink
        ) {
            return;
        }
        close();
    };
    visual.addEventListener('click', click);
    document.addEventListener('pointerdown', pointerDown, true);
    return () => {
        close();
        visual.removeEventListener('click', click);
        document.removeEventListener('pointerdown', pointerDown, true);
    };
}

function attachClassicTableContext(
    editor: Editor,
    ui: EditorUi,
    visual: HTMLElement,
): () => void {
    const document = visual.ownerDocument;
    let balloon: DismissibleUiHandle | undefined;
    let activeTable: HTMLElement | undefined;
    let activeTarget: HTMLElement | undefined;
    let activeSelection: (() => void) | undefined;
    const commandButtons = new Map<string, HTMLButtonElement>();
    const refreshCommandButtons = (): void => {
        for (const [command, button] of commandButtons) {
            button.disabled = !editor.commands.canExecute(command);
        }
    };
    const close = (): void => {
        balloon?.close();
        balloon = undefined;
        commandButtons.clear();
    };
    const execute = (command: string, ...args: readonly unknown[]): boolean => {
        const EventConstructor = document.defaultView?.Event ?? Event;
        activeTarget?.dispatchEvent(
            new EventConstructor('soeditor:table-commit-request', {
                bubbles: true,
            }),
        );
        close();
        try {
            editor.execute(command, ...args);
            return true;
        } catch (error: unknown) {
            ui.notifications.show({
                message: error instanceof Error ? error.message : String(error),
                severity: 'error',
            });
            return false;
        }
    };
    const openCellEditor = (
        anchor: HTMLElement,
        activate: () => void,
    ): void => {
        anchor.focus();
        activate();
        let inspected: unknown;
        try {
            inspected = editor.execute('table.cell.inspect');
        } catch (error: unknown) {
            ui.notifications.show({
                message: error instanceof Error ? error.message : String(error),
                severity: 'error',
            });
            return;
        }
        close();
        const body = document.createElement('div');
        body.className = 'soeditor-table-cell-editor';
        const help = document.createElement('p');
        help.className = 'soeditor-table-cell-editor__help';
        help.textContent =
            'Edit the HTML inside this cell. Nested tables are not allowed.';
        const input = document.createElement('textarea');
        input.className = 'soeditor-table-context__editor';
        input.value = tableContextProperty(inspected, 'contentHtml');
        input.rows = 6;
        input.spellcheck = false;
        input.setAttribute('aria-label', 'Cell HTML');
        body.append(help, input);
        const apply = (): void => {
            anchor.focus();
            activate();
            if (execute('table.cell.setHtml', input.value)) {
                dialog.close();
            }
        };
        const dialog = ui.dialogs.open({
            title: 'Edit cell HTML',
            content: body,
            actions: [
                {
                    kind: 'primary',
                    label: 'Apply',
                    run: apply,
                },
            ],
        });
        dialog.element.classList.add('soeditor-ui__link-dialog');
        input.addEventListener('keydown', (event) => {
            if (
                event.key !== 'Enter' ||
                event.isComposing ||
                (!event.ctrlKey && !event.metaKey)
            ) {
                return;
            }
            event.preventDefault();
            apply();
        });
        input.focus();
        input.select();
    };
    const openProperties = (
        anchor: HTMLElement,
        activate: () => void,
        kind: TableContextPropertyKind,
    ): void => {
        anchor.focus();
        activate();
        const inspectCommand =
            kind === 'table' ? 'table.inspect' : `table.${kind}.inspect`;
        let inspected: unknown;
        try {
            inspected = editor.execute(inspectCommand);
        } catch (error: unknown) {
            ui.notifications.show({
                message: error instanceof Error ? error.message : String(error),
                severity: 'error',
            });
            return;
        }
        close();
        const fields: readonly TableContextField[] =
            kind === 'table'
                ? [
                      { key: 'caption', label: 'Caption', type: 'text' },
                      { key: 'width', label: 'Table width', type: 'width' },
                      {
                          key: 'alignment',
                          label: 'Alignment',
                          options: ['left', 'center', 'right'],
                          type: 'select',
                      },
                      {
                          advanced: true,
                          key: 'responsiveClass',
                          label: 'Responsive classes',
                          type: 'text',
                      },
                      {
                          advanced: true,
                          key: 'ariaLabel',
                          label: 'Accessible label',
                          type: 'text',
                      },
                  ]
                : kind === 'row'
                  ? [
                        {
                            key: 'section',
                            label: 'Section',
                            options: ['head', 'body', 'foot'],
                            type: 'select',
                        },
                        { key: 'height', label: 'Height', type: 'number' },
                        {
                            advanced: true,
                            key: 'className',
                            label: 'Row classes',
                            type: 'text',
                        },
                        {
                            advanced: true,
                            key: 'ariaLabel',
                            label: 'Accessible label',
                            type: 'text',
                        },
                    ]
                  : [
                        {
                            key: 'horizontalAlignment',
                            label: 'Horizontal alignment',
                            options: ['left', 'center', 'right'],
                            type: 'select',
                        },
                        {
                            key: 'verticalAlignment',
                            label: 'Vertical alignment',
                            options: ['top', 'middle', 'bottom', 'baseline'],
                            type: 'select',
                        },
                        {
                            key: 'scope',
                            label: 'Header scope',
                            options: ['col', 'colgroup', 'row', 'rowgroup'],
                            type: 'select',
                        },
                        {
                            advanced: true,
                            key: 'className',
                            label: 'Cell classes',
                            type: 'text',
                        },
                        {
                            advanced: true,
                            key: 'ariaLabel',
                            label: 'Accessible label',
                            type: 'text',
                        },
                    ];
        const controls = new Map<
            string,
            HTMLInputElement | HTMLSelectElement
        >();
        let tableWidthControl: TableWidthControl | undefined;
        const body = document.createElement('div');
        body.className = 'soeditor-table-properties';
        if (kind === 'cell') {
            const selectionHelp = document.createElement('p');
            selectionHelp.className = 'soeditor-table-properties__help';
            selectionHelp.textContent = 'Changes apply to all selected cells.';
            body.append(selectionHelp);
        }
        const primaryFields = document.createElement('div');
        primaryFields.className =
            'soeditor-ui__link-target-controls soeditor-table-properties__primary';
        const advanced = document.createElement('details');
        advanced.className =
            'soeditor-ui__link-advanced soeditor-table-properties__advanced';
        const advancedSummary = document.createElement('summary');
        advancedSummary.textContent = 'Advanced settings';
        const advancedFields = document.createElement('div');
        advancedFields.className =
            'soeditor-ui__link-target-controls soeditor-ui__link-advanced-fields soeditor-table-properties__advanced-fields';
        let hasAdvancedFields = false;
        for (const field of fields) {
            const existing = tableContextProperty(inspected, field.key);
            const target = field.advanced ? advancedFields : primaryFields;
            if (field.advanced) {
                hasAdvancedFields = true;
                if (existing.length > 0) advanced.open = true;
            }
            if (field.type === 'width') {
                tableWidthControl = createTableWidthControl(
                    document,
                    existing,
                    ui.translate,
                );
                target.append(tableWidthControl.element);
                continue;
            }
            const label = document.createElement('label');
            label.className = 'soeditor-ui__field';
            label.dataset.tableField = field.key;
            const caption = document.createElement('span');
            caption.textContent = field.label;
            let control: HTMLInputElement | HTMLSelectElement;
            if (field.type === 'select') {
                const select = document.createElement('select');
                const empty = document.createElement('option');
                empty.value = '';
                empty.textContent = 'Default';
                select.append(empty);
                for (const value of field.options ?? []) {
                    const option = document.createElement('option');
                    option.value = value;
                    option.textContent = tablePropertyOptionLabel(value);
                    select.append(option);
                }
                select.value = existing;
                control = select;
            } else {
                const input = document.createElement('input');
                input.type = field.type;
                input.value = existing;
                if (field.type === 'number') input.min = '1';
                control = input;
            }
            controls.set(field.key, control);
            label.append(caption, control);
            target.append(label);
        }
        body.append(primaryFields);
        if (hasAdvancedFields) {
            advanced.append(advancedSummary, advancedFields);
            body.append(advanced);
        }
        const title =
            kind === 'table'
                ? 'Table properties'
                : kind === 'row'
                  ? 'Row properties'
                  : 'Cell properties';
        const command =
            kind === 'table' ? 'table.properties' : `table.${kind}.properties`;
        const dialog = ui.dialogs.open({
            title,
            content: body,
            actions: [
                {
                    kind: 'primary',
                    label: 'Apply',
                    run: () => {
                        if (
                            tableWidthControl !== undefined &&
                            !tableWidthControl.validate()
                        ) {
                            tableWidthControl.focus();
                            return;
                        }
                        const properties: Record<string, unknown> = {};
                        for (const field of fields) {
                            const rawValue =
                                field.type === 'width'
                                    ? (tableWidthControl?.value() ?? '')
                                    : (controls.get(field.key)?.value.trim() ??
                                      '');
                            const value = rawValue;
                            properties[field.key] =
                                field.type === 'number'
                                    ? value.length === 0
                                        ? null
                                        : Number(value)
                                    : field.key === 'section'
                                      ? value
                                      : value.length === 0
                                        ? null
                                        : value;
                        }
                        anchor.focus();
                        activate();
                        if (execute(command, properties)) {
                            dialog.close();
                        }
                    },
                },
            ],
        });
        dialog.element.classList.add('soeditor-ui__link-dialog');
        const firstControl = controls.values().next().value;
        if (firstControl !== undefined) firstControl.focus();
        else tableWidthControl?.focus();
    };
    const selection = (event: Event): void => {
        const origin = event.target;
        if (!(origin instanceof Element)) return;
        const target = origin.closest<HTMLElement>('.soeditor-table-cell');
        if (target === null) return;
        if (
            !target.classList.contains('soeditor-table-cell') ||
            !visual.contains(target)
        ) {
            return;
        }
        const activate = tableSelectionActivation(event);
        if (activate === undefined) return;
        const table = target.closest<HTMLElement>('.soeditor-table-widget');
        if (table === null) return;
        activeTarget = target;
        activeSelection = activate;
        if (balloon !== undefined && activeTable === table) {
            refreshCommandButtons();
            return;
        }
        close();
        activeTable = table;
        balloon = ui.balloons.show({
            anchor: table,
            placement: 'above',
            content: (container) => {
                container.classList.add('soeditor-table-context');
                container.setAttribute('aria-label', 'Table tools');
                const propertyActions = [
                    ['table.properties', 'Table properties', 'table'],
                    ['table.row.properties', 'Row properties', 'row'],
                    ['table.cell.properties', 'Cell properties', 'cell'],
                ] as const;
                for (const [iconId, label, kind] of propertyActions) {
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'soeditor-table-context__button';
                    ui.setIcon(button, iconId, label);
                    button.title = label;
                    button.setAttribute('aria-label', label);
                    button.addEventListener('click', () => {
                        const current = activeTarget;
                        const select = activeSelection;
                        if (current !== undefined && select !== undefined) {
                            openProperties(current, select, kind);
                        }
                    });
                    container.append(button);
                }
                const editCellHtml = document.createElement('button');
                editCellHtml.type = 'button';
                editCellHtml.className = 'soeditor-table-context__button';
                ui.setIcon(editCellHtml, 'editor.source', 'Edit cell HTML');
                editCellHtml.title = 'Edit cell HTML';
                editCellHtml.setAttribute('aria-label', 'Edit cell HTML');
                editCellHtml.disabled =
                    !editor.commands.canExecute('table.cell.setHtml');
                commandButtons.set('table.cell.setHtml', editCellHtml);
                editCellHtml.addEventListener('click', () => {
                    const current = activeTarget;
                    const select = activeSelection;
                    if (current !== undefined && select !== undefined) {
                        openCellEditor(current, select);
                    }
                });
                container.append(editCellHtml);
                const actions = [
                    ['table.row.insertAfter', 'Add row'],
                    ['table.row.remove', 'Delete row'],
                    ['table.column.insertAfter', 'Add column'],
                    ['table.column.remove', 'Delete column'],
                    ['table.header.toggle', 'Toggle header'],
                    ['table.cells.merge', 'Merge cells'],
                    ['table.cell.split', 'Split cell'],
                    ['table.cells.clear', 'Clear cells'],
                    ['table.remove', 'Delete table'],
                ] as const;
                for (const [command, label] of actions) {
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'soeditor-table-context__button';
                    ui.setIcon(button, command, label);
                    button.title = label;
                    button.setAttribute('aria-label', label);
                    button.disabled = !editor.commands.canExecute(command);
                    commandButtons.set(command, button);
                    button.addEventListener('click', () => {
                        activeSelection?.();
                        execute(command);
                    });
                    container.append(button);
                }
                const resizeLabel = document.createElement('label');
                resizeLabel.className = 'soeditor-table-context__resize';
                const resizeText = document.createElement('span');
                resizeText.textContent = 'Column width';
                const resize = document.createElement('input');
                resize.type = 'range';
                resize.min = '40';
                resize.max = '1200';
                resize.step = '10';
                resize.value = '120';
                resize.disabled = !editor.commands.canExecute(
                    'table.column.resize',
                );
                resize.addEventListener('change', () => {
                    activeSelection?.();
                    execute('table.column.resize', {
                        width: Number(resize.value),
                    });
                });
                resizeLabel.append(resizeText, resize);
                container.append(resizeLabel);
            },
        });
        balloon.element.classList.add('soeditor-ui__table-balloon');
    };
    const edit = (event: Event): void => {
        const origin = event.target;
        const target =
            origin instanceof Element
                ? origin.closest<HTMLElement>('.soeditor-table-cell')
                : null;
        const activate = tableSelectionActivation(event);
        if (
            target !== null &&
            target.classList.contains('soeditor-table-cell') &&
            visual.contains(target) &&
            activate !== undefined
        ) {
            openCellEditor(target, activate);
        }
    };
    const editingStart = (): void => ui.refresh();
    const editingEnd = (): void => ui.refresh();
    const pointerDown = (event: PointerEvent): void => {
        const path = event.composedPath();
        const target = path.find(
            (candidate): candidate is Node => candidate instanceof Node,
        );
        if (!(target instanceof Node)) return;
        if (
            balloon !== undefined &&
            path.some(
                (candidate) =>
                    candidate instanceof Node &&
                    balloon?.element.contains(candidate) === true,
            )
        ) {
            return;
        }
        if (
            path.some(
                (candidate) =>
                    candidate instanceof Element &&
                    candidate.closest('.soeditor-table-cell') !== null,
            )
        ) {
            return;
        }
        close();
        activeTable = undefined;
        activeTarget = undefined;
        activeSelection = undefined;
    };
    const keydown = (event: KeyboardEvent): void => {
        if (event.key === 'Escape' && balloon !== undefined) {
            event.preventDefault();
            close();
            visual.focus();
        }
    };
    visual.addEventListener('soeditor:table-selection', selection);
    visual.addEventListener('soeditor:table-edit', edit);
    visual.addEventListener('soeditor:table-editing-start', editingStart);
    visual.addEventListener('soeditor:table-editing-end', editingEnd);
    document.addEventListener('pointerdown', pointerDown, true);
    document.addEventListener('keydown', keydown);
    return () => {
        close();
        visual.removeEventListener('soeditor:table-selection', selection);
        visual.removeEventListener('soeditor:table-edit', edit);
        visual.removeEventListener(
            'soeditor:table-editing-start',
            editingStart,
        );
        visual.removeEventListener('soeditor:table-editing-end', editingEnd);
        document.removeEventListener('pointerdown', pointerDown, true);
        document.removeEventListener('keydown', keydown);
    };
}

function tableSelectionActivation(event: Event): (() => void) | undefined {
    const detail: unknown = Reflect.get(event, 'detail');
    if (typeof detail !== 'object' || detail === null) return undefined;
    const activate: unknown = Reflect.get(detail, 'activate');
    return typeof activate === 'function'
        ? () => {
              Reflect.apply(activate, undefined, []);
          }
        : undefined;
}

function tableContextProperty(value: unknown, key: string): string {
    if (typeof value !== 'object' || value === null) return '';
    const candidate: unknown = Reflect.get(value, key);
    return typeof candidate === 'string' || typeof candidate === 'number'
        ? String(candidate)
        : '';
}

function tablePropertyOptionLabel(value: string): string {
    const labels: Readonly<Record<string, string>> = {
        baseline: 'Baseline',
        body: 'Body',
        bottom: 'Bottom',
        center: 'Center',
        col: 'Column',
        colgroup: 'Column group',
        foot: 'Footer',
        head: 'Header',
        left: 'Left',
        middle: 'Middle',
        right: 'Right',
        row: 'Row',
        rowgroup: 'Row group',
        top: 'Top',
    };
    return labels[value] ?? value;
}

function createTableWidthControl(
    document: Document,
    currentValue: string,
    translate: (message: string) => string,
): TableWidthControl {
    const normalized = /^[1-9][0-9]{0,3}$/u.test(currentValue)
        ? `${currentValue}px`
        : currentValue;
    const presets = new Set(['25%', '50%', '75%', '100%']);
    const wrapper = document.createElement('div');
    wrapper.className = 'soeditor-ui__field soeditor-table-properties__width';
    wrapper.dataset.tableField = 'width';
    const caption = document.createElement('span');
    caption.textContent = 'Table width';
    const mode = document.createElement('select');
    mode.setAttribute('aria-label', 'Table width');
    const options = [
        ['auto', 'Automatic'],
        ['25%', '25%'],
        ['50%', '50%'],
        ['75%', '75%'],
        ['100%', '100%'],
        ['custom', 'Custom'],
    ] as const;
    for (const [value, label] of options) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        mode.append(option);
    }
    mode.value =
        normalized.length === 0
            ? 'auto'
            : presets.has(normalized)
              ? normalized
              : 'custom';

    const custom = document.createElement('div');
    custom.className =
        'soeditor-ui__link-rel-custom soeditor-table-properties__custom-width';
    const amount = document.createElement('input');
    amount.type = 'number';
    amount.inputMode = 'numeric';
    amount.min = '1';
    amount.step = '1';
    amount.setAttribute('aria-label', 'Custom width');
    const unit = document.createElement('select');
    unit.setAttribute('aria-label', 'Width unit');
    for (const [value, label] of [
        ['%', 'Percent'],
        ['px', 'Pixels'],
    ] as const) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        unit.append(option);
    }
    const parsed = /^(\d+)(px|%)$/u.exec(normalized);
    amount.value = parsed?.[1] ?? '';
    unit.value = parsed?.[2] ?? '%';
    const feedback = document.createElement('small');
    feedback.className = 'soeditor-table-properties__feedback';
    const refresh = (): boolean => {
        custom.hidden = mode.value !== 'custom';
        feedback.hidden = custom.hidden;
        if (custom.hidden) {
            amount.setCustomValidity('');
            amount.setAttribute('aria-invalid', 'false');
            feedback.classList.remove('is-error');
            feedback.textContent = '';
            return true;
        }
        const percent = unit.value === '%';
        const maximum = percent ? 100 : 9999;
        amount.max = String(maximum);
        const numeric = Number(amount.value);
        const valid =
            /^\d+$/u.test(amount.value) &&
            Number.isInteger(numeric) &&
            numeric >= 1 &&
            numeric <= maximum;
        const message = translate(
            percent
                ? 'Enter a whole number from 1 to 100.'
                : 'Enter a whole number from 1 to 9999.',
        );
        amount.setCustomValidity(valid ? '' : message);
        amount.setAttribute('aria-invalid', String(!valid));
        feedback.classList.toggle('is-error', !valid);
        feedback.textContent = message;
        return valid;
    };
    let previousMode = mode.value;
    mode.addEventListener('change', () => {
        if (
            mode.value === 'custom' &&
            presets.has(previousMode) &&
            amount.value.length === 0
        ) {
            amount.value = previousMode.slice(0, -1);
            unit.value = '%';
        }
        previousMode = mode.value;
        refresh();
        if (!custom.hidden) amount.focus();
    });
    amount.addEventListener('input', refresh);
    unit.addEventListener('change', refresh);
    custom.append(amount, unit);
    wrapper.append(caption, mode, custom, feedback);
    refresh();
    return Object.freeze({
        element: wrapper,
        focus: () => mode.focus(),
        validate: () => {
            if (refresh()) return true;
            amount.reportValidity();
            return false;
        },
        value: () => {
            if (mode.value === 'auto') return '';
            if (mode.value !== 'custom') return mode.value;
            return `${String(Number(amount.value))}${unit.value}`;
        },
    });
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
