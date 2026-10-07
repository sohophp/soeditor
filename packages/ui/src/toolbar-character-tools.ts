import { createToolbarRoot } from './toolbar-root.js';

import type { ToolbarItemFactory } from './types.js';
import {
    field,
    canExecute,
    execute,
    readSpecialCharacters,
} from './toolbar-tool-shared.js';

const specialCharacterButton: ToolbarItemFactory = ({
    document,
    editor,
    ui,
}) => {
    const details = createToolbarRoot(document, ui, 'details');
    details.className = 'soeditor-ui__menu';
    const summary = document.createElement('summary');
    summary.className = 'soeditor-ui__button';
    ui.setIcon(summary, 'specialCharacter.insert', 'Special character');
    summary.title = 'Special character';
    summary.setAttribute('aria-label', 'Choose special character');
    const menu = document.createElement('div');
    menu.className = 'soeditor-ui__menu-items soeditor-ui__character-grid';
    const characters = readSpecialCharacters(
        editor.config.get<unknown>('cms.specialCharacters'),
    );
    const listeners: Array<{
        readonly button: HTMLButtonElement;
        readonly click: () => void;
    }> = [];
    for (const character of characters === false ? [] : characters) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'soeditor-ui__menu-item';
        button.textContent = character;
        button.title = `Insert ${character}`;
        button.setAttribute('aria-label', `Insert ${character}`);
        const click = (): void => {
            execute(editor, ui, 'specialCharacter.insert', [character]);
            details.open = false;
        };
        button.addEventListener('click', click);
        listeners.push({ button, click });
        menu.append(button);
    }
    const custom = document.createElement('button');
    custom.type = 'button';
    custom.className = 'soeditor-ui__menu-item soeditor-ui__character-custom';
    custom.textContent = 'Custom…';
    const customClick = (): void => {
        let input: HTMLInputElement;
        const handle = ui.dialogs.open({
            title: 'Special character',
            content: (container) => {
                input = field(document, container, 'Character', 'text', true);
            },
            actions: [
                {
                    label: 'Insert character',
                    kind: 'primary',
                    run: () => {
                        if (
                            execute(editor, ui, 'specialCharacter.insert', [
                                input.value,
                            ])
                        ) {
                            handle.close();
                            details.open = false;
                        }
                    },
                },
            ],
        });
    };
    custom.addEventListener('click', customClick);
    menu.append(custom);
    details.append(summary, menu);
    details.hidden = characters === false;
    return {
        element: details,
        update: () => {
            const available = canExecute(editor, 'specialCharacter.insert');
            summary.setAttribute('aria-disabled', String(!available));
            for (const { button } of listeners) button.disabled = !available;
            custom.disabled = !available;
        },
        destroy: () => {
            for (const { button, click } of listeners) {
                button.removeEventListener('click', click);
            }
            custom.removeEventListener('click', customClick);
        },
    };
};

export { specialCharacterButton };
