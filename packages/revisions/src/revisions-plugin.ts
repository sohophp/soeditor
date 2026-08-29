import {
    EditorDestroyedError,
    Plugin,
    type Editor,
    type PluginConstructor,
} from '@soeditor/core';
import {
    UiPlugin,
    uiRegistryServiceToken,
    type EditorUi,
    type PanelHandle,
    type ToolbarItemFactory,
} from '@soeditor/ui';

import {
    RevisionsController,
    revisionsServiceToken,
    type RevisionsPluginOptions,
    type RevisionsService,
} from './revisions-service.js';
import type { ReviewPolicy, RevisionKind } from './model.js';

const MAX_SOURCE_PREVIEW = 100_000;

/** Creates one configured, per-editor revision-history plugin constructor. */
export function createRevisionsPlugin(
    options: RevisionsPluginOptions,
): PluginConstructor {
    const captured = Object.freeze({ ...options });
    return class RevisionsPlugin extends Plugin {
        static readonly id = 'revisions';
        static readonly requires = [UiPlugin];
        readonly #disposers: Array<() => void> = [];
        #controller: RevisionsController | undefined;
        #service: RevisionsService | undefined;

        override async init(): Promise<void> {
            const controller = new RevisionsController(this.editor, captured);
            await controller.init();
            const service = controller.service;
            this.#controller = controller;
            this.#service = service;
            this.editor.services.register(revisionsServiceToken, service);
            registerCommands(this.editor, service);
            this.#disposers.push(
                this.editor.services
                    .get(uiRegistryServiceToken)
                    .registerToolbarItem('revisions', createRevisionsButton()),
            );
        }

        override destroy(): void {
            for (const dispose of this.#disposers.splice(0).reverse())
                dispose();
            this.#controller?.destroy();
            try {
                if (
                    this.#service !== undefined &&
                    this.editor.services.tryGet(revisionsServiceToken) ===
                        this.#service
                ) {
                    this.editor.services.unregister(revisionsServiceToken);
                }
            } catch (error: unknown) {
                if (!(error instanceof EditorDestroyedError)) throw error;
            }
            this.#controller = undefined;
            this.#service = undefined;
        }
    };
}

function registerCommands(editor: Editor, service: RevisionsService): void {
    editor.commands.register({
        id: 'revisions.refresh',
        label: 'Refresh revisions',
        execute: (_context, ...args) => {
            noArguments('revisions.refresh', args);
            return service.refresh();
        },
    });
    editor.commands.register({
        id: 'revisions.view',
        label: 'View revision',
        canExecute: () =>
            service.snapshot.revisions.some(({ id }) =>
                service.can('view', id),
            ),
        execute: (_context, ...args) =>
            service.view(requiredString('revisions.view', args)),
    });
    editor.commands.register({
        id: 'revisions.viewCurrent',
        label: 'View current document',
        canExecute: () => service.snapshot.viewing !== 'current',
        execute: (_context, ...args) => {
            noArguments('revisions.viewCurrent', args);
            service.viewCurrent();
        },
    });
    editor.commands.register({
        id: 'revisions.compare',
        label: 'Compare revision',
        canExecute: () =>
            service.snapshot.revisions.some(({ id }) =>
                service.can('view', id),
            ),
        execute: (_context, ...args) =>
            service.compare(requiredString('revisions.compare', args)),
    });
    editor.commands.register({
        id: 'revisions.restore',
        label: 'Restore revision',
        canExecute: () =>
            service.snapshot.revisions.some(({ id }) =>
                service.can('restore', id),
            ),
        execute: (_context, ...args) =>
            service.restore(requiredString('revisions.restore', args)),
    });
    editor.commands.register({
        id: 'revisions.save',
        label: 'Save revision',
        canExecute: () => service.can('save'),
        execute: (_context, ...args) => {
            if (args.length !== 2) {
                throw new TypeError(
                    'Command "revisions.save" requires a kind and label.',
                );
            }
            return service.save(
                revisionKind(args[0]),
                stringValue(args[1], 'label'),
            );
        },
    });
    editor.commands.register({
        id: 'review.setPolicy',
        label: 'Set review policy',
        execute: (_context, ...args) => {
            if (args.length !== 1) {
                throw new TypeError(
                    'Command "review.setPolicy" requires one policy.',
                );
            }
            service.setPolicy(reviewPolicy(args[0]));
        },
    });
}

function createRevisionsButton(): ToolbarItemFactory {
    return ({ document, editor, ui }) => {
        const service = editor.services.get(revisionsServiceToken);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'soeditor-ui__button';
        button.textContent = 'Revisions';
        button.title = 'Open revision history';
        button.setAttribute('aria-label', 'Open revision history');
        let panel: PanelHandle | undefined;
        let disposePanel: (() => void) | undefined;
        const open = (): void => {
            disposePanel?.();
            panel?.close();
            const content = document.createElement('div');
            content.className = 'soeditor-revisions';
            const render = (): void =>
                renderPanel(content, editor, ui, service);
            disposePanel = service.subscribe(render);
            render();
            panel = ui.panels.show({ content, title: 'Revision history' });
        };
        button.addEventListener('click', open);
        const update = (): void => {
            button.dataset.reviewPolicy = service.snapshot.policy;
        };
        const disposeUpdate = service.subscribe(update);
        update();
        return {
            element: button,
            update,
            destroy: () => {
                button.removeEventListener('click', open);
                disposeUpdate();
                disposePanel?.();
                panel?.close();
            },
        };
    };
}

