import { nativePickerColor } from './toolbar-tool-shared.js';
import { createToolbarRoot } from './toolbar-root.js';
import { showFormatState } from './format-state.js';

import type { ToolbarItemFactory } from './types.js';
import { canExecute, execute } from './toolbar-tool-shared.js';

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
    ['Classic yellow marker', '#ffff66'],
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
interface ColorMenuOptions {
    readonly removeCommand?: string;
    readonly removeLabel?: string;
}

const recentColorsStorageKey = 'soeditor.ui.recent-colors.v1';
const maximumRecentColors = 16;

function colorMenu(
    label: string,
    command: 'font.color' | 'font.backgroundColor' | 'font.highlight',
    fallbackIcon: string,
    colors: readonly (readonly [string, string])[],
    options: ColorMenuOptions = {},
): ToolbarItemFactory {
    return ({ document, editor, ui }) => {
        const details = createToolbarRoot(document, ui, 'details');
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
                commitColor(value);
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
        let colorEditedBeforeToggle = false;
        const valueInputEvent = (): void => {
            colorEditedBeforeToggle = true;
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
            colorEditedBeforeToggle = true;
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
                const click = (): void => commitColor(value);
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
            const edited = colorEditedBeforeToggle;
            colorEditedBeforeToggle = false;
            if (!details.open) return;
            renderRecentColors();
            // The native toggle task can run after the first input event.
            if (!edited) {
                const state = ui.getEditingFormatState?.(command);
                if (state?.status === 'uniform') stageColor(state.value);
                else if (state?.status === 'mixed') valueInput.value = '';
            }
            ui.refresh();
        };
        details.addEventListener('toggle', toggle);
        renderRecentColors();
        stageColor(colors[0]?.[1] ?? '#000000');
        return {
            element: details,
            update: () => {
                const available = canExecute(editor, command);
                summary.setAttribute('aria-disabled', String(!available));
                const state = ui.getEditingFormatState?.(command);
                showFormatState(summary, label, state, ui, available);
                if (state?.status === 'uniform')
                    summary.style.setProperty(
                        '--soeditor-selected-color',
                        state.value,
                    );
                else summary.style.removeProperty('--soeditor-selected-color');
                for (const { button } of buttons) {
                    const selected =
                        available &&
                        details.open &&
                        state?.status === 'uniform' &&
                        document.defaultView?.getComputedStyle(button)
                            .backgroundColor === state.value;
                    button.setAttribute('aria-pressed', String(selected));
                }
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

export { fontColorButton, fontBackgroundColorButton, highlightButton };
