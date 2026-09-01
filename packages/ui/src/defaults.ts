import type { Editor } from '@soeditor/core';

import type {
    DialogHandle,
    DismissibleUiHandle,
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
    'fontFamily',
    'fontSize',
    'fontColor',
    'fontBackgroundColor',
    'highlight',
    'link',
    '|',
    'image',
    'table',
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
    icon = command,
): ToolbarItemFactory {
    return ({ document, editor, ui }) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'soeditor-ui__button';
        ui.setIcon(button, icon, text);
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

function sourceOnlyCommandButton(
    label: string,
    command: string,
    text = label,
): ToolbarItemFactory {
    return ({ document, editor, ui }) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'soeditor-ui__button';
        ui.setIcon(button, command, text);
        button.title = label;
        button.setAttribute('aria-label', label);
        const click = (): void => {
            execute(editor, ui, command, []);
        };
        button.addEventListener('click', click);
        return {
            element: button,
            update: () => {
                button.hidden = editor.state.mode !== 'source';
                updateCommandButton(button, editor, command);
            },
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
            const target = sourceMode ? 'WYSIWYG' : 'Source';
            if (button.dataset.switchTarget !== target.toLowerCase()) {
                ui.setIcon(
                    button,
                    sourceMode ? 'editor.visual' : 'editor.source',
                    target,
                );
            }
            button.title = sourceMode
                ? ui.translate('Switch to WYSIWYG editing')
                : ui.translate('Switch to Source editing');
            button.setAttribute('aria-label', ui.translate(target));
            button.dataset.switchTarget = target.toLowerCase();
            button.setAttribute('aria-pressed', String(sourceMode));
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
    ui.setIcon(summary, 'paragraph.heading', 'Heading');
    summary.setAttribute('aria-label', 'Choose block style');
    const menu = document.createElement('div');
    menu.className = 'soeditor-ui__menu-items soeditor-ui__heading-choices';
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
        button.className = 'soeditor-ui__menu-item soeditor-ui__heading-choice';
        button.dataset.block =
            entry.command === 'paragraph.set'
                ? 'p'
                : `h${String(entry.args[0])}`;
        const sample = document.createElement('span');
        sample.textContent = entry.label;
        button.append(sample);
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

const linkButton: ToolbarItemFactory = ({ document, editor, ui }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'soeditor-ui__button';
    ui.setIcon(button, 'link.set', 'Link');
    button.title = 'Link';
    button.setAttribute('aria-label', 'Link');
    const click = (): void => {
        ui.restoreEditingSelection();
        const current = editor.commands.has('link.inspect')
            ? editor.commands.canExecute('link.inspect')
                ? editor.execute('link.inspect')
                : undefined
            : undefined;
        const values =
            typeof current === 'object' && current !== null
                ? (current as Record<string, unknown>)
                : {};
        const selectedText = ui.getEditingSelectionText();
        const editingExisting = typeof values.href === 'string';
        const body = document.createElement('div');
        body.className = 'soeditor-ui__link-dialog-form';
        const essentials = document.createElement('div');
        essentials.className = 'soeditor-ui__link-essentials';
        const displayed = field(
            document,
            essentials,
            'Displayed text',
            'text',
            false,
            selectedText,
        );
        const href = field(
            document,
            essentials,
            'Link URL',
            'text',
            true,
            typeof values.href === 'string' ? values.href : '',
        );
        displayed.autocomplete = 'off';
        displayed.placeholder = 'Text shown to readers';
        href.setAttribute('autocomplete', 'url');
        href.inputMode = 'url';
        href.placeholder = 'https://example.com/page';
        href.spellcheck = false;

        const advanced = document.createElement('details');
        advanced.className = 'soeditor-ui__link-advanced';
        advanced.open = ['title', 'target', 'rel'].some(
            (name) =>
                typeof values[name] === 'string' &&
                values[name].trim().length > 0,
        );
        const advancedSummary = document.createElement('summary');
        advancedSummary.textContent = 'Advanced settings';
        const advancedFields = document.createElement('div');
        advancedFields.className = 'soeditor-ui__link-advanced-fields';
        const title = field(
            document,
            advancedFields,
            'Title',
            'text',
            false,
            typeof values.title === 'string' ? values.title : '',
        );
        title.autocomplete = 'off';
        title.placeholder = 'Optional tooltip';
        const target = linkTargetField(
            document,
            advancedFields,
            typeof values.target === 'string' ? values.target : '',
        );
        const rel = relationshipTagField(
            document,
            advancedFields,
            typeof values.rel === 'string' ? values.rel : '',
        );
        advanced.append(advancedSummary, advancedFields);
        body.append(essentials, advanced);
        const save = (): void => {
            href.value = href.value.trim();
            if (!href.reportValidity()) return;
            const text = displayed.value || href.value;
            const attributes = {
                href: href.value,
                ...(title.value.length === 0 ? {} : { title: title.value }),
                ...(target.value.length === 0 ? {} : { target: target.value }),
                ...(rel.value().length === 0 ? {} : { rel: rel.value() }),
            };
            const command = text === selectedText ? 'link.set' : 'link.setText';
            if (
                execute(editor, ui, command, [
                    command === 'link.set'
                        ? attributes
                        : { ...attributes, text },
                ])
            ) {
                handle.close();
            }
        };
        const handle = ui.dialogs.open({
            title: editingExisting ? 'Edit link' : 'Link',
            returnFocus: button,
            content: body,
            actions: [
                ...(editingExisting
                    ? [
                          {
                              kind: 'danger' as const,
                              label: 'Remove link',
                              run: (): void => {
                                  if (execute(editor, ui, 'link.remove', [])) {
                                      handle.close();
                                  }
                              },
                          },
                      ]
                    : []),
                {
                    kind: 'primary',
                    label: editingExisting ? 'Update link' : 'Insert link',
                    run: save,
                },
            ],
        });
        handle.element.classList.add('soeditor-ui__link-dialog');
        body.addEventListener('keydown', (event) => {
            const view = document.defaultView;
            const fromInput =
                view !== null && event.target instanceof view.HTMLInputElement;
            if (
                event.key !== 'Enter' ||
                event.isComposing ||
                event.defaultPrevented ||
                !fromInput
            ) {
                return;
            }
            event.preventDefault();
            save();
        });
        href.focus();
        href.select();
    };
    button.addEventListener('click', click);
    return {
        element: button,
        update: () => updateCommandButton(button, editor, 'link.set'),
        destroy: () => button.removeEventListener('click', click),
    };
};

const commonLinkTargets = Object.freeze([
    { label: 'Same window (_self)', value: '_self' },
    { label: 'New window or tab (_blank)', value: '_blank' },
    { label: 'Parent frame (_parent)', value: '_parent' },
    { label: 'Top frame (_top)', value: '_top' },
] as const);

const commonLinkRelationships = Object.freeze([
    'nofollow',
    'sponsored',
    'ugc',
    'noopener',
    'noreferrer',
    'external',
] as const);

function linkTargetField(
    document: Document,
    container: HTMLElement,
    value: string,
): HTMLInputElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'soeditor-ui__field';
    const caption = document.createElement('span');
    caption.textContent = 'Target';
    const controls = document.createElement('div');
    controls.className = 'soeditor-ui__link-target-controls';
    const select = document.createElement('select');
    select.setAttribute('aria-label', 'Common target');
    const prompt = document.createElement('option');
    prompt.value = '';
    prompt.textContent = 'Choose a common target';
    select.append(prompt);
    for (const entry of commonLinkTargets) {
        const option = document.createElement('option');
        option.value = entry.value;
        option.textContent = entry.label;
        select.append(option);
    }
    const input = document.createElement('input');
    input.type = 'text';
    input.value = value;
    input.placeholder = 'Custom target name';
    input.setAttribute('aria-label', 'Target');
    input.autocomplete = 'off';
    select.addEventListener('change', () => {
        if (select.value.length === 0) return;
        input.value = select.value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    controls.append(select, input);
    wrapper.append(caption, controls);
    container.append(wrapper);
    return input;
}

interface RelationshipTagInput {
    value(): string;
}

function relationshipTagField(
    document: Document,
    container: HTMLElement,
    value: string,
): RelationshipTagInput {
    const wrapper = document.createElement('div');
    wrapper.className = 'soeditor-ui__field';
    const caption = document.createElement('span');
    caption.textContent = 'Relationship';
    const choices = document.createElement('div');
    choices.className = 'soeditor-ui__link-rel-choices';
    choices.setAttribute('role', 'group');
    choices.setAttribute('aria-label', 'Common relationships');
    const selected = new Set(
        value
            .split(/\s+/u)
            .map((token) => token.trim().toLowerCase())
            .filter((token) => token.length > 0),
    );
    const buttons = new Map<string, HTMLButtonElement>();

    const updateButton = (token: string): void => {
        const button = buttons.get(token);
        if (button === undefined) return;
        const active = selected.has(token);
        button.classList.toggle('is-selected', active);
        button.setAttribute('aria-pressed', String(active));
    };
    const addChoice = (token: string): void => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'soeditor-ui__link-rel-tag';
        button.textContent = token;
        button.title = `Toggle relationship ${token}`;
        button.setAttribute('aria-label', `Relationship ${token}`);
        button.addEventListener('click', () => {
            if (selected.has(token)) selected.delete(token);
            else selected.add(token);
            updateButton(token);
        });
        buttons.set(token, button);
        choices.append(button);
        updateButton(token);
    };
    for (const token of commonLinkRelationships) addChoice(token);
    for (const token of selected) {
        if (!buttons.has(token)) addChoice(token);
    }

    const customControls = document.createElement('div');
    customControls.className = 'soeditor-ui__link-rel-custom';
    const custom = document.createElement('input');
    custom.type = 'text';
    custom.placeholder = 'Custom relationship';
    custom.autocomplete = 'off';
    custom.setAttribute('aria-label', 'Add relationship');
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'soeditor-ui__dialog-action';
    add.textContent = 'Add';
    const commitCustom = (): void => {
        const token = custom.value.trim().toLowerCase();
        if (!/^[a-z][a-z0-9.-]{0,63}$/u.test(token)) {
            custom.setCustomValidity(
                'Use one relationship token beginning with a letter; letters, numbers, dots, and hyphens are supported.',
            );
            custom.reportValidity();
            return;
        }
        custom.setCustomValidity('');
        selected.add(token);
        if (!buttons.has(token)) addChoice(token);
        else updateButton(token);
        custom.value = '';
        custom.focus();
    };
    custom.addEventListener('input', () => custom.setCustomValidity(''));
    custom.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        commitCustom();
    });
    add.addEventListener('click', commitCustom);
    customControls.append(custom, add);
    wrapper.append(caption, choices, customControls);
    container.append(wrapper);
    return {
        value: () => [...selected].sort().join(' '),
    };
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

const specialCharacterButton: ToolbarItemFactory = ({
    document,
    editor,
    ui,
}) => {
    const details = document.createElement('details');
    details.className = 'soeditor-ui__menu';
    const summary = document.createElement('summary');
    summary.className = 'soeditor-ui__button';
    ui.setIcon(summary, 'specialCharacter.insert', 'Special character');
    summary.title = 'Special character';
    summary.setAttribute('aria-label', 'Choose special character');
    const menu = document.createElement('div');
    menu.className = 'soeditor-ui__menu-items soeditor-ui__character-grid';
    const positionMenu = (): void => {
        menu.style.transform = '';
        if (!details.open) return;

        const gutter = 8;
        const viewportWidth = document.documentElement.clientWidth;
        const menuRectangle = menu.getBoundingClientRect();
        let horizontalShift = 0;
        if (menuRectangle.right > viewportWidth - gutter) {
            horizontalShift = viewportWidth - gutter - menuRectangle.right;
        }
        if (menuRectangle.left + horizontalShift < gutter) {
            horizontalShift += gutter - (menuRectangle.left + horizontalShift);
        }
        if (horizontalShift !== 0) {
            menu.style.transform = `translateX(${String(horizontalShift)}px)`;
        }
    };
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
    details.addEventListener('toggle', positionMenu);
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
            details.removeEventListener('toggle', positionMenu);
            for (const { button, click } of listeners) {
                button.removeEventListener('click', click);
            }
            custom.removeEventListener('click', customClick);
        },
    };
};

