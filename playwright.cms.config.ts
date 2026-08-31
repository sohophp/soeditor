import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests/browser',
    testMatch: 'cms-multibrowser.spec.ts',
    fullyParallel: false,
    projects: [
        { name: 'chromium', use: { browserName: 'chromium' } },
        { name: 'firefox', use: { browserName: 'firefox' } },
        { name: 'webkit', use: { browserName: 'webkit' } },
        {
            name: 'chromium-mobile',
            use: {
                browserName: 'chromium',
                hasTouch: true,
                isMobile: true,
                viewport: { height: 844, width: 390 },
            },
        },
    ],
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
