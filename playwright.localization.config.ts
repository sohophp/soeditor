import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests/browser',
    testMatch: 'localization.spec.ts',
    fullyParallel: false,
    projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
    use: { baseURL: 'http://127.0.0.1:4173', headless: true },
    webServer: {
        command:
            'node node_modules/vite/bin/vite.js apps/playground --host 127.0.0.1 --port 4173',
        reuseExistingServer: false,
        url: 'http://127.0.0.1:4173',
    },
});