function readSpecialCharacters(value: unknown): readonly string[] | false {
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

const anchorButton = textDialogButton(
    'Named anchor',
    'anchor.insert',
    'Anchor name',
    'text',
    '⌖',
);

const placeholderButton = textDialogButton(
    'CMS placeholder',
    'placeholder.insert',
    'Placeholder name',
);

const imageButton = dialogCommandButton(
    'Image',
    'image.insert',
    (document, run) => {
        let src: HTMLInputElement;
        let alt: HTMLInputElement;
        return {
            content: (container) => {
                container
                    .closest('.soeditor-ui__dialog')
                    ?.classList.add('soeditor-ui__image-dialog');
                src = field(document, container, 'Image URL', 'url', true);
                alt = field(document, container, 'Alternative text', 'text');
            },
            run: () => run({ src: src.value, alt: alt.value }),
        };
    },
    '▣',
);

const imageActionsMenu: ToolbarItemFactory = ({ document, editor, ui }) => {
    const details = document.createElement('details');
    details.className = 'soeditor-ui__menu soeditor-ui__image-menu';
    const summary = document.createElement('summary');
    summary.className = 'soeditor-ui__button';
    ui.setIcon(summary, 'image.actions', 'Insert image');
    summary.title = 'Insert image';
    summary.setAttribute('aria-label', 'Choose image insertion method');
    const menu = document.createElement('div');
    menu.className = 'soeditor-ui__menu-items';
    menu.setAttribute('role', 'menu');
    const uploadInput = document.createElement('input');
    uploadInput.type = 'file';
    uploadInput.accept = 'image/*';
    uploadInput.hidden = true;
    const upload = imageAction(
        document,
        ui,
        'image.upload',
        'Upload from computer',
    );
    const browse = imageAction(
        document,
        ui,
        'image.browse',
        'Insert with file manager',
    );
    const url = imageAction(document, ui, 'image.insert', 'Insert via URL');
    const close = (): void => {
        details.open = false;
    };
    const uploadClick = (): void => {
        close();
        uploadInput.click();
    };
    const uploadChange = (): void => {
        const file = uploadInput.files?.item(0);
        uploadInput.value = '';
        if (file === null || file === undefined) return;
        close();
        execute(editor, ui, 'image.upload', [
            { file, name: file.name, type: file.type },
        ]);
    };
    const browseClick = (): void => {
        close();
        execute(editor, ui, 'image.browse', []);
    };
    const urlClick = (): void => {
        close();
        let source: HTMLInputElement;
        let alternative: HTMLInputElement;
        const handle = ui.dialogs.open({
            title: 'Insert image via URL',
            content: (container) => {
                container
                    .closest('.soeditor-ui__dialog')
                    ?.classList.add('soeditor-ui__image-dialog');
                source = field(document, container, 'Image URL', 'url', true);
                alternative = field(
                    document,
                    container,
                    'Alternative text',
                    'text',
                );
            },
            actions: [
                {
                    kind: 'primary',
                    label: 'Insert image',
                    run: () => {
                        if (
                            execute(editor, ui, 'image.insert', [
                                {
                                    alt: alternative.value,
                                    src: source.value,
                                },
                            ])
                        ) {
                            handle.close();
                        }
                    },
                },
            ],
        });
    };
    upload.addEventListener('click', uploadClick);
    uploadInput.addEventListener('change', uploadChange);
    browse.addEventListener('click', browseClick);
    url.addEventListener('click', urlClick);
    menu.append(upload, browse, url, uploadInput);
    details.append(summary, menu);
    return {
        element: details,
        update: () => {
            const uploadAvailable = canExecute(editor, 'image.upload');
            const browseAvailable = canExecute(editor, 'image.browse');
            const urlAvailable = canExecute(editor, 'image.insert');
            upload.disabled = !uploadAvailable;
            browse.disabled = !browseAvailable;
            url.disabled = !urlAvailable;
            summary.setAttribute(
                'aria-disabled',
                String(!uploadAvailable && !browseAvailable && !urlAvailable),
            );
        },
        destroy: () => {
            upload.removeEventListener('click', uploadClick);
            uploadInput.removeEventListener('change', uploadChange);
            browse.removeEventListener('click', browseClick);
            url.removeEventListener('click', urlClick);
        },
    };
};

function imageAction(
    document: Document,
    ui: EditorUi,
    icon: string,
    label: string,
): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'soeditor-ui__menu-item';
    button.setAttribute('role', 'menuitem');
    ui.setIcon(button, icon, label);
    const text = document.createElement('span');
    text.textContent = label;
    button.append(text);
    return button;
}

