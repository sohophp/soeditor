import '@soeditor/editor/cms/styles.css';
import '../style.css';
import type { CreateClassicEditorOptions } from '@soeditor/editor/cms';

export const locale =
    new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'zh-CN';
document.documentElement.lang = locale;
export const label = (zh: string, en: string) => (locale === 'en' ? en : zh);
export const initial = '<h2>CMS article</h2><p>Edit this content.</p>';
export const options: CreateClassicEditorOptions = {
    locale,
    ariaLabel: label('文章正文', 'Article HTML'),
    editingModes: ['wysiwyg', 'source'],
    minHeight: 240,
};
export const createEditor = async (
    host: HTMLElement,
    configuration: CreateClassicEditorOptions,
) => {
    const cms = await import('@soeditor/editor/cms/optional');
    return cms.createClassicEditor(host, configuration);
};
