import { Plugin, type Editor } from '@soeditor/core';
import type { SourcePosition, SourceRange } from '@soeditor/html';
import { DiagnosticsPlugin, type Problem } from '@soeditor/html-tools';
import {
    SourceEditingPlugin,
    sourceEditingServiceToken,
} from '@soeditor/source';
import {
    EditorUiDestroyedError,
    UiPlugin,
    uiRegistryServiceToken,
    type EditorUi,
    type ToolbarItemFactory,
} from '@soeditor/ui';

import type { InspectorElement, OutlineItem } from './analysis.js';
import { UnsupportedDeveloperToolsDocumentFormatError } from './developer-tools-engine.js';
import { developerToolsServiceToken } from './developer-tools-service.js';

/** Registers command-driven HTML developer workflows and UI contributions. */
export class DeveloperToolsPlugin extends Plugin {
    static readonly id = 'developer-tools';
    static readonly requires = [
        UiPlugin,
        DiagnosticsPlugin,
        SourceEditingPlugin,
    ];
    readonly #disposers: Array<() => void> = [];

    override init(): void {
        if (this.editor.state.document.format !== 'html') {
            throw new UnsupportedDeveloperToolsDocumentFormatError(
                this.editor.state.document.format,
            );
        }
        this.editor.commands.register({
            id: 'developer.find',
            label: 'Find/Replace in HTML source',
            canExecute: ({ editor }) =>
                editor.state.document.format === 'html' &&
                editor.services.has(sourceEditingServiceToken),
            execute: ({ editor }, ...args) => {
                const query = optionalStringArgument('developer.find', args);
                if (editor.state.mode !== 'source') {
                    editor.execute('editor.source');
                }
                editor.services
                    .get(sourceEditingServiceToken)
                    .openSearchPanel(query);
            },
        });
        this.editor.commands.register({
            id: 'developer.reveal',
            canExecute: ({ editor }) =>
                editor.services.has(developerToolsServiceToken) &&
                editor.services.has(sourceEditingServiceToken),
            execute: ({ editor }, ...args) => {
                if (args.length !== 1 || !isSourceRange(args[0])) {
                    throw new TypeError(
                        'Command "developer.reveal" requires one source range.',
                    );
                }
                editor.services.get(developerToolsServiceToken).reveal(args[0]);
            },
        });

        const registry = this.editor.services.get(uiRegistryServiceToken);
        this.#disposers.push(
            registry.registerToolbarItem('problems', createProblemsButton()),
            registry.registerToolbarItem('inspector', createInspectorButton()),
            registry.registerToolbarItem('outline', createOutlineButton()),
            registry.registerToolbarItem(
                'find-replace',
                createCommandButton('Find/Replace', 'developer.find'),
            ),
            registry.registerToolbarItem(
                'command-palette',
                createCommandPaletteButton(),
            ),
        );
    }

    override destroy(): void {
        for (const dispose of this.#disposers.splice(0).reverse()) {
            dispose();
        }
    }
}

function createProblemsButton(): ToolbarItemFactory {
    return ({ document, editor, ui }) => {
        const button = toolbarButton(document, 'Problems');
        const click = (): void => {
            const content = document.createElement('div');
            content.textContent = 'Validating HTML…';
            ui.panels.show({ title: 'Problems', content });
            let result: unknown;
            try {
                result = editor.execute('document.validate');
            } catch (error: unknown) {
                showError(ui, error);
                return;
            }
            void Promise.resolve(result).then(
                () => {
                    if (content.isConnected) {
                        renderProblems(
                            content,
                            editor.services
                                .get(developerToolsServiceToken)
                                .getProblems(),
                            editor,
                            ui,
                        );
                    }
                },
                (error: unknown) => showError(ui, error),
            );
        };
        button.addEventListener('click', click);
        return {
            element: button,
            update: () => {
                button.disabled = !editor.services.has(
                    developerToolsServiceToken,
                );
            },
            destroy: () => button.removeEventListener('click', click),
        };
    };
}