const tableButton: ToolbarItemFactory = ({ document, editor, ui }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'soeditor-ui__button';
    ui.setIcon(button, 'table.insert', 'Table');
    button.title = 'Insert table';
    button.setAttribute('aria-label', 'Insert table');
    button.setAttribute('aria-expanded', 'false');
    let handle: DismissibleUiHandle | undefined;
    const close = (): void => {
        handle?.close();
        handle = undefined;
        button.setAttribute('aria-expanded', 'false');
    };
    const open = (): void => {
        if (handle !== undefined) {
            close();
            return;
        }
        handle = ui.balloons.show({
            anchor: button,
            content: (container) => {
                container.classList.add('soeditor-ui__table-picker');
                container.setAttribute('aria-label', 'Choose table size');
                const status = document.createElement('span');
                status.className = 'soeditor-ui__table-picker-status';
                status.setAttribute('aria-live', 'polite');
                status.textContent = 'Choose table size';
                const grid = document.createElement('div');
                grid.className = 'soeditor-ui__table-picker-grid';
                grid.setAttribute('role', 'grid');
                for (let row = 1; row <= 10; row += 1) {
                    for (let column = 1; column <= 10; column += 1) {
                        const cell = document.createElement('button');
                        cell.type = 'button';
                        cell.className = 'soeditor-ui__table-picker-cell';
                        cell.dataset.row = String(row);
                        cell.dataset.column = String(column);
                        cell.setAttribute('role', 'gridcell');
                        cell.setAttribute(
                            'aria-label',
                            `Insert ${String(row)} by ${String(column)} table`,
                        );
                        const highlight = (): void => {
                            status.textContent = `${String(row)} × ${String(column)} table`;
                            for (const candidate of Array.from(grid.children)) {
                                candidate.classList.toggle(
                                    'is-selected',
                                    Number(
                                        candidate.getAttribute('data-row'),
                                    ) <= row &&
                                        Number(
                                            candidate.getAttribute(
                                                'data-column',
                                            ),
                                        ) <= column,
                                );
                            }
                        };
                        cell.addEventListener('pointerenter', highlight);
                        cell.addEventListener('focus', highlight);
                        cell.addEventListener('keydown', (event) => {
                            const movement =
                                event.key === 'ArrowUp'
                                    ? [-1, 0]
                                    : event.key === 'ArrowDown'
                                      ? [1, 0]
                                      : event.key === 'ArrowLeft'
                                        ? [0, -1]
                                        : event.key === 'ArrowRight'
                                          ? [0, 1]
                                          : undefined;
                            if (movement === undefined) {
                                if (event.key === 'Escape') {
                                    event.preventDefault();
                                    close();
                                    button.focus();
                                }
                                return;
                            }
                            event.preventDefault();
                            const nextRow = Math.max(
                                1,
                                Math.min(10, row + (movement[0] ?? 0)),
                            );
                            const nextColumn = Math.max(
                                1,
                                Math.min(10, column + (movement[1] ?? 0)),
                            );
                            grid.querySelector<HTMLButtonElement>(
                                `[data-row="${String(nextRow)}"][data-column="${String(nextColumn)}"]`,
                            )?.focus();
                        });
                        cell.addEventListener('click', () => {
                            if (
                                execute(editor, ui, 'table.insert', [
                                    { columns: column, rows: row },
                                ])
                            ) {
                                close();
                            }
                        });
                        grid.append(cell);
                    }
                }
                container.append(status, grid);
            },
        });
        button.setAttribute('aria-expanded', 'true');
        handle.element
            .querySelector<HTMLButtonElement>('.soeditor-ui__table-picker-cell')
            ?.focus();
    };
    button.addEventListener('click', open);
    return {
        element: button,
        update: () => {
            updateCommandButton(button, editor, 'table.insert');
            if (button.disabled) close();
        },
        destroy: () => {
            close();
            button.removeEventListener('click', open);
        },
    };
};

