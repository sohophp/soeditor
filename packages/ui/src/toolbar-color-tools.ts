import type * as ColorPicker from './color-picker.js';
import { createToolbarRoot } from './toolbar-root.js';
import { showFormatState } from './format-state.js';

import type { ToolbarItemFactory } from './types.js';
import { canExecute, execute } from './toolbar-tool-shared.js';

function palette(values: string): readonly (readonly [string, string])[] {
    return values.split('|').map((entry) => {
        const [name = '', value = ''] = entry.split(':');
        return [name, '#' + value] as const;
    });
}

const textColors = palette(
    'Black:000000|Dark gray:344054|Gray:667085|Red:dc2626|Rose:e11d48|Orange:ea580c|Amber:d97706|Yellow:ca8a04|Lime:65a30d|Green:16a34a|Teal:0d9488|Cyan:0891b2|Blue:2563eb|Indigo:4f46e5|Purple:7c3aed|White:ffffff',
);

const backgroundColors = palette(
    'Light gray:f2f4f7|Light slate:e2e8f0|Light red:fee2e2|Light rose:ffe4e6|Light orange:ffedd5|Light amber:fef3c7|Light yellow:fef9c3|Light lime:ecfccb|Light green:dcfce7|Light teal:ccfbf1|Light cyan:cffafe|Light blue:dbeafe|Light indigo:e0e7ff|Light purple:ede9fe|Dark:1f2937|White:ffffff',
);

const highlightColors = palette(
    'Classic yellow marker:ffff66|Yellow marker:fef08a|Green marker:bbf7d0|Pink marker:fecaca|Blue marker:bae6fd|Orange marker:fed7aa|Violet marker:ddd6fe|Strong yellow marker:fde047|Strong green marker:86efac|Strong pink marker:fda4af|Strong blue marker:7dd3fc|Strong orange marker:fdba74|Strong violet marker:c4b5fd|Gray marker:d1d5db|Cyan marker:a5f3fc|Red marker:fca5a5|Lime marker:bef264',
);

export function createColorTools(picker: typeof ColorPicker) {
    const fontColorButton = colorMenu(
        'Text color',
        'font.color',
        'A̲',
        textColors,
        picker,
        {
            removeCommand: 'font.color.remove',
            removeLabel: 'Remove text color',
        },
    );
    const fontBackgroundColorButton = colorMenu(
        'Background color',
        'font.backgroundColor',
        'A■',
        backgroundColors,
        picker,
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
        picker,
        {
            removeCommand: 'font.highlight.remove',
            removeLabel: 'Remove highlight',
        },
    );
    return { fontColorButton, fontBackgroundColorButton, highlightButton };
}
interface ColorMenuOptions {
    readonly removeCommand: string;
    readonly removeLabel: string;
}

const recentColorsStorageKey = 'soeditor.ui.recent-colors.v1';
const maximumRecentColors = 16;

