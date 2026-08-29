import { HistoryPlugin } from '@soeditor/engine';
import { DiagnosticsPlugin, HtmlFormattingPlugin } from '@soeditor/html-tools';
import { PreviewPlugin } from '@soeditor/preview';
import {
    BlockquotePlugin,
    BoldPlugin,
    CodeBlockPlugin,
    HeadingPlugin,
    ImagePlugin,
    InlineCodePlugin,
    ItalicPlugin,
    LinkPlugin,
    MediaPlugin,
    OrderedListPlugin,
    ParagraphPlugin,
    StrikePlugin,
    TablePlugin,
    UnderlinePlugin,
    UnorderedListPlugin,
} from '@soeditor/rich-text';
import { SourceEditingPlugin } from '@soeditor/source';
import { defaultToolbarConfiguration, UiPlugin } from '@soeditor/ui';

import { createPreset } from './create-preset.js';

export const classicPreset = createPreset(
    'html',
    [
        HistoryPlugin,
        ParagraphPlugin,
        HeadingPlugin,
        BoldPlugin,
        ItalicPlugin,
        UnderlinePlugin,
        StrikePlugin,
        LinkPlugin,
        OrderedListPlugin,
        UnorderedListPlugin,
        BlockquotePlugin,
        InlineCodePlugin,
        CodeBlockPlugin,
        ImagePlugin,
        MediaPlugin,
        TablePlugin,
        SourceEditingPlugin,
        DiagnosticsPlugin,
        HtmlFormattingPlugin,
        PreviewPlugin,
        UiPlugin,
    ],
    defaultToolbarConfiguration,
);