const tablePropertiesButton = dialogCommandButton(
    'Table properties',
    'table.properties',
    (document, run) => {
        let caption: HTMLInputElement;
        let width: HTMLInputElement;
        let alignment: HTMLInputElement;
        let responsiveClass: HTMLInputElement;
        let ariaLabel: HTMLInputElement;
        return {
            content: (container) => {
                caption = field(document, container, 'Caption', 'text');
                width = field(document, container, 'Width (px or %)', 'text');
                alignment = field(
                    document,
                    container,
                    'Alignment (left, center, right)',
                    'text',
                );
                responsiveClass = field(
                    document,
                    container,
                    'Responsive classes',
                    'text',
                );
                ariaLabel = field(
                    document,
                    container,
                    'Accessible label',
                    'text',
                );
            },
            run: () =>
                run({
                    caption: caption.value.length === 0 ? null : caption.value,
                    width: width.value.length === 0 ? null : width.value,
                    alignment:
                        alignment.value.length === 0 ? null : alignment.value,
                    responsiveClass:
                        responsiveClass.value.length === 0
                            ? null
                            : responsiveClass.value,
                    ariaLabel:
                        ariaLabel.value.length === 0 ? null : ariaLabel.value,
                }),
        };
    },
);

const tableRowPropertiesButton = dialogCommandButton(
    'Table row properties',
    'table.row.properties',
    (document, run) => {
        let section: HTMLInputElement;
        let className: HTMLInputElement;
        let height: HTMLInputElement;
        return {
            content: (container) => {
                section = field(
                    document,
                    container,
                    'Section (head, body, foot)',
                    'text',
                );
                className = field(document, container, 'Row classes', 'text');
                height = field(document, container, 'Height', 'number');
                height.min = '20';
                height.max = '2000';
            },
            run: () =>
                run({
                    ...(section.value.length === 0
                        ? {}
                        : { section: section.value }),
                    className:
                        className.value.length === 0 ? null : className.value,
                    height:
                        height.value.length === 0 ? null : Number(height.value),
                }),
        };
    },
);

