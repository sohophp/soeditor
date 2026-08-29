import {
    EditorDestroyedError,
    ServiceAlreadyRegisteredError,
    type Editor,
} from '@soeditor/core';
import { diagnosticsServiceToken, type Problem } from '@soeditor/html-tools';
import type { SourceRange } from '@soeditor/html';
import { sourceEditingServiceToken } from '@soeditor/source';
import { EditorUiDestroyedError, type EditorUi } from '@soeditor/ui';

import {
    createDocumentOutline,
    inspectVisualSelection,
    type InspectorElement,
} from './analysis.js';
import {
    developerToolsServiceToken,
    type DeveloperToolsService,
} from './developer-tools-service.js';

/** Options for connecting developer analysis to visual selection and UI. */
export interface DeveloperToolsEngineOptions {
    readonly editor: Editor;
    readonly ui: EditorUi;
    readonly visualElement: HTMLElement;
}

/** Minimal lifecycle of attached developer tooling. */
export interface DeveloperToolsEngineHandle {
    destroy(): void;
}

/** Reports use of a retained developer-tools capability after cleanup. */
export class DeveloperToolsEngineDestroyedError extends Error {
    constructor() {
        super('The developer-tools engine has been destroyed.');
        this.name = 'DeveloperToolsEngineDestroyedError';
    }
}

/** Prevents HTML developer tooling from interpreting another source format. */
export class UnsupportedDeveloperToolsDocumentFormatError extends Error {
    constructor(format: string) {
        super(`HTML developer tools do not support "${format}" documents.`);
        this.name = 'UnsupportedDeveloperToolsDocumentFormatError';
    }
}

class DomDeveloperToolsEngine implements DeveloperToolsEngineHandle {
    readonly #disposeDestroy: () => void;
    readonly #disposeState: () => void;
    readonly #editor: Editor;
    readonly #service: DeveloperToolsService;
    readonly #ui: EditorUi;
    readonly #visualElement: HTMLElement;
    #destroyed = false;
    #inspector: InspectorElement | undefined;

    constructor(options: DeveloperToolsEngineOptions) {
        if (options.editor.state.document.format !== 'html') {
            throw new UnsupportedDeveloperToolsDocumentFormatError(
                options.editor.state.document.format,
            );
        }
        if (options.editor.services.has(developerToolsServiceToken)) {
            throw new ServiceAlreadyRegisteredError(
                developerToolsServiceToken.id,
            );
        }
        if (options.ui.destroyed) {
            throw new EditorUiDestroyedError();
        }
        if (options.visualElement.ownerDocument.defaultView === null) {
            throw new Error('The developer-tools visual host has no window.');
        }
        this.#editor = options.editor;
        this.#ui = options.ui;
        this.#visualElement = options.visualElement;
        this.#service = Object.freeze({
            getInspector: () => this.#getInspector(),
            getOutline: () => this.#getOutline(),
            getProblems: () => this.#getProblems(),
            reveal: (range: SourceRange) => this.#reveal(range),
        });
        options.editor.services.register(
            developerToolsServiceToken,
            this.#service,
        );
        options.visualElement.ownerDocument.addEventListener(
            'selectionchange',
            this.#handleSelectionChange,
        );
        this.#disposeState = options.editor.events.on('state:change', () =>
            this.#updateStatus(),
        );
        this.#disposeDestroy = options.editor.events.on('editor:destroy', () =>
            this.#destroy(false),
        );
        this.#updateStatus();
        options.ui.refresh();
    }

    destroy(): void {
        this.#destroy(true);
    }

    #destroy(restoreStatus: boolean): void {
        if (this.#destroyed) {
            return;
        }
        this.#destroyed = true;
        this.#disposeState();
        this.#disposeDestroy();
        this.#visualElement.ownerDocument.removeEventListener(
            'selectionchange',
            this.#handleSelectionChange,
        );
        try {
            if (
                this.#editor.services.tryGet(developerToolsServiceToken) ===
                this.#service
            ) {
                this.#editor.services.unregister(developerToolsServiceToken);
            }
        } catch (error: unknown) {
            if (!(error instanceof EditorDestroyedError)) {
                throw error;
            }
        }
        if (restoreStatus) {
            try {
                this.#ui.setStatus();
                this.#ui.refresh();
            } catch (error: unknown) {
                if (!(error instanceof EditorUiDestroyedError)) {
                    throw error;
                }
            }
        }
    }

    readonly #handleSelectionChange = (): void => {
        if (this.#destroyed) {
            return;
        }
        const selection = this.#visualElement.ownerDocument.getSelection();
        const anchor = selection?.anchorNode;
        if (
            anchor === null ||
            anchor === undefined ||
            !this.#visualElement.contains(anchor)
        ) {
            return;
        }
        this.#inspector = inspectVisualSelection(this.#visualElement);
        this.#updateStatus();
        if (!this.#ui.destroyed) {
            this.#ui.refresh();
        }
    };

    #getInspector(): InspectorElement | undefined {
        this.#assertAlive();
        return this.#inspector;
    }

    #getOutline() {
        this.#assertAlive();
        return createDocumentOutline(this.#editor.getData());
    }

    #getProblems(): readonly Problem[] {
        this.#assertAlive();
        return this.#editor.services.get(diagnosticsServiceToken).problems;
    }

    #reveal(range: SourceRange): void {
        this.#assertAlive();
        if (this.#editor.state.mode !== 'source') {
            this.#editor.execute('editor.source');
        }
        this.#editor.services.get(sourceEditingServiceToken).reveal(range);
    }

    #updateStatus(): void {
        if (this.#ui.destroyed) {
            return;
        }
        const mode = capitalize(this.#editor.state.mode);
        const dirty = this.#editor.state.dirty ? 'Unsaved' : 'Saved';
        const path =
            this.#editor.state.mode === 'visual'
                ? this.#inspector?.path.join(' > ')
                : undefined;
        this.#ui.setStatus(
            `${mode} · ${dirty}${path === undefined ? '' : ` · ${path}`}`,
        );
    }

    #assertAlive(): void {
        if (this.#destroyed) {
            throw new DeveloperToolsEngineDestroyedError();
        }
    }
}

/** Attaches HTML developer analysis to an existing editor UI. */
export function createDeveloperToolsEngine(
    options: DeveloperToolsEngineOptions,
): DeveloperToolsEngineHandle {
    return new DomDeveloperToolsEngine(options);
}

function capitalize(value: string): string {
    return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
