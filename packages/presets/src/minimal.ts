import { HistoryPlugin } from '@soeditor/engine';
import { BoldPlugin, ItalicPlugin, ParagraphPlugin } from '@soeditor/rich-text';
import { UiPlugin } from '@soeditor/ui';

import { createPreset } from './create-preset.js';

export const minimalPreset = createPreset(
    'html',
    [HistoryPlugin, ParagraphPlugin, BoldPlugin, ItalicPlugin, UiPlugin],
    ['undo', 'redo', '|', 'bold', 'italic'],
);
