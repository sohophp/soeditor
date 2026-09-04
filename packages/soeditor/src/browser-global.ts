import type { EditorCreateOptions } from '@soeditor/core';
import { Editor } from '@soeditor/core';
import './styles.css';

import type {
    ClassicEditor,
    CreateClassicEditorOptions,
} from './classic-editor.js';
import {
    ClassicEditorAlreadyAttachedError,
    ClassicEditorDestroyedError,
} from './classic-editor-errors.js';
import { cmsRuntimePreset } from '@soeditor/presets/cms-runtime';

/** Creates the same instance-scoped Core editor exposed by the ESM API. */
const create = (options: EditorCreateOptions): Promise<Editor> =>
    Editor.create(options);

/** The standalone CMS global stays WYSIWYG-only; optional ESM provides Source. */
const createClassicEditor = async (
    host: HTMLElement,
    options?: CreateClassicEditorOptions,
): Promise<ClassicEditor> => {
    if (options?.editingModes?.includes('source') === true) {
        throw new TypeError(
            'The standalone CMS global does not bundle HTML Source. Use the ESM @soeditor/editor/cms/optional entry for Source support.',
        );
    }
    if (options?.preview !== undefined && options.preview !== false) {
        throw new TypeError(
            'The standalone CMS global does not bundle Preview. Use the ESM @soeditor/editor/cms/optional entry for Preview support.',
        );
    }
    if (options?.save !== undefined) {
        throw new TypeError(
            'The standalone CMS global does not bundle save adapters. Use native form submission or the ESM @soeditor/editor/cms/optional entry for save workflows.',
        );
    }
    const classic = await import('./classic-editor.js');
    return classic.createClassicEditor(host, {
        ...options,
        preset: options?.preset ?? cmsRuntimePreset,
    });
};

const browserApi = Object.freeze({
    ClassicEditorAlreadyAttachedError,
    ClassicEditorDestroyedError,
    create,
    createClassicEditor,
});

export default browserApi;
