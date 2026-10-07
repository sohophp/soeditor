import {
    textDialogButton,
    dialogCommandButton,
    field,
    updateCommandButton,
    updateCommandAvailability,
    canExecute,
    execute,
} from './toolbar-tool-shared.js';
import { lazyToolbarTool } from './lazy-toolbar-tool.js';
import { mountToolbarDrawer, destroyToolbarItems } from './toolbar-mount.js';
import { showFormatState } from './format-state.js';
import { blockFormatMenu } from './block-format-menu.js';
import { SOURCE_TOOLBAR } from './source-toolbar.js';

import type {
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
        let pending = false;
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
        const before = editor.events.on(
            'command:beforeExecute',
            ({ commandId }) => {
                if (commandId !== command) return;
                pending = true;
                button.disabled = true;
                button.setAttribute('aria-busy', 'true');
            },
        );
        const settle = editor.events.on(
            'command:afterExecute',
            ({ commandId }) => {
                if (commandId !== command) return;
                pending = false;
                button.removeAttribute('aria-busy');
                updateCommandButton(button, editor, command);
            },
        );
        const fail = editor.events.on('command:error', ({ commandId }) => {
            if (commandId !== command) return;
            pending = false;
            button.removeAttribute('aria-busy');
            updateCommandButton(button, editor, command);
        });
        return {
            element: button,
            update: () => {
                button.hidden = editor.state.mode !== 'source';
                if (!pending) updateCommandButton(button, editor, command);
            },
            destroy: () => {
                before();
                settle();
                fail();
                button.removeEventListener('click', click);
            },
        };
    };
}

const sourceButton: ToolbarItemFactory = ({ document, editor, ui }) => {
    let sourceTransformPending = 0;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'soeditor-ui__button';
    const command = (): 'editor.source' | 'editor.visual' =>
        editor.state.mode === 'source' ? 'editor.visual' : 'editor.source';
    const click = async (): Promise<void> => {
        execute(editor, ui, command(), []);
    };
    button.addEventListener('click', click);
    const isSourceTransform = (commandId: string): boolean =>
        commandId === 'document.format' || commandId === 'document.minify';
    const before = editor.events.on(
        'command:beforeExecute',
        ({ commandId }) => {
            if (!isSourceTransform(commandId)) return;
            sourceTransformPending += 1;
            button.disabled = true;
            button.setAttribute('aria-busy', 'true');
        },
    );
    const finishSourceTransform = (commandId: string): void => {
        if (!isSourceTransform(commandId)) return;
        sourceTransformPending = Math.max(0, sourceTransformPending - 1);
        if (sourceTransformPending > 0) return;
        button.removeAttribute('aria-busy');
        updateCommandAvailability(button, editor, command());
    };
    const after = editor.events.on('command:afterExecute', ({ commandId }) =>
        finishSourceTransform(commandId),
    );
    const fail = editor.events.on('command:error', ({ commandId }) =>
        finishSourceTransform(commandId),
    );
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
            if (sourceTransformPending === 0) {
                updateCommandAvailability(button, editor, command());
            }
        },
        destroy: () => {
            before();
            after();
            fail();
            button.removeEventListener('click', click);
        },
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
            const target = previewMode ? 'edit' : 'preview';
            if (button.dataset.previewTarget !== target) {
                ui.setIcon(
                    button,
                    previewMode ? 'editor.preview.close' : 'editor.preview',
                    previewMode ? 'Edit' : 'Preview',
                );
                button.dataset.previewTarget = target;
            }
            button.title = previewMode ? 'Close preview' : 'Preview content';
            button.setAttribute('aria-label', button.title);
            button.setAttribute('aria-pressed', String(previewMode));
            updateCommandAvailability(button, editor, command());
        },
        destroy: () => button.removeEventListener('click', click),
    };
};

const moreFormattingMenu: ToolbarItemFactory = (context) => {
    const instances: ToolbarItemInstance[] = [];
    const factories = new Map(defaultToolbarItems);
    factories.set(
        'strike',
        commandButton('Strikethrough', 'format.strike', [], 'S'),
    );
    const element = mountToolbarDrawer(
        {
            id: 'moreFormatting',
            label: 'More text styles',
            items: ['strike', 'subscript', 'superscript', 'removeFormat'],
        },
        context.document.createElement('div'),
        factories,
        context,
        instances,
    );
    return {
        element,
        update: () => {
            for (const instance of instances) instance.update?.();
        },
        destroy: () => destroyToolbarItems(instances),
    };
};

