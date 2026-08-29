import {
    EditorDestroyedError,
    Plugin,
    type Editor,
    type PluginConstructor,
} from '@soeditor/core';
import {
    VisualDecorationsPlugin,
    visualEditingServiceToken,
} from '@soeditor/engine';
import {
    UiPlugin,
    uiRegistryServiceToken,
    type EditorUi,
    type PanelHandle,
    type ToolbarItemFactory,
} from '@soeditor/ui';

import {
    CommentsController,
    commentsServiceToken,
    type CommentsPluginOptions,
    type CommentsService,
} from './comments-service.js';
import type { CommentThread } from './model.js';

/** Creates one configured, per-editor comments plugin constructor. */
export function createCommentsPlugin(
    options: CommentsPluginOptions,
): PluginConstructor {
    const captured = Object.freeze({ ...options });
    return class CommentsPlugin extends Plugin {
        static readonly id = 'comments';
        static readonly requires = [VisualDecorationsPlugin, UiPlugin];
        readonly #disposers: Array<() => void> = [];
        #controller: CommentsController | undefined;
        #service: CommentsService | undefined;

        override async init(): Promise<void> {
            const controller = new CommentsController(this.editor, captured);
            await controller.init();
            const service = controller.service;
            this.#controller = controller;
            this.#service = service;
            this.editor.services.register(commentsServiceToken, service);
            registerCommands(this.editor, service);
            const registry = this.editor.services.get(uiRegistryServiceToken);
            this.#disposers.push(
                registry.registerToolbarItem(
                    'comments',
                    createCommentsButton(),
                ),
                registry.registerShortcut({
                    chord: 'Alt+Shift+ArrowUp',
                    command: 'comments.previous',
                    id: 'comments.previous',
                }),
                registry.registerShortcut({
                    chord: 'Alt+Shift+ArrowDown',
                    command: 'comments.next',
                    id: 'comments.next',
                }),
            );
        }

        override destroy(): void {
            for (const dispose of this.#disposers.splice(0).reverse()) {
                dispose();
            }
            try {
                this.#controller?.destroy();
            } catch (error: unknown) {
                if (!(error instanceof EditorDestroyedError)) throw error;
            }
            try {
                if (
                    this.#service !== undefined &&
                    this.editor.services.tryGet(commentsServiceToken) ===
                        this.#service
                ) {
                    this.editor.services.unregister(commentsServiceToken);
                }
            } catch (error: unknown) {
                if (!(error instanceof EditorDestroyedError)) throw error;
            }
            this.#controller = undefined;
            this.#service = undefined;
        }
    };
}

function registerCommands(editor: Editor, service: CommentsService): void {
    editor.commands.register({
        id: 'comments.create',
        label: 'Add comment',
        canExecute: () => {
            if (
                editor.state.mode !== 'visual' ||
                !editor.services.has(visualEditingServiceToken) ||
                !service.can('create')
            ) {
                return false;
            }
            const selection = editor.services
                .get(visualEditingServiceToken)
                .getSelection();
            return (
                selection !== undefined &&
                (selection.anchor.block !== selection.focus.block ||
                    selection.anchor.offset !== selection.focus.offset)
            );
        },
        execute: (_context, ...args) =>
            service.create(requiredBody('comments.create', args)),
    });
    registerThreadCommand(editor, service, 'comments.reply', 'reply', true);
    registerThreadCommand(editor, service, 'comments.resolve', 'resolve');
    registerThreadCommand(editor, service, 'comments.reopen', 'reopen');
    registerThreadCommand(editor, service, 'comments.delete', 'delete');
    editor.commands.register({
        id: 'comments.open',
        label: 'Open comment',
        canExecute: () =>
            service.snapshot.some(({ state }) => state !== 'deleted'),
        execute: (_context, ...args) =>
            service.open(requiredThreadId('comments.open', args)),
    });
    editor.commands.register({
        id: 'comments.previous',
        label: 'Previous comment',
        canExecute: () =>
            service.snapshot.some(({ state }) => state !== 'deleted'),
        execute: (_context, ...args) => {
            noArguments('comments.previous', args);
            return service.previous();
        },
    });
    editor.commands.register({
        id: 'comments.next',
        label: 'Next comment',
        canExecute: () =>
            service.snapshot.some(({ state }) => state !== 'deleted'),
        execute: (_context, ...args) => {
            noArguments('comments.next', args);
            return service.next();
        },
    });
}

