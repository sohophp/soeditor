import type { DocumentFormat, PluginConstructor } from '@soeditor/core';
import type { ToolbarConfiguration } from '@soeditor/ui';

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
