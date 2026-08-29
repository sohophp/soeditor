import { Editor } from '@soeditor/core';
import { describe, expect, it } from 'vitest';

import {
    UiContributionAlreadyRegisteredError,
    UiPlugin,
    uiRegistryServiceToken,
} from '../src/index.js';

describe('UI contribution registry', () => {
    it('registers and idempotently removes per-editor toolbar items', async () => {
        const editor = await Editor.create({ plugins: [UiPlugin] });
        const registry = editor.services.get(uiRegistryServiceToken);
        const factory = (): never => {
            throw new Error('not mounted in this unit test');
        };
        const dispose = registry.registerToolbarItem('custom', factory);

        expect(() => registry.registerToolbarItem('custom', factory)).toThrow(
            UiContributionAlreadyRegisteredError,
        );
        dispose();
        dispose();
        expect(() =>
            registry.registerToolbarItem('custom', factory),
        ).not.toThrow();
    });

    it('registers status items with duplicate and cleanup guarantees', async () => {
        const editor = await Editor.create({ plugins: [UiPlugin] });
        const registry = editor.services.get(uiRegistryServiceToken);
        const factory = (): never => {
            throw new Error('not mounted in this unit test');
        };
        const dispose = registry.registerStatusItem('word-count', factory);
        expect(() =>
            registry.registerStatusItem('word-count', factory),
        ).toThrow(UiContributionAlreadyRegisteredError);
        dispose();
        dispose();
        expect(() =>
            registry.registerStatusItem('word-count', factory),
        ).not.toThrow();
        await editor.destroy();
        expect(() => registry.registerStatusItem('late', factory)).toThrow(
            'destroyed',
        );
    });

    it('normalizes shortcuts and rejects duplicate IDs and chords', async () => {
        const editor = await Editor.create({ plugins: [UiPlugin] });
        const registry = editor.services.get(uiRegistryServiceToken);
        registry.registerShortcut({
            id: 'custom.first',
            chord: 'Mod+Alt+K',
            command: 'custom.command',
        });

        expect(() =>
            registry.registerShortcut({
                id: 'custom.first',
                chord: 'Mod+Shift+K',
                command: 'custom.command',
            }),
        ).toThrow('shortcut ID');
        expect(() =>
            registry.registerShortcut({
                id: 'custom.second',
                chord: 'Mod + Alt + k',
                command: 'custom.command',
            }),
        ).toThrow('shortcut chord');
        expect(() =>
            registry.registerShortcut({
                id: 'custom.invalid',
                chord: 'Mod+Shift',
                command: 'custom.command',
            }),
        ).toThrow('non-modifier key');
    });

    it('keeps editor registries independent', async () => {
        const first = await Editor.create({ plugins: [UiPlugin] });
        const second = await Editor.create({ plugins: [UiPlugin] });
        const factory = (): never => {
            throw new Error('not mounted in this unit test');
        };

        first.services
            .get(uiRegistryServiceToken)
            .registerToolbarItem('independent', factory);
        expect(() =>
            second.services
                .get(uiRegistryServiceToken)
                .registerToolbarItem('independent', factory),
        ).not.toThrow();
    });

    it('makes retained registry references terminal after destruction', async () => {
        const editor = await Editor.create({ plugins: [UiPlugin] });
        const registry = editor.services.get(uiRegistryServiceToken);
        await editor.destroy();

        expect(() =>
            registry.registerShortcut({
                id: 'late',
                chord: 'Alt+L',
                command: 'late.command',
            }),
        ).toThrow('destroyed');
        expect(() =>
            registry.registerToolbarItem('late', () => {
                throw new Error('not mounted');
            }),
        ).toThrow('destroyed');
    });
});
