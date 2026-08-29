import type { Editor } from '../editor/editor.js';

/** Context passed to each plugin constructor. */
export interface PluginContext {
    /** The editor instance that owns the plugin. */
    readonly editor: Editor;
}

/** A constructable plugin type with a stable ID and optional requirements. */
export interface PluginConstructor<Instance extends Plugin = Plugin> {
    /** Constructs a plugin for one editor instance. */
    new (context: PluginContext): Instance;
    /** Stable ID used for dependency resolution and lookup. */
    readonly id: string;
    /** Plugins that must initialize before this plugin. */
    readonly requires?: readonly PluginConstructor[];
}

/** Base class for an editor extension with explicit lifecycle hooks. */
export abstract class Plugin {
    /** The editor instance that owns this plugin. */
    protected readonly editor: Editor;

    /** Creates a plugin owned by the editor in the supplied context. */
    constructor(context: PluginContext) {
        this.editor = context.editor;
    }

    /** Initializes resources after every plugin has been constructed. */
    init?(): void | Promise<void>;
    /** Runs only after every plugin has initialized successfully. */
    ready?(): void | Promise<void>;
    /**
     * Releases resources after this plugin initialized successfully.
     *
     * A destroy hook must not await this editor's own `destroy()` promise,
     * because that promise cannot settle until the hook itself completes. The
     * hook may obtain or compare the shared promise without awaiting it.
     */
    destroy?(): void | Promise<void>;
}
