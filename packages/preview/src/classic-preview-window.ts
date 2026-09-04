import type { Editor } from '@soeditor/core';
import {
    isCompleteHtmlDocument,
    normalizePreviewConfiguration,
    type PreviewConfiguration,
} from './configuration.js';
import { renderPreviewDocument } from './renderer.js';

let previewWindowSequence = 0;

export interface ClassicPreviewWindowOptions {
    readonly editor: Editor;
    readonly features?: string;
    readonly getTemplates: () => readonly ClassicPreviewWindowTemplate[];
    readonly initialTemplateId: string;
    readonly owner: Window;
    readonly reportError: (error: unknown) => void;
    readonly templatePickerLabel: string;
}

export interface ClassicPreviewWindowTemplate {
    readonly configuration: PreviewConfiguration;
    readonly decorateWysiwygTables: boolean;
    readonly id: string;
    readonly label: string;
}

export interface ClassicPreviewWindow {
    destroy(): void;
    open(): boolean;
    refresh(): void;
}

export interface ClassicPreviewTemplateOptions extends PreviewConfiguration {
    readonly id: string;
    readonly label: string;
    readonly wysiwygStyles?: boolean;
}

export interface ClassicPreviewTemplatesOptions extends PreviewConfiguration {
    readonly templates?: readonly ClassicPreviewTemplateOptions[];
    readonly wysiwygStyles?: boolean;
}

/** Builds the isolated built-in and host-provided Classic preview templates. */
export function createClassicPreviewTemplates(
    options: ClassicPreviewTemplatesOptions,
    contentStylePreset: string,
    wysiwygContentStyles: string,
    customContentStyles: string | undefined,
    translate: (key: string) => string,
): readonly ClassicPreviewWindowTemplate[] {
    const configuration = (
        value: ClassicPreviewTemplatesOptions,
    ): PreviewConfiguration => {
        const inheritedStyles =
            value.wysiwygStyles === false
                ? []
                : [
                      wysiwygContentStyles,
                      ...(customContentStyles === undefined
                          ? []
                          : [customContentStyles]),
                  ];
        return {
            ...(value.baseUrl === undefined ? {} : { baseUrl: value.baseUrl }),
            context: {
                ...value.context,
                soeditorContentStyle: contentStylePreset,
            },
            styles: [...inheritedStyles, ...(value.styles ?? [])],
            ...(value.stylesheets === undefined
                ? {}
                : { stylesheets: value.stylesheets }),
            template:
                value.template ??
                '<!doctype html><html><head><meta charset="utf-8"><title>Preview</title></head><body><main class="soeditor-wysiwyg-content" data-soeditor-content-style="{{ soeditorContentStyle }}">{{ content }}</main></body></html>',
            title: value.title ?? 'Content preview',
        };
    };
    const builtIns: ClassicPreviewWindowTemplate[] = [
        {
            configuration: configuration(options),
            decorateWysiwygTables: options.wysiwygStyles !== false,
            id: 'webpage',
            label: translate('Web page'),
        },
        {
            configuration: configuration({
                styles: [
                    'html { background: #e5e7eb; } body { margin: 0; padding: 24px 12px; } .soeditor-email-preview { background: #fff; box-sizing: border-box; margin: 0 auto; max-width: 600px; padding: 28px; width: 100%; } .soeditor-email-preview img { height: auto; max-width: 100%; }',
                ],
                template:
                    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main class="soeditor-wysiwyg-content soeditor-email-preview" data-soeditor-content-style="{{ soeditorContentStyle }}">{{ content }}</main></body></html>',
                title: translate('Email newsletter preview'),
            }),
            decorateWysiwygTables: true,
            id: 'email',
            label: translate('Email newsletter'),
        },
        {
            configuration: configuration({
                styles: [
                    'html { background: #d9dde3; } body { margin: 0; padding: 24px; } .soeditor-word-preview { background: #fff; box-shadow: 0 2px 12px #0002; box-sizing: border-box; margin: 0 auto; min-height: 297mm; padding: 25.4mm; width: 210mm; } @media (max-width: 850px) { body { padding: 8px; } .soeditor-word-preview { min-height: 0; padding: 32px; width: 100%; } }',
                ],
                template:
                    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main class="soeditor-wysiwyg-content soeditor-word-preview" data-soeditor-content-style="{{ soeditorContentStyle }}">{{ content }}</main></body></html>',
                title: translate('Word document preview'),
            }),
            decorateWysiwygTables: true,
            id: 'word',
            label: translate('Word document'),
        },
    ];
    for (const template of options.templates ?? []) {
        builtIns.push({
            configuration: configuration(template),
            decorateWysiwygTables: template.wysiwygStyles !== false,
            id: template.id,
            label: template.label,
        });
    }
    return Object.freeze(builtIns);
}

