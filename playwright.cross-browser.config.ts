import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests/browser',
    testMatch: ['cms-multibrowser.spec.ts', 'wysiwyg-editor.spec.ts'],
    fullyParallel: false,
    projects: [
        { name: 'firefox', use: { browserName: 'firefox' } },
        { name: 'webkit', use: { browserName: 'webkit' } },
    ],
    use: {
        baseURL: 'http://127.0.0.1:4173',
        headless: true,
    },
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
