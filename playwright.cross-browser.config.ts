import { defineConfig } from '@playwright/test';

export default defineConfig({
    globalSetup: './tests/browser/cross-browser-preflight.ts',
    testDir: './tests/browser',
    testMatch: ['cms-multibrowser.spec.ts', 'wysiwyg-editor.spec.ts'],
    fullyParallel: false,
    projects: (['firefox', 'webkit'] as const).flatMap((browserName) => [
        { name: browserName, use: { browserName } },
        {
            name: `${browserName}-distribution`,
            use: { browserName },
            testMatch: ['distribution.spec.ts'],
        },
        {
            name: `${browserName}-image-tools`,
            use: { browserName },
            testMatch: ['classic-editor.spec.ts'],
            grep: /image drag preserves|image resize cancels|image alignment renders|element path follows|counts semantic body|declared Classic toolbar|type-around/u,
        },
    ]),
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
