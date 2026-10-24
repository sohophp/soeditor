import { createLazyToolbarTool } from './lazy-toolbar-base.js';
import type { LazyToolOptions } from './lazy-toolbar-base.js';
import type { lazyToolbarTools } from './toolbar-lazy-tools.js';
import type { ToolbarItemFactory } from './types.js';
export type { LazyToolOptions } from './lazy-toolbar-base.js';

export function lazyToolbarTool(
    name: keyof typeof lazyToolbarTools,
    options: LazyToolOptions,
): ToolbarItemFactory {
    return createLazyToolbarTool(name, options, loadToolbarTool);
}

async function loadToolbarTool(
    name: keyof typeof lazyToolbarTools,
): Promise<ToolbarItemFactory> {
    switch (name) {
        case 'linkButton':
            return (await import('./toolbar-link-tools.js')).linkButton;
        case 'specialCharacterButton':
            return (await import('./toolbar-character-tools.js'))
                .specialCharacterButton;
        case 'imageActionsMenu':
            return (await import('./toolbar-image-tools.js')).imageActionsMenu;
        case 'tableButton':
            return (await import('./toolbar-table-tools.js')).tableButton;
        case 'tablePropertiesButton':
            return (await import('./toolbar-table-tools.js'))
                .tablePropertiesButton;
        case 'tableRowPropertiesButton':
            return (await import('./toolbar-table-tools.js'))
                .tableRowPropertiesButton;
        case 'tableCellPropertiesButton':
            return (await import('./toolbar-table-tools.js'))
                .tableCellPropertiesButton;
        case 'fontColorButton':
        case 'fontBackgroundColorButton':
        case 'highlightButton': {
            const [tools, picker] = await Promise.all([
                import('./toolbar-color-tools.js'),
                import('./color-picker.js'),
            ]);
            return tools.createColorTools(picker)[name];
        }
    }
}
