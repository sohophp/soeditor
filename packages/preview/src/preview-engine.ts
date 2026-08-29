import {
    EditorDestroyedError,
    ServiceAlreadyRegisteredError,
    type Editor,
} from '@soeditor/core';

import {
    normalizePreviewConfiguration,
    type PreviewConfiguration,
} from './configuration.js';
import { previewServiceToken, type PreviewService } from './preview-service.js';
import { renderPreviewDocument } from './renderer.js';

/** Options used to attach one isolated preview iframe. */
export interface PreviewEngineOptions {
    readonly configuration?: PreviewConfiguration;
    readonly editor: Editor;
    readonly element: HTMLElement;
}

/** Minimal lifecycle of an attached preview environment. */
export interface PreviewEngine {
    destroy(): void;
}

/** Reports use of an independently destroyed preview engine. */
export class PreviewEngineDestroyedError extends Error {
    constructor() {
        super('The preview engine has been destroyed.');
        this.name = 'PreviewEngineDestroyedError';
    }
}

/** Prevents preview attachment from deleting caller-owned host content. */
export class PreviewHostNotEmptyError extends Error {
    constructor() {
        super('A preview host must be empty before attachment.');
        this.name = 'PreviewHostNotEmptyError';
    }
}

class DomPreviewEngine implements PreviewEngine {
    readonly #configuration;
    readonly #disposeDocumentChange: () => void;
    readonly #disposeEditorDestroy: () => void;
    readonly #disposeModeChange: () => void;
    readonly #editor: Editor;
    readonly #element: HTMLElement;
    readonly #iframe: HTMLIFrameElement;
    readonly #previousHidden: boolean;
    readonly #service: PreviewService;
    readonly #view: Window;
    #destroyed = false;
    #stale = true;

    constructor(options: PreviewEngineOptions) {
        this.#editor = options.editor;
        this.#element = options.element;
        const view = options.element.ownerDocument.defaultView;
        if (view === null) {
            throw new Error('The preview host is not attached to a window.');
        }
        if (options.element.childNodes.length !== 0) {
            throw new PreviewHostNotEmptyError();
        }
        if (options.editor.services.has(previewServiceToken)) {
            throw new ServiceAlreadyRegisteredError(previewServiceToken.id);
        }
        this.#view = view;
        this.#configuration = normalizePreviewConfiguration(
            options.configuration,
        );
        this.#previousHidden = options.element.hidden;
        const iframe = options.element.ownerDocument.createElement('iframe');
        iframe.className = 'soeditor-preview__frame';
        iframe.title = this.#configuration.title;
        iframe.referrerPolicy = 'no-referrer';
        iframe.setAttribute('sandbox', '');
        this.#iframe = iframe;
        options.element.append(iframe);

        const service = Object.freeze<PreviewService>({
            refresh: () => this.#refresh(),
        });
        this.#service = service;
        options.editor.services.register(previewServiceToken, service);
        this.#updateMode();
        this.#disposeDocumentChange = options.editor.events.on(
            'document:change',
            () => this.#handleDocumentChange(),
        );
        this.#disposeModeChange = options.editor.events.on('mode:change', () =>
            this.#updateMode(),
        );
        this.#disposeEditorDestroy = options.editor.events.on(
            'editor:destroy',
            () => this.destroy(),
        );
    }

    destroy(): void {
        if (this.#destroyed) {
            return;
        }
        this.#destroyed = true;
        this.#disposeDocumentChange();
        this.#disposeModeChange();
        this.#disposeEditorDestroy();
        const errors: unknown[] = [];
        try {
            if (
                this.#editor.services.tryGet(previewServiceToken) ===
                this.#service
            ) {
                this.#editor.services.unregister(previewServiceToken);
            }
        } catch (error: unknown) {
            if (!(error instanceof EditorDestroyedError)) {
                errors.push(error);
            }
        }
        try {
            if (this.#editor.state.mode === 'preview') {
                this.#editor.update(
                    (transaction) => transaction.setMode('visual'),
                    { origin: 'system' },
                );
            }
        } catch (error: unknown) {
            if (!(error instanceof EditorDestroyedError)) {
                errors.push(error);
            }
        }
        this.#iframe.remove();
        this.#element.hidden = this.#previousHidden;
        if (errors.length > 0) {
            throw new AggregateError(errors, 'Preview engine cleanup failed.');
        }
    }

    #refresh(): void {
        this.#assertAlive();
        this.#iframe.srcdoc = renderPreviewDocument(
            this.#editor.getData(),
            this.#configuration,
            this.#view,
        );
        this.#stale = false;
    }

    #updateMode(): void {
        const preview = this.#editor.state.mode === 'preview';
        this.#element.hidden = !preview;
        if (preview && this.#stale) {
            this.#refresh();
        }
    }

    #handleDocumentChange(): void {
        this.#stale = true;
        if (this.#editor.state.mode === 'preview') {
            this.#refresh();
        }
    }

    #assertAlive(): void {
        if (this.#destroyed) {
            throw new PreviewEngineDestroyedError();
        }
    }
}

/** Attaches a sandboxed preview environment to an empty host. */
export function createPreviewEngine(
    options: PreviewEngineOptions,
): PreviewEngine {
    return new DomPreviewEngine(options);
}
