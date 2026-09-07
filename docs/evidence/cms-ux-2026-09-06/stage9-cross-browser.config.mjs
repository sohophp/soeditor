export default {
    testDir: '/var/www/node/SoEditor/tests/browser',
    testMatch: 'cms-multibrowser.spec.ts',
    outputDir: '/tmp/soeditor-cross-results',
    fullyParallel: false,
    workers: 2,
    projects: [
        { name: 'firefox', use: { browserName: 'firefox' } },
        { name: 'webkit', use: { browserName: 'webkit' } },
    ],
    use: { baseURL: 'http://127.0.0.1:4173', headless: true },
    webServer: {
        command:
            'node ../../node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173',
        cwd: '/var/www/node/SoEditor/apps/playground',
        url: 'http://127.0.0.1:4173',
        reuseExistingServer: false,
    },
};
