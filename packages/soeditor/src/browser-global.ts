import type { EditorCreateOptions } from '@soeditor/core';
import { Editor } from '@soeditor/core';
import './styles.css';

import type {
    ClassicEditor,
    CreateClassicEditorOptions,
} from './classic-editor.js';
import { createClassicEditor as createCmsEditor } from './cms.js';
import * as publicApi from './cms.js';

/** Creates the same instance-scoped Core editor exposed by the ESM API. */
const create = (options: EditorCreateOptions): Promise<Editor> =>
    Editor.create(options);

/** The standalone CMS global stays WYSIWYG-only; ESM provides lazy Source. */
const createClassicEditor = (
    host: HTMLElement,
    options?: CreateClassicEditorOptions,
): Promise<ClassicEditor> => {
    if (options?.editingModes?.includes('source') === true) {
        throw new TypeError(
            'The standalone CMS global does not bundle HTML Source. Use the ESM CMS entry for lazy Source support.',
        );
    }
    return createCmsEditor(host, options);
};

const browserApi = Object.freeze({
    ...publicApi,
    create,
    createClassicEditor,
});

export default browserApi;
