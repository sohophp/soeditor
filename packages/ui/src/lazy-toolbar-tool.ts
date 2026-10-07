import { mountToolbarTool } from './toolbar-root.js';
import { showFormatState } from './format-state.js';
import {
    canExecute,
    readSpecialCharacters,
    reportError,
} from './toolbar-tool-shared.js';
import type { lazyToolbarTools } from './toolbar-lazy-tools.js';
import type {
    EditorUiFormatProperty,
    ToolbarItemFactory,
    ToolbarItemInstance,
} from './types.js';

export interface LazyToolOptions {
    readonly label: string;
    readonly command: string;
    readonly ariaLabel: string;
    readonly menuClass: string;
}

/** Keep first-use menus and dialogs outside the ordinary ESM startup path. */
export function lazyToolbarTool(
    name: keyof typeof lazyToolbarTools,
    options: LazyToolOptions,
): ToolbarItemFactory {
    return (context) => {
        const { document, editor, ui } = context;
        const menu = options.menuClass !== '';
        const root = document.createElement(menu ? 'details' : 'button');
        if (root instanceof HTMLButtonElement) root.type = 'button';
        root.className = menu ? options.menuClass : 'soeditor-ui__button';
        const control = menu ? document.createElement('summary') : root;
        control.className = 'soeditor-ui__button';
        ui.setIcon(
            control,
            name === 'imageActionsMenu' ? 'image.actions' : options.command,
            options.label,
        );
        control.title = options.label;
        control.setAttribute('aria-label', options.ariaLabel);
        if (menu) root.append(control);
        if (name === 'specialCharacterButton')
            root.hidden =
                readSpecialCharacters(
                    editor.config.get<unknown>('cms.specialCharacters'),
                ) === false;
        let instance: ToolbarItemInstance | undefined;
        let pending = false;
        let destroyed = false;
        const update = (): void => {
            if (instance !== undefined) {
                instance.update?.();
                return;
            }
            const available = canExecute(editor, options.command);
            if (control instanceof HTMLButtonElement)
                control.disabled = !available;
            else control.setAttribute('aria-disabled', String(!available));
            if (name.endsWith('ColorButton') || name === 'highlightButton') {
                const state = ui.getEditingFormatState?.(
                    options.command as EditorUiFormatProperty,
                );
                showFormatState(control, options.label, state, ui, available);
                if (state?.status === 'uniform')
                    control.style.setProperty(
                        '--soeditor-selected-color',
                        state.value,
                    );
                else control.style.removeProperty('--soeditor-selected-color');
            }
        };
        const activate = async (event: Event): Promise<void> => {
            event.preventDefault();
            if (pending || destroyed || !canExecute(editor, options.command))
                return;
            const snapshot = editor.state.document;
            const mode = editor.state.mode;
            pending = true;
            control.setAttribute('aria-busy', 'true');
            try {
                const factory = await loadToolbarTool(name);
                if (
                    destroyed ||
                    ui.destroyed ||
                    !root.isConnected ||
                    editor.state.readonly ||
                    editor.state.document !== snapshot ||
                    editor.state.mode !== mode
                )
                    return;
                const menuArrow = control.querySelector(
                    '.soeditor-ui__format-arrow',
                );
                control.removeEventListener('click', activate);
                control.removeEventListener('keydown', keyboard);
                instance = mountToolbarTool(context, root, factory);
                instance.update?.();
                if (instance.element instanceof HTMLDetailsElement) {
                    instance.element.open = true;
                    const summary = instance.element.querySelector('summary');
                    if (menuArrow !== null) summary?.append(menuArrow);
                    if (event instanceof KeyboardEvent) summary?.focus();
                    instance.element.dispatchEvent(new Event('toggle'));
                    if (event instanceof KeyboardEvent)
                        summary?.dispatchEvent(
                            new KeyboardEvent('keydown', {
                                key: event.key,
                                bubbles: true,
                            }),
                        );
                } else {
                    instance.element.click();
                }
            } catch (error) {
                if (!destroyed && !ui.destroyed) reportError(ui, error);
            } finally {
                pending = false;
                control.removeAttribute('aria-busy');
            }
        };
        const keyboard = (event: KeyboardEvent): void => {
            if (!menu || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp'))
                return;
            event.stopImmediatePropagation();
            void activate(event);
        };
        const opened = (): void => {
            if (
                instance === undefined &&
                root instanceof HTMLDetailsElement &&
                root.open
            )
                void activate(
                    new KeyboardEvent('keydown', { key: 'ArrowDown' }),
                );
        };
        if (menu) root.addEventListener('toggle', opened);
        control.addEventListener('keydown', keyboard);
        control.addEventListener('click', activate);
        return {
            element: root,
            update,
            destroy: () => {
                destroyed = true;
                control.removeEventListener('click', activate);
                control.removeEventListener('keydown', keyboard);
                root.removeEventListener('toggle', opened);
                instance?.destroy?.();
            },
        };
    };
}

async function loadToolbarTool(
    name: keyof typeof lazyToolbarTools,
): Promise<ToolbarItemFactory> {
    switch (name) {
        case 'linkButton':
            return (await import('./toolbar-link-tools.js')).linkButton;
        case 'specialCharacterButton':
            return (await import('./toolbar-character-tools.js'))
                .specialCharacterButton;
        case 'imageActionsMenu':
            return (await import('./toolbar-image-tools.js')).imageActionsMenu;
        case 'tableButton':
            return (await import('./toolbar-table-tools.js')).tableButton;
        case 'tablePropertiesButton':
            return (await import('./toolbar-table-tools.js'))
                .tablePropertiesButton;
        case 'tableRowPropertiesButton':
            return (await import('./toolbar-table-tools.js'))
                .tableRowPropertiesButton;
        case 'tableCellPropertiesButton':
            return (await import('./toolbar-table-tools.js'))
                .tableCellPropertiesButton;
        case 'fontColorButton':
            return (await import('./toolbar-color-tools.js')).fontColorButton;
        case 'fontBackgroundColorButton':
            return (await import('./toolbar-color-tools.js'))
                .fontBackgroundColorButton;
        case 'highlightButton':
            return (await import('./toolbar-color-tools.js')).highlightButton;
    }
}
