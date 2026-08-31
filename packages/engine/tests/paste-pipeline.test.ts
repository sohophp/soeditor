import { Editor } from '@soeditor/core';

import {
    classifyPasteInput,
    PastePipelinePlugin,
    PasteRejectedError,
    pastePipelineServiceToken,
    SOEDITOR_CLIPBOARD_MIME,
    type PastePipelineInput,
} from '../src/paste-pipeline.js';

describe('paste pipeline', () => {
    it('classifies internal, Office-family, web, text, and file inputs', () => {
        expect(classifyPasteInput(input({ internalHtml: '<p>x</p>' }))).toBe(
            'internal',
        );
        expect(
            classifyPasteInput(input({ types: [SOEDITOR_CLIPBOARD_MIME] })),
        ).toBe('cross-editor');
        expect(
            classifyPasteInput(input({ html: '<p style="mso-x:1">x</p>' })),
        ).toBe('office');
        expect(
            classifyPasteInput(
                input({ html: '<b id="docs-internal-guid-x">x</b>' }),
            ),
        ).toBe('google-docs');
        expect(classifyPasteInput(input({ html: '<p>LibreOffice</p>' }))).toBe(
            'libreoffice',
        );
        expect(classifyPasteInput(input({ html: '<p>Web</p>' }))).toBe('web');
        expect(classifyPasteInput(input())).toBe('plain-text');
        expect(
            classifyPasteInput(
                input({
                    files: [{ name: 'x.png', size: 1, type: 'image/png' }],
                }),
            ),
        ).toBe('files');
    });

    it('runs ordered processors and keeps internal source authoritative', async () => {
        const editor = await Editor.create({ plugins: [PastePipelinePlugin] });
        const service = editor.services.get(pastePipelineServiceToken);
        const calls: string[] = [];
        service.register({
            id: 'late',
            process: (context) => {
                calls.push('late');
                return { html: `${context.html}<p>late</p>` };
            },
        });
        service.register({
            id: 'early',
            priority: 10,
            process: (context) => {
                calls.push('early');
                return { html: `${context.html}<p>early</p>` };
            },
        });

        expect(service.process(input({ html: '<p>x</p>' })).html).toBe(
            '<p>x</p><p>early</p><p>late</p>',
        );
        expect(calls).toEqual(['early', 'late']);
        expect(
            service.process(
                input({
                    html: '<p>external</p>',
                    internalHtml: '<p>internal</p>',
                }),
            ).html,
        ).toBe('<p>internal</p>');
        await editor.destroy();
        expect(() => service.process(input())).toThrow(/destroyed/u);
    });

    it('applies independent automatic policies for Office and web input', async () => {
        const editor = await Editor.create({
            config: {
                cms: {
                    paste: {
                        officePolicy: 'plain-text',
                        policy: 'semantic',
                        webPolicy: 'preserve',
                    },
                },
            },
            plugins: [PastePipelinePlugin],
        });
        const service = editor.services.get(pastePipelineServiceToken);

        expect(
            service.process(input({ html: '<p style="mso-x:1">Word</p>' }))
                .policy,
        ).toBe('plain-text');
        expect(service.process(input({ html: '<p>Web</p>' })).policy).toBe(
            'preserve',
        );
        await editor.destroy();
    });

    it('reports bounded rejection and processor failure without partial output', async () => {
        const editor = await Editor.create({
            config: { cms: { paste: { maxInputCharacters: 8 } } },
            plugins: [PastePipelinePlugin],
        });
        const service = editor.services.get(pastePipelineServiceToken);
        const diagnostics: string[] = [];
        service.subscribe((diagnostic) => diagnostics.push(diagnostic.code));
        expect(() => service.process(input({ html: '<p>large</p>' }))).toThrow(
            PasteRejectedError,
        );
        expect(diagnostics).toEqual(['input-too-large']);
        await editor.destroy();

        const failing = await Editor.create({ plugins: [PastePipelinePlugin] });
        const failingService = failing.services.get(pastePipelineServiceToken);
        failingService.register({
            id: 'failure',
            process: () => {
                throw new Error('broken');
            },
        });
        expect(() =>
            failingService.process(input({ html: '<p>x</p>' })),
        ).toThrow(/processor "failure" failed/u);
    });

    it('stops after a processor consumes asynchronous file input', async () => {
        const editor = await Editor.create({ plugins: [PastePipelinePlugin] });
        const service = editor.services.get(pastePipelineServiceToken);
        let fallbackCalled = false;
        service.register({
            id: 'upload',
            priority: 10,
            process: () => ({ consumed: true, html: '', text: '' }),
        });
        service.register({
            id: 'fallback',
            process: () => {
                fallbackCalled = true;
                return undefined;
            },
        });

        expect(
            service.process(
                input({
                    files: [{ name: 'x.png', size: 1, type: 'image/png' }],
                }),
            ).consumed,
        ).toBe(true);
        expect(fallbackCalled).toBe(false);
        await editor.destroy();
    });
});

function input(
    overrides: Partial<PastePipelineInput> = {},
): PastePipelineInput {
    return {
        files: [],
        html: '',
        source: 'paste',
        text: '',
        types: [],
        ...overrides,
    };
}
