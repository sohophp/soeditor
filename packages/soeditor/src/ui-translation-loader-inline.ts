import type { EditorUiTranslationResource } from '@soeditor/ui';
import { builtInUiTranslations } from '@soeditor/ui/translations';

/** Keeps the browser-global artifact self-contained without a dynamic-loader wrapper. */
export function loadBuiltInUiTranslations(
    locale: string,
): readonly EditorUiTranslationResource[] {
    return /^zh(?:[_-]|$)/iu.test(locale.trim()) ? builtInUiTranslations : [];
}