function registerThreadCommand(
    editor: Editor,
    service: CommentsService,
    command:
        | 'comments.delete'
        | 'comments.reopen'
        | 'comments.reply'
        | 'comments.resolve',
    action: 'delete' | 'reopen' | 'reply' | 'resolve',
    hasBody = false,
): void {
    editor.commands.register({
        id: command,
        label: `${action[0]!.toUpperCase()}${action.slice(1)} comment`,
        canExecute: () =>
            service.snapshot.some(({ id }) => service.can(action, id)),
        execute: (_context, ...args) => {
            const threadId = requiredThreadId(command, args, hasBody ? 2 : 1);
            switch (action) {
                case 'reply':
                    return service.reply(
                        threadId,
                        requiredBody(command, args.slice(1)),
                    );
                case 'resolve':
                    return service.resolve(threadId);
                case 'reopen':
                    return service.reopen(threadId);
                case 'delete':
                    return service.delete(threadId);
            }
        },
    });
}

function createCommentsButton(): ToolbarItemFactory {
    return ({ document, editor, ui }) => {
        const service = editor.services.get(commentsServiceToken);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'soeditor-ui__button';
        button.title = 'Open comments';
        button.setAttribute('aria-label', 'Open comments');
        let panel: PanelHandle | undefined;
        let disposePanel: (() => void) | undefined;
        const open = (): void => {
            disposePanel?.();
            panel?.close();
            const content = document.createElement('div');
            content.className = 'soeditor-comments';
            const render = (): void =>
                renderCommentsPanel(content, editor, ui, service);
            disposePanel = service.subscribe(render);
            render();
            panel = ui.panels.show({ content, title: 'Comments' });
        };
        button.addEventListener('click', open);
        const update = (): void => {
            const count = service.snapshot.filter(
                ({ state }) => state !== 'deleted',
            ).length;
            button.textContent =
                count === 0 ? 'Comments' : `Comments (${String(count)})`;
            button.setAttribute(
                'aria-label',
                count === 0
                    ? 'Open comments'
                    : `Open comments, ${String(count)} threads`,
            );
        };
        const disposeCount = service.subscribe(update);
        update();
        return {
            element: button,
            update,
            destroy: () => {
                button.removeEventListener('click', open);
                disposeCount();
                disposePanel?.();
                panel?.close();
            },
        };
    };
}

function renderCommentsPanel(
    container: HTMLElement,
    editor: Editor,
    ui: EditorUi,
    service: CommentsService,
): void {
    const document = container.ownerDocument;
    const controls = document.createElement('div');
    controls.className = 'soeditor-comments__navigation';
    controls.append(
        commandButton(document, editor, ui, 'Previous', 'comments.previous'),
        commandButton(document, editor, ui, 'Next', 'comments.next'),
    );
    const composer = document.createElement('form');
    composer.className = 'soeditor-comments__composer';
    const body = document.createElement('textarea');
    body.rows = 3;
    body.maxLength = 10_000;
    body.setAttribute('aria-label', 'New comment');
    body.placeholder = 'Comment on the current selection';
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.textContent = 'Add comment';
    submit.disabled = !editor.commands.canExecute('comments.create');
    composer.addEventListener('submit', (event) => {
        event.preventDefault();
        ui.restoreEditingSelection();
        run(editor, ui, 'comments.create', [body.value]);
    });
    composer.append(body, submit);
    const list = document.createElement('div');
    list.className = 'soeditor-comments__threads';
    list.setAttribute('aria-label', 'Comment threads');
    for (const thread of service.snapshot) {
        if (thread.state === 'deleted') continue;
        list.append(renderThread(document, editor, ui, service, thread));
    }
    if (list.childNodes.length === 0) {
        const empty = document.createElement('p');
        empty.textContent = 'No comments.';
        list.append(empty);
    }
    if (service.lastError !== undefined) {
        const error = document.createElement('p');
        error.setAttribute('role', 'alert');
        error.textContent = `Comments error: ${errorMessage(service.lastError)}`;
        container.replaceChildren(controls, composer, error, list);
        return;
    }
    container.replaceChildren(controls, composer, list);
}

