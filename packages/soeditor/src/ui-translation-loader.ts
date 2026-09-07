import type { EditorUiTranslationResource } from '@soeditor/ui';

/** Loads the complete built-in UI dictionaries only for supported non-English locales. */
export async function loadBuiltInUiTranslations(
    locale: string,
): Promise<readonly EditorUiTranslationResource[]> {
    return /^zh(?:[_-]|$)/iu.test(locale.trim())
        ? (await import('@soeditor/ui/translations')).builtInUiTranslations
        : [];
}
