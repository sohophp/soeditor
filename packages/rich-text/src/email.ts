import { Plugin } from '@soeditor/core';

import { cleanupHtml, HtmlCleanupPlugin } from './paste.js';

export type EmailPreviewClient = 'apple-mail' | 'gmail-web' | 'outlook-web';

export interface EmailContentIssue {
    readonly code: string;
    readonly message: string;
    readonly severity: 'error' | 'warning';
}

export interface EmailContentAnalysis {
    readonly issues: readonly EmailContentIssue[];
    readonly optimizedSource: string;
}

/** Sandboxed preview templates approximating common email reading surfaces. */
export const emailPreviewTemplates: Readonly<
    Record<EmailPreviewClient, string>
> = Object.freeze({
    'apple-mail':
        '<!doctype html><html><head><meta charset="utf-8"><style>body{background:#fff;color:#111;font:15px/1.45 -apple-system,BlinkMacSystemFont,sans-serif;margin:0;padding:28px}.mail{margin:auto;max-width:720px}</style></head><body><main class="mail">{{ content }}</main></body></html>',
    'gmail-web':
        '<!doctype html><html><head><meta charset="utf-8"><style>body{background:#f6f8fc;color:#202124;font:14px/1.5 Arial,sans-serif;margin:0;padding:24px}.mail{background:#fff;border-radius:12px;margin:auto;max-width:680px;padding:24px}</style></head><body><main class="mail">{{ content }}</main></body></html>',
    'outlook-web':
        '<!doctype html><html><head><meta charset="utf-8"><style>body{background:#f3f2f1;color:#242424;font:14px/1.45 Arial,sans-serif;margin:0;padding:24px}.mail{background:#fff;border:1px solid #ddd;margin:auto;max-width:680px;padding:24px}</style></head><body><main class="mail">{{ content }}</main></body></html>',
});

/** Email diagnostics and one-command conservative source optimization. */
export class EmailContentPlugin extends Plugin {
    static readonly id = 'email-content';
    static readonly requires = [HtmlCleanupPlugin];

    override init(): void {
        this.editor.commands.register({
            id: 'email.analyze',
            label: 'Analyze email HTML',
            canExecute: ({ editor }) => editor.state.document.format === 'html',
            execute: ({ editor }) => analyzeEmailContent(editor.getData()),
        });
        this.editor.commands.register({
            id: 'email.optimize',
            label: 'Optimize email HTML',
            canExecute: ({ editor }) =>
                editor.state.document.format === 'html' &&
                !editor.state.readonly,
            execute: ({ editor }) => {
                const analysis = analyzeEmailContent(editor.getData());
                if (analysis.optimizedSource !== editor.getData()) {
                    editor.update(
                        (transaction) =>
                            transaction
                                .replaceDocument(analysis.optimizedSource)
                                .setMeta('email.optimized', true),
                        { origin: 'command' },
                    );
                }
                return analysis;
            },
        });
    }
}

export function analyzeEmailContent(source: string): EmailContentAnalysis {
    const issues: EmailContentIssue[] = [];
    const add = (
        code: string,
        message: string,
        severity: EmailContentIssue['severity'] = 'warning',
    ): void => {
        issues.push(Object.freeze({ code, message, severity }));
    };
    if (/<(?:script|iframe|form|input|button)\b/iu.test(source)) {
        add(
            'email.executable-or-form',
            'Scripts, iframes, and form controls are unreliable or unsafe in email.',
            'error',
        );
    }
    if (/<video\b/iu.test(source)) {
        add(
            'email.video',
            'Video support varies; provide a linked poster fallback.',
        );
    }
    if (/<link\b[^>]*rel=["']?stylesheet/iu.test(source)) {
        add(
            'email.external-css',
            'External stylesheets are commonly removed by email clients.',
        );
    }
    if (/<img\b(?![^>]*\balt=)[^>]*>/giu.test(source)) {
        add('email.image-alt', 'Every email image should include alt text.');
    }
    if (/<style\b/iu.test(source)) {
        add(
            'email.embedded-css',
            'Inline critical CSS for broader email client compatibility.',
        );
    }
    const optimizedSource = cleanupHtml(source, 'balanced')
        .replace(/<video\b[^>]*>[\s\S]*?<\/video\s*>/giu, '')
        .replace(/<video\b[^>]*\/?>/giu, '');
    return Object.freeze({
        issues: Object.freeze(issues),
        optimizedSource,
    });
}
