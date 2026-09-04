import { cmsRuntimePreset } from '@soeditor/presets/cms-runtime';

import {
    createClassicEditor as createFullClassicEditor,
    type ClassicEditor,
    type CreateClassicEditorOptions,
} from './classic-editor.js';

/** Mounts Classic with explicitly requested Source, Preview, or save support. */
export const createClassicEditor = (
    host: HTMLElement,
    options?: CreateClassicEditorOptions,
): Promise<ClassicEditor> =>
    createFullClassicEditor(host, {
        ...options,
        preset: options?.preset ?? cmsRuntimePreset,
    });

export {
    ClassicEditorAlreadyAttachedError,
    ClassicEditorDestroyedError,
} from './classic-editor-errors.js';
export type {
    ClassicEditor,
    ClassicEditorChange,
    ClassicEditingMode,
    ClassicPreviewOptions,
    ClassicPreviewTemplate,
    ClassicEditorSaveOptions,
    ClassicSourceOptions,
    ClassicWorkspaceView,
    CreateClassicEditorOptions,
} from './classic-editor.js';
