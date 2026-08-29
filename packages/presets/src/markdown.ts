import { HistoryPlugin } from '@soeditor/engine';
import { MarkdownPlugin } from '@soeditor/markdown';
import { PreviewPlugin } from '@soeditor/preview';
import { UiPlugin } from '@soeditor/ui';

import { createPreset } from './create-preset.js';

export const markdownPreset = createPreset(
    'markdown',
    [HistoryPlugin, MarkdownPlugin, PreviewPlugin, UiPlugin],
    ['undo', 'redo', '|', 'markdown', 'preview'],
);
