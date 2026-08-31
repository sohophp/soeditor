import { createServiceToken } from '@soeditor/core';
import type { VisualEditingService } from '@soeditor/engine';

/** Internal bridge that lets standard rich-text commands target one nested editable. */
export interface NestedEditingBridge {
    getActive(commandId: string): VisualEditingService | undefined;
}

export const nestedEditingBridgeToken = createServiceToken<NestedEditingBridge>(
    'soeditor.nested-editing',
);
