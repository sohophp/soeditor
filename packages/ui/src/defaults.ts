import type { Editor } from '@soeditor/core';

import type {
    DialogHandle,
    EditorUi,
    KeyboardShortcutDefinition,
    ToolbarItemFactory,
    ToolbarItemInstance,
} from './types.js';

export const defaultToolbarConfiguration = Object.freeze([
    'undo',
    'redo',
    '|',
    'heading',
    '|',
    'bold',
    'italic',
    'underline',
    'strike',
    'link',
    '|',
    'image',
    'table',
    '|',
    'source',
    'preview',
    'format',
] as const);

export const defaultShortcuts: readonly KeyboardShortcutDefinition[] =
    Object.freeze([
        shortcut('undo', 'Mod+Z', 'editor.undo'),
        shortcut('redo', 'Mod+Shift+Z', 'editor.redo'),
        shortcut('bold', 'Mod+B', 'format.bold'),
        shortcut('italic', 'Mod+I', 'format.italic'),
        shortcut('underline', 'Mod+U', 'format.underline'),
    ]);

function commandButton(
    label: string,
    command: string,
    args: readonly unknown[] = [],
    text = label,
): ToolbarItemFactory {
    return ({ document, editor, ui }) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'soeditor-ui__button';
        button.textContent = text;
        button.title = label;
        button.setAttribute('aria-label', label);
        const click = (): void => {
            execute(editor, ui, command, args);
        };
        button.addEventListener('click', click);
        return {
            element: button,
            update: () => updateCommandButton(button, editor, command),
            destroy: () => button.removeEventListener('click', click),
        };
    };
}

const sourceButton: ToolbarItemFactory = ({ document, editor, ui }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'soeditor-ui__button';
    const command = (): 'editor.source' | 'editor.visual' =>
        editor.state.mode === 'source' ? 'editor.visual' : 'editor.source';
    const click = (): void => {
        execute(editor, ui, command(), []);
    };
    button.addEventListener('click', click);
    return {
        element: button,
        update: () => {
            const sourceMode = editor.state.mode === 'source';
            button.textContent = sourceMode ? 'Visual' : 'Source';
            button.title = sourceMode
                ? 'Switch to visual editing'
                : 'Switch to HTML source editing';
            button.setAttribute('aria-pressed', String(sourceMode));
            updateCommandAvailability(button, editor, command());
        },
        destroy: () => button.removeEventListener('click', click),
    };
};

const previewButton: ToolbarItemFactory = ({ document, editor, ui }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'soeditor-ui__button';
    const command = (): 'editor.preview' | 'editor.preview.close' =>
        editor.state.mode === 'preview'
            ? 'editor.preview.close'
            : 'editor.preview';
    const click = (): void => {
        execute(editor, ui, command(), []);
    };
    button.addEventListener('click', click);
    return {
        element: button,
        update: () => {
            const previewMode = editor.state.mode === 'preview';
            button.textContent = previewMode ? 'Edit' : 'Preview';
            button.title = previewMode ? 'Close preview' : 'Preview content';
            button.setAttribute('aria-pressed', String(previewMode));
            updateCommandAvailability(button, editor, command());
        },
        destroy: () => button.removeEventListener('click', click),
    };
};

const headingMenu: ToolbarItemFactory = ({ document, editor, ui }) => {
    const details = document.createElement('details');
    details.className = 'soeditor-ui__menu';
    const summary = document.createElement('summary');
    summary.className = 'soeditor-ui__button';
    summary.textContent = 'Heading';
    summary.setAttribute('aria-label', 'Choose block style');
    const menu = document.createElement('div');
    menu.className = 'soeditor-ui__menu-items';
    const entries = [
        { label: 'Paragraph', command: 'paragraph.set', args: [] },
        ...Array.from({ length: 6 }, (_, index) => ({
            label: `Heading ${String(index + 1)}`,
            command: 'paragraph.heading',
            args: [index + 1],
        })),
    ];
    const buttons = entries.map((entry) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'soeditor-ui__menu-item';
        button.textContent = entry.label;
        const click = (): void => {
            execute(editor, ui, entry.command, entry.args);
            details.open = false;
        };
        button.addEventListener('click', click);
        menu.append(button);
        return { button, click, command: entry.command };
    });
    details.append(summary, menu);
    return {
        element: details,
        update: () => {
            const available = buttons.some(({ command }) =>
                canExecute(editor, command),
            );
            summary.setAttribute('aria-disabled', String(!available));
            for (const { button, command } of buttons) {
                updateCommandButton(button, editor, command);
            }
        },
        destroy: () => {
            for (const { button, click } of buttons) {
                button.removeEventListener('click', click);
            }
        },
    };
};

const linkButton = dialogCommandButton('Link', 'link.set', (document, run) => {
    let href: HTMLInputElement;
    let title: HTMLInputElement;
    return {
        content: (container) => {
            href = field(document, container, 'URL', 'url', true);
            title = field(document, container, 'Title', 'text', false);
        },
        run: () =>
            run({
                href: href.value,
                ...(title.value.length === 0 ? {} : { title: title.value }),
            }),
    };
});

