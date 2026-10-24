import { mountToolbarTool } from './toolbar-root.js';
import type { ToolbarItemContext, ToolbarItemInstance } from './types.js';
import { createColorTools } from './toolbar-color-tools.js';
import * as picker from './color-picker.js';
export const { fontColorButton, fontBackgroundColorButton, highlightButton } =
    createColorTools(picker);

export function mountColorTool(
    context: ToolbarItemContext,
    root: HTMLElement,
    name: 'fontColorButton' | 'fontBackgroundColorButton' | 'highlightButton',
): ToolbarItemInstance {
    const tools = {
        fontColorButton,
        fontBackgroundColorButton,
        highlightButton,
    };
    return mountToolbarTool(context, root, tools[name]);
}
