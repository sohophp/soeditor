import type { EditorUi, EditorUiFormatState } from './types.js';

export function showFormatState(
    element: HTMLElement,
    label: string,
    state: EditorUiFormatState | undefined,
    ui: EditorUi,
    available: boolean,
): void {
    const status = available ? (state?.status ?? 'unavailable') : 'unavailable';
    element.dataset.formatState = status;
    const value =
        status === 'uniform' && state?.status === 'uniform' ? state.value : '';
    element.dataset.formatValue = value;
    const description =
        status === 'mixed'
            ? ui.translate('Mixed formatting')
            : status === 'unavailable'
              ? ui.translate('Formatting unavailable')
              : value;
    element.setAttribute('aria-description', description);
    element.title = `${ui.translate(label)}: ${description}`;
}