function renderThread(
    document: Document,
    editor: Editor,
    ui: EditorUi,
    service: CommentsService,
    thread: Exclude<CommentThread, { readonly state: 'deleted' }>,
): HTMLElement {
    const article = document.createElement('article');
    article.className = 'soeditor-comments__thread';
    article.dataset.commentState = thread.state;
    article.setAttribute(
        'aria-current',
        String(service.activeThreadId === thread.id),
    );
    const heading = document.createElement('h3');
    heading.textContent = `Comment · ${thread.state}`;
    const open = document.createElement('button');
    open.type = 'button';
    open.textContent = 'Go to comment';
    open.addEventListener('click', () =>
        run(editor, ui, 'comments.open', [thread.id]),
    );
    article.append(heading, open);
    for (const message of thread.messages) {
        const item = document.createElement('div');
        item.className = 'soeditor-comments__message';
        const author = document.createElement('strong');
        author.textContent = message.author.name;
        const body = document.createElement('p');
        body.textContent = message.body;
        item.append(author, body);
        article.append(item);
    }
    const actions = document.createElement('div');
    actions.className = 'soeditor-comments__actions';
    if (service.can('reply', thread.id)) {
        const reply = document.createElement('textarea');
        reply.rows = 2;
        reply.maxLength = 10_000;
        reply.setAttribute('aria-label', 'Reply');
        const send = document.createElement('button');
        send.type = 'button';
        send.textContent = 'Reply';
        send.addEventListener('click', () =>
            run(editor, ui, 'comments.reply', [thread.id, reply.value]),
        );
        actions.append(reply, send);
    }
    const stateCommand =
        thread.state === 'resolved' ? 'comments.reopen' : 'comments.resolve';
    if (
        service.can(
            thread.state === 'resolved' ? 'reopen' : 'resolve',
            thread.id,
        )
    ) {
        actions.append(
            commandButton(
                document,
                editor,
                ui,
                thread.state === 'resolved' ? 'Reopen' : 'Resolve',
                stateCommand,
                [thread.id],
            ),
        );
    }
    if (service.can('delete', thread.id)) {
        actions.append(
            commandButton(document, editor, ui, 'Delete', 'comments.delete', [
                thread.id,
            ]),
        );
    }
    article.append(actions);
    return article;
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
    button.disabled = !editor.commands.canExecute(command);
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

function requiredThreadId(
    command: string,
    args: readonly unknown[],
    length = 1,
): string {
    if (
        args.length !== length ||
        typeof args[0] !== 'string' ||
        args[0].length === 0
    ) {
        throw new TypeError(
            `Command "${command}" requires a comment thread ID.`,
        );
    }
    return args[0];
}

function requiredBody(command: string, args: readonly unknown[]): string {
    if (args.length !== 1 || typeof args[0] !== 'string') {
        throw new TypeError(`Command "${command}" requires a comment body.`);
    }
    return args[0];
}

function noArguments(command: string, args: readonly unknown[]): void {
    if (args.length !== 0) {
        throw new TypeError(`Command "${command}" does not accept arguments.`);
    }
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
    return (
        typeof value === 'object' &&
        value !== null &&
        'then' in value &&
        typeof value.then === 'function'
    );
}