function renderPanel(
    container: HTMLElement,
    editor: Editor,
    ui: EditorUi,
    service: RevisionsService,
): void {
    const document = container.ownerDocument;
    const snapshot = service.snapshot;
    const policy = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = 'Review policy';
    policy.append(legend);
    for (const value of ['edit', 'comments-only', 'readonly'] as const) {
        const button = commandButton(
            document,
            editor,
            ui,
            value,
            'review.setPolicy',
            [value],
        );
        button.setAttribute('aria-pressed', String(snapshot.policy === value));
        button.disabled =
            snapshot.policy !== value &&
            !service.can('set-policy', undefined, value);
        policy.append(button);
    }

    const save = document.createElement('form');
    save.className = 'soeditor-revisions__save';
    const label = document.createElement('input');
    label.required = true;
    label.maxLength = 256;
    label.setAttribute('aria-label', 'Revision label');
    label.placeholder = 'Revision label';
    const kind = document.createElement('select');
    kind.setAttribute('aria-label', 'Revision kind');
    for (const value of ['draft', 'saved'] as const) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        kind.append(option);
    }
    const saveButton = document.createElement('button');
    saveButton.type = 'submit';
    saveButton.textContent = 'Save current';
    saveButton.disabled = !editor.commands.canExecute('revisions.save');
    save.addEventListener('submit', (event) => {
        event.preventDefault();
        run(editor, ui, 'revisions.save', [kind.value, label.value]);
    });
    save.append(label, kind, saveButton);

    const current = commandButton(
        document,
        editor,
        ui,
        'Current document',
        'revisions.viewCurrent',
    );
    current.disabled = snapshot.viewing === 'current';
    const list = document.createElement('div');
    list.className = 'soeditor-revisions__list';
    list.setAttribute('aria-label', 'Available revisions');
    list.append(current);
    for (const revision of snapshot.revisions) {
        const button = commandButton(
            document,
            editor,
            ui,
            `${revision.kind}: ${revision.label}`,
            'revisions.view',
            [revision.id],
        );
        button.setAttribute(
            'aria-current',
            String(snapshot.revision?.id === revision.id),
        );
        button.disabled = !service.can('view', revision.id);
        list.append(button);
    }

    const content = document.createElement('section');
    content.className = 'soeditor-revisions__content';
    if (snapshot.revision === undefined) {
        const message = document.createElement('p');
        message.textContent = 'Viewing the current document.';
        content.append(message);
    } else {
        const heading = document.createElement('h3');
        heading.textContent = snapshot.revision.label;
        const source = document.createElement('pre');
        source.textContent = previewSource(snapshot.revision.source);
        source.setAttribute('aria-label', 'Revision source');
        const summary = document.createElement('p');
        const comparison = snapshot.comparison;
        summary.textContent = comparison?.equivalent
            ? 'Semantically equivalent to current.'
            : `${String(comparison?.changes.length ?? 0)} bounded semantic changes.`;
        const restore = commandButton(
            document,
            editor,
            ui,
            'Restore revision',
            'revisions.restore',
            [snapshot.revision.id],
        );
        restore.disabled = !service.can('restore', snapshot.revision.id);
        content.append(heading, summary, source, restore);
    }
    const children: Node[] = [policy, save, list, content];
    if (snapshot.error !== undefined) {
        const error = document.createElement('p');
        error.setAttribute('role', 'alert');
        error.textContent = `Revision error: ${errorMessage(snapshot.error)}`;
        children.splice(2, 0, error);
    }
    container.replaceChildren(...children);
}

function commandButton(
    document: Document,
    editor: Editor,
    ui: EditorUi,
    label: string,
    command: string,
    args: readonly unknown[] = [],
): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', () => run(editor, ui, command, args));
    return button;
}

function run(
    editor: Editor,
    ui: EditorUi,
    command: string,
    args: readonly unknown[],
): void {
    try {
        const result = editor.execute(command, ...args);
        if (isPromiseLike(result)) {
            void Promise.resolve(result).catch((error: unknown) =>
                ui.notifications.show({
                    message: errorMessage(error),
                    severity: 'error',
                }),
            );
        }
    } catch (error: unknown) {
        ui.notifications.show({
            message: errorMessage(error),
            severity: 'error',
        });
    }
}

function requiredString(command: string, args: readonly unknown[]): string {
    if (args.length !== 1) {
        throw new TypeError(
            `Command "${command}" requires one string argument.`,
        );
    }
    return stringValue(args[0], 'ID');
}

function stringValue(value: unknown, label: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new TypeError(`Revision ${label} must not be empty.`);
    }
    return value;
}

function revisionKind(value: unknown): RevisionKind {
    if (value !== 'draft' && value !== 'saved') {
        throw new TypeError('Revision kind must be draft or saved.');
    }
    return value;
}

function reviewPolicy(value: unknown): ReviewPolicy {
    if (value !== 'edit' && value !== 'comments-only' && value !== 'readonly') {
        throw new TypeError('Review policy is invalid.');
    }
    return value;
}

function noArguments(command: string, args: readonly unknown[]): void {
    if (args.length !== 0) {
        throw new TypeError(`Command "${command}" does not accept arguments.`);
    }
}

function previewSource(source: string): string {
    return source.length <= MAX_SOURCE_PREVIEW
        ? source
        : `${source.slice(0, MAX_SOURCE_PREVIEW)}\n… preview truncated …`;
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
    return (
        typeof value === 'object' &&
        value !== null &&
        'then' in value &&
        typeof value.then === 'function'
    );
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