const tableCellPropertiesButton = dialogCommandButton(
    'Table cell properties',
    'table.cell.properties',
    (document, run) => {
        let horizontal: HTMLInputElement;
        let vertical: HTMLInputElement;
        let scope: HTMLInputElement;
        let className: HTMLInputElement;
        return {
            content: (container) => {
                horizontal = field(
                    document,
                    container,
                    'Alignment (left, center, right)',
                    'text',
                );
                vertical = field(
                    document,
                    container,
                    'Vertical alignment',
                    'text',
                );
                scope = field(document, container, 'Header scope', 'text');
                className = field(document, container, 'Cell classes', 'text');
            },
            run: () =>
                run({
                    horizontalAlignment:
                        horizontal.value.length === 0 ? null : horizontal.value,
                    verticalAlignment:
                        vertical.value.length === 0 ? null : vertical.value,
                    scope: scope.value.length === 0 ? null : scope.value,
                    className:
                        className.value.length === 0 ? null : className.value,
                }),
        };
    },
);

const textColors = Object.freeze([
    ['Black', '#000000'],
    ['Dark gray', '#344054'],
    ['Gray', '#667085'],
    ['Red', '#dc2626'],
    ['Rose', '#e11d48'],
    ['Orange', '#ea580c'],
    ['Amber', '#d97706'],
    ['Yellow', '#ca8a04'],
    ['Lime', '#65a30d'],
    ['Green', '#16a34a'],
    ['Teal', '#0d9488'],
    ['Cyan', '#0891b2'],
    ['Blue', '#2563eb'],
    ['Indigo', '#4f46e5'],
    ['Purple', '#7c3aed'],
    ['White', '#ffffff'],
] as const);

const backgroundColors = Object.freeze([
    ['Light gray', '#f2f4f7'],
    ['Light slate', '#e2e8f0'],
    ['Light red', '#fee2e2'],
    ['Light rose', '#ffe4e6'],
    ['Light orange', '#ffedd5'],
    ['Light amber', '#fef3c7'],
    ['Light yellow', '#fef9c3'],
    ['Light lime', '#ecfccb'],
    ['Light green', '#dcfce7'],
    ['Light teal', '#ccfbf1'],
    ['Light cyan', '#cffafe'],
    ['Light blue', '#dbeafe'],
    ['Light indigo', '#e0e7ff'],
    ['Light purple', '#ede9fe'],
    ['Dark', '#1f2937'],
    ['White', '#ffffff'],
] as const);

const highlightColors = Object.freeze([
    ['Yellow marker', '#fef08a'],
    ['Green marker', '#bbf7d0'],
    ['Pink marker', '#fecaca'],
    ['Blue marker', '#bae6fd'],
    ['Orange marker', '#fed7aa'],
    ['Violet marker', '#ddd6fe'],
    ['Strong yellow marker', '#fde047'],
    ['Strong green marker', '#86efac'],
    ['Strong pink marker', '#fda4af'],
    ['Strong blue marker', '#7dd3fc'],
    ['Strong orange marker', '#fdba74'],
    ['Strong violet marker', '#c4b5fd'],
    ['Gray marker', '#d1d5db'],
    ['Cyan marker', '#a5f3fc'],
    ['Red marker', '#fca5a5'],
    ['Lime marker', '#bef264'],
] as const);

const fontFamilies = Object.freeze([
    ['Default', 'inherit'],
    ['Arial', 'arial'],
    ['Courier New', 'courier new'],
    ['Georgia', 'georgia'],
    ['Lucida Sans Unicode', 'lucida sans unicode'],
    ['Tahoma', 'tahoma'],
    ['Times New Roman', 'times new roman'],
    ['Trebuchet MS', 'trebuchet ms'],
    ['Verdana', 'verdana'],
] as const);

const fontSizes = Object.freeze([
    ['Default', 'medium'],
    ['9 px', '9px'],
    ['10 px', '10px'],
    ['11 px', '11px'],
    ['12 px', '12px'],
    ['14 px', '14px'],
    ['15 px', '15px'],
    ['18 px', '18px'],
    ['20 px', '20px'],
    ['24 px', '24px'],
    ['28 px', '28px'],
    ['32 px', '32px'],
    ['36 px', '36px'],
    ['48 px', '48px'],
    ['72 px', '72px'],
] as const);

const fontColorButton = colorMenu('Text color', 'font.color', 'A̲', textColors, {
    removeCommand: 'font.color.remove',
    removeLabel: 'Remove text color',
});
const fontBackgroundColorButton = colorMenu(
    'Background color',
    'font.backgroundColor',
    'A■',
    backgroundColors,
    {
        removeCommand: 'font.backgroundColor.remove',
        removeLabel: 'Remove background color',
    },
);
const highlightButton = colorMenu(
    'Highlight',
    'font.highlight',
    '▁̸',
    highlightColors,
    {
        removeCommand: 'font.highlight.remove',
        removeLabel: 'Remove highlight',
    },
);
const fontFamilyButton = choiceMenu(
    'Font family',
    'font.family',
    'Aƒ',
    fontFamilies,
);
const fontSizeButton = choiceMenu('Font size', 'font.size', 'A↕', fontSizes);

