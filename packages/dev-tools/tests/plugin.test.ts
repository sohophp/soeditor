import { Editor } from '@soeditor/core';
import { sourceEditingServiceToken } from '@soeditor/source';
import { describe, expect, it } from 'vitest';

import {
    DeveloperToolsPlugin,
    developerToolsServiceToken,
} from '../src/index.js';

describe('DeveloperToolsPlugin', () => {
    it('registers developer commands through explicit dependencies', async () => {
        const editor = await Editor.create({ plugins: [DeveloperToolsPlugin] });

        expect(editor.commands.has('developer.find')).toBe(true);
        expect(editor.commands.get('developer.find').label).toBe(
            'Find/Replace in HTML source',
        );
        expect(editor.commands.canExecute('developer.find')).toBe(false);
        expect(editor.commands.has('developer.reveal')).toBe(true);
        expect(editor.plugins.has('editor-ui')).toBe(true);
        expect(editor.plugins.has('html-diagnostics')).toBe(true);
        expect(editor.plugins.has('source-editing')).toBe(true);
        await editor.destroy();
    });

    it('rejects malformed find and reveal arguments before mutation', async () => {
        const editor = await Editor.create({ plugins: [DeveloperToolsPlugin] });
        editor.services.register(sourceEditingServiceToken, {
            focus: () => undefined,
            getDiagnostics: () => [],
            openSearchPanel: () => undefined,
            reveal: () => undefined,
        });
        editor.services.register(developerToolsServiceToken, {
            getInspector: () => undefined,
            getOutline: () => [],
            getProblems: () => [],
            reveal: () => undefined,
        });

        expect(() => editor.execute('developer.find', 3)).toThrow(
            'accepts one string query',
        );
        expect(() => editor.execute('developer.reveal', {})).toThrow(
            'requires one source range',
        );
        expect(editor.state.mode).toBe('visual');
        await editor.destroy();
    });

    it('rejects installation on a Markdown document', async () => {
        await expect(
            Editor.create({
                format: 'markdown',
                plugins: [DeveloperToolsPlugin],
            }),
        ).rejects.toThrow('do not support "markdown" documents');
    });
});
