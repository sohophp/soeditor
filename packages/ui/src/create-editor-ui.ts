import { createEditorUiWithTranslations } from './editor-ui.js';
import { builtInUiTranslations } from './localization.js';
import type { CreateEditorUiOptions, EditorUi } from './types.js';

/** Attaches one editor UI with the complete built-in translation baseline. */
export function createEditorUi(options: CreateEditorUiOptions): EditorUi {
    return createEditorUiWithTranslations({
        ...options,
        translations: [
            ...builtInUiTranslations,
            ...(options.translations ?? []),
        ],
    });
}
