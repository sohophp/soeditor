import { Editor, Plugin } from '@soeditor/core';
import { describe, expect, it } from 'vitest';

import {
    classicPreset,
    developerPreset,
    extendPreset,
    markdownPreset,
    minimalPreset,
} from '../src/index.js';
import { minimalPreset as narrowMinimalPreset } from '../src/minimal.js';

describe('editor presets', () => {
    it('publishes four immutable, duplicate-free definitions', () => {
        for (const preset of [
            minimalPreset,
            classicPreset,
            developerPreset,
            markdownPreset,
        ]) {
            expect(Object.isFrozen(preset)).toBe(true);
            expect(Object.isFrozen(preset.plugins)).toBe(true);
            expect(Object.isFrozen(preset.toolbar)).toBe(true);
            expect(
                new Set(preset.plugins.map((plugin) => plugin.id)).size,
            ).toBe(preset.plugins.length);
        }
        expect(markdownPreset.format).toBe('markdown');
        expect(narrowMinimalPreset).toBe(minimalPreset);
        expect(developerPreset.plugins.map((plugin) => plugin.id)).toContain(
            'developer-tools',
        );
    });

    it('creates independent editors from minimal and Markdown presets', async () => {
        const first = await Editor.create({
            data: '<p>First</p>',
            format: minimalPreset.format,
            plugins: minimalPreset.plugins,
        });
        const second = await Editor.create({
            data: '# Second',
            format: markdownPreset.format,
            plugins: markdownPreset.plugins,
        });
        expect(first.state.document.format).toBe('html');
        expect(second.state.document.format).toBe('markdown');
        await first.destroy();
        await second.destroy();
    });

    it('initializes every HTML preset without browser surface ownership', async () => {
        for (const preset of [minimalPreset, classicPreset, developerPreset]) {
            const editor = await Editor.create({ plugins: preset.plugins });
            expect(editor.state.document.format).toBe('html');
            await editor.destroy();
        }
    });

    it('extends without mutation and rejects duplicate plugin IDs', () => {
        class ExtraPlugin extends Plugin {
            static readonly id = 'example.extra';
        }
        const extended = extendPreset(minimalPreset, {
            plugins: [ExtraPlugin],
            toolbar: [...minimalPreset.toolbar, '|', 'extra'],
        });
        expect(extended.plugins.at(-1)).toBe(ExtraPlugin);
        expect(minimalPreset.plugins).not.toContain(ExtraPlugin);
        expect(() =>
            extendPreset(minimalPreset, {
                plugins: [ExtraPlugin, ExtraPlugin],
            }),
        ).toThrow('duplicated');
    });
});
