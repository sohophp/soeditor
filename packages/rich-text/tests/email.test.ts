import { Editor } from '@soeditor/core';
import { describe, expect, it } from 'vitest';

import {
    analyzeEmailContent,
    EmailContentPlugin,
    emailPreviewTemplates,
} from '../src/email.js';

describe('email content mode', () => {
    it('reports compatibility issues and applies conservative optimization', async () => {
        const source =
            '<style>p{color:red}</style><p onclick="run()">Mail<img src="/x.png"></p><video src="/x.mp4"></video><script>run()</script>';
        const analysis = analyzeEmailContent(source);
        expect(analysis.issues.map((issue) => issue.code)).toEqual(
            expect.arrayContaining([
                'email.embedded-css',
                'email.executable-or-form',
                'email.image-alt',
                'email.video',
            ]),
        );
        expect(analysis.optimizedSource).not.toMatch(
            /(?:onclick|script|video)/iu,
        );

        const editor = await Editor.create({
            data: source,
            plugins: [EmailContentPlugin],
        });
        editor.execute('email.optimize');
        expect(editor.getData()).toBe(analysis.optimizedSource);
        await editor.destroy();
        expect(emailPreviewTemplates['gmail-web']).toContain('{{ content }}');
    });
});