const headingMenu: ToolbarItemFactory = ({ document, editor, ui }) => {
    const details = document.createElement('details');
    details.className = 'soeditor-ui__menu';
    const summary = document.createElement('summary');
    summary.className = 'soeditor-ui__button';
    summary.classList.add('soeditor-ui__value-control');
    const currentValue = document.createElement('span');
    currentValue.className = 'soeditor-ui__current-value';
    summary.append(currentValue);
    summary.setAttribute('aria-label', 'Choose block style');
    const menu = document.createElement('div');
    menu.className = 'soeditor-ui__menu-items soeditor-ui__heading-choices';
    const entries: readonly (readonly [
        label: string,
        command: string,
        args: readonly unknown[],
    ])[] = [
        ['Paragraph', 'paragraph.set', []],
        ...Array.from(
            { length: 6 },
            (_, index) =>
                [
                    `Heading ${index + 1}`,
                    'paragraph.heading',
                    [index + 1],
                ] as const,
        ),
        ['DIV', 'block.div', []],
        ['Preformatted', 'codeBlock.toggle', []],
        ['Code', 'format.inlineCode', []],
    ];
    const buttons = entries.map(([label, command, args]) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'soeditor-ui__menu-item soeditor-ui__heading-choice';
        if (command === 'paragraph.set') button.dataset.block = 'p';
        else if (command === 'paragraph.heading')
            button.dataset.block = `h${args[0]}`;
        const sample = document.createElement('span');
        sample.textContent = label;
        button.append(sample);
        const click = (): void => {
            details.open = false;
            execute(editor, ui, command, args);
        };
        button.addEventListener('click', click);
        menu.append(button);
        return { button, click, command };
    });
    details.append(summary, menu);
    return {
        element: details,
        update: () => {
            const available = buttons.some(({ command }) =>
                canExecute(editor, command),
            );
            summary.setAttribute('aria-disabled', String(!available));
            const state = ui.getEditingFormatState?.('heading');
            showFormatState(summary, 'Heading', state, ui, available);
            const block = state?.status === 'uniform' ? state.value : '';
            const currentLabel = ui.translate(
                state?.status === 'mixed'
                    ? 'Mixed'
                    : state?.status !== 'uniform'
                      ? 'Heading'
                      : /^h[1-6]$/u.test(block)
                        ? `Heading ${block.slice(1)}`
                        : block === 'div'
                          ? 'DIV'
                          : block === 'pre'
                            ? 'Preformatted'
                            : 'Paragraph',
            );
            // Preserve the text hit target between pointerdown and click (WebKit).
            if (currentValue.textContent !== currentLabel)
                currentValue.textContent = currentLabel;
            for (const { button, command } of buttons) {
                updateCommandButton(button, editor, command);
                if (
                    state?.status !== 'unavailable' &&
                    state !== undefined &&
                    button.dataset.block
                ) {
                    const active =
                        available &&
                        state.status === 'uniform' &&
                        state.value === button.dataset.block;
                    button.classList.toggle('is-active', active);
                    button.setAttribute('aria-pressed', String(active));
                }
            }
        },
        destroy: () => {
            for (const { button, click } of buttons) {
                button.removeEventListener('click', click);
            }
        },
    };
};

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

const mediaButton = dialogCommandButton(
    'Media',
    'media.insert',
    (document, run) => {
        let src: HTMLInputElement;
        let alt: HTMLInputElement;
        let caption: HTMLInputElement;
        let width: HTMLInputElement;
        let height: HTMLInputElement;
        return {
            content: (container) => {
                src = field(document, container, 'Media URL', 'url', true);
                alt = field(document, container, 'Alternative text', 'text');
                caption = field(document, container, 'Caption', 'text');
                width = field(document, container, 'Width', 'number');
                height = field(document, container, 'Height', 'number');
                width.max = '10000';
                height.max = '10000';
            },
            run: () =>
                run({
                    src: src.value,
                    alt: alt.value,
                    ...(caption.value.length === 0
                        ? {}
                        : { caption: caption.value }),
                    ...(width.value.length === 0
                        ? {}
                        : { width: Number(width.value) }),
                    ...(height.value.length === 0
                        ? {}
                        : { height: Number(height.value) }),
                }),
        };
    },
);

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

const fontFamilyButton = choiceMenu(
    'Font family',
    'font.family',
    'Aƒ',
    fontFamilies,
);
const fontSizeButton = choiceMenu('Font size', 'font.size', 'A↕', fontSizes);

function choiceMenu(
    label: string,
    command: 'font.size' | 'font.family',
    fallbackIcon: string,
    choices: readonly (readonly [string, string])[],
): ToolbarItemFactory {
    return ({ document, editor, ui }) => {
        const details = document.createElement('details');
        details.className = 'soeditor-ui__menu soeditor-ui__choice-menu';
        const summary = document.createElement('summary');
        summary.className = 'soeditor-ui__button';
        const currentValue = document.createElement('span');
        currentValue.className = 'soeditor-ui__current-value';
        if (command === 'font.size') {
            summary.classList.add('soeditor-ui__value-control');
            summary.append(currentValue);
        } else {
            ui.setIcon(summary, command, fallbackIcon);
        }
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
                const state = ui.getEditingFormatState?.(command);
                showFormatState(summary, label, state, ui, available);
                const currentLabel =
                    state?.status === 'uniform'
                        ? state.value
                        : ui.translate(
                              state?.status === 'mixed' ? 'Mixed' : label,
                          );
                if (currentValue.textContent !== currentLabel)
                    currentValue.textContent = currentLabel;
                for (const { button } of buttons) {
                    button.disabled = !available;
                    const selected =
                        available &&
                        state?.status === 'uniform' &&
                        state.value.toLowerCase().replaceAll('"', '') ===
                            button.dataset.value
                                ?.toLowerCase()
                                .replaceAll('"', '');
                    button.setAttribute('aria-pressed', String(selected));
                    button.classList.toggle('is-active', selected);
                }
            },
            destroy: () => {
                for (const { button, click } of buttons) {
                    button.removeEventListener('click', click);
                }
            },
        };
    };
}