function createInspectorButton(): ToolbarItemFactory {
    return ({ document, editor, ui }) => {
        const button = toolbarButton(document, 'Inspector');
        const click = (): void => {
            const inspector = editor.services
                .get(developerToolsServiceToken)
                .getInspector();
            ui.panels.show({
                title: 'HTML Inspector',
                content: (container) => renderInspector(container, inspector),
            });
        };
        button.addEventListener('click', click);
        return {
            element: button,
            update: () => {
                const service = editor.services.tryGet(
                    developerToolsServiceToken,
                );
                button.disabled = service?.getInspector() === undefined;
            },
            destroy: () => button.removeEventListener('click', click),
        };
    };
}

function createOutlineButton(): ToolbarItemFactory {
    return ({ document, editor, ui }) => {
        const button = toolbarButton(document, 'Outline');
        const click = (): void => {
            const outline = editor.services
                .get(developerToolsServiceToken)
                .getOutline();
            ui.panels.show({
                title: 'Document Outline',
                content: (container) =>
                    renderOutline(container, outline, editor, ui),
            });
        };
        button.addEventListener('click', click);
        return {
            element: button,
            update: () => {
                button.disabled = !editor.services.has(
                    developerToolsServiceToken,
                );
            },
            destroy: () => button.removeEventListener('click', click),
        };
    };
}

function createCommandButton(
    label: string,
    command: string,
): ToolbarItemFactory {
    return ({ document, editor, ui }) => {
        const button = toolbarButton(document, label);
        const click = (): void => {
            try {
                editor.execute(command);
            } catch (error: unknown) {
                showError(ui, error);
            }
        };
        button.addEventListener('click', click);
        return {
            element: button,
            update: () => {
                button.disabled =
                    !editor.commands.has(command) ||
                    !editor.commands.canExecute(command);
            },
            destroy: () => button.removeEventListener('click', click),
        };
    };
}

function createCommandPaletteButton(): ToolbarItemFactory {
    return ({ document, editor, ui }) => {
        const button = toolbarButton(document, 'Commands');
        const open = (): void => openCommandPalette(document, editor, ui);
        const keydown = (event: KeyboardEvent): void => {
            if (
                (event.ctrlKey || event.metaKey) &&
                event.shiftKey &&
                !event.altKey &&
                event.key.toLowerCase() === 'p'
            ) {
                event.preventDefault();
                event.stopPropagation();
                open();
            }
        };
        button.addEventListener('click', open);
        ui.element.addEventListener('keydown', keydown, true);
        return {
            element: button,
            destroy: () => {
                button.removeEventListener('click', open);
                ui.element.removeEventListener('keydown', keydown, true);
            },
        };
    };
}

function openCommandPalette(
    document: Document,
    editor: Editor,
    ui: EditorUi,
): void {
    const content = document.createElement('div');
    const input = document.createElement('input');
    input.type = 'search';
    input.placeholder = 'Type a command';
    input.setAttribute('aria-label', 'Filter commands');
    const results = document.createElement('div');
    results.className = 'soeditor-dev-tools__command-results';
    content.append(input, results);
    const handle = ui.dialogs.open({ title: 'Command Palette', content });
    const render = (): void => {
        const query = input.value.trim().toLowerCase();
        results.replaceChildren();
        for (const id of editor.commands.ids()) {
            const command = editor.commands.get(id);
            if (
                command.label === undefined ||
                !`${command.label} ${id}`.toLowerCase().includes(query)
            ) {
                continue;
            }
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'soeditor-ui__menu-item';
            button.textContent = command.label;
            button.dataset.commandId = id;
            button.disabled = !editor.commands.canExecute(id);
            button.addEventListener('click', () => {
                try {
                    const result = editor.execute(id);
                    handle.close();
                    if (isPromiseLike(result)) {
                        void Promise.resolve(result).catch((error: unknown) =>
                            showError(ui, error),
                        );
                    }
                } catch (error: unknown) {
                    showError(ui, error);
                }
            });
            results.append(button);
        }
    };
    input.addEventListener('input', render);
    render();
    input.focus();
}

