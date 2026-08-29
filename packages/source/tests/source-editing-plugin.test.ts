import { Editor } from '@soeditor/core';
import {
    ProjectionCoordinatorPlugin,
    projectionCoordinatorServiceToken,
} from '@soeditor/projections';
import { describe, expect, it } from 'vitest';

import { SourceEditingPlugin } from '../src/index.js';

describe('SourceEditingPlugin', () => {
    it('registers command-driven source and visual mode transitions', async () => {
        const editor = await Editor.create({ plugins: [SourceEditingPlugin] });

        expect(editor.commands.has('editor.source')).toBe(true);
        expect(editor.commands.has('editor.visual')).toBe(true);
        expect(editor.commands.isActive('editor.visual')).toBe(true);
        expect(editor.commands.canExecute('editor.visual')).toBe(false);

        editor.execute('editor.source');
        expect(editor.state.mode).toBe('source');
        expect(editor.commands.isActive('editor.source')).toBe(true);
        expect(editor.commands.canExecute('editor.source')).toBe(false);

        editor.execute('editor.visual');
        expect(editor.state.mode).toBe('visual');
    });

    it('rejects command arguments without changing mode', async () => {
        const editor = await Editor.create({ plugins: [SourceEditingPlugin] });

        expect(() => editor.execute('editor.source', 'unexpected')).toThrow(
            'does not accept arguments',
        );
        expect(editor.state.mode).toBe('visual');
    });

    it('does not offer HTML projection commands for Markdown documents', async () => {
        const editor = await Editor.create({
            format: 'markdown',
            plugins: [SourceEditingPlugin],
        });

        expect(editor.commands.canExecute('editor.source')).toBe(false);
        expect(editor.commands.canExecute('editor.visual')).toBe(false);
        expect(editor.state.mode).toBe('markdown');
    });

    it('requires coordinated targets to be attached before activation', async () => {
        const editor = await Editor.create({
            plugins: [ProjectionCoordinatorPlugin, SourceEditingPlugin],
        });
        const coordinator = editor.services.get(
            projectionCoordinatorServiceToken,
        );

        expect(editor.commands.canExecute('editor.source')).toBe(false);
        expect(editor.execute('editor.source')).toBeUndefined();
        expect(editor.state.mode).toBe('visual');

        coordinator.attach({ id: 'source', update: () => undefined });
        expect(editor.commands.canExecute('editor.source')).toBe(true);
        editor.execute('editor.source');
        expect(coordinator.snapshot.primary).toBe('source');
    });
});
