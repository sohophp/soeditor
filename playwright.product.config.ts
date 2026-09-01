import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests/browser',
    testMatch: [
        'classic-editor.spec.ts',
        'cms-multibrowser.spec.ts',
        'distribution.spec.ts',
        'file-manager.spec.ts',
        'qualification.spec.ts',
        'table.spec.ts',
        'wysiwyg-editor.spec.ts',
    ],
    grepInvert:
        /whole-document HTML formatting|formats large source|validates large formatting|formats the CMS showcase|live custom-template preview|opt into Developer Visual/u,
    fullyParallel: true,
    projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
    use: {
        baseURL: 'http://127.0.0.1:4173',
        headless: true,
    },
    webServer: {
        command:
            'pnpm --filter @soeditor/playground dev --host 127.0.0.1 --port 4173',
        reuseExistingServer: false,
        url: 'http://127.0.0.1:4173',
    },
});