const linkButton = lazyToolbarTool('linkButton', {
    label: 'Link',
    command: 'link.set',
    ariaLabel: 'Link',
    menuClass: '',
});
const specialCharacterButton = lazyToolbarTool('specialCharacterButton', {
    label: 'Special character',
    command: 'specialCharacter.insert',
    ariaLabel: 'Choose special character',
    menuClass: 'soeditor-ui__menu',
});
const imageActionsMenu = lazyToolbarTool('imageActionsMenu', {
    label: 'Insert image',
    command: 'image.insert',
    ariaLabel: 'Choose image insertion method',
    menuClass: 'soeditor-ui__menu soeditor-ui__image-menu',
});
const tableButton = lazyToolbarTool('tableButton', {
    label: 'Insert table',
    command: 'table.insert',
    ariaLabel: 'Insert table',
    menuClass: '',
});
const tablePropertiesButton = lazyToolbarTool('tablePropertiesButton', {
    label: 'Table properties',
    command: 'table.properties',
    ariaLabel: 'Table properties',
    menuClass: '',
});
const tableRowPropertiesButton = lazyToolbarTool('tableRowPropertiesButton', {
    label: 'Table row properties',
    command: 'table.row.properties',
    ariaLabel: 'Table row properties',
    menuClass: '',
});
const tableCellPropertiesButton = lazyToolbarTool('tableCellPropertiesButton', {
    label: 'Table cell properties',
    command: 'table.cell.properties',
    ariaLabel: 'Table cell properties',
    menuClass: '',
});
const fontColorButton = lazyToolbarTool('fontColorButton', {
    label: 'Text color',
    command: 'font.color',
    ariaLabel: 'Text color',
    menuClass: 'soeditor-ui__menu soeditor-ui__color-menu',
});
const fontBackgroundColorButton = lazyToolbarTool('fontBackgroundColorButton', {
    label: 'Background color',
    command: 'font.backgroundColor',
    ariaLabel: 'Background color',
    menuClass: 'soeditor-ui__menu soeditor-ui__color-menu',
});
const highlightButton = lazyToolbarTool('highlightButton', {
    label: 'Highlight',
    command: 'font.highlight',
    ariaLabel: 'Highlight',
    menuClass: 'soeditor-ui__menu soeditor-ui__color-menu',
});

export const defaultToolbarItems: ReadonlyMap<string, ToolbarItemFactory> =
    new Map([
        ['undo', commandButton('Undo', 'editor.undo')],
        ['redo', commandButton('Redo', 'editor.redo')],
        [
            'reset',
            commandButton('Reset edits', 'editor.reset', [], 'Reset edits'),
        ],
        ['heading', headingMenu],
        ['moreFormatting', moreFormattingMenu],
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
        ['div', commandButton('DIV block', 'block.div', [], 'DIV')],
        ['alignment', blockFormatMenu('alignment')],
        ['orderedList', blockFormatMenu('ordered')],
        ['unorderedList', blockFormatMenu('unordered')],
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
        ...(SOURCE_TOOLBAR
            ? ([
                  ['source', sourceButton],
                  [
                      'sourceFind',
                      commandButton(
                          'Find/Replace',
                          'editor.source.find',
                          [],
                          'Find',
                      ),
                  ],
                  [
                      'format',
                      sourceOnlyCommandButton(
                          'Format source HTML',
                          'document.format',
                      ),
                  ],
                  [
                      'minify',
                      sourceOnlyCommandButton(
                          'Minify source HTML',
                          'document.minify',
                      ),
                  ],
              ] satisfies readonly (readonly [string, ToolbarItemFactory])[])
            : []),
        ['cleanHtml', commandButton('Clean HTML', 'html.cleanup')],
    ]);

/** Toolbar contributions retained behind the explicit compatibility entry. */
export const compatibilityToolbarItems: ReadonlyMap<
    string,
    ToolbarItemFactory
> = new Map([
    ['markdown', commandButton('Markdown', 'editor.markdown')],
    ['media', mediaButton],
    ['preview', previewButton],
]);

function shortcut(
    id: string,
    chord: string,
    command: string,
): KeyboardShortcutDefinition {
    return Object.freeze({ id: `default.${id}`, chord, command });
}

export { destroyToolbarItems } from './toolbar-mount.js';
