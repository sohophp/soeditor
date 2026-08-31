export { Editor as SoEditor } from '@soeditor/core';
export {
    ClassicEditorAlreadyAttachedError,
    ClassicEditorDestroyedError,
} from './classic-editor-errors.js';
export type {
    ClassicEditor,
    ClassicEditorChange,
    ClassicEditingMode,
    ClassicEditorSaveOptions,
    ClassicWorkspaceView,
    CreateClassicEditorOptions,
    UnsupportedContentDisplay,
} from './classic-editor.js';

import type {
    ClassicEditor,
    CreateClassicEditorOptions,
} from './classic-editor.js';

/** Mounts the lazily loaded classic CMS editor on a textarea or element. */
export const createClassicEditor = async (
    host: HTMLElement,
    options?: CreateClassicEditorOptions,
): Promise<ClassicEditor> => {
    const classic = await import('./classic-editor.js');
    return classic.createClassicEditor(host, options);
};
export * from '@soeditor/adapter-sofinder';
export * from '@soeditor/comments';
export * from '@soeditor/core';
export * from '@soeditor/dev-tools';
export * from '@soeditor/engine';
export * from '@soeditor/file-manager';
export * from '@soeditor/html';
export * from '@soeditor/html-tools';
export * from '@soeditor/layout';
export * from '@soeditor/markdown';
export * from '@soeditor/presets';
export * from '@soeditor/preview';
export * from '@soeditor/projections';
export * from '@soeditor/revisions';
export * from '@soeditor/rich-text';
export * from '@soeditor/source';
export * from '@soeditor/ui';
export * from '@soeditor/workspace';
export * from '@soeditor/wysiwyg';