function colorMenu(
    label: string,
    command: 'font.color' | 'font.backgroundColor' | 'font.highlight',
    fallbackIcon: string,
    colors: readonly (readonly [string, string])[],
    pickerRuntime: typeof ColorPicker,
    options: ColorMenuOptions,
): ToolbarItemFactory {
    return ({ document, editor, ui }) => {
        const {
            createColorPicker,
            parsePickerColor,
            serializePickerColor,
            formatPickerColor,
        } = pickerRuntime;
        const defaultColor = colors[0]?.[1] ?? '#000000';
        const controller = new AbortController();
        function listen<K extends keyof HTMLElementEventMap>(
            target: HTMLElement,
            type: K,
            listener: (event: HTMLElementEventMap[K]) => void,
        ): void {
            target.addEventListener(type, listener, {
                signal: controller.signal,
            });
        }
        function make<K extends keyof HTMLElementTagNameMap>(
            tag: K,
            suffix: string,
        ): HTMLElementTagNameMap[K] {
            const node = document.createElement(tag);
            node.className = 'soeditor-ui__' + suffix;
            return node;
        }

        const details = createToolbarRoot(document, ui, 'details');
        details.className = 'soeditor-ui__menu soeditor-ui__color-menu';
        const summary = make('summary', 'button');
        ui.setIcon(summary, command, fallbackIcon);
        summary.title = label;
        summary.setAttribute('aria-label', label);
        const menu = make('div', 'color-panel');
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
        listen(menu, 'pointerdown', panelPointerDown);
        const presetLabel = make('span', 'color-section-label');
        presetLabel.textContent = 'Preset colors';
        const presets = make('div', 'color-grid soeditor-ui__preset-colors');
        const recentSection = make('section', 'recent-colors');
        const recentLabel = make('span', 'color-section-label');
        recentLabel.textContent = 'Recent colors';
        const recentPalette = make(
            'div',
            'color-grid soeditor-ui__recent-color-grid',
        );
        recentSection.append(recentLabel, recentPalette);
        const remove = make('button', 'menu-item soeditor-ui__color-remove');
        remove.type = 'button';
        ui.setIcon(remove, `${command}.remove`, 'Remove');
        remove.append(options.removeLabel);
        listen(remove, 'click', () => {
            execute(editor, ui, options.removeCommand, []);
            details.open = false;
        });
        function swatch(
            name: string,
            value: string,
            recent = false,
        ): HTMLButtonElement {
            const button = make('button', 'color-choice');
            button.type = 'button';
            button.title = name;
            button.setAttribute(
                'aria-label',
                recent ? `Recent color ${value}` : name,
            );
            button.dataset[recent ? 'recentColor' : 'value'] = value;
            button.style.setProperty('--soeditor-choice-color', value);
            return button;
        }
        const buttons = colors.map(([name, value]) => swatch(name, value));
        presets.append(...buttons);
        const custom = make('div', 'custom-color');
        const customLabel = make('label', 'color-section-label');
        customLabel.textContent = 'Color value';
        const valueInput = make('input', 'color-value');
        valueInput.type = 'text';
        valueInput.placeholder = '#RRGGBB';
        valueInput.spellcheck = false;
        valueInput.setAttribute('aria-label', 'Color value');
        customLabel.append(valueInput);
        const controls = make('div', 'color-controls');
        const preview = make('span', 'color-preview');
        preview.setAttribute('aria-hidden', 'true');
        let format: ColorPicker.ColorFormat = 'HEXA';
        let pendingValue = defaultColor;
        let pendingColor: ColorPicker.HsvaColor | undefined;
        const formats = make('div', 'color-formats');
        formats.setAttribute('role', 'group');
        formats.setAttribute('aria-label', ui.translate('Color format'));
        const formatButtons = (['HEXA', 'RGBA', 'HSVA'] as const).map(
            (value) => {
                const button = make('button', 'color-format');
                button.type = 'button';
                button.textContent = value;
                listen(button, 'click', () => {
                    const color =
                        pendingColor ??
                        parsePickerColor(document, pendingValue);
                    format = value;
                    if (color)
                        valueInput.value = formatPickerColor(color, format);
                    updateFormats();
                });
                formats.append(button);
                return button;
            },
        );
        function updateFormats(): void {
            for (const button of formatButtons)
                button.setAttribute(
                    'aria-pressed',
                    String(button.textContent === format),
                );
        }
        updateFormats();
        function readInput(): string | undefined {
            if (/^hsva?\(/iu.test(valueInput.value.trim())) {
                const color = parsePickerColor(
                    document,
                    valueInput.value.trim(),
                );
                return color ? serializePickerColor(color) : undefined;
            }
            return normalizeColorInput(valueInput.value, document);
        }
        const apply = make('button', 'menu-item soeditor-ui__color-apply');
        apply.type = 'button';
        apply.textContent = 'Apply color';
        const feedback = make('span', 'color-feedback');
        feedback.setAttribute('role', 'status');
        const invalidColorMessage =
            'Invalid color. Enter HEX, RGB, HSL or a color name.';
        const spectrum = createColorPicker(
            document,
            (key) => ui.translate(key),
            (value, color) => {
                colorEditedBeforeToggle = true;
                stageColor(value, false, color);
            },
        );
        let appliedColor = defaultColor;
        const current = make('button', 'current-color');
        current.type = 'button';
        current.setAttribute(
            'aria-label',
            ui.translate('Restore current color'),
        );
        const currentSwatch = make('span', 'current-color-swatch');
        currentSwatch.setAttribute('aria-hidden', 'true');
        current.append(currentSwatch, ui.translate('Current color'));
        listen(current, 'click', () => stageColor(appliedColor));
        const cancel = make('button', 'menu-item soeditor-ui__color-cancel');
        cancel.type = 'button';
        cancel.textContent = ui.translate('Cancel');
        listen(cancel, 'click', () => {
            details.open = false;
        });
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
            const value = readInput();
            if (value === undefined) {
                // Incomplete text is expected while typing; explain it only on submit.
                valueInput.removeAttribute('aria-invalid');
                feedback.textContent = '';
                return;
            }
            pendingValue = value;
            pendingColor = parsePickerColor(document, valueInput.value);
            setColorPreview(value);
            valueInput.setAttribute('aria-invalid', 'false');
            feedback.textContent = '';
        };
        const valueKey = (event: KeyboardEvent): void => {
            if (event.key !== 'Enter' || event.isComposing) return;
            event.preventDefault();
            event.stopPropagation();
            submit();
        };
        listen(valueInput, 'keydown', valueKey);
        listen(apply, 'click', submit);
        listen(valueInput, 'input', valueInputEvent);
        controls.append(preview, cancel, apply);
        custom.append(customLabel, formats, feedback);
        const header = make('div', 'color-header');
        header.append(current);
        header.append(remove);
        menu.append(
            header,
            spectrum.element,
            presetLabel,
            presets,
            recentSection,
            custom,
            controls,
        );
        details.append(summary, menu);

        let recentButtons: HTMLButtonElement[] = [];
        function renderRecentColors(): void {
            recentPalette.replaceChildren();
            const recent = readRecentColors(document);
            recentSection.hidden = recent.length === 0;
            recentButtons = recent.map((value) => swatch(value, value, true));
            recentPalette.append(...recentButtons);
        }
        listen(menu, 'click', (event) => {
            const button =
                event.target instanceof Element
                    ? event.target.closest<HTMLButtonElement>(
                          '.soeditor-ui__color-choice',
                      )
                    : null;
            if (!button || button.disabled) return;
            const value = button.dataset.value ?? button.dataset.recentColor;
            if (value !== undefined) commitColor(value);
        });
        function stageColor(
            value: string,
            syncPicker = true,
            sourceColor?: ColorPicker.HsvaColor,
        ): void {
            pendingValue = value;
            const color = sourceColor ?? parsePickerColor(document, value);
            pendingColor = color;
            valueInput.value = color ? formatPickerColor(color, format) : value;
            valueInput.setAttribute('aria-invalid', 'false');
            feedback.textContent = '';
            setColorPreview(value, syncPicker);
        }
        function setColorPreview(value: string, syncPicker = true): void {
            if (syncPicker) spectrum.setColor(value);
            preview.style.setProperty('--soeditor-current-color', value);
        }
        function validatePendingColor(): string | undefined {
            const value = readInput();
            const valid = value !== undefined;
            valueInput.setAttribute('aria-invalid', String(!valid));
            feedback.textContent = valid ? '' : invalidColorMessage;
            return valid ? pendingValue : undefined;
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
            const state = ui.getEditingFormatState?.(command);
            appliedColor =
                state?.status === 'uniform' ? state.value : defaultColor;
            currentSwatch.style.backgroundColor = appliedColor;
            current.disabled = state?.status === 'mixed';
            if (!edited) {
                // Unformatted backgrounds/highlights resolve to transparent in
                // computed styles. Start a visible draft without changing content.
                const color = parsePickerColor(document, appliedColor);
                stageColor(color?.a === 0 ? defaultColor : appliedColor);
                if (state?.status === 'mixed') valueInput.value = '';
            }
            ui.refresh();
        };
        listen(details, 'toggle', toggle);
        renderRecentColors();
        stageColor(defaultColor);
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
                for (const button of buttons) {
                    const selected =
                        available &&
                        details.open &&
                        state?.status === 'uniform' &&
                        document.defaultView?.getComputedStyle(button)
                            .backgroundColor === state.value;
                    button.setAttribute('aria-pressed', String(selected));
                }
                for (const button of buttons) button.disabled = !available;
                remove.disabled = !canExecute(editor, options.removeCommand);
                valueInput.disabled = !available;
                for (const button of formatButtons)
                    button.disabled = !available;
                spectrum.setDisabled(!available);
                current.disabled = !available || state?.status === 'mixed';
                apply.disabled = !available;
                for (const button of recentButtons) {
                    button.disabled = !available;
                }
            },
            destroy: () => {
                spectrum.destroy();
                controller.abort();
            },
        };
    };
}

function normalizeColorInput(
    value: string,
    document: Document,
): string | undefined {
    const normalized = value.trim().toLowerCase();
    if (
        normalized.length === 0 ||
        normalized.length > 80 ||
        !/^(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\([\d.% ,+-]+\)|[a-z]+)$/u.test(
            normalized,
        )
    ) {
        return undefined;
    }
    const style = document.createElement('span').style;
    style.color = normalized;
    return style.color === '' ||
        /^(?:inherit|initial|unset|revert|currentcolor)$/u.test(normalized)
        ? undefined
        : normalized;
}

function readRecentColors(document: Document): readonly string[] {
    try {
        const raw = document.defaultView?.localStorage.getItem(
            recentColorsStorageKey,
        );
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map((value) =>
                typeof value === 'string'
                    ? normalizeColorInput(value, document)
                    : undefined,
            )
            .filter((value): value is string => value !== undefined)
            .slice(0, maximumRecentColors);
    } catch {
        return [];
    }
}

function rememberRecentColor(document: Document, value: string): void {
    const recent = [
        value,
        ...readRecentColors(document).filter(
            (candidate) => candidate !== value,
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