function renderProblems(
    container: HTMLElement,
    problems: readonly Problem[],
    editor: Editor,
    ui: EditorUi,
): void {
    container.replaceChildren();
    if (problems.length === 0) {
        container.textContent = 'No problems found.';
        return;
    }
    const list = container.ownerDocument.createElement('ul');
    list.className = 'soeditor-dev-tools__problems';
    for (const problem of problems) {
        const item = container.ownerDocument.createElement('li');
        item.dataset.severity = problem.severity;
        const button = container.ownerDocument.createElement('button');
        button.type = 'button';
        button.textContent = `${problem.severity}: ${problem.message}${formatLocation(problem)}`;
        button.disabled = problem.source === undefined;
        button.addEventListener('click', () => {
            if (problem.source === undefined) {
                return;
            }
            try {
                editor.execute('developer.reveal', problem.source);
            } catch (error: unknown) {
                showError(ui, error);
            }
        });
        item.append(button);
        list.append(item);
    }
    container.append(list);
}

function renderInspector(
    container: HTMLElement,
    inspector: InspectorElement | undefined,
): void {
    if (inspector === undefined) {
        container.textContent = 'Place the caret in the visual editor.';
        return;
    }
    const document = container.ownerDocument;
    const path = document.createElement('p');
    path.textContent = inspector.path.join(' > ');
    const heading = document.createElement('h3');
    heading.textContent = `<${inspector.tagName}>`;
    const attributes = document.createElement('dl');
    for (const attribute of inspector.attributes) {
        const name = document.createElement('dt');
        name.textContent = attribute.name;
        const value = document.createElement('dd');
        value.textContent = attribute.value;
        attributes.append(name, value);
    }
    if (inspector.attributes.length === 0) {
        attributes.textContent = 'No projected attributes.';
    }
    container.append(path, heading, attributes);
}

function renderOutline(
    container: HTMLElement,
    outline: readonly OutlineItem[],
    editor: Editor,
    ui: EditorUi,
): void {
    if (outline.length === 0) {
        container.textContent = 'No headings found.';
        return;
    }
    const list = container.ownerDocument.createElement('ol');
    list.className = 'soeditor-dev-tools__outline';
    for (const heading of outline) {
        const item = container.ownerDocument.createElement('li');
        item.style.marginInlineStart = `${String((heading.level - 1) * 1.1)}rem`;
        const button = container.ownerDocument.createElement('button');
        button.type = 'button';
        button.textContent = heading.label;
        button.disabled = heading.source === undefined;
        button.addEventListener('click', () => {
            if (heading.source !== undefined) {
                try {
                    editor.execute('developer.reveal', heading.source);
                } catch (error: unknown) {
                    showError(ui, error);
                }
            }
        });
        item.append(button);
        list.append(item);
    }
    container.append(list);
}

function toolbarButton(document: Document, label: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'soeditor-ui__button';
    button.textContent = label;
    button.title = label;
    return button;
}

function optionalStringArgument(
    command: string,
    args: readonly unknown[],
): string | undefined {
    if (args.length === 0) {
        return undefined;
    }
    if (args.length !== 1 || typeof args[0] !== 'string') {
        throw new TypeError(`Command "${command}" accepts one string query.`);
    }
    return args[0];
}

function isSourceRange(value: unknown): value is SourceRange {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const start = Reflect.get(value, 'start');
    const end = Reflect.get(value, 'end');
    return isPosition(start) && isPosition(end) && end.offset >= start.offset;
}

function isPosition(value: unknown): value is SourcePosition {
    return (
        typeof value === 'object' &&
        value !== null &&
        Number.isInteger(Reflect.get(value, 'line')) &&
        Number.isInteger(Reflect.get(value, 'column')) &&
        Number.isInteger(Reflect.get(value, 'offset'))
    );
}

function formatLocation(problem: Problem): string {
    return problem.source === undefined
        ? ''
        : ` (${String(problem.source.start.line)}:${String(problem.source.start.column)})`;
}

function showError(ui: EditorUi, error: unknown): void {
    try {
        ui.notifications.show({
            message: error instanceof Error ? error.message : String(error),
            severity: 'error',
        });
    } catch (notificationError: unknown) {
        if (!(notificationError instanceof EditorUiDestroyedError)) {
            throw notificationError;
        }
    }
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
    return (typeof value === 'object' && value !== null) ||
        typeof value === 'function'
        ? typeof Reflect.get(value, 'then') === 'function'
        : false;
}
