import type { Plugin, PluginConstructor } from './plugin.js';

/** Public lookup capabilities for plugins owned by one editor. */
export interface PluginCollection {
    /** Returns whether a plugin is loaded. */
    has(key: string | PluginConstructor): boolean;
    /** Gets a plugin or throws when it is absent. */
    get(id: string): Plugin;
    get<Instance extends Plugin>(
        constructor: PluginConstructor<Instance>,
    ): Instance;
    /** Gets a plugin when present. */
    tryGet(id: string): Plugin | undefined;
    tryGet<Instance extends Plugin>(
        constructor: PluginConstructor<Instance>,
    ): Instance | undefined;
}
