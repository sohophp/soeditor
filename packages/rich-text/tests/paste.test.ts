import { readFile } from 'node:fs/promises';

import { Editor } from '@soeditor/core';
import type {
    PasteInputClassification,
    PasteProcessorContext,
} from '@soeditor/engine';
import { describe, expect, it } from 'vitest';

import {
    cleanupHtml,
    HtmlCleanupPlugin,
    processCmsPaste,
} from '../src/paste.js';

describe('CMS external paste cleanup', () => {
    it('can clean all external presentation styles while retaining table and text semantics', () => {
        const html =
            '<h4 class="lead" style="color:red">Title</h4><table style="width:100%"><tbody><tr><td style="padding:8px;text-align:left"><b>Cell</b></td><td style="text-align:right">Other</td></tr></tbody></table>';
        expect(
            processCmsPaste(context(html, 'web', 'semantic'), false, false)
                ?.html,
        ).toBe(
            '<h4>Title</h4><table><tbody><tr><td><strong>Cell</strong></td><td>Other</td></tr></tbody></table>',
        );
        expect(
            processCmsPaste(context(html, 'web', 'preserve'), false, false)
                ?.html,
        ).toBe(html);
    });
    it('preserves table attributes, arbitrary safe CSS, class spacing and inline markup', () => {
        const html =
            '<table class="cms  mso-table" style="width:100%; border-collapse:collapse"><tbody><tr><td data-value="1" style="padding: 8px; text-align:left"><b>A  B</b><!--cell--></td><td>Plain</td></tr></tbody></table>';
        expect(processCmsPaste(context(html, 'web', 'preserve'))?.html).toBe(
            html,
        );
        expect(
            processCmsPaste(
                context(
                    '<table><tbody><tr><td>Plain</td></tr></tbody></table>',
                    'web',
                    'preserve',
                ),
            )?.html,
        ).not.toContain('text-align');
    });
    it('does not collapse copied code whitespace inside nested inline wrappers', () => {
        const html = '<pre><span>A  \n    B</span></pre>';
        expect(processCmsPaste(context(html, 'web', 'semantic'))?.html).toBe(
            '<pre>A  \n    B</pre>',
        );
    });

    it('keeps a start alignment that overrides an explicitly aligned parent', () => {
        const html =
            '<div style="text-align: center;"><p style="text-align: start;">Left aligned inside center</p></div>';
        expect(
            processCmsPaste(context(html, 'web', 'semantic'))?.html,
        ).toContain('<p style="text-align: start;">');
    });

    it('does not retain the native clipboard default start alignment during automatic cleanup', () => {
        const html =
            '<h4 style="text-align: start;">OLED Structure - H4 25PX</h4><p style="text-align: START;">When a voltage is applied.</p><p style="text-align: center;">Centered</p><br />';
        const result = processCmsPaste(context(html, 'web', 'semantic'));
        expect(result?.html).toBe(
            '<h4>OLED Structure - H4 25PX</h4><p>When a voltage is applied.</p><p style="text-align: center;">Centered</p><br />',
        );
        expect(
            processCmsPaste(context(html, 'web', 'preserve'))?.html,
        ).toContain('text-align: start;');
        expect(
            processCmsPaste(context(html, 'web', 'semantic'), true)?.html,
        ).toContain('text-align: start;');
    });

    it('keeps original tags and whitespace when preservation is explicitly selected', () => {
        const html =
            '<div class="cms"><b>Bold</b> <i>Italic</i><!--CMS:block--></div>';
        expect(processCmsPaste(context(html, 'web', 'preserve'))?.html).toBe(
            html,
        );
    });

    it.each([
        [
            'word',
            'office',
            '<h1>Office title</h1><p><strong>Bold</strong> <a href="https://example.test">link</a></p><ol start="2"><li>First</li><li>Second</li></ol><table><tbody><tr><th>Head</th><td>Value</td></tr></tbody></table>',
        ],
        [
            'excel',
            'office',
            '<table><tbody><tr><td>1</td><td>Two</td></tr></tbody></table>',
        ],
        [
            'google-docs',
            'google-docs',
            '<strong>Google bold</strong><ul><li>Item</li></ul>',
        ],
        ['libreoffice', 'libreoffice', '<p><em>LibreOffice text</em></p>'],
    ] as const)(
        'normalizes the %s fixture deterministically',
        async (fixture, classification, expected) => {
            const html = await readFixture(fixture);
            const result = processCmsPaste(
                context(html, classification, 'semantic'),
            );
            expect(compact(result?.html ?? '')).toBe(expected);
        },
    );

    it('strips executable input and unsafe URLs under semantic and preserve policies', async () => {
        const html = await readFixture('web-malicious');
        const semantic = processCmsPaste(context(html, 'web', 'semantic'));
        const preserve = processCmsPaste(context(html, 'web', 'preserve'));

        for (const result of [semantic, preserve]) {
            expect(result?.html).not.toMatch(
                /(?:<script|onclick|onerror|javascript:)/iu,
            );
        }
        expect(compact(semantic?.html ?? '')).toBe(
            '<p>Safe <a>label</a><img src="x"></p>Custom',
        );
        expect(preserve?.html).toContain(
            '<custom-card data-id="7">Custom</custom-card>',
        );
    });

    it('supports bounded style retention and explicit plain-text loss', async () => {
        const word = await readFixture('word');
        const retained = processCmsPaste(
            context(word, 'office', 'semantic'),
            true,
        );
        expect(retained?.html).toContain('style="color: #123456;"');
        expect(retained?.html).not.toContain('mso-style-name');

        expect(
            processCmsPaste({
                ...context('<p><strong>Rich</strong></p>', 'web', 'plain-text'),
                text: 'Rich',
            }),
        ).toEqual({ html: '', policy: 'plain-text', text: 'Rich' });
    });

    it('rejects file input and malformed clipboard fragment markers', () => {
        expect(() =>
            processCmsPaste({
                ...context('', 'files', 'semantic'),
                files: [{ name: 'image.png', size: 100, type: 'image/png' }],
            }),
        ).toThrow(/UploadService/u);
        expect(() =>
            processCmsPaste(
                context(
                    '<html><body><!--StartFragment--><p>x</p></body></html>',
                    'web',
                    'semantic',
                ),
            ),
        ).toThrow(/fragment markers/u);
    });

    it('pastes only the selected fragment from a wrapped web clipboard', () => {
        const html =
            'Version:0.9\r\nStartHTML:0000000179\r\nEndHTML:0000021573\r\n' +
            'StartFragment:0000000215\r\nEndFragment:0000021537\r\n' +
            'SourceURL:https://example.test/article\r\n' +
            '<html><head><title>Not selected</title></head><body>' +
            '<p>Before selection</p><!--StartFragment-->' +
            '<h2>What is OLED?</h2><p onclick="run()">Article</p>' +
            '<table><tbody><tr><td>OLED</td></tr></tbody></table>' +
            '<!--EndFragment--><p>After selection</p></body></html>';
        const result = processCmsPaste(context(html, 'web', 'semantic'));
        expect(compact(result?.html ?? '')).toBe(
            '<h2>What is OLED?</h2><p>Article</p>' +
                '<table><tbody><tr><td>OLED</td></tr></tbody></table>',
        );
    });

    it('uses the body when full-document clipboard HTML has no fragment markers', () => {
        const result = processCmsPaste(
            context(
                '<!doctype html><html><head><title>Not selected</title><script>run()</script></head><body><h2>Article</h2><p>Text</p></body></html>',
                'web',
                'semantic',
            ),
        );
        expect(result?.html).toBe('<h2>Article</h2><p>Text</p>');
    });

    it('preserves safe external table structure and accessibility semantics', () => {
        const source =
            '<table aria-label="Results"><caption>Quarter</caption><colgroup><col width="240px"><col span="2"></colgroup><thead><tr><th scope="col">Name</th></tr></thead><tbody><tr><td rowspan="2">A</td></tr></tbody><tfoot><tr><td>Total</td></tr></tfoot></table>';
        const result = processCmsPaste(context(source, 'office', 'semantic'));
        expect(compact(result?.html ?? '')).toBe(source);
    });

    it('previews and applies undoable strict, balanced, and trusted cleanup', async () => {
        const source =
            '<custom-card data-id="7"><p style="color:red" onclick="run()">Safe</p><script>run()</script></custom-card>';
        expect(cleanupHtml(source, 'trusted')).toBe(source);
        expect(cleanupHtml(source, 'strict')).toBe('<p>Safe</p>');
        expect(cleanupHtml(source, 'balanced')).toContain(
            '<custom-card data-id="7"><p style="color:red">Safe</p></custom-card>',
        );

        const editor = await Editor.create({
            data: source,
            plugins: [HtmlCleanupPlugin],
        });
        const inspected = editor.execute('html.cleanup.inspect', 'strict');
        expect(inspected).toMatchObject({ changed: true, profile: 'strict' });
        editor.execute('html.cleanup', 'strict');
        expect(editor.getData()).toBe('<p>Safe</p>');
        await editor.destroy();
    });
});

function context(
    html: string,
    classification: PasteInputClassification,
    policy: PasteProcessorContext['policy'],
): PasteProcessorContext {
    return {
        classification,
        consumed: false,
        files: [],
        html,
        policy,
        source: 'paste',
        text: '',
        types: html.length === 0 ? ['text/plain'] : ['text/html', 'text/plain'],
    };
}

async function readFixture(name: string): Promise<string> {
    return readFile(
        new URL(`./fixtures/paste/${name}.html`, import.meta.url),
        'utf8',
    );
}

function compact(value: string): string {
    return value.replaceAll('\n', '').trim();
}
