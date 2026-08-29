import { Plugin, type Editor } from '@soeditor/core';
import type { SourcePosition, SourceRange } from '@soeditor/html';
import {
    DiagnosticsPlugin,
    diagnosticsServiceToken,
    type DiagnosticsSnapshot,
    type Problem,
    type ProblemSeverity,
} from '@soeditor/html-tools';
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
        const diagnostics = editor.services.get(diagnosticsServiceToken);
        let disposePanelSubscription: (() => void) | undefined;
        const updateButtonCount = (): void => {
            const count = diagnostics.snapshot.counts.total;
            button.textContent =
                count === 0 ? 'Problems' : `Problems (${String(count)})`;
            button.setAttribute(
                'aria-label',
                count === 0 ? 'Problems' : `Problems, ${String(count)} found`,
            );
        };
        const disposeCountSubscription =
            diagnostics.subscribe(updateButtonCount);
        updateButtonCount();
        const click = (): void => {
            disposePanelSubscription?.();
            const content = document.createElement('div');
            content.className = 'soeditor-dev-tools__problems-workflow';
            const selectedSeverities = new Set<ProblemSeverity>([
                'error',
                'warning',
                'info',
                'hint',
            ]);
            const selectedProviders = new Set<string>();
            const status = document.createElement('p');
            status.setAttribute('role', 'status');
            status.setAttribute('aria-live', 'polite');
            const filters = document.createElement('div');
            filters.className = 'soeditor-dev-tools__problem-filters';
            const severityFilters = createProblemFilterGroup(
                document,
                'Severity',
                ['error', 'warning', 'info', 'hint'],
                selectedSeverities,
                () => render(),
            );
            const providerFilters = document.createElement('fieldset');
            const providerLegend = document.createElement('legend');
            providerLegend.textContent = 'Provider';
            providerFilters.append(providerLegend);
            filters.append(severityFilters, providerFilters);
            const failures = document.createElement('div');
            const results = document.createElement('div');
            results.className = 'soeditor-dev-tools__problems';
            results.addEventListener('keydown', handleProblemArrowNavigation);
            content.append(status, filters, failures, results);
            let providerSignature = '';
            const render = (): void => {
                const snapshot = diagnostics.snapshot;
                const providers = availableProviders(snapshot);
                const nextSignature = providers.join('\u0000');
                if (nextSignature !== providerSignature) {
                    const previouslyKnown = new Set(selectedProviders);
                    selectedProviders.clear();
                    for (const provider of providers) {
                        if (
                            providerSignature.length === 0 ||
                            previouslyKnown.has(provider)
                        ) {
                            selectedProviders.add(provider);
                        }
                    }
                    providerFilters.replaceChildren(providerLegend);
                    appendProblemFilterOptions(
                        providerFilters,
                        providers,
                        selectedProviders,
                        render,
                    );
                    providerSignature = nextSignature;
                }
                renderProblemsWorkflow(
                    status,
                    failures,
                    results,
                    snapshot,
                    diagnostics.getProblems({
                        providers: [...selectedProviders],
                        severities: [...selectedSeverities],
                    }),
                    editor,
                    ui,
                );
            };
            ui.panels.show({ title: 'Problems', content });
            disposePanelSubscription = diagnostics.subscribe(() => {
                if (!content.isConnected) {
                    disposePanelSubscription?.();
                    disposePanelSubscription = undefined;
                    return;
                }
                render();
            });
            render();
            let result: unknown;
            try {
                result = editor.execute('document.validate');
            } catch (error: unknown) {
                showError(ui, error);
                return;
            }
            void Promise.resolve(result).catch((error: unknown) =>
                showError(ui, error),
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
            destroy: () => {
                disposePanelSubscription?.();
                disposeCountSubscription();
                button.removeEventListener('click', click);
            },
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
                    ui.restoreEditingSelection();
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

function renderProblemsWorkflow(
    status: HTMLElement,
    failures: HTMLElement,
    results: HTMLElement,
    snapshot: DiagnosticsSnapshot,
    problems: readonly Problem[],
    editor: Editor,
    ui: EditorUi,
): void {
    const document = results.ownerDocument;
    status.textContent =
        snapshot.status === 'validating'
            ? `Validating HTML… ${String(snapshot.counts.total)} previous problems.`
            : `${String(snapshot.counts.total)} problems found.`;
    failures.replaceChildren();
    if (snapshot.failures.length > 0) {
        const heading = document.createElement('h3');
        heading.textContent = 'Provider errors';
        const list = document.createElement('ul');
        for (const failure of snapshot.failures) {
            const item = document.createElement('li');
            item.textContent = `${failure.provider}: ${errorMessage(failure.error)}`;
            list.append(item);
        }
        failures.append(heading, list);
    }
    results.replaceChildren();
    if (snapshot.status !== 'validating' && problems.length === 0) {
        const empty = document.createElement('p');
        empty.textContent =
            snapshot.failures.length === 0
                ? 'No problems found.'
                : 'No problems were returned by the providers that completed.';
        results.append(empty);
        return;
    }
    const groups = new Map<string, Problem[]>();
    for (const problem of problems) {
        const group = groups.get(problem.provider) ?? [];
        group.push(problem);
        groups.set(problem.provider, group);
    }
    for (const [provider, providerProblems] of groups) {
        const section = document.createElement('section');
        const heading = document.createElement('h3');
        heading.textContent = `${provider} (${String(providerProblems.length)})`;
        const list = document.createElement('ul');
        for (const problem of providerProblems) {
            const item = document.createElement('li');
            item.dataset.severity = problem.severity;
            const label = `${problem.severity}: ${problem.message}${formatLocation(problem)}`;
            if (problem.source === undefined) {
                const text = document.createElement('span');
                text.textContent = label;
                item.append(text);
            } else {
                const button = document.createElement('button');
                button.type = 'button';
                button.dataset.problem = 'true';
                button.textContent = label;
                button.addEventListener('click', () => {
                    try {
                        editor.execute('developer.reveal', problem.source);
                    } catch (error: unknown) {
                        showError(ui, error);
                    }
                });
                item.append(button);
            }
            list.append(item);
        }
        section.append(heading, list);
        results.append(section);
    }
}

function createProblemFilterGroup<Value extends string>(
    document: Document,
    legendText: string,
    values: readonly Value[],
    selected: Set<Value>,
    render: () => void,
): HTMLFieldSetElement {
    const fieldset = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = legendText;
    fieldset.append(legend);
    appendProblemFilterOptions(fieldset, values, selected, render);
    return fieldset;
}

function appendProblemFilterOptions<Value extends string>(
    fieldset: HTMLFieldSetElement,
    values: readonly Value[],
    selected: Set<Value>,
    render: () => void,
): void {
    for (const value of values) {
        const label = fieldset.ownerDocument.createElement('label');
        const input = fieldset.ownerDocument.createElement('input');
        input.type = 'checkbox';
        input.checked = selected.has(value);
        input.addEventListener('change', () => {
            if (input.checked) {
                selected.add(value);
            } else {
                selected.delete(value);
            }
            render();
        });
        label.append(input, ` ${value}`);
        fieldset.append(label);
    }
}

function availableProviders(snapshot: DiagnosticsSnapshot): readonly string[] {
    return [
        ...new Set([
            ...snapshot.problems.map(({ provider }) => provider),
            ...snapshot.failures.map(({ provider }) => provider),
        ]),
    ];
}

function handleProblemArrowNavigation(event: KeyboardEvent): void {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
        return;
    }
    const buttons = Array.from(
        (
            event.currentTarget as HTMLElement
        ).querySelectorAll<HTMLButtonElement>('button[data-problem="true"]'),
    );
    const current = buttons.indexOf(event.target as HTMLButtonElement);
    if (current < 0 || buttons.length === 0) {
        return;
    }
    event.preventDefault();
    const offset = event.key === 'ArrowDown' ? 1 : -1;
    buttons[(current + offset + buttons.length) % buttons.length]?.focus();
}

function errorMessage(error: unknown): string {
    try {
        return error instanceof Error ? error.message : String(error);
    } catch {
        return 'Unknown provider failure.';
    }
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
