import {
    createServiceToken,
    EditorDestroyedError,
    Plugin,
} from '@soeditor/core';

import { defaultShortcuts, defaultToolbarItems } from './defaults.js';
import { freezeShortcut } from './shortcuts.js';
import type {
    KeyboardShortcutDefinition,
    ToolbarItemFactory,
    UiRegistryService,
} from './types.js';

interface StoredShortcut extends KeyboardShortcutDefinition {
    readonly parsed: ReturnType<typeof freezeShortcut>['parsed'];
}

interface RegistryRecord {
    readonly shortcuts: Map<string, StoredShortcut>;
    readonly shortcutIds: Map<string, StoredShortcut>;
    readonly toolbarItems: Map<string, ToolbarItemFactory>;
}

const records = new WeakMap<UiRegistryService, RegistryRecord>();

/** Typed identity of the per-editor UI contribution registry. */
export const uiRegistryServiceToken = createServiceToken<UiRegistryService>(
    'soeditor.ui-registry',
);

/** Reports a duplicate toolbar item, shortcut ID, or shortcut chord. */
export class UiContributionAlreadyRegisteredError extends Error {
    constructor(kind: string, id: string) {
        super(`UI ${kind} "${id}" is already registered.`);
        this.name = 'UiContributionAlreadyRegisteredError';
    }
}

/** Registers default UI contributions and a per-editor extension registry. */
export class UiPlugin extends Plugin {
    static readonly id = 'editor-ui';
    #destroyed = false;
    #service: UiRegistryService | undefined;

    override init(): void {
        const record: RegistryRecord = {
            shortcuts: new Map(),
            shortcutIds: new Map(),
            toolbarItems: new Map(),
        };
        const service = Object.freeze<UiRegistryService>({
            registerShortcut: (definition) =>
                this.#registerShortcut(record, definition),
            registerToolbarItem: (id, factory) =>
                this.#registerToolbarItem(record, id, factory),
        });
        records.set(service, record);
        this.#service = service;
        for (const [id, factory] of defaultToolbarItems) {
            this.#registerToolbarItem(record, id, factory);
        }
        for (const shortcut of defaultShortcuts) {
            this.#registerShortcut(record, shortcut);
        }
        this.editor.services.register(uiRegistryServiceToken, service);
    }

    override destroy(): void {
        this.#destroyed = true;
        const service = this.#service;
        if (service !== undefined) {
            const record = getUiRegistryRecord(service);
            record.shortcuts.clear();
            record.shortcutIds.clear();
            record.toolbarItems.clear();
        }
        this.#service = undefined;
    }

    #registerToolbarItem(
        record: RegistryRecord,
        id: string,
        factory: ToolbarItemFactory,
    ): () => void {
        this.#assertAlive();
        if (typeof id !== 'string' || id.trim().length === 0) {
            throw new TypeError('A toolbar item ID must not be empty.');
        }
        if (typeof factory !== 'function') {
            throw new TypeError(`Toolbar item "${id}" requires a factory.`);
        }
        if (record.toolbarItems.has(id)) {
            throw new UiContributionAlreadyRegisteredError('toolbar item', id);
        }
        record.toolbarItems.set(id, factory);
        let active = true;
        return () => {
            if (active && record.toolbarItems.get(id) === factory) {
                record.toolbarItems.delete(id);
            }
            active = false;
        };
    }

    #registerShortcut(
        record: RegistryRecord,
        definition: KeyboardShortcutDefinition,
    ): () => void {
        this.#assertAlive();
        const shortcut = freezeShortcut(definition);
        if (record.shortcutIds.has(shortcut.id)) {
            throw new UiContributionAlreadyRegisteredError(
                'shortcut ID',
                shortcut.id,
            );
        }
        if (record.shortcuts.has(shortcut.chord)) {
            throw new UiContributionAlreadyRegisteredError(
                'shortcut chord',
                shortcut.chord,
            );
        }
        record.shortcutIds.set(shortcut.id, shortcut);
        record.shortcuts.set(shortcut.chord, shortcut);
        let active = true;
        return () => {
            if (active && record.shortcutIds.get(shortcut.id) === shortcut) {
                record.shortcutIds.delete(shortcut.id);
                record.shortcuts.delete(shortcut.chord);
            }
            active = false;
        };
    }

    #assertAlive(): void {
        if (this.#destroyed) {
            throw new EditorDestroyedError();
        }
    }
}

export function getUiRegistryRecord(
    service: UiRegistryService,
): RegistryRecord {
    const record = records.get(service);
    if (record === undefined) {
        throw new Error('UI registry storage is unavailable.');
    }
    return record;
}