interface ColorMenuOptions {
    readonly removeCommand?: string;
    readonly removeLabel?: string;
}

const recentColorsStorageKey = 'soeditor.ui.recent-colors.v1';
const maximumRecentColors = 16;

function colorMenu(
    label: string,
    command: string,
    fallbackIcon: string,
    colors: readonly (readonly [string, string])[],
    options: ColorMenuOptions = {},
): ToolbarItemFactory {
    return ({ document, editor, ui }) => {
        const details = document.createElement('details');
        details.className = 'soeditor-ui__menu soeditor-ui__color-menu';
        const summary = document.createElement('summary');
        summary.className = 'soeditor-ui__button';
        ui.setIcon(summary, command, fallbackIcon);
        summary.title = label;
        summary.setAttribute('aria-label', label);
        const menu = document.createElement('div');
        menu.className = 'soeditor-ui__color-panel';
        menu.setAttribute('aria-label', label);
        const panelPointerDown = (event: PointerEvent): void => {
            const interactive = event
                .composedPath()
                .some(
                    (candidate) =>
                        candidate instanceof Element &&
                        candidate.matches(
                            'a[href],button,input,label,select,textarea',
                        ),
                );
            if (interactive) return;
            event.preventDefault();
            ui.restoreEditingSelection();
        };
        menu.addEventListener('pointerdown', panelPointerDown);
        const presetLabel = document.createElement('span');
        presetLabel.className = 'soeditor-ui__color-section-label';
        presetLabel.textContent = 'Preset colors';
        const presets = document.createElement('div');
        presets.className =
            'soeditor-ui__color-grid soeditor-ui__preset-colors';
        const recentSection = document.createElement('section');
        recentSection.className = 'soeditor-ui__recent-colors';
        const recentLabel = document.createElement('span');
        recentLabel.className = 'soeditor-ui__color-section-label';
        recentLabel.textContent = 'Recent colors';
        const recentPalette = document.createElement('div');
        recentPalette.className =
            'soeditor-ui__color-grid soeditor-ui__recent-color-grid';
        recentSection.append(recentLabel, recentPalette);
        const remove =
            options.removeLabel === undefined ||
            options.removeCommand === undefined
                ? undefined
                : document.createElement('button');
        const removeClick = (): void => {
            if (remove === undefined || options.removeCommand === undefined)
                return;
            execute(editor, ui, options.removeCommand, []);
            details.open = false;
        };
        if (remove !== undefined) {
            remove.type = 'button';
            remove.className =
                'soeditor-ui__menu-item soeditor-ui__color-remove';
            ui.setIcon(remove, `${command}.remove`, 'Remove');
            const removeText = document.createElement('span');
            removeText.textContent = options.removeLabel ?? '';
            remove.append(removeText);
            remove.addEventListener('click', removeClick);
            menu.append(remove);
        }
        const buttons = colors.map(([name, value]) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'soeditor-ui__color-choice';
            button.title = name;
            button.setAttribute('aria-label', name);
            button.dataset.value = value;
            button.style.setProperty('--soeditor-choice-color', value);
            const click = (): void => {
                stageColor(value);
            };
            button.addEventListener('click', click);
            presets.append(button);
            return { button, click };
        });
        const custom = document.createElement('div');
        custom.className = 'soeditor-ui__custom-color';
        const customLabel = document.createElement('label');
        customLabel.className = 'soeditor-ui__color-section-label';
        customLabel.textContent = 'Color value';
        const valueInput = document.createElement('input');
        valueInput.type = 'text';
        valueInput.className = 'soeditor-ui__color-value';
        valueInput.placeholder = '#2563eb or rgb(37, 99, 235)';
        valueInput.autocomplete = 'off';
        valueInput.spellcheck = false;
        valueInput.setAttribute('aria-label', 'Color value');
        customLabel.append(valueInput);
        const controls = document.createElement('div');
        controls.className = 'soeditor-ui__color-controls';
        const pickerLabel = document.createElement('label');
        pickerLabel.className = 'soeditor-ui__native-color';
        pickerLabel.title = 'Choose color';
        const picker = document.createElement('input');
        picker.type = 'color';
        picker.value = colors[0]?.[1] ?? '#000000';
        picker.setAttribute('aria-label', 'Choose color');
        pickerLabel.append(picker);
        const apply = document.createElement('button');
        apply.type = 'button';
        apply.className = 'soeditor-ui__menu-item soeditor-ui__color-apply';
        apply.textContent = 'Apply color';
        const feedback = document.createElement('span');
        feedback.className = 'soeditor-ui__color-feedback';
        feedback.setAttribute('role', 'status');
        feedback.setAttribute('aria-live', 'polite');
        const invalidColorMessage =
            'Invalid color. Use #2563eb, rgb(37, 99, 235), hsl(217, 91%, 60%), or a color name.';
        const submit = (): void => {
            const value = validatePendingColor();
            if (value === undefined) {
                valueInput.focus();
                return;
            }
            commitColor(value);
        };
        const valueInputEvent = (): void => {
            const value = normalizeColorInput(valueInput.value);
            if (value === undefined) {
                valueInput.setAttribute('aria-invalid', 'true');
                feedback.textContent = invalidColorMessage;
                return;
            }
            setColorPreview(value);
            valueInput.setAttribute('aria-invalid', 'false');
            feedback.textContent = '';
        };
        const pickerInput = (): void => {
            stageColor(picker.value);
        };
        apply.addEventListener('click', submit);
        valueInput.addEventListener('input', valueInputEvent);
        picker.addEventListener('input', pickerInput);
        picker.addEventListener('change', pickerInput);
        controls.append(pickerLabel, apply);
        custom.append(customLabel, controls, feedback);
        menu.append(presetLabel, presets, recentSection, custom);
        details.append(summary, menu);

        let recentButtons: Array<{
            readonly button: HTMLButtonElement;
            readonly click: () => void;
        }> = [];
        function renderRecentColors(): void {
            for (const { button, click } of recentButtons) {
                button.removeEventListener('click', click);
            }
            recentButtons = [];
            recentPalette.replaceChildren();
            const recent = readRecentColors(document);
            recentSection.hidden = recent.length === 0;
            for (const value of recent) {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'soeditor-ui__color-choice';
                button.title = value;
                button.setAttribute('aria-label', `Recent color ${value}`);
                button.dataset.recentColor = value;
                button.style.setProperty('--soeditor-choice-color', value);
                const click = (): void => stageColor(value);
                button.addEventListener('click', click);
                recentButtons.push({ button, click });
                recentPalette.append(button);
            }
        }
        function stageColor(value: string): void {
            const normalized = normalizeColorInput(value);
            if (normalized === undefined) return;
            valueInput.value = normalized;
            valueInput.setAttribute('aria-invalid', 'false');
            feedback.textContent = '';
            setColorPreview(normalized);
        }
        function setColorPreview(value: string): void {
            pickerLabel.style.setProperty('--soeditor-current-color', value);
            const pickerValue = nativePickerColor(value);
            if (pickerValue !== undefined) picker.value = pickerValue;
        }
        function validatePendingColor(): string | undefined {
            const value = normalizeColorInput(valueInput.value);
            const valid = value !== undefined;
            valueInput.setAttribute('aria-invalid', String(!valid));
            feedback.textContent = valid ? '' : invalidColorMessage;
            return value;
        }
        function commitColor(value: string): void {
            if (!execute(editor, ui, command, [value])) return;
            rememberRecentColor(document, value);
            renderRecentColors();
            details.open = false;
        }
        const toggle = (): void => {
            if (details.open) renderRecentColors();
        };
        details.addEventListener('toggle', toggle);
        renderRecentColors();
        stageColor(colors[0]?.[1] ?? '#000000');
        return {
            element: details,
            update: () => {
                const available = canExecute(editor, command);
                summary.setAttribute('aria-disabled', String(!available));
                for (const { button } of buttons) button.disabled = !available;
                if (remove !== undefined) {
                    remove.disabled = !canExecute(
                        editor,
                        options.removeCommand ?? '',
                    );
                }
                valueInput.disabled = !available;
                picker.disabled = !available;
                apply.disabled = !available;
                for (const { button } of recentButtons) {
                    button.disabled = !available;
                }
            },
            destroy: () => {
                for (const { button, click } of buttons) {
                    button.removeEventListener('click', click);
                }
                for (const { button, click } of recentButtons) {
                    button.removeEventListener('click', click);
                }
                remove?.removeEventListener('click', removeClick);
                apply.removeEventListener('click', submit);
                valueInput.removeEventListener('input', valueInputEvent);
                picker.removeEventListener('input', pickerInput);
                picker.removeEventListener('change', pickerInput);
                menu.removeEventListener('pointerdown', panelPointerDown);
                details.removeEventListener('toggle', toggle);
            },
        };
    };
}

