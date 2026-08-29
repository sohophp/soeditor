import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test('mounts React StrictMode and Vue adapters with prop updates and cleanup', async ({
    page,
}) => {
    await page.goto('/framework-adapters.html');
    await page.locator('body[data-ready="true"]').waitFor();

    const initial = await call(page, 'snapshot');
    expect(initial).toMatchObject({ reactSurfaces: 1, vueSurfaces: 1 });
    expect(initial.reactCreates).toBeGreaterThanOrEqual(1);
    await expect(page.getByRole('alert')).toContainText(
        'Expected adapter mount failure',
    );
    await expect(page.locator('[data-testid="react-fallback"]')).toHaveCount(0);

    await page.evaluate(() => {
        const harness = Reflect.get(
            globalThis,
            '__frameworkAdaptersDemo',
        ) as Harness;
        harness.setValue('<p>Owner update</p>');
        harness.setReadonly(true);
    });
    await expect
        .poll(async () => call(page, 'snapshot'))
        .toMatchObject({
            reactReadonly: true,
            reactSource: '<p>Owner update</p>',
            vueReadonly: true,
            vueSource: '<p>Owner update</p>',
        });

    const accessibility = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
    expect(accessibility.violations).toEqual([]);

    const destroyed = await call(page, 'destroy');
    expect(destroyed).toMatchObject({ reactSurfaces: 0, vueSurfaces: 0 });
    expect(destroyed.reactDestroys).toBe(destroyed.reactCreates);
    expect(destroyed.vueDestroys).toBe(destroyed.vueCreates);
});

async function call(
    page: Page,
    method: 'destroy' | 'snapshot',
): Promise<Snapshot> {
    return page.evaluate(async (name) => {
        const harness = Reflect.get(
            globalThis,
            '__frameworkAdaptersDemo',
        ) as Harness;
        return harness[name]();
    }, method);
}

interface Snapshot {
    readonly reactCreates: number;
    readonly reactDestroys: number;
    readonly reactReadonly?: boolean;
    readonly reactSource?: string;
    readonly reactSurfaces: number;
    readonly vueCreates: number;
    readonly vueDestroys: number;
    readonly vueReadonly?: boolean;
    readonly vueSource?: string;
    readonly vueSurfaces: number;
}

interface Harness {
    destroy(): Promise<Snapshot>;
    setReadonly(value: boolean): void;
    setValue(value: string): void;
    snapshot(): Snapshot;
}
