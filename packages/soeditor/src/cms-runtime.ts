import { cmsRuntimePreset } from '@soeditor/presets/cms-runtime';
import { createClassicEditor } from './classic-editor.js';
import type {
    ClassicEditor,
    CreateClassicEditorOptions,
} from './classic-editor.js';

/** Keep runtime contributions with the mounted editor, below first-use tools. */
export function createCmsClassicEditor(
    host: HTMLElement,
    options?: CreateClassicEditorOptions,
): Promise<ClassicEditor> {
    return createClassicEditor(host, {
        ...options,
        preset: options?.preset ?? cmsRuntimePreset,
    });
}