function nativePickerColor(value: string): string | undefined {
    const short = /^#([\da-f])([\da-f])([\da-f])$/u.exec(value);
    if (short !== null) {
        return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
    }
    return /^#[\da-f]{6}$/u.test(value) ? value : undefined;
}

function normalizeColorInput(value: string): string | undefined {
    const normalized = value.trim().toLowerCase();
    if (
        normalized.length === 0 ||
        normalized.length > 80 ||
        !(
            /^#[\da-f]{3,8}$/u.test(normalized) ||
            /^(?:rgb|hsl)a?\([\d.% ,+-]+\)$/u.test(normalized) ||
            /^[a-z]+$/u.test(normalized)
        )
    ) {
        return undefined;
    }
    return normalized;
}

function readRecentColors(document: Document): readonly string[] {
    try {
        const raw = document.defaultView?.localStorage.getItem(
            recentColorsStorageKey,
        );
        if (raw === null || raw === undefined) return [];
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map((value) =>
                typeof value === 'string'
                    ? normalizeColorInput(value)
                    : undefined,
            )
            .filter((value): value is string => value !== undefined)
            .slice(0, maximumRecentColors);
    } catch {
        return [];
    }
}

function rememberRecentColor(document: Document, value: string): void {
    const normalized = normalizeColorInput(value);
    if (normalized === undefined) return;
    const recent = [
        normalized,
        ...readRecentColors(document).filter(
            (candidate) => candidate !== normalized,
        ),
    ].slice(0, maximumRecentColors);
    try {
        document.defaultView?.localStorage.setItem(
            recentColorsStorageKey,
            JSON.stringify(recent),
        );
    } catch {
        // Storage can be unavailable in private or sandboxed contexts. The
        // color command remains usable without persistence.
    }
}

