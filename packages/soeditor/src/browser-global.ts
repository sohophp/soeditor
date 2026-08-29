import type { EditorCreateOptions } from '@soeditor/core';
import { Editor } from '@soeditor/core';
import '@soeditor/ui/styles.css';

import * as publicApi from './index.js';

/** Creates the same instance-scoped Core editor exposed by the ESM API. */
const create = (options: EditorCreateOptions): Promise<Editor> =>
    Editor.create(options);

const browserApi = Object.freeze({ ...publicApi, create });

export default browserApi;
