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

    it('rejects file and complete-document inputs for later host-owned handling', () => {
        expect(() =>
            processCmsPaste({
                ...context('', 'files', 'semantic'),
                files: [{ name: 'image.png', size: 100, type: 'image/png' }],
            }),
        ).toThrow(/UploadService/u);
        expect(() =>
            processCmsPaste(
                context(
                    '<!doctype html><html><body>x</body></html>',
                    'web',
                    'semantic',
                ),
            ),
        ).toThrow(/Complete HTML/u);
    });

    it('previews and applies undoable strict, balanced, and trusted cleanup', async () => {
        const source =
            '<custom-card data-id="7"><p style="color:red" onclick="run()">Safe</p><script>run()</script></custom-card>';
        expect(cleanupHtml(source, 'trusted')).toBe(source);
        expect(cleanupHtml(source, 'strict')).toBe('<p>Safe</p>');
        expect(cleanupHtml(source, 'balanced')).toContain(
            '<custom-card data-id="7"><p style="color: red;">Safe</p></custom-card>',
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
