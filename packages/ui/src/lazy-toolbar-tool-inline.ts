import { lazyToolbarTools } from './toolbar-lazy-tools.js';
import type { LazyToolOptions } from './lazy-toolbar-tool.js';
import type { ToolbarItemFactory } from './types.js';

/** The standalone global build already isolates its supported companion assets. */
export function lazyToolbarTool(
    name: keyof typeof lazyToolbarTools,
    _options: LazyToolOptions,
): ToolbarItemFactory {
    void _options;
    return lazyToolbarTools[name];
}
