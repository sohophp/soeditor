import {
    firefox,
    webkit,
    type Browser,
    type BrowserType,
} from '@playwright/test';

interface BrowserProbe {
    readonly browser: BrowserType;
    readonly name: string;
}

const probes: readonly BrowserProbe[] = [
    { browser: firefox, name: 'Firefox' },
    { browser: webkit, name: 'WebKit' },
];

export default async function crossBrowserPreflight(): Promise<void> {
    const results = await Promise.allSettled(
        probes.map(async ({ browser, name }) => {
            let instance: Browser | undefined;
            try {
                instance = await browser.launch({ headless: true });
            } catch (error: unknown) {
                throw new Error(`${name}: ${errorMessage(error)}`, {
                    cause: error,
                });
            } finally {
                await instance?.close();
            }
        }),
    );
    const failures = results.flatMap((result) =>
        result.status === 'rejected' ? [errorMessage(result.reason)] : [],
    );
    if (failures.length > 0) {
        throw new Error(
            `Cross-browser host preflight failed before product tests:\n\n${failures.join('\n\n')}`,
        );
    }
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
