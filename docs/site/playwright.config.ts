import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
    testDir: './tests',
    timeout: 45000,
    fullyParallel: true,
    workers: 2,
    retries: 0,
    reporter: [
        ['list'],
        ['json', { outputFile: '.vitepress/reports/browser.json' }],
    ],
    use: { baseURL: 'http://127.0.0.1:4175', trace: 'retain-on-failure' },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
        { name: 'webkit', use: { ...devices['Desktop Safari'] } },
        {
            name: 'mobile',
            use: {
                ...devices['Pixel 5'],
                viewport: { width: 360, height: 800 },
            },
        },
    ],
    webServer: {
        command: 'pnpm preview',
        url: 'http://127.0.0.1:4175/en/',
        reuseExistingServer: !process.env.CI,
        timeout: 90000,
    },
});
