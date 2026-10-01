import { Editor } from '@soeditor/core';
import { describe, expect, it } from 'vitest';

import {
    createHtmlFormattingService,
    HtmlFormattingPlugin,
    HtmlFormattingSourceTooLargeError,
    htmlFormattingServiceToken,
    InvalidHtmlFormattingSourceError,
    StaleHtmlFormattingError,
} from '../src/index.js';

describe('HTML formatting', () => {
    it('formats complete documents without treating body text inside an attribute as document markup', async () => {
        const service = createHtmlFormattingService();
        const fragment =
            '<p title="literal <body> example">Keep &amp; retain</p>';
        expect(await service.format(fragment)).toContain(fragment);
        expect(await service.minify(fragment)).toBe(fragment);
        const document =
            '<!--CMS:page-->\n<!doctype html>\n<html lang="en"><head><title>A &amp; B</title></head><body><main><p>Content</p></main></body></html>';
        const formatted = await service.format(document);
        expect(formatted).toContain('<!doctype html>');
        expect(formatted).toContain('<title>A &amp; B</title>');
        expect(await service.minify(formatted)).toBe(
            '<!--CMS:page--><!doctype html><html lang="en"><head><title>A &amp; B</title></head><body><main><p>Content</p></main></body></html>',
        );
    });

    it('formats indentation without rewriting literal text, attribute quoting or embedded data', async () => {
        const service = createHtmlFormattingService();
        const paragraph =
            "<p title='A  B &amp; C' data-value='{{ item }}'>A  B&nbsp;&#32;C</p>";
        const script =
            '<script>const result=  "keep";\n// keep indentation\n</script>';
        const style = '<style>.cms { color:red; --value: "a  b"; }</style>';
        const pre = '<pre data-id=code>  x\n\ty  </pre>';
        const source = `<main>${paragraph}${script}${style}${pre}</main>`;
        const formatted = await service.format(source);
        expect(formatted).toContain('\n  <p');
        for (const preserved of [paragraph, script, style, pre])
            expect(formatted).toContain(preserved);
        expect(await service.format(formatted)).toBe(formatted);
    });

    it('minifies source indentation and tag spacing without reserializing attributes or entities', async () => {
        const service = createHtmlFormattingService();
        const source =
            "<DIV\n CLASS='a  b'\n data-id=one>\n  <P title='A &amp; B'>A&nbsp;  B <em> C </em></P>\n  <!--CMS:block\n  > marker-->\n  <pre>  x\n  y</pre>\n</DIV>";
        const expected =
            "<DIV CLASS='a  b' data-id=one><P title='A &amp; B'>A&nbsp;  B <em> C </em></P><!--CMS:block\n  > marker--><pre>  x\n  y</pre></DIV>";
        expect(await service.minify(source)).toBe(expected);
        expect(await service.minify(expected)).toBe(expected);
    });

    it('preserves authored whitespace rules, inline boundaries and encoded spaces in both operations', async () => {
        const service = createHtmlFormattingService();
        const literal =
            '<div style="white-space: pre-wrap">  A\n    <b>B</b>  C</div>';
        const inline =
            '<p><code> A\n B </code><span>C</span> <span>D</span>&#32;</p>';
        for (const operation of ['format', 'minify'] as const) {
            const result = await service[operation](
                `<main>${literal}${inline}</main>`,
            );
            expect(result).toContain(literal);
            expect(result).toContain(inline);
        }
    });

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
        expect(formatted).toContain('alpha < beta\n  > gamma');
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
            '<!doctype html><html lang="en"><head><title>Page</title></head><body><main><p>Text</p></main></body></html>',
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

it('formats and validates through the standalone service without installing editor plugins', async () => {
    const service = createHtmlFormattingService();
    expect(await service.format('<main><h1>Title</h1><p>CMS</p></main>')).toBe(
        '<main>\n  <h1>Title</h1>\n  <p>CMS</p>\n</main>\n',
    );
    expect(await service.minify('<div>\n  <p>CMS</p>\n</div>')).toContain(
        '<p>CMS</p>',
    );
    await expect(
        service.minify('<p id="a" id="b">Draft</p>'),
    ).rejects.toBeInstanceOf(InvalidHtmlFormattingSourceError);
});
