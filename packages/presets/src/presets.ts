import type { DocumentFormat, PluginConstructor } from '@soeditor/core';
import { DeveloperToolsPlugin } from '@soeditor/dev-tools';
import { HistoryPlugin } from '@soeditor/engine';
import { FileManagerPlugin } from '@soeditor/file-manager';
import { DiagnosticsPlugin, HtmlFormattingPlugin } from '@soeditor/html-tools';
import { MarkdownPlugin } from '@soeditor/markdown';
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
    OrderedListPlugin,
    ParagraphPlugin,
    StrikePlugin,
    TablePlugin,
    UnderlinePlugin,
    UnorderedListPlugin,
} from '@soeditor/rich-text';
import { SourceEditingPlugin } from '@soeditor/source';
import {
    defaultToolbarConfiguration,
    UiPlugin,
    type ToolbarConfiguration,
} from '@soeditor/ui';

/** Static editor capabilities that still require explicit surface attachment. */
export interface EditorPreset {
    readonly format: DocumentFormat;
    readonly plugins: readonly PluginConstructor[];
    readonly toolbar: ToolbarConfiguration;
}

/** Additional roots and optional toolbar replacement for preset composition. */
export interface ExtendPresetOptions {
    readonly plugins?: readonly PluginConstructor[];
    readonly toolbar?: ToolbarConfiguration;
}

const commonRichTextPlugins = [
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
    TablePlugin,
] as const;

export const minimalPreset = createPreset(
    'html',
    [HistoryPlugin, ParagraphPlugin, BoldPlugin, ItalicPlugin, UiPlugin],
    ['undo', 'redo', '|', 'bold', 'italic'],
);

export const classicPreset = createPreset(
    'html',
    [
        ...commonRichTextPlugins,
        SourceEditingPlugin,
        DiagnosticsPlugin,
        HtmlFormattingPlugin,
        PreviewPlugin,
        UiPlugin,
    ],
    defaultToolbarConfiguration,
);

export const developerPreset = createPreset(
    'html',
    [...classicPreset.plugins, DeveloperToolsPlugin, FileManagerPlugin],
    [
        ...defaultToolbarConfiguration,
        '|',
        'problems',
        'image-browse',
        'inspector',
        'outline',
        'find-replace',
        'command-palette',
    ],
);

export const markdownPreset = createPreset(
    'markdown',
    [HistoryPlugin, MarkdownPlugin, PreviewPlugin, UiPlugin],
    ['undo', 'redo', '|', 'markdown', 'preview'],
);

/** Returns a new validated preset without mutating the base definition. */
export function extendPreset(
    base: EditorPreset,
    options: ExtendPresetOptions,
): EditorPreset {
    return createPreset(
        base.format,
        [...base.plugins, ...(options.plugins ?? [])],
        options.toolbar ?? base.toolbar,
    );
}

function createPreset(
    format: DocumentFormat,
    plugins: readonly PluginConstructor[],
    toolbar: ToolbarConfiguration,
): EditorPreset {
    const ids = new Set<string>();
    for (const plugin of plugins) {
        if (typeof plugin !== 'function' || plugin.id.trim().length === 0) {
            throw new TypeError(
                'Preset plugins require a non-empty static ID.',
            );
        }
        if (ids.has(plugin.id)) {
            throw new TypeError(
                `Preset plugin ID "${plugin.id}" is duplicated.`,
            );
        }
        ids.add(plugin.id);
    }
    const frozenPlugins = Object.freeze([...plugins]);
    const frozenToolbar = Object.freeze([...toolbar]);
    return Object.freeze({
        format,
        plugins: frozenPlugins,
        toolbar: frozenToolbar,
    });
}