function choiceMenu(
    label: string,
    command: string,
    fallbackIcon: string,
    choices: readonly (readonly [string, string])[],
): ToolbarItemFactory {
    return ({ document, editor, ui }) => {
        const details = document.createElement('details');
        details.className = 'soeditor-ui__menu soeditor-ui__choice-menu';
        const summary = document.createElement('summary');
        summary.className = 'soeditor-ui__button';
        ui.setIcon(summary, command, fallbackIcon);
        summary.title = label;
        summary.setAttribute('aria-label', label);
        const menu = document.createElement('div');
        menu.className = 'soeditor-ui__menu-items soeditor-ui__size-choices';
        menu.dataset.command = command;
        const buttons = choices.map(([name, value]) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'soeditor-ui__menu-item';
            button.textContent = name;
            button.dataset.value = value;
            if (command === 'font.family') {
                button.style.fontFamily = value;
            }
            const click = (): void => {
                execute(editor, ui, command, [value]);
                details.open = false;
            };
            button.addEventListener('click', click);
            menu.append(button);
            return { button, click };
        });
        details.append(summary, menu);
        return {
            element: details,
            update: () => {
                const available = canExecute(editor, command);
                summary.setAttribute('aria-disabled', String(!available));
                for (const { button } of buttons) button.disabled = !available;
            },
            destroy: () => {
                for (const { button, click } of buttons) {
                    button.removeEventListener('click', click);
                }
            },
        };
    };
}

export const defaultToolbarItems: ReadonlyMap<string, ToolbarItemFactory> =
    new Map([
        ['undo', commandButton('Undo', 'editor.undo')],
        ['redo', commandButton('Redo', 'editor.redo')],
        ['heading', headingMenu],
        ['bold', commandButton('Bold', 'format.bold', undefined, 'B')],
        ['italic', commandButton('Italic', 'format.italic', undefined, 'I')],
        ['underline', commandButton('Underline', 'format.underline', [], 'U')],
        ['strike', commandButton('Strike', 'format.strike', [], 'S')],
        ['fontFamily', fontFamilyButton],
        ['fontSize', fontSizeButton],
        ['fontColor', fontColorButton],
        ['fontBackgroundColor', fontBackgroundColorButton],
        ['highlight', highlightButton],
        ['subscript', commandButton('Subscript', 'format.subscript', [], 'X₂')],
        [
            'superscript',
            commandButton('Superscript', 'format.superscript', [], 'X²'),
        ],
        [
            'removeFormat',
            commandButton('Remove format', 'format.remove', [], 'Tₓ'),
        ],
        ['blockquote', commandButton('Block quote', 'blockquote.toggle')],
        ['orderedList', commandButton('Ordered list', 'list.ordered')],
        ['unorderedList', commandButton('Unordered list', 'list.unordered')],
        ['outdent', commandButton('Outdent', 'format.outdent')],
        ['indent', commandButton('Indent', 'format.indent')],
        [
            'alignLeft',
            commandButton(
                'Align left',
                'format.alignment',
                ['left'],
                '≡←',
                'format.alignment.left',
            ),
        ],
        [
            'alignCenter',
            commandButton(
                'Align center',
                'format.alignment',
                ['center'],
                '≡↔',
                'format.alignment.center',
            ),
        ],
        [
            'alignRight',
            commandButton(
                'Align right',
                'format.alignment',
                ['right'],
                '→≡',
                'format.alignment.right',
            ),
        ],
        [
            'alignJustify',
            commandButton(
                'Justify',
                'format.alignment',
                ['justify'],
                '≣',
                'format.alignment.justify',
            ),
        ],
        [
            'horizontalRule',
            commandButton('Horizontal rule', 'horizontalRule.insert'),
        ],
        ['link', linkButton],
        ['unlink', commandButton('Remove link', 'link.remove', [], '⌁̸')],
        [
            'link-internal',
            commandButton('Choose internal link', 'link.pick', ['internal']),
        ],
        ['link-file', commandButton('Choose file link', 'link.pick', ['file'])],
        ['specialCharacter', specialCharacterButton],
        ['anchor', anchorButton],
        ['pageBreak', commandButton('Page break', 'pageBreak.insert')],
        ['placeholder', placeholderButton],
        ['image', imageButton],
        ['image-actions', imageActionsMenu],
        ['table', tableButton],
        ['tableProperties', tablePropertiesButton],
        ['tableRowProperties', tableRowPropertiesButton],
        ['tableCellProperties', tableCellPropertiesButton],
        ['source', sourceButton],
        [
            'sourceFind',
            commandButton('Find/Replace', 'editor.source.find', [], 'Find'),
        ],
        [
            'format',
            sourceOnlyCommandButton('Format source HTML', 'document.format'),
        ],
        [
            'minify',
            sourceOnlyCommandButton('Minify source HTML', 'document.minify'),
        ],
        ['cleanHtml', commandButton('Clean HTML', 'html.cleanup')],
    ]);

function textDialogButton(
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

function dialogCommandButton(
    label: string,
    command: string,
    create: (
        document: Document,
        run: (...args: readonly unknown[]) => void,
        editor: Editor,
    ) => {
        readonly content: (container: HTMLElement) => void;
        readonly run: () => void;
    },
    fallbackIcon = label,
): ToolbarItemFactory {
    return ({ document, editor, ui }) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'soeditor-ui__button';
        ui.setIcon(button, command, fallbackIcon);
        button.title = label;
        button.setAttribute('aria-label', label);
        const click = (): void => {
            const fields = create(
                document,
                (...args) => {
                    if (execute(editor, ui, command, args)) {
                        handle.close();
                    }
                },
                editor,
            );
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
            update: () => updateCommandAvailability(button, editor, command),
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
    const errors: unknown[] = [];
    for (const item of [...items].reverse()) {
        try {
            item.destroy?.();
        } catch (error: unknown) {
            errors.push(error);
        }
    }
    if (errors.length > 0) {
        throw new AggregateError(errors, 'Toolbar item cleanup failed.');
    }
}
