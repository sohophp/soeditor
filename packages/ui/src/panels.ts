import type {
    PanelHandle,
    PanelOptions,
    PanelService,
    UiContent,
} from './types.js';
import { EditorUiDestroyedError } from './errors.js';

/** Creates the generic docked-panel service owned by one UI instance. */
export function createPanelService(
    document: Document,
    layer: HTMLElement,
): { readonly panels: PanelService; destroy(): void } {
    let current: PanelHandle | undefined;
    let destroyed = false;

    const panels: PanelService = Object.freeze({
        show: (options: PanelOptions): PanelHandle => {
            if (destroyed) {
                throw new EditorUiDestroyedError();
            }
            if (
                typeof options.title !== 'string' ||
                options.title.trim().length === 0
            ) {
                throw new TypeError('A panel title must not be empty.');
            }
            current?.close();
            const panel = document.createElement('section');
            panel.className = 'soeditor-ui__panel';
            panel.setAttribute('role', 'region');
            panel.setAttribute('aria-label', options.title);
            const header = document.createElement('header');
            header.className = 'soeditor-ui__panel-header';
            const title = document.createElement('h2');
            title.className = 'soeditor-ui__panel-title';
            title.textContent = options.title;
            const closeButton = document.createElement('button');
            closeButton.type = 'button';
            closeButton.className = 'soeditor-ui__panel-close';
            closeButton.textContent = 'Close';
            closeButton.setAttribute('aria-label', `Close ${options.title}`);
            const body = document.createElement('div');
            body.className = 'soeditor-ui__panel-body';
            appendContent(body, options.content);
            let active = true;
            const handle: PanelHandle = Object.freeze({
                element: panel,
                close: () => {
                    if (!active) {
                        return;
                    }
                    active = false;
                    panel.remove();
                    if (current === handle) {
                        current = undefined;
                    }
                },
            });
            closeButton.addEventListener('click', handle.close);
            header.append(title, closeButton);
            panel.append(header, body);
            layer.append(panel);
            current = handle;
            return handle;
        },
    });

    return Object.freeze({
        panels,
        destroy: () => {
            if (destroyed) {
                return;
            }
            destroyed = true;
            current?.close();
        },
    });
}

function appendContent(container: HTMLElement, content?: UiContent): void {
    if (content === undefined) {
        return;
    }
    if (typeof content === 'string') {
        container.textContent = content;
    } else if (typeof content === 'function') {
        content(container);
    } else {
        container.append(content);
    }
}
