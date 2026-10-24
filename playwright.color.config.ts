import { defineConfig, devices } from '@playwright/test';

/** Focused qualification for the lazy CMS color menus. */
export default defineConfig({
    testDir: './tests/browser',
    testMatch: ['classic-editor.spec.ts', 'distribution.spec.ts'],
    grep: /spectrum|typed and picked colors|declared Classic toolbar/u,
    workers: 2,
    projects: [
        { name: 'chromium', use: { browserName: 'chromium' } },
        { name: 'firefox', use: { browserName: 'firefox' } },
        { name: 'webkit', use: { browserName: 'webkit' } },
        { name: 'chromium-touch', use: { ...devices['Pixel 7'] } },
    ],
    use: { baseURL: 'http://127.0.0.1:4173', headless: true },
    webServer: {
        command:
            'pnpm --filter @soeditor/playground dev --host 127.0.0.1 --port 4173',
        reuseExistingServer: false,
        url: 'http://127.0.0.1:4173',
    },
});
