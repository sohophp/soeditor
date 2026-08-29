import type { DocumentFormat, PluginConstructor } from '@soeditor/core';
import type { ToolbarConfiguration } from '@soeditor/ui';

import type { EditorPreset, ExtendPresetOptions } from './types.js';

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

export function createPreset(
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
    return Object.freeze({
        format,
        plugins: Object.freeze([...plugins]),
        toolbar: Object.freeze([...toolbar]),
    });
}
