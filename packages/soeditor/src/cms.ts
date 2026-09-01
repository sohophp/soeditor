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
} from './classic-editor.js';

import type {
    ClassicEditor,
    CreateClassicEditorOptions,
} from './classic-editor.js';

/** Mounts the CMS editor without exporting unrelated product families. */
export const createClassicEditor = async (
    host: HTMLElement,
    options?: CreateClassicEditorOptions,
): Promise<ClassicEditor> => {
    const classic = await import('./classic-editor.js');
    return classic.createClassicEditor(host, options);
};
