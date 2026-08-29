import { Editor } from '@soeditor/core';
import { describe, expect, it } from 'vitest';

import {
    HtmlFormattingPlugin,
    htmlFormattingServiceToken,
    InvalidHtmlFormattingSourceError,
    StaleHtmlFormattingError,
} from '../src/index.js';

describe('HTML formatting', () => {
    it('formats canonical HTML through an asynchronous command transaction', async () => {
        const editor = await Editor.create({
            data: '<main><h1>Title</h1><p>Text</p></main>',
            plugins: [HtmlFormattingPlugin],
        });

        const formatted = await editor.execute('document.format', {
            htmlWhitespaceSensitivity: 'css',
            printWidth: 80,
            tabWidth: 2,
        });
        expect(formatted).toBe(
            '<main>\n  <h1>Title</h1>\n  <p>Text</p>\n</main>\n',
        );
        expect(editor.getData()).toBe(formatted);
        expect(editor.state.document.revision).toBe(1);
    });

    it('preserves custom elements, comments, templates, and unsafe source data', async () => {
        const editor = await Editor.create({
            data: '<!--CMS:block--><product-card data-id="1"></product-card><template><custom-element></custom-element></template><p onclick="alert(1)">Text</p>',
            plugins: [HtmlFormattingPlugin],
        });

        await editor.execute('document.format');
        expect(editor.getData()).toContain('<!--CMS:block-->');
        expect(editor.getData()).toContain('<product-card data-id="1"');
        expect(editor.getData()).toContain('<custom-element></custom-element>');
        expect(editor.getData()).toContain('onclick="alert(1)"');
    });

    it('refuses parser-invalid source without mutation', async () => {
        const source = '<p id="first" id="duplicate">Text</p>';
        const editor = await Editor.create({
            data: source,
            plugins: [HtmlFormattingPlugin],
        });

        await expect(editor.execute('document.format')).rejects.toBeInstanceOf(
            InvalidHtmlFormattingSourceError,
        );
        expect(editor.getData()).toBe(source);
        expect(editor.state.document.revision).toBe(0);
    });

    it('does not overwrite a newer source change after asynchronous validation', async () => {
        const editor = await Editor.create({
            data: '<p>Old</p>',
            plugins: [HtmlFormattingPlugin],
        });

        const formatting = editor.execute('document.format');
        editor.setData('<p>Newer</p>');

        await expect(formatting).rejects.toBeInstanceOf(
            StaleHtmlFormattingError,
        );
        expect(editor.getData()).toBe('<p>Newer</p>');
    });

    it('does not create a transaction when source is already formatted', async () => {
        const source = '<p>Ready</p>\n';
        const editor = await Editor.create({
            data: source,
            plugins: [HtmlFormattingPlugin],
        });

        expect(await editor.execute('document.format')).toBe(source);
        expect(editor.state.document.revision).toBe(0);
    });

    it('validates the narrow public option surface', async () => {
        const editor = await Editor.create({
            data: '<p>Text</p>',
            plugins: [HtmlFormattingPlugin],
        });

        await expect(
            editor.execute('document.format', { printWidth: 10 }),
        ).rejects.toThrow('printWidth');
        await expect(
            editor.execute('document.format', { unknown: true }),
        ).rejects.toThrow('does not support option');
        await expect(
            editor.execute('document.format', {
                htmlWhitespaceSensitivity: 'unsafe',
            }),
        ).rejects.toThrow('htmlWhitespaceSensitivity');
        expect(editor.getData()).toBe('<p>Text</p>');
    });

    it('exposes formatting without leaking formatter-specific options', async () => {
        const editor = await Editor.create({ plugins: [HtmlFormattingPlugin] });
        const service = editor.services.get(htmlFormattingServiceToken);

        expect(await service.format('<div><span>X</span></div>')).toContain(
            '<span>X</span>',
        );
    });

    it('makes a retained formatting service terminal after destruction', async () => {
        const editor = await Editor.create({ plugins: [HtmlFormattingPlugin] });
        const service = editor.services.get(htmlFormattingServiceToken);

        await editor.destroy();
        await expect(service.format('<p>Late</p>')).rejects.toThrow(
            'destroyed',
        );
    });
});
