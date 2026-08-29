import { Editor } from '@soeditor/core';
import { describe, expect, it } from 'vitest';

import { MarkdownPlugin } from '../src/index.js';

describe('MarkdownPlugin', () => {
    it('registers a format-scoped Markdown mode command', async () => {
        const markdown = await Editor.create({
            data: '# Heading',
            format: 'markdown',
            mode: 'preview',
            plugins: [MarkdownPlugin],
        });
        const html = await Editor.create({ plugins: [MarkdownPlugin] });

        expect(markdown.commands.canExecute('editor.markdown')).toBe(true);
        markdown.execute('editor.markdown');
        expect(markdown.state.mode).toBe('markdown');
        expect(markdown.commands.isActive('editor.markdown')).toBe(true);
        expect(html.commands.canExecute('editor.markdown')).toBe(false);

        await markdown.destroy();
        await html.destroy();
    });

    it('rejects command arguments without changing state', async () => {
        const editor = await Editor.create({
            format: 'markdown',
            mode: 'preview',
            plugins: [MarkdownPlugin],
        });

        expect(() => editor.execute('editor.markdown', 'unexpected')).toThrow(
            'does not accept arguments',
        );
        expect(editor.state.mode).toBe('preview');
        await editor.destroy();
    });
});
