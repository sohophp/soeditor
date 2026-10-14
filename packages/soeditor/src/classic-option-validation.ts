import type { UiRegistryService } from '@soeditor/ui';
import type { ClassicPreviewOptions } from './classic-editor.js';

/** Validate explicitly requested optional capabilities before mounting the editor. */
export function readClassicPreviewOptions(
    value: boolean | ClassicPreviewOptions | undefined,
): ClassicPreviewOptions | undefined {
    if (value === undefined || value === false) return undefined;
    if (value === true) return Object.freeze({});
    if (typeof value !== 'object' || value === null) {
        throw new TypeError(
            'Classic preview must be a boolean or configuration object.',
        );
    }
    if (
        value.windowFeatures !== undefined &&
        (typeof value.windowFeatures !== 'string' ||
            value.windowFeatures.trim().length === 0)
    ) {
        throw new TypeError(
            'Classic preview windowFeatures must be a non-empty string.',
        );
    }
    if (
        value.wysiwygStyles !== undefined &&
        typeof value.wysiwygStyles !== 'boolean'
    ) {
        throw new TypeError('Classic preview wysiwygStyles must be a boolean.');
    }
    return value;
}

export function registerClassicPreviewTool(
    registry: UiRegistryService,
    open: () => boolean | undefined,
): void {
    registry.registerToolbarItem('popupPreview', ({ document, ui }) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'soeditor-ui__button';
        ui.setIcon(button, 'editor.preview', 'Preview');
        button.querySelector('svg')?.classList.add('soeditor-ui__icon--solid');
        button.title = ui.translate('Preview in new window');
        button.setAttribute(
            'aria-label',
            ui.translate('Preview in new window'),
        );
        const click = (): void => {
            if (open() === false) {
                ui.notifications.show({
                    message: ui.translate(
                        'The preview window was blocked by the browser.',
                    ),
                    severity: 'error',
                });
            }
        };
        button.addEventListener('click', click);
        return {
            destroy: () => button.removeEventListener('click', click),
            element: button,
            update: () => undefined,
        };
    });
}
