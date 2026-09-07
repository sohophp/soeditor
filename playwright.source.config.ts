import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests/browser',
    testMatch: 'classic-editor.spec.ts',
    grep: /loads Source|while Source loads|failed Source request|invalid Source drafts|auto-formats Source|synchronizes proportional scrolling|reuses one popup|Unicode word|external history/u,
    fullyParallel: false,
    projects: [
        { name: 'chromium', use: { browserName: 'chromium' } },
        { name: 'firefox', use: { browserName: 'firefox' } },
        { name: 'webkit', use: { browserName: 'webkit' } },
    ],
    use: { baseURL: 'http://127.0.0.1:4173', headless: true },
    webServer:
        process.env.SOEDITOR_EXTERNAL_TEST_SERVER === '1'
            ? undefined
            : {
                  command:
                      'node node_modules/vite/bin/vite.js apps/playground --host 127.0.0.1 --port 4173',
                  reuseExistingServer: false,
                  url: 'http://127.0.0.1:4173',
              },
});
