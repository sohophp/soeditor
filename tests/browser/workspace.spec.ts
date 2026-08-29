import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test('mounts a real workspace and recovers unsaved canonical source', async ({
    page,
}) => {
    await openWorkspace(page);
    const editing = page.locator('#editing');
    await editing.click();
    await page.keyboard.press('End');
    await page.keyboard.type('!');
    await expect(page.locator('#source')).toContainText('Workspace initial!');

    expect(await crash(page)).toBe('ready');
    await expect(page.locator('#source')).toContainText('Workspace initial!');
    await expect(editing).toContainText('Workspace initial!');
    expect(await snapshot(page)).toMatchObject({
        changeCount: 1,
        createCount: 2,
        editingChildren: 1,
        recoveryCount: 1,
        status: 'ready',
        toolbarChildren: 1,
    });

    const accessibility = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
    expect(accessibility.violations).toEqual([]);

    expect(await destroy(page)).toEqual({
        editingChildren: 0,
        status: 'destroyed',
        toolbarChildren: 0,
    });
});

test('synchronizes a controlled value without an onChange feedback loop', async ({
    page,
}) => {
    await openWorkspace(page, '?controlled=1');
    await page.evaluate(() => {
        const harness = Reflect.get(
            globalThis,
            '__workspaceDemo',
        ) as WorkspaceHarness;
        harness.setValue('<p>External</p>');
    });
    await expect(page.locator('#source')).toHaveText('<p>External</p>');
    expect((await snapshot(page)).changeCount).toBe(0);

    await page.locator('#editing').click();
    await page.keyboard.press('End');
    await page.keyboard.type('!');
    await expect(page.locator('#source')).toContainText('External!');
    await expect.poll(async () => (await snapshot(page)).changeCount).toBe(1);
    await page.waitForTimeout(50);
    expect((await snapshot(page)).changeCount).toBe(1);
    await destroy(page);
});

test('stops recovery at the crash-rate limit without losing source evidence', async ({
    page,
}) => {
    await openWorkspace(page);
    await page.locator('#editing').click();
    await page.keyboard.press('End');
    await page.keyboard.type(' retained');
    await expect(page.locator('#source')).toContainText('retained');

    expect(await crash(page)).toBe('ready');
    expect(await crash(page)).toBe('ready');
    expect(await crash(page)).toBe('failed');
    expect(await snapshot(page)).toMatchObject({
        createCount: 3,
        editingChildren: 0,
        recoveryCount: 2,
        source: '<p>Workspace initial retained</p>',
        status: 'failed',
        toolbarChildren: 0,
    });
    expect((await snapshot(page)).error).toContain('recovery limit');
    expect(await destroy(page)).toMatchObject({ status: 'destroyed' });
});

async function openWorkspace(page: Page, query = ''): Promise<void> {
    await page.goto(`/workspace.html${query}`);
    await page.locator('body[data-ready="true"]').waitFor();
    await expect(page.locator('#editing')).toHaveAttribute(
        'contenteditable',
        'true',
    );
}

async function crash(page: Page): Promise<string> {
    return page.evaluate(() => {
        const harness = Reflect.get(
            globalThis,
            '__workspaceDemo',
        ) as WorkspaceHarness;
        return harness.crash();
    });
}

async function destroy(page: Page): Promise<{
    editingChildren: number;
    status: string;
    toolbarChildren: number;
}> {
    return page.evaluate(() => {
        const harness = Reflect.get(
            globalThis,
            '__workspaceDemo',
        ) as WorkspaceHarness;
        return harness.destroy();
    });
}

async function snapshot(page: Page): Promise<WorkspaceDemoSnapshot> {
    return page.evaluate(() => {
        const harness = Reflect.get(
            globalThis,
            '__workspaceDemo',
        ) as WorkspaceHarness;
        return harness.snapshot();
    });
}

interface WorkspaceDemoSnapshot {
    readonly changeCount: number;
    readonly createCount: number;
    readonly editingChildren: number;
    readonly error?: string;
    readonly recoveryCount?: number;
    readonly source?: string;
    readonly status?: string;
    readonly toolbarChildren: number;
}

interface WorkspaceHarness {
    crash(): Promise<string>;
    destroy(): Promise<{
        editingChildren: number;
        status: string;
        toolbarChildren: number;
    }>;
    setValue(source: string): void;
    snapshot(): WorkspaceDemoSnapshot;
}
