import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests/browser',
    fullyParallel: false,
    use: {
        baseURL: 'http://127.0.0.1:4173',
        browserName: 'chromium',
        headless: true,
    },
    webServer: {
        command:
            'pnpm --filter @soeditor/playground dev --host 127.0.0.1 --port 4173',
        reuseExistingServer: false,
        url: 'http://127.0.0.1:4173',
    },
});
