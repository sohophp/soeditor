export {
    ClassicEditorAlreadyAttachedError,
    ClassicEditorDestroyedError,
} from './classic-editor-errors.js';
export type {
    ClassicEditor,
    ClassicEditorChange,
    ClassicEditingMode,
    ClassicCanvasOptions,
    ClassicCanvasPreset,
    ClassicCanvasPresetId,
    ClassicPreviewOptions,
    ClassicPreviewTemplate,
    ClassicEditorSaveOptions,
    ClassicSourceOptions,
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
    const requiresOptionalClassic =
        options?.preview !== undefined ||
        options?.save !== undefined ||
        options?.source !== undefined ||
        options?.editingModes?.includes('source') === true ||
        options?.initialEditingMode === 'source';
    if (requiresOptionalClassic) {
        throw new TypeError(
            'The default CMS entry does not load Source, Preview, or save adapters. Import createClassicEditor from "@soeditor/editor/cms/optional" when those features are configured.',
        );
    }
    const classic = await import('./cms-runtime.js');
    return classic.createCmsClassicEditor(host, options);
};