const imageButton = dialogCommandButton(
    'Image',
    'image.insert',
    (document, run) => {
        let src: HTMLInputElement;
        let alt: HTMLInputElement;
        return {
            content: (container) => {
                src = field(document, container, 'Image URL', 'url', true);
                alt = field(document, container, 'Alternative text', 'text');
            },
            run: () => run({ src: src.value, alt: alt.value }),
        };
    },
);

const tableButton = dialogCommandButton(
    'Table',
    'table.insert',
    (document, run) => {
        let rows: HTMLInputElement;
        let columns: HTMLInputElement;
        return {
            content: (container) => {
                rows = field(document, container, 'Rows', 'number', true, '2');
                columns = field(
                    document,
                    container,
                    'Columns',
                    'number',
                    true,
                    '2',
                );
            },
            run: () =>
                run({
                    rows: Number(rows.value),
                    columns: Number(columns.value),
                }),
        };
    },
);

export const defaultToolbarItems: ReadonlyMap<string, ToolbarItemFactory> =
    new Map([
        ['undo', commandButton('Undo', 'editor.undo')],
        ['redo', commandButton('Redo', 'editor.redo')],
        ['heading', headingMenu],
        ['bold', commandButton('Bold', 'format.bold', undefined, 'B')],
        ['italic', commandButton('Italic', 'format.italic', undefined, 'I')],
        [
            'underline',
            commandButton('Underline', 'format.underline', undefined, 'U'),
        ],
        ['strike', commandButton('Strike', 'format.strike')],
        ['link', linkButton],
        ['image', imageButton],
        ['table', tableButton],
        ['source', sourceButton],
        ['markdown', commandButton('Markdown', 'editor.markdown')],
        ['preview', previewButton],
        ['format', commandButton('Format HTML', 'document.format')],
    ]);

function dialogCommandButton(
    label: string,
    command: string,
    create: (
        document: Document,
        run: (...args: readonly unknown[]) => void,
    ) => {
        readonly content: (container: HTMLElement) => void;
        readonly run: () => void;
    },
): ToolbarItemFactory {
    return ({ document, editor, ui }) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'soeditor-ui__button';
        button.textContent = label;
        const click = (): void => {
            const fields = create(document, (...args) => {
                if (execute(editor, ui, command, args)) {
                    handle.close();
                }
            });
            const handle: DialogHandle = ui.dialogs.open({
                title: label,
                content: fields.content,
                actions: [
                    {
                        label: `Insert ${label.toLowerCase()}`,
                        kind: 'primary',
                        run: () => fields.run(),
                    },
                ],
            });
        };
        button.addEventListener('click', click);
        return {
            element: button,
            update: () => updateCommandButton(button, editor, command),
            destroy: () => button.removeEventListener('click', click),
        };
    };
}

function field(
    document: Document,
    container: HTMLElement,
    labelText: string,
    type: string,
    required = false,
    value = '',
): HTMLInputElement {
    const label = document.createElement('label');
    label.className = 'soeditor-ui__field';
    const caption = document.createElement('span');
    caption.textContent = labelText;
    const input = document.createElement('input');
    input.type = type;
    input.required = required;
    input.value = value;
    if (type === 'number') {
        input.min = '1';
        input.max = '20';
    }
    label.append(caption, input);
    container.append(label);
    return input;
}

function updateCommandButton(
    button: HTMLButtonElement,
    editor: Editor,
    command: string,
): void {
    updateCommandAvailability(button, editor, command);
    const active = editor.commands.has(command)
        ? editor.commands.isActive(command)
        : false;
    button.setAttribute('aria-pressed', String(active));
    button.classList.toggle('is-active', active);
}

function updateCommandAvailability(
    button: HTMLButtonElement,
    editor: Editor,
    command: string,
): void {
    button.disabled = !canExecute(editor, command);
}

function canExecute(editor: Editor, command: string): boolean {
    return editor.commands.has(command) && editor.commands.canExecute(command);
}

function execute(
    editor: Editor,
    ui: EditorUi,
    command: string,
    args: readonly unknown[],
): boolean {
    try {
        ui.restoreEditingSelection();
        const result = editor.execute(command, ...args);
        if (isPromiseLike(result)) {
            void Promise.resolve(result).catch((error: unknown) =>
                reportError(ui, error),
            );
        }
        return true;
    } catch (error: unknown) {
        reportError(ui, error);
        return false;
    }
}

function reportError(ui: EditorUi, error: unknown): void {
    try {
        ui.notifications.show({
            message: error instanceof Error ? error.message : String(error),
            severity: 'error',
        });
    } catch {
        // Core already publishes command failures; a destroyed UI has no sink.
    }
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
    return (typeof value === 'object' && value !== null) ||
        typeof value === 'function'
        ? typeof Reflect.get(value, 'then') === 'function'
        : false;
}

function shortcut(
    id: string,
    chord: string,
    command: string,
): KeyboardShortcutDefinition {
    return Object.freeze({ id: `default.${id}`, chord, command });
}

export function destroyToolbarItems(
    items: readonly ToolbarItemInstance[],
): void {
    for (const item of [...items].reverse()) {
        item.destroy?.();
    }
}
