import { showFormatState } from './format-state.js';
import type { ToolbarItemFactory } from './types.js';

const alignments = [
    ['left', 'Align left'],
    ['center', 'Align center'],
    ['right', 'Align right'],
    ['justify', 'Justify'],
] as const;
const ordered = [
    ['decimal', 'Decimal', '1.', '2.', '3.'],
    ['decimal-leading-zero', 'Decimal with leading zero', '01.', '02.', '03.'],
    ['lower-roman', 'Lowercase Roman', 'i.', 'ii.', 'iii.'],
    ['upper-roman', 'Uppercase Roman', 'I.', 'II.', 'III.'],
    ['lower-alpha', 'Lowercase letters', 'a.', 'b.', 'c.'],
    ['upper-alpha', 'Uppercase letters', 'A.', 'B.', 'C.'],
] as const;
const bullets = [
    ['disc', 'Filled circle', '•', '•', '•'],
    ['circle', 'Hollow circle', '◦', '◦', '◦'],
    ['square', 'Square', '▪', '▪', '▪'],
] as const;

/** Compact CMS controls backed entirely by commands. */
export function blockFormatMenu(
    kind: 'alignment' | 'ordered' | 'unordered',
): ToolbarItemFactory {
    return ({ document, editor, ui }) => {
        const alignment = kind === 'alignment';
        const command = alignment ? 'format.alignment' : `list.${kind}`;
        const label = alignment
            ? 'Alignment'
            : kind === 'ordered'
              ? 'Ordered list'
              : 'Unordered list';
        const wrapper = document.createElement('span');
        wrapper.className = 'soeditor-ui__format-control';
        const details = document.createElement('details');
        details.className = 'soeditor-ui__menu';
        const summary = document.createElement('summary');
        summary.className = 'soeditor-ui__button';
        summary.title = ui.translate(alignment ? label : `${label} styles`);
        summary.setAttribute('aria-label', summary.title);
        summary.setAttribute('aria-haspopup', 'menu');
        const main = document.createElement('button');
        main.type = 'button';
        main.className = 'soeditor-ui__button';
        main.title = ui.translate(label);
        main.setAttribute('aria-label', main.title);
        ui.setIcon(main, command, label);
        if (alignment) ui.setIcon(summary, 'format.alignment.left', label);
        const arrow = document.createElement('span');
        arrow.className = 'soeditor-ui__format-arrow';
        arrow.textContent = '⌄';
        arrow.setAttribute('aria-hidden', 'true');
        summary.append(arrow);
        const menu = document.createElement('div');
        menu.className = `soeditor-ui__menu-items soeditor-ui__format-choices${alignment ? ' soeditor-ui__alignment-choices' : ''}`;
        menu.setAttribute('role', 'menu');
        menu.setAttribute('aria-label', ui.translate(label));
        const run = (id: string): void => {
            ui.restoreEditingSelection();
            try {
                editor.execute(id);
                details.open = false;
            } catch (error: unknown) {
                ui.notifications.show({
                    severity: 'error',
                    message:
                        error instanceof Error ? error.message : String(error),
                });
            }
        };
        const options = alignment
            ? alignments
            : kind === 'ordered'
              ? ordered
              : bullets;
        const buttons = options.map(([value, title, ...markers]) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'soeditor-ui__button soeditor-ui__format-choice';
            button.title = ui.translate(title);
            button.setAttribute('aria-label', button.title);
            button.setAttribute('role', 'menuitemradio');
            const id = `${command}.${value}`;
            button.dataset.formatCommand = id;
            if (alignment) ui.setIcon(button, id, title);
            else {
                const preview = document.createElement('span');
                preview.className = 'soeditor-ui__list-preview';
                preview.setAttribute('aria-hidden', 'true');
                for (const marker of markers) {
                    const row = document.createElement('span');
                    const number = document.createElement('span');
                    if (kind === 'unordered') number.dataset.marker = value;
                    else number.textContent = marker;
                    row.append(number, document.createElement('i'));
                    preview.append(row);
                }
                button.append(preview);
            }
            button.addEventListener('click', () => run(id));
            menu.append(button);
            return button;
        });
        const available = (id: string): boolean =>
            editor.commands.has(id) && editor.commands.canExecute(id);
        const active = (id: string): boolean =>
            editor.commands.has(id) && editor.commands.isActive(id);
        main.addEventListener('click', () => run(command));
        summary.addEventListener('click', (event) => {
            if (summary.getAttribute('aria-disabled') === 'true')
                event.preventDefault();
        });
        details.append(summary, menu);
        if (!alignment) wrapper.append(main);
        wrapper.append(details);
        return {
            element: wrapper,
            update: () => {
                main.disabled = !available(command);
                const state = ui.getEditingFormatState?.(
                    alignment ? 'alignment' : 'list',
                );
                const listPrefix = kind === 'ordered' ? 'ol:' : 'ul:';
                const mainActive =
                    !main.disabled &&
                    (state?.status === 'uniform'
                        ? state.value.startsWith(listPrefix)
                        : state !== undefined
                          ? false
                          : active(command));
                main.classList.toggle('is-active', mainActive);
                main.setAttribute('aria-pressed', String(mainActive));
                showFormatState(summary, label, state, ui, !main.disabled);
                let selectedIcon =
                    state?.status === 'mixed' ? '' : 'format.alignment.left';
                for (const button of buttons) {
                    const id = button.dataset.formatCommand ?? '';
                    button.disabled = !available(id);
                    const expected = id.slice(command.length + 1);
                    const selected =
                        !button.disabled &&
                        (state?.status === 'uniform'
                            ? state.value ===
                              (alignment ? expected : listPrefix + expected)
                            : state !== undefined
                              ? false
                              : active(id));
                    button.setAttribute('aria-checked', String(selected));
                    button.classList.toggle('is-active', selected);
                    if (selected) selectedIcon = id;
                }
                summary.setAttribute(
                    'aria-disabled',
                    String(buttons.every((button) => button.disabled)),
                );
                if (buttons.every((button) => button.disabled))
                    details.open = false;
                if (alignment && summary.dataset.currentIcon !== selectedIcon) {
                    ui.setIcon(
                        summary,
                        selectedIcon,
                        selectedIcon === '' ? '—' : label,
                    );
                    summary.append(arrow);
                    summary.dataset.currentIcon = selectedIcon;
                }
            },
            destroy: () => {
                details.open = false;
            },
        };
    };
}
