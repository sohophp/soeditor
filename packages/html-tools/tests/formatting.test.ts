import { Editor } from '@soeditor/core';
import { describe, expect, it } from 'vitest';

import {
    HtmlFormattingPlugin,
    HtmlFormattingSourceTooLargeError,
    htmlFormattingServiceToken,
    InvalidHtmlFormattingSourceError,
    StaleHtmlFormattingError,
} from '../src/index.js';

describe('HTML formatting', () => {
    it('formats canonical HTML through an asynchronous command transaction', async () => {
        const editor = await Editor.create({
            data: '<main><h1>Title</h1><p>Text</p></main>',
            mode: 'source',
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

    it('keeps inline tag closing brackets off separate source lines without changing text whitespace', async () => {
        const editor = await Editor.create({
            data: '<p><span class="cms-lead">这是一段 <strong>CMS 语义</strong><strong>式控制的</strong><strong>导语</strong>。 </span><u><em><strong> 编辑者可以使用熟</strong></em></u>悉的工具栏，同时保留开发者需要的 <strong>HTML</strong> 自由。</p>',
            mode: 'source',
            plugins: [HtmlFormattingPlugin],
        });

        const formatted = String(
            await editor.execute('document.format', { printWidth: 80 }),
        );

        expect(formatted).not.toMatch(/\r?\n[ \t]*>/u);
        expect(formatted).toContain(
            '<span class="cms-lead">这是一段 <strong>CMS 语义</strong><strong>式控制的</strong><strong>导语</strong>。 </span><u><em><strong> 编辑者可以使用熟</strong></em></u>悉的工具栏',
        );
    });

    it('does not join a literal greater-than text line to the preceding tag', async () => {
        const editor = await Editor.create({
            data: '<p>\n&gt;\n</p>',
            mode: 'source',
            plugins: [HtmlFormattingPlugin],
        });

        const formatted = String(await editor.execute('document.format'));

        expect(formatted).toContain('&gt;');
        expect(formatted).not.toContain('<p>>');
    });

    it('does not rewrite greater-than lines inside comments or raw script text', async () => {
        const editor = await Editor.create({
            data: '<!-- CMS <marker\n  > retained --><script>const result = alpha < beta\n  > gamma;</script>',
            mode: 'source',
            plugins: [HtmlFormattingPlugin],
        });

        const formatted = String(
            await editor.execute('document.format', { printWidth: 40 }),
        );

        expect(formatted).toContain('<!-- CMS <marker\n  > retained -->');
        expect(formatted).toContain('alpha < beta\n    > gamma');
    });

    it('preserves custom elements, comments, templates, and unsafe source data', async () => {
        const editor = await Editor.create({
            data: '<!--CMS:block--><product-card data-id="1"></product-card><template><custom-element></custom-element></template><p onclick="alert(1)">Text</p>',
            mode: 'source',
            plugins: [HtmlFormattingPlugin],
        });

        await editor.execute('document.format');
        expect(editor.getData()).toContain('<!--CMS:block-->');
        expect(editor.getData()).toContain('<product-card data-id="1"');
        expect(editor.getData()).toContain('<custom-element></custom-element>');
        expect(editor.getData()).toContain('onclick="alert(1)"');
    });

    it('minifies block indentation while preserving inline and preformatted whitespace', async () => {
        const editor = await Editor.create({
            data: '<main>\n  <h1>Title</h1>\n  <p><span>A</span> <span>B</span></p>\n  <pre>  keep\n  this  </pre>\n</main>\n',
            mode: 'source',
            plugins: [HtmlFormattingPlugin],
        });

        const minified = await editor.execute('document.minify');

        expect(minified).toBe(
            '<main><h1>Title</h1><p><span>A</span> <span>B</span></p><pre>  keep\n  this  </pre></main>',
        );
        expect(editor.getData()).toBe(minified);
        expect(editor.state.document.revision).toBe(1);
    });

    it('minifies without deleting comments, custom elements, or unsafe attributes', async () => {
        const editor = await Editor.create({
            data: '<main>\n<!--CMS:block-->\n<product-card data-id="1"></product-card>\n<p onclick="alert(1)">Text</p>\n</main>',
            mode: 'source',
            plugins: [HtmlFormattingPlugin],
        });

        await editor.execute('document.minify');

        expect(editor.getData()).toContain('<!--CMS:block-->');
        expect(editor.getData()).toContain(
            '<product-card data-id="1"></product-card>',
        );
        expect(editor.getData()).toContain('onclick="alert(1)"');
    });

    it('retains complete-document structure while minifying', async () => {
        const source =
            '<!doctype html>\n<html lang="en">\n  <head><title>Page</title></head>\n  <body>\n    <main><p>Text</p></main>\n  </body>\n</html>';
        const editor = await Editor.create({
            data: source,
            mode: 'source',
            plugins: [HtmlFormattingPlugin],
        });

        const minified = await editor.execute('document.minify');

        expect(minified).toBe(
            '<!DOCTYPE html><html lang="en"><head><title>Page</title></head><body><main><p>Text</p></main></body></html>',
        );
    });

    it('refuses parser-invalid source without mutation', async () => {
        const source = '<p id="first" id="duplicate">Text</p>';
        const editor = await Editor.create({
            data: source,
            mode: 'source',
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
            mode: 'source',
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
            mode: 'source',
            plugins: [HtmlFormattingPlugin],
        });

        expect(await editor.execute('document.format')).toBe(source);
        expect(editor.state.document.revision).toBe(0);
    });

    it('validates the narrow public option surface', async () => {
        const editor = await Editor.create({
            data: '<p>Text</p>',
            mode: 'source',
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
        expect(
            await service.minify('<main>\n<h1>X</h1>\n<p>Y</p>\n</main>'),
        ).toBe('<main><h1>X</h1><p>Y</p></main>');
    });

    it('makes a retained formatting service terminal after destruction', async () => {
        const editor = await Editor.create({ plugins: [HtmlFormattingPlugin] });
        const service = editor.services.get(htmlFormattingServiceToken);

        await editor.destroy();
        await expect(service.format('<p>Late</p>')).rejects.toThrow(
            'destroyed',
        );
    });

    it('rejects oversized source before invoking the formatter', async () => {
        const editor = await Editor.create({ plugins: [HtmlFormattingPlugin] });
        const service = editor.services.get(htmlFormattingServiceToken);

        await expect(
            service.format('x'.repeat(2 * 1024 * 1024 + 1)),
        ).rejects.toBeInstanceOf(HtmlFormattingSourceTooLargeError);
        await editor.destroy();
    });
});
