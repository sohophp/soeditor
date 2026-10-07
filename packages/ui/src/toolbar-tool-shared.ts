import { createToolbarRoot } from './toolbar-root.js';
import type { Editor } from '@soeditor/core';
import type { DialogHandle, EditorUi, ToolbarItemFactory } from './types.js';

export function textDialogButton(
    label: string,
    command: string,
    fieldLabel: string,
    type = 'text',
    fallbackIcon = label,
): ToolbarItemFactory {
    return dialogCommandButton(
        label,
        command,
        (document, run) => {
            let input: HTMLInputElement;
            return {
                content: (container) => {
                    input = field(document, container, fieldLabel, type, true);
                },
                run: () => run(input.value),
            };
        },
        fallbackIcon,
    );
}

export function dialogCommandButton(
    label: string,
    command: string,
    create: (
        document: Document,
        run: (...args: readonly unknown[]) => void,
        editor: Editor,
    ) =>
        | {
              readonly content: (container: HTMLElement) => void;
              readonly run: () => void;
          }
        | Promise<{
              readonly content: (container: HTMLElement) => void;
              readonly run: () => void;
          }>,
    fallbackIcon = label,
): ToolbarItemFactory {
    return ({ document, editor, ui }) => {
        const button = createToolbarRoot(document, ui, 'button');
        button.type = 'button';
        button.className = 'soeditor-ui__button';
        ui.setIcon(button, command, fallbackIcon);
        button.title = label;
        button.setAttribute('aria-label', label);
        const click = async (): Promise<void> => {
            const state: { handle?: DialogHandle } = {};
            const fields = await Promise.resolve(
                create(
                    document,
                    (...args) => {
                        if (execute(editor, ui, command, args)) {
                            state.handle?.close();
                        }
                    },
                    editor,
                ),
            ).catch((error: unknown) => {
                reportError(ui, error);
                return undefined;
            });
            if (fields === undefined || !button.isConnected) return;
            state.handle = ui.dialogs.open({
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
            update: () => updateCommandAvailability(button, editor, command),
            destroy: () => button.removeEventListener('click', click),
        };
    };
}

export function field(
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

export function inspectedValues(
    editor: Editor,
    command: string,
): Record<string, unknown> {
    if (!editor.commands.has(command) || !editor.commands.canExecute(command))
        return {};
    const value = editor.execute(command);
    return typeof value === 'object' && value !== null
        ? (value as Record<string, unknown>)
        : {};
}

export function stringValue(value: unknown): string {
    return typeof value === 'string' || typeof value === 'number'
        ? String(value)
        : '';
}

export function updateCommandButton(
    button: HTMLButtonElement,
    editor: Editor,
    command: string,
): void {
    updateCommandAvailability(button, editor, command);
    const active =
        !button.disabled && editor.commands.has(command)
            ? editor.commands.isActive(command)
            : false;
    button.setAttribute('aria-pressed', String(active));
    button.classList.toggle('is-active', active);
}

export function updateCommandAvailability(
    button: HTMLButtonElement,
    editor: Editor,
    command: string,
): void {
    button.disabled = !canExecute(editor, command);
}

export function canExecute(editor: Editor, command: string): boolean {
    return editor.commands.has(command) && editor.commands.canExecute(command);
}

export function execute(
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

export function reportError(ui: EditorUi, error: unknown): void {
    try {
        ui.notifications.show({
            message: error instanceof Error ? error.message : String(error),
            severity: 'error',
        });
    } catch {
        // Core already publishes command failures; a destroyed UI has no sink.
    }
}

export function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
    return (typeof value === 'object' && value !== null) ||
        typeof value === 'function'
        ? typeof Reflect.get(value, 'then') === 'function'
        : false;
}

const defaultSpecialCharacters = Object.freeze([
    '©',
    '®',
    '™',
    '€',
    '£',
    '¥',
    '¢',
    '§',
    '¶',
    '•',
    '…',
    '–',
    '—',
    '«',
    '»',
    '“',
    '”',
    '‘',
    '’',
    '°',
    '±',
    '×',
    '÷',
    '≈',
    '≠',
    '≤',
    '≥',
    '∞',
    '√',
    'Ω',
    '→',
    '←',
    '↑',
    '↓',
    '✓',
    '★',
    '♥',
    '◆',
    '½',
    '¼',
] as const);

export function readSpecialCharacters(
    value: unknown,
): readonly string[] | false {
    if (value === false) return false;
    if (value === undefined) return defaultSpecialCharacters;
    if (!Array.isArray(value) || value.length > 200) {
        throw new TypeError(
            'cms.specialCharacters must be false or an array of at most 200 characters.',
        );
    }
    return Object.freeze(
        value.map((character, index) => {
            if (
                typeof character !== 'string' ||
                character.length === 0 ||
                Array.from(character).length > 4 ||
                Array.from(character).some((value) => {
                    const code = value.codePointAt(0) ?? 0;
                    return code <= 31 || code === 127;
                })
            ) {
                throw new TypeError(
                    `cms.specialCharacters[${String(index)}] must be one bounded printable value.`,
                );
            }
            return character;
        }),
    );
}

export function nativePickerColor(value: string): string | undefined {
    const short = /^#([\da-f])([\da-f])([\da-f])$/u.exec(value);
    if (short !== null) {
        return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
    }
    return /^#[\da-f]{6}$/u.test(value) ? value : undefined;
}
