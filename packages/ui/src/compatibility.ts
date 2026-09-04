import { Plugin } from '@soeditor/core';

import { compatibilityToolbarItems } from './defaults.js';
import { UiPlugin, uiRegistryServiceToken } from './ui-plugin.js';

/**
 * Restores historical optional toolbar contributions without adding them to
 * the default CMS UI registry or toolbar.
 */
export class CompatibilityUiPlugin extends Plugin {
    static readonly id = 'editor-ui-compatibility';
    static readonly requires = [UiPlugin];
    readonly #dispose: (() => void)[] = [];

    override init(): void {
        const registry = this.editor.services.get(uiRegistryServiceToken);
        for (const [id, factory] of compatibilityToolbarItems) {
            this.#dispose.push(registry.registerToolbarItem(id, factory));
        }
    }

    override destroy(): void {
        for (const dispose of this.#dispose.splice(0).reverse()) dispose();
    }
}