export function createClassicPreviewWindow(
    options: ClassicPreviewWindowOptions,
): ClassicPreviewWindow {
    validateTemplates(options.getTemplates(), options.initialTemplateId);
    const name = `soeditor-preview-${String(++previewWindowSequence)}`;
    let popup: Window | null = null;
    let iframe: HTMLIFrameElement | undefined;
    let templateSelect: HTMLSelectElement | undefined;
    let activeTemplateId = options.initialTemplateId;
    let destroyed = false;

    const refresh = (): void => {
        if (destroyed || popup === null || popup.closed) return;
        try {
            const template = requireTemplate(
                options.getTemplates(),
                activeTemplateId,
            );
            const configuration = normalizePreviewConfiguration(
                template.configuration,
            );
            if (iframe === undefined || !iframe.isConnected) {
                const frame = createPreviewFrame(
                    popup.document,
                    configuration.title,
                    options.getTemplates(),
                    activeTemplateId,
                    options.templatePickerLabel,
                    (id) => {
                        activeTemplateId = id;
                        refresh();
                    },
                );
                iframe = frame.iframe;
                templateSelect = frame.select;
            }
            if (templateSelect !== undefined) {
                templateSelect.value = activeTemplateId;
            }
            iframe.srcdoc = renderPreviewDocument(
                decorateWysiwygTables(
                    options.editor.getData(),
                    template.decorateWysiwygTables,
                    options.owner,
                ),
                configuration,
                options.owner,
            );
        } catch (error: unknown) {
            options.reportError(error);
        }
    };
    const disposeDocumentChange = options.editor.events.on(
        'document:change',
        refresh,
    );
    const disposeEditorDestroy = options.editor.events.on(
        'editor:destroy',
        () => destroy(),
    );
    const open = (): boolean => {
        if (destroyed) return false;
        if (popup !== null && !popup.closed) {
            refresh();
            popup.focus();
            return true;
        }
        popup = options.owner.open(
            'about:blank',
            name,
            options.features ??
                'popup=yes,width=1024,height=768,resizable=yes,scrollbars=yes',
        );
        if (popup === null) return false;
        iframe = undefined;
        templateSelect = undefined;
        refresh();
        popup.focus();
        return true;
    };
    const destroy = (): void => {
        if (destroyed) return;
        destroyed = true;
        disposeDocumentChange();
        disposeEditorDestroy();
        try {
            popup?.close();
        } catch {
            // A preview navigated by the user can become cross-origin.
        }
        popup = null;
        iframe = undefined;
        templateSelect = undefined;
    };

    return Object.freeze({ destroy, open, refresh });
}

function decorateWysiwygTables(
    source: string,
    enabled: boolean,
    owner: Window,
): string {
    if (!enabled || !/<table(?:\s|>)/iu.test(source)) return source;
    const Parser = (owner as Window & { DOMParser: typeof DOMParser })
        .DOMParser;
    const document = new Parser().parseFromString(source, 'text/html');
    for (const table of Array.from(document.querySelectorAll('table'))) {
        table.classList.add('soeditor-table-widget');
        for (const cell of Array.from(table.querySelectorAll('th,td'))) {
            cell.classList.add('soeditor-table-cell');
        }
    }
    return isCompleteHtmlDocument(source)
        ? `<!doctype html>${document.documentElement.outerHTML}`
        : document.body.innerHTML;
}

function createPreviewFrame(
    document: Document,
    title: string,
    templates: readonly ClassicPreviewWindowTemplate[],
    activeTemplateId: string,
    pickerLabel: string,
    selectTemplate: (id: string) => void,
): { readonly iframe: HTMLIFrameElement; readonly select: HTMLSelectElement } {
    document.head.replaceChildren();
    document.body.replaceChildren();
    document.title = title;
    document.documentElement.style.cssText = 'height:100%;margin:0';
    document.body.style.cssText =
        'display:grid;grid-template-rows:auto minmax(0,1fr);height:100%;margin:0;overflow:hidden';
    const toolbar = document.createElement('div');
    toolbar.style.cssText =
        'align-items:center;background:#f6f8fa;border-bottom:1px solid #d0d7de;display:flex;font:14px/1.4 system-ui,sans-serif;gap:8px;padding:8px 12px';
    const label = document.createElement('label');
    label.textContent = pickerLabel;
    const select = document.createElement('select');
    select.setAttribute('aria-label', pickerLabel);
    select.style.cssText =
        'background:#fff;border:1px solid #afb8c1;border-radius:6px;font:inherit;min-height:32px;padding:4px 28px 4px 8px';
    for (const template of templates) {
        const option = document.createElement('option');
        option.value = template.id;
        option.textContent = template.label;
        select.append(option);
    }
    select.value = activeTemplateId;
    select.addEventListener('change', () => selectTemplate(select.value));
    label.append(' ', select);
    toolbar.append(label);
    const iframe = document.createElement('iframe');
    iframe.title = title;
    iframe.referrerPolicy = 'no-referrer';
    iframe.setAttribute('sandbox', '');
    iframe.style.cssText = 'border:0;display:block;height:100%;width:100%';
    document.body.append(toolbar, iframe);
    return { iframe, select };
}

function validateTemplates(
    templates: readonly ClassicPreviewWindowTemplate[],
    initialTemplateId: string,
): void {
    if (templates.length === 0) {
        throw new TypeError('Classic preview requires at least one template.');
    }
    const ids = new Set<string>();
    for (const template of templates) {
        if (!/^[a-z][a-z0-9.-]*$/u.test(template.id) || ids.has(template.id)) {
            throw new TypeError(
                `Classic preview template id "${template.id}" is invalid or duplicated.`,
            );
        }
        if (template.label.trim().length === 0) {
            throw new TypeError(
                'Classic preview template labels must not be empty.',
            );
        }
        ids.add(template.id);
        normalizePreviewConfiguration(template.configuration);
    }
    if (!ids.has(initialTemplateId)) {
        throw new TypeError(
            `Classic preview initial template "${initialTemplateId}" does not exist.`,
        );
    }
}

function requireTemplate(
    templates: readonly ClassicPreviewWindowTemplate[],
    id: string,
): ClassicPreviewWindowTemplate {
    const template = templates.find((candidate) => candidate.id === id);
    if (template === undefined) {
        throw new Error(`Classic preview template "${id}" is unavailable.`);
    }
    return template;
}
