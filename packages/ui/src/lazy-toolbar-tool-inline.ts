import { createLazyToolbarTool } from './lazy-toolbar-base.js';
import type { LazyToolOptions } from './lazy-toolbar-base.js';
import type { lazyToolbarTools } from './toolbar-lazy-tools.js';
import type { ToolbarItemFactory } from './types.js';
import { linkButton } from './toolbar-link-tools.js';
import { specialCharacterButton } from './toolbar-character-tools.js';
import { imageActionsMenu } from './toolbar-image-tools.js';
import {
    tableButton,
    tablePropertiesButton,
    tableRowPropertiesButton,
    tableCellPropertiesButton,
} from './toolbar-table-tools.js';
const inlineTools = {
    linkButton,
    specialCharacterButton,
    imageActionsMenu,
    tableButton,
    tablePropertiesButton,
    tableRowPropertiesButton,
    tableCellPropertiesButton,
};

/** The global build keeps the spectrum in a separately served companion. */
export function lazyToolbarTool(
    name: keyof typeof lazyToolbarTools,
    options: LazyToolOptions,
): ToolbarItemFactory {
    if (
        name === 'fontColorButton' ||
        name === 'fontBackgroundColorButton' ||
        name === 'highlightButton'
    ) {
        return createLazyToolbarTool(name, options, async (_name, root) => {
            const tools = await import('./toolbar-color-companion.js');
            return (context) => tools.mountColorTool(context, root, name);
        });
    }
    return inlineTools[name];
}
