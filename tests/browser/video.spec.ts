import { expect, test, type Page } from '@playwright/test';

const content = (page: Page) =>
    page.evaluate(() => globalThis.__classicDemo.editor.getData());
const setContent = (page: Page, html: string) =>
    page.evaluate(
        (value) => globalThis.__classicDemo.editor.setData(value),
        html,
    );
const openVideo = async (page: Page) => {
    await page.locator('[data-toolbar-item="cmsVideo"]').click();
    return page.getByRole('dialog').last();
};

test.beforeEach(async ({ page }) => {
    await page.route('https://www.youtube.com/oembed?**', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ type: 'video' }),
        }),
    );
    await page.goto('/classic.html?test=1&video=1');
    await page.locator('body[data-ready="true"]').waitFor();
    await page.locator('.soeditor-wysiwyg-content p').click();
});

test('YouTube metadata fills title and cover, suggests Shorts ratio and survives save and undo', async ({
    page,
}) => {
    let requests = 0;
    await page.route('https://www.youtube.com/oembed?**', (route) => {
        ++requests;
        expect(new URL(route.request().url()).searchParams.get('url')).toBe(
            'https://www.youtube.com/watch?v=abcdefghijk',
        );
        return route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                type: 'video',
                title: 'A short video',
                thumbnail_url:
                    'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg',
                html: '<script>throw new Error("Never execute metadata HTML")</script>',
            }),
        });
    });
    await page.route('https://i.ytimg.com/**', (route) => route.abort());
    const before = await content(page);
    const dialog = await openVideo(page);
    expect(requests).toBe(0);
    await dialog
        .getByLabel('Video URL', { exact: true })
        .fill('https://www.youtube.com/shorts/abcdefghijk');
    await expect(dialog.getByLabel('Title', { exact: true })).toHaveValue(
        'A short video',
    );
    await expect(dialog.getByLabel('Poster URL', { exact: true })).toHaveValue(
        'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg',
    );
    await expect(
        dialog.getByLabel('Aspect ratio', { exact: true }),
    ).toHaveValue('9:16');
    await expect(
        dialog.getByLabel('Width (pixels or %)', { exact: true }),
    ).toHaveValue('100%');
    await expect(page.locator('iframe')).toHaveCount(0);
    await page.route('https://www.youtube-nocookie.com/**', (route) =>
        route.fulfill({
            contentType: 'text/html',
            body: '<p>Portrait player</p>',
        }),
    );
    await dialog
        .getByRole('button', { name: 'Preview video', exact: true })
        .click();
    const portrait = page.getByRole('dialog', {
        name: 'Video preview',
        exact: true,
    });
    const portraitBounds = await portrait.locator('iframe').boundingBox();
    expect(portraitBounds?.width).toBeGreaterThanOrEqual(200);
    expect(portraitBounds?.height).toBeLessThanOrEqual(
        (page.viewportSize()?.height ?? 720) * 0.6 + 1,
    );
    await portrait.getByRole('button', { name: 'Close', exact: true }).click();
    await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
    const saved = await content(page);
    expect(saved).toContain(
        'data-soeditor-poster="https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg"',
    );
    expect(saved).not.toContain('<script');
    await page.locator('[data-soeditor-video-card]').last().dblclick();
    await expect(
        page.getByRole('dialog').getByLabel('Poster URL', { exact: true }),
    ).toHaveValue('https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg');
    expect(requests).toBe(1);
    await page
        .getByRole('dialog')
        .getByRole('button', { name: 'Cancel', exact: true })
        .click();
    await page.evaluate(() => globalThis.__classicDemo.execute('editor.undo'));
    expect(await content(page)).toBe(before);
});

test('YouTube metadata preserves manual edits and discards responses for an old URL', async ({
    page,
}) => {
    let release = (): void => undefined;
    const delayed = new Promise<void>((resolve) => {
        release = resolve;
    });
    let finished = (): void => undefined;
    const responded = new Promise<void>((resolve) => {
        finished = resolve;
    });
    let started = false;
    await page.route('https://www.youtube.com/oembed?**', async (route) => {
        const old = route.request().url().includes('abcdefghijk');
        if (old) {
            started = true;
            await delayed;
        }
        try {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    type: 'video',
                    title: old ? 'Old video' : 'New video',
                    thumbnail_url: `https://i.ytimg.com/vi/${old ? 'abcdefghijk' : '12345678901'}/hqdefault.jpg`,
                }),
            });
        } finally {
            if (old) finished();
        }
    });
    const dialog = await openVideo(page);
    const source = dialog.getByLabel('Video URL', { exact: true });
    await source.fill('https://youtu.be/abcdefghijk');
    await expect.poll(() => started).toBe(true);
    await dialog.getByLabel('Title', { exact: true }).fill('My title');
    await dialog
        .getByLabel('Aspect ratio', { exact: true })
        .selectOption('1:1');
    await source.fill('https://youtu.be/12345678901');
    await expect(dialog.getByLabel('Poster URL', { exact: true })).toHaveValue(
        'https://i.ytimg.com/vi/12345678901/hqdefault.jpg',
    );
    release();
    await responded;
    await expect(dialog.getByLabel('Title', { exact: true })).toHaveValue(
        'My title',
    );
    await expect(
        dialog.getByLabel('Aspect ratio', { exact: true }),
    ).toHaveValue('1:1');
    await source.fill('/demo-video.webm');
    await expect(dialog.getByLabel('Poster URL', { exact: true })).toHaveValue(
        '',
    );
    await expect(dialog.getByLabel('Title', { exact: true })).toHaveValue(
        'My title',
    );
});

test('YouTube metadata failure permits insertion and pending requests are aborted on dialog close', async ({
    page,
}) => {
    await page.route('https://www.youtube.com/oembed?**', (route) =>
        route.abort(),
    );
    const before = await content(page);
    let dialog = await openVideo(page);
    await dialog
        .getByLabel('Video URL', { exact: true })
        .fill('https://youtu.be/abcdefghijk');
    await expect(dialog.getByRole('status')).toContainText(
        'Could not load video details',
    );
    await dialog.getByLabel('Title', { exact: true }).fill('Manual video');
    await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
    expect(await content(page)).toContain('title="Manual video"');
    await page.evaluate(() => globalThis.__classicDemo.execute('editor.undo'));
    expect(await content(page)).toBe(before);
    let release = (): void => undefined;
    const pending = new Promise<void>((resolve) => {
        release = resolve;
    });
    await page.route('https://www.youtube.com/oembed?**', async (route) => {
        await pending;
        await route.fulfill({
            contentType: 'application/json',
            body: '{"type":"video","title":"Late"}',
        });
    });
    dialog = await openVideo(page);
    const started = page.waitForRequest('https://www.youtube.com/oembed?**');
    await dialog
        .getByLabel('Video URL', { exact: true })
        .fill('https://youtu.be/12345678901');
    await started;
    const aborted = page.waitForEvent('requestfailed', (request) =>
        request.url().includes('/oembed?'),
    );
    await page.evaluate(() => globalThis.__classicDemo.destroy());
    await aborted;
    release();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('#content')).toHaveValue(before);
});

test('optional CMS video: loads properties on demand and inserts, edits and undoes inert native video', async ({
    page,
}) => {
    expect(
        await page.evaluate(() =>
            performance
                .getEntriesByType('resource')
                .some((entry) => entry.name.includes('video-runtime')),
        ),
    ).toBe(false);
    await page.locator('.soeditor-wysiwyg-content p').click();
    const before = await content(page);
    let dialog = await openVideo(page);
    await dialog
        .getByLabel('Video URL', { exact: true })
        .fill('/demo-video.webm');
    await dialog.locator('summary').click();
    await dialog
        .getByLabel('Subtitle URL (WebVTT)', { exact: true })
        .fill('/demo-video.vtt');
    await dialog.getByLabel('Title', { exact: true }).fill('CMS movie');
    await dialog.getByLabel('Width (pixels or %)').fill('640');
    await dialog.getByLabel('Alignment').selectOption('right');
    await dialog.getByLabel('Aspect ratio').selectOption('4:3');
    await dialog
        .getByRole('button', { name: 'Preview video', exact: true })
        .click();
    const preview = page.getByRole('dialog', {
        name: 'Video preview',
        exact: true,
    });
    const player = preview.locator('video');
    await expect(player).toHaveCSS('aspect-ratio', '4 / 3');
    await player.evaluate((video) => video.play());
    await expect
        .poll(() => player.evaluate((video) => video.currentTime))
        .toBeGreaterThan(0);
    await expect(player.locator('track')).toHaveAttribute(
        'src',
        '/demo-video.vtt',
    );
    await preview.getByRole('button', { name: 'Close', exact: true }).click();
    await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
    const card = page.locator('[data-soeditor-video-card]');
    await expect(card).toHaveCount(1);
    await expect(card).toContainText('CMS movie');
    await expect(page.locator('.soeditor-wysiwyg-content video')).toHaveCount(
        0,
    );
    const saved = await content(page);
    expect(saved).toContain('<video');
    expect(saved).toContain('controls');
    expect(saved).not.toContain('soeditor-video-card');
    await card.dblclick();
    dialog = page.getByRole('dialog', { name: 'Edit video', exact: true });
    await expect(dialog.getByLabel('Video URL', { exact: true })).toHaveValue(
        '/demo-video.webm',
    );
    await dialog.getByLabel('Title', { exact: true }).fill('Revised');
    await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
    await expect(card).toContainText('Revised');
    await page.evaluate(() => globalThis.__classicDemo.execute('editor.undo'));
    expect(await content(page)).toBe(saved);
    await page.evaluate(() => globalThis.__classicDemo.execute('editor.undo'));
    expect(await content(page)).toBe(before);
    await setContent(
        page,
        '<video autoplay preload="auto" style="width:45%"><source src="/demo-video.webm" type="video/webm"></video>',
    );
    await card.dblclick();
    dialog = page.getByRole('dialog', { name: 'Edit video', exact: true });
    await dialog.getByLabel('Title', { exact: true }).fill('Preserved sources');
    await dialog
        .getByRole('button', { name: 'Preview video', exact: true })
        .click();
    const legacyPreview = page.getByRole('dialog', {
        name: 'Video preview',
        exact: true,
    });
    const legacyPlayer = legacyPreview.locator('video');
    await expect(legacyPlayer.locator('source')).toHaveCount(1);
    expect(await legacyPlayer.evaluate((video) => video.autoplay)).toBe(false);
    await legacyPlayer.evaluate((video) => video.play());
    await expect
        .poll(() => legacyPlayer.evaluate((video) => video.currentTime))
        .toBeGreaterThan(0);
    await legacyPreview
        .getByRole('button', { name: 'Close', exact: true })
        .click();
    await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
    const preserved = await content(page);
    expect(preserved).not.toMatch(/<video[^>]*\bsrc=/u);
    expect(preserved).toContain('width:45%');
    expect(preserved).toContain('autoplay');
});

test('optional CMS video: preserves stored embeds and only creates a YouTube player in explicit preview', async ({
    page,
}) => {
    const requests: string[] = [];
    page.on('request', (request) => {
        if (request.url().includes('youtube-nocookie.com'))
            requests.push(request.url());
    });
    let playerRequests = 0;
    await page.route('https://www.youtube-nocookie.com/**', (route) =>
        ++playerRequests === 1
            ? route.abort()
            : route.fulfill({
                  contentType: 'text/html',
                  body: '<p>Test player</p>',
              }),
    );
    const stored =
        '<p>Before</p><iframe src="https://www.youtube-nocookie.com/embed/abcdefghijk" title="Stored video" data-cms="keep"></iframe><!--CMS--><iframe src="https://unknown.example/embed" data-extra="retain"></iframe><p>After</p>';
    await setContent(page, stored);
    const card = page.locator('[data-soeditor-video-card]');
    await expect(card).toHaveCount(1);
    expect(requests).toEqual([]);
    await card.dblclick();
    const dialog = page.getByRole('dialog', {
        name: 'Edit video',
        exact: true,
    });
    await dialog.getByRole('button', { name: 'Preview video' }).click();
    const preview = page.getByRole('dialog', {
        name: 'Video preview',
        exact: true,
    });
    await expect(preview.locator('iframe')).toHaveCount(1);
    await expect.poll(() => requests.length).toBe(1);
    await expect(
        preview.getByRole('link', { name: 'Watch on YouTube', exact: true }),
    ).toHaveAttribute('href', 'https://www.youtube.com/watch?v=abcdefghijk');
    const playerBounds = await preview.locator('iframe').boundingBox();
    expect(playerBounds?.width).toBeGreaterThan(600);
    expect(playerBounds?.height).toBeGreaterThanOrEqual(200);
    await preview
        .getByRole('button', { name: 'Reload video', exact: true })
        .click();
    await expect.poll(() => requests.length).toBe(2);
    await expect(preview.frameLocator('iframe').locator('body')).toHaveText(
        'Test player',
    );
    await expect(preview.locator('iframe')).toHaveCount(1);
    await page.setViewportSize({ width: 375, height: 720 });
    const narrowBounds = await preview.locator('iframe').boundingBox();
    expect(narrowBounds?.height).toBeGreaterThanOrEqual(200);
    expect(narrowBounds?.width).toBeLessThan(375);
    await preview.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.locator('iframe')).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(await content(page)).toBe(stored);
    await page.locator('[data-workspace-view="source"]').click();
    await page.locator('[data-workspace-view="wysiwyg"]').click();
    await expect(card).toHaveCount(1);
    expect(await content(page)).toBe(stored);
    expect(requests).toHaveLength(2);
});

test('optional CMS video: rejects executable URLs and stale or read-only edits without changing content', async ({
    page,
}) => {
    const before = await content(page);
    const dialog = await openVideo(page);
    await dialog
        .getByLabel('Video URL', { exact: true })
        .fill('javascript:alert(1)');
    await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
    await expect(dialog.getByRole('alert')).not.toBeEmpty();
    expect(await content(page)).toBe(before);
    await dialog.getByLabel('Video URL', { exact: true }).fill('/movie.mp4');
    await setContent(page, '<p>New source content</p>');
    await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
    await expect(dialog.getByRole('alert')).toContainText('document changed');
    expect(await content(page)).toBe('<p>New source content</p>');
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.evaluate(() =>
        globalThis.__classicDemo.editor.setReadonly(true),
    );
    await expect(page.locator('[data-toolbar-item="cmsVideo"]')).toBeDisabled();
});

test('optional CMS video: copies canonical HTML, supports paragraph boundaries and keyboard deletion with undo', async ({
    page,
}) => {
    const stored =
        '<p>Before</p><video src="/movie.mp4" controls title="Movie"></video><p>After</p>';
    await setContent(page, stored);
    const card = page.locator('[data-soeditor-video-card]');
    await card.click();
    const copied = await card.evaluate((element) => {
        const data = new DataTransfer();
        const event = new ClipboardEvent('copy', {
            bubbles: true,
            composed: true,
            clipboardData: data,
        });
        // Firefox does not retain the supplied transfer in synthetic events.
        Object.defineProperty(event, 'clipboardData', { value: data });
        element.dispatchEvent(event);
        return data.getData('text/html');
    });
    expect(copied).toContain('<video');
    expect(copied).not.toContain('soeditor-video-card');
    await page.evaluate(() => {
        document.addEventListener(
            'dragstart',
            (event) => {
                Reflect.set(
                    globalThis,
                    '__videoDragPrevented',
                    event.defaultPrevented,
                );
            },
            { once: true },
        );
    });
    const surface = page.locator('.soeditor-wysiwyg-content');
    await surface.locator('p').first().click();
    await page.keyboard.press('ControlOrMeta+A');
    const from = await surface.locator('p').first().boundingBox();
    const to = await surface.locator('p').last().boundingBox();
    if (from === null || to === null) throw new Error('Missing drag geometry');
    await page.mouse.move(from.x + 15, from.y + 8);
    await page.mouse.down();
    await page.mouse.move(to.x + 30, to.y + 8, { steps: 15 });
    await page.mouse.up();
    await expect
        .poll(() =>
            page.evaluate(() =>
                Reflect.get(globalThis, '__videoDragPrevented'),
            ),
        )
        .toBe(true);
    expect(await content(page)).toBe(stored);
    await card.focus();
    await page.keyboard.press('Delete');
    await expect(card).toHaveCount(0);
    await page.evaluate(() => globalThis.__classicDemo.execute('editor.undo'));
    expect(await content(page)).toBe(stored);
    await card.hover();
    const buttons = page.locator('.soeditor-block-paragraph button');
    await expect(buttons).toHaveCount(2);
    await buttons.first().click();
    expect(await content(page)).toMatch(/Before<\/p><p><br\s*\/?><\/p><video/u);
});

test('optional CMS video: inserts at a new caret instead of modifying the previously selected video', async ({
    page,
}) => {
    await setContent(
        page,
        '<video src="/first.mp4" controls></video><p>After</p>',
    );
    await page.locator('[data-soeditor-video-card]').click();
    await page.locator('.soeditor-wysiwyg-content p').click();
    const dialog = await openVideo(page);
    await expect(dialog).toHaveAttribute('aria-label', 'Insert video');
    await dialog.getByLabel('Video URL', { exact: true }).fill('/second.mp4');
    await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
    await expect(page.locator('[data-soeditor-video-card]')).toHaveCount(2);
    expect(await content(page)).toContain('/first.mp4');
});

test('optional CMS video: selects direct assets through the existing media picker and ignores late results after teardown', async ({
    page,
}) => {
    await page.evaluate(() => {
        globalThis.__classicDemo.editor.editor.services.replace(
            'soeditor.file-manager',
            {
                open: (options: { kind: string }) => {
                    Reflect.set(globalThis, '__videoPickerKind', options.kind);
                    return Promise.resolve({
                        url: '/picked.mp4',
                        mime: 'video/mp4',
                    });
                },
            },
        );
    });
    let dialog = await openVideo(page);
    await dialog
        .getByRole('button', { name: 'Choose video', exact: true })
        .click();
    await expect(dialog.getByLabel('Video URL', { exact: true })).toHaveValue(
        '/picked.mp4',
    );
    expect(
        await page.evaluate(() => Reflect.get(globalThis, '__videoPickerKind')),
    ).toBe('media');
    await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
    await page.evaluate(() => {
        globalThis.__classicDemo.editor.editor.services.replace(
            'soeditor.file-manager',
            {
                open: () =>
                    new Promise((resolve) => {
                        Reflect.set(
                            globalThis,
                            '__resolveVideoPicker',
                            resolve,
                        );
                    }),
            },
        );
    });
    await page.locator('[data-soeditor-video-card]').dblclick();
    dialog = page.getByRole('dialog', { name: 'Edit video', exact: true });
    await dialog
        .getByRole('button', { name: 'Choose video', exact: true })
        .click();
    await page.evaluate(() => globalThis.__classicDemo.destroy());
    await page.evaluate(() => {
        const resolve: unknown = Reflect.get(
            globalThis,
            '__resolveVideoPicker',
        );
        if (typeof resolve === 'function') resolve({ url: '/late.mp4' });
    });
    await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('optional CMS video: switches provider with one undo step and keeps other instances isolated', async ({
    page,
}) => {
    await setContent(
        page,
        '<video src="/first.mp4" controls title="First"></video>',
    );
    await page.locator('[data-soeditor-video-card]').dblclick();
    const dialog = page.getByRole('dialog', {
        name: 'Edit video',
        exact: true,
    });
    await dialog
        .getByLabel('Video URL', { exact: true })
        .fill('https://youtu.be/abcdefghijk');
    await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
    expect(await content(page)).toContain('<iframe');
    expect(await content(page)).not.toContain('<video');
    await page.evaluate(() => globalThis.__classicDemo.execute('editor.undo'));
    expect(await content(page)).toBe(
        '<video src="/first.mp4" controls title="First"></video>',
    );
    await page.evaluate(async () => {
        const host = document.createElement('textarea');
        document.body.append(host);
        const second = await globalThis.__classicDemo.create(host, {
            data: '<p>Second editor</p>',
        });
        Reflect.set(globalThis, '__videoSecond', second);
    });
    await expect(page.locator('[data-toolbar-item="cmsVideo"]')).toHaveCount(1);
    await page.evaluate(() => globalThis.__classicDemo.destroy());
    await expect(page.locator('.soeditor-wysiwyg-content')).toContainText(
        'Second editor',
    );
});

test('optional CMS video: leaves the default request graph untouched and retries a failed lazy import', async ({
    page,
}) => {
    await page.goto('/classic.html?test=1');
    await page.locator('body[data-ready="true"]').waitFor();
    await expect(page.locator('[data-toolbar-item="cmsVideo"]')).toHaveCount(0);
    expect(
        await page.evaluate(() =>
            performance
                .getEntriesByType('resource')
                .some((entry) =>
                    /\/packages\/soeditor\/src\/video(?:-runtime|-model|-policy)?\.ts/u.test(
                        entry.name,
                    ),
                ),
        ),
    ).toBe(false);
    await page.goto('/classic.html?test=1&video=1');
    await page.locator('body[data-ready="true"]').waitFor();
    await page.locator('.soeditor-wysiwyg-content p').click();
    let failed = false;
    await page.route('**/video-runtime.ts*', async (route) => {
        if (!failed) {
            failed = true;
            await route.abort();
        } else await route.continue();
    });
    await page.locator('[data-toolbar-item="cmsVideo"]').click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.soeditor-ui__notification')).toBeVisible();
    await page.unroute('**/video-runtime.ts*');
    await page.locator('[data-toolbar-item="cmsVideo"]').click();
    await expect(
        page.getByRole('dialog', { name: 'Insert video', exact: true }),
    ).toBeVisible();
});

test('whole article preview plays approved YouTube separately from inert article HTML', async ({
    page,
    context,
}) => {
    await context.route(
        'https://www.youtube-nocookie.com/**',
        async (route) => {
            expect((await route.request().allHeaders())['referer']).toBe(
                new URL(page.url()).origin + '/',
            );
            return route.fulfill({
                contentType: 'text/html',
                body: '<button onclick="this.textContent=\'Playing\'">Play video</button>',
            });
        },
    );
    const html =
        '<p>Article video</p><iframe title="Article player" width="560" height="315" src="https://www.youtube.com/embed/abcdefghijk"></iframe><div style="height:1500px">After video</div><script>parent.document.body.dataset.articleExecuted="yes"</script><img src="/missing-preview-image" onerror="parent.document.body.dataset.articleExecuted=\'yes\'"><iframe src="https://www.youtube.com/embed/abcdefghijk" srcdoc="<script>parent.parent.document.body.dataset.articleExecuted=\'yes\'</script>"></iframe>';
    await setContent(page, html);
    const canonical = await content(page);
    const popupPromise = context.waitForEvent('page');
    await page.locator('[data-toolbar-item="popupPreview"]').click();
    const popup = await popupPromise;
    const article = popup.locator('body > iframe');
    const player = popup.locator('[data-preview-media] iframe');
    await expect(article).toHaveAttribute('sandbox', 'allow-same-origin');
    await expect(player).toHaveCount(1);
    await player
        .contentFrame()
        .getByRole('button', { name: 'Play video' })
        .click();
    await expect(
        player.contentFrame().getByRole('button', { name: 'Playing' }),
    ).toBeVisible();
    const geometry = () =>
        popup.evaluate(() => {
            const frame =
                document.querySelector<HTMLIFrameElement>('body > iframe')!;
            const sourceElement =
                frame.contentDocument?.querySelector('iframe');
            if (sourceElement == null) return false;
            const source = sourceElement.getBoundingClientRect();
            const player = document
                .querySelector('[data-preview-player]')!
                .getBoundingClientRect();
            return (
                Math.abs(
                    player.top - source.top - frame.getBoundingClientRect().top,
                ) < 2 && Math.abs(player.width - source.width) < 2
            );
        });
    await expect.poll(geometry).toBe(true);
    await article.evaluate((frame: HTMLIFrameElement) =>
        frame.contentWindow!.scrollTo(0, 180),
    );
    await expect.poll(geometry).toBe(true);
    await expect(popup.locator('body')).not.toHaveAttribute(
        'data-article-executed',
        'yes',
    );
    await popup.getByRole('combobox').selectOption('word');
    await expect(player).toHaveCount(1);
    await expect.poll(geometry).toBe(true);
    expect(await content(page)).toBe(canonical);
    await setContent(page, '<p>Video removed</p>');
    await expect(player).toHaveCount(0);
    await popup.close();
});

test('article preview loads visible media only and retains players through text edits and templates', async ({
    page,
    context,
}) => {
    let requests = 0;
    await context.route('https://www.youtube-nocookie.com/**', (route) => {
        ++requests;
        return route.fulfill({
            contentType: 'text/html',
            body: '<button onclick="this.textContent=\'Playing\'">Play video</button>',
        });
    });
    const movie =
        '<iframe title="First movie" width="560" height="315" src="https://www.youtube.com/embed/abcdefghijk"></iframe>';
    const rest =
        '<div style="height:1800px">Long article</div><iframe title="Later movie" width="560" height="315" src="https://www.youtube.com/embed/lmnopqrstuv"></iframe>';
    await setContent(page, '<p>Original title</p>' + movie + rest);
    const pending = context.waitForEvent('page');
    await page.locator('[data-toolbar-item="popupPreview"]').click();
    const popup = await pending;
    const first = popup.locator('[data-preview-player]').first();
    await first
        .locator('iframe')
        .contentFrame()
        .getByRole('button', { name: 'Play video' })
        .click();
    expect(requests).toBe(1);
    const original = await first.locator('iframe').elementHandle();
    const article = popup.locator('body > iframe');
    await article.evaluate((frame: HTMLIFrameElement) =>
        frame.contentWindow!.scrollTo(0, 120),
    );
    await setContent(page, '<p>Changed title</p>' + movie + rest);
    await expect(
        article.contentFrame().getByText('Changed title'),
    ).toBeVisible();
    await expect(
        first
            .locator('iframe')
            .contentFrame()
            .getByRole('button', { name: 'Playing' }),
    ).toBeVisible();
    expect(await original!.evaluate((node) => node.isConnected)).toBe(true);
    expect(requests).toBe(1);
    await expect
        .poll(() =>
            article.evaluate(
                (frame: HTMLIFrameElement) => frame.contentWindow!.scrollY,
            ),
        )
        .toBe(120);
    await popup.getByRole('combobox').selectOption('word');
    await expect(
        first
            .locator('iframe')
            .contentFrame()
            .getByRole('button', { name: 'Playing' }),
    ).toBeVisible();
    expect(requests).toBe(1);
    await article.evaluate((frame: HTMLIFrameElement) =>
        frame.contentWindow!.scrollTo(0, 2200),
    );
    await expect(popup.locator('[data-preview-media] iframe')).toHaveCount(2);
    await expect.poll(() => requests).toBe(2);
    await setContent(page, '<p>Removed first movie</p>' + rest);
    await expect
        .poll(() => original!.evaluate((node) => node.isConnected))
        .toBe(false);
    await popup.close();
});

test('article video preview supports collapsed content, portrait, narrow layouts, zoom and wheel scrolling', async ({
    page,
    context,
}) => {
    let requests = 0;
    await context.route('https://www.youtube-nocookie.com/**', (route) => {
        ++requests;
        return route.fulfill({
            contentType: 'text/html',
            body: '<button>Play video</button>',
        });
    });
    await setContent(
        page,
        '<details><summary>Optional movie</summary><iframe title="Portrait" style="display:block;width:240px;max-width:100%;height:430px;margin:auto" src="https://www.youtube.com/embed/abcdefghijk"></iframe></details><div style="height:1800px">After</div>',
    );
    const pending = context.waitForEvent('page');
    await page.locator('[data-toolbar-item="popupPreview"]').click();
    const popup = await pending;
    await popup.setViewportSize({ width: 375, height: 640 });
    const article = popup.locator('body > iframe');
    await expect(article.contentFrame().locator('details')).toHaveCount(1);
    await expect(popup.locator('[data-preview-player]')).toHaveCount(1);
    expect(requests).toBe(0);
    await article.contentFrame().locator('summary').click();
    const player = popup.locator('[data-preview-media] iframe');
    await expect(player).toHaveCount(1);
    const geometry = () =>
        popup.evaluate(() => {
            const frame =
                document.querySelector<HTMLIFrameElement>('body > iframe')!;
            const source = frame
                .contentDocument!.querySelector('iframe')!
                .getBoundingClientRect();
            const target = document
                .querySelector('[data-preview-player]')!
                .getBoundingClientRect();
            const bounds = frame.getBoundingClientRect();
            const scale = bounds.width / frame.offsetWidth;
            return (
                Math.abs(target.top - (source.top * scale + bounds.top)) < 2 &&
                Math.abs(target.width - source.width * scale) < 2
            );
        });
    await expect.poll(geometry).toBe(true);
    const bounds = await player.boundingBox();
    expect(bounds!.width).toBeLessThan(375);
    expect(bounds!.height).toBeGreaterThan(bounds!.width);
    await popup.mouse.move(
        bounds!.x + bounds!.width / 2,
        bounds!.y + bounds!.height / 2,
    );
    await popup.mouse.wheel(0, 160);
    await expect
        .poll(() =>
            article.evaluate(
                (frame: HTMLIFrameElement) => frame.contentWindow!.scrollY,
            ),
        )
        .toBeGreaterThan(0);
    await expect.poll(geometry).toBe(true);
    await popup.evaluate(() => {
        document.body.style.zoom = '1.25';
    });
    await expect.poll(geometry).toBe(true);
    await article.evaluate((frame: HTMLIFrameElement) =>
        frame.contentWindow!.scrollTo(0, 0),
    );
    await expect.poll(geometry).toBe(true);
    // Use physical viewport coordinates: frame-locator clicks do not account for
    // the parent document's CSS zoom consistently across automation backends.
    const target = await popup.evaluate(() => {
        const frame =
            document.querySelector<HTMLIFrameElement>('body > iframe')!;
        const bounds = frame.getBoundingClientRect();
        const scale = bounds.width / frame.offsetWidth;
        const summary = frame
            .contentDocument!.querySelector('summary')!
            .getBoundingClientRect();
        return {
            x: bounds.left + (summary.left + summary.width / 2) * scale,
            y: bounds.top + (summary.top + summary.height / 2) * scale,
        };
    });
    await popup.mouse.click(target.x, target.y);

    await expect(popup.locator('[data-preview-player]')).toBeHidden();
    expect(requests).toBe(1);
    await popup.close();
});

test('native article video survives text refresh and shares retry and original-video controls', async ({
    page,
    context,
}) => {
    // Page-level interception stalls popup media requests in Chromium's automation
    // backend. This native-only case exercises the real local video response.
    await page.unrouteAll();
    const movie =
        '<video title="Local movie" src="/demo-video.webm" controls muted loop style="width:320px;height:240px"></video>';
    await setContent(page, '<p>Before</p>' + movie);
    const pending = context.waitForEvent('page');
    await page.locator('[data-toolbar-item="popupPreview"]').click();
    const popup = await pending;
    const video = popup.locator('[data-preview-media] video');
    await popup.bringToFront();
    await expect
        .poll(() =>
            video.evaluate((node: HTMLVideoElement) => ({
                ready: node.readyState,
                muted: node.muted,
                error: node.error?.message,
            })),
        )
        .toMatchObject({ ready: 4, muted: true });
    await video.evaluate((node: HTMLVideoElement) => node.play());
    await expect
        .poll(() =>
            video.evaluate((node: HTMLVideoElement) => node.currentTime),
        )
        .toBeGreaterThan(0);
    const original = await video.elementHandle();
    await setContent(page, '<p>After</p>' + movie);
    await expect(
        popup.locator('body > iframe').contentFrame().getByText('After'),
    ).toBeVisible();
    expect(await original!.evaluate((node) => node.isConnected)).toBe(true);
    expect(await video.evaluate((node: HTMLVideoElement) => node.paused)).toBe(
        false,
    );
    await expect(
        popup.getByRole('link', { name: 'Open original video' }),
    ).toHaveAttribute('href', /demo-video.webm$/);
    await popup.getByRole('button', { name: 'Reload video' }).click();
    expect(await original!.evaluate((node) => node.isConnected)).toBe(false);
    await expect(video).toHaveCount(1);
    await popup.close();
});

test('video properties keeps advanced native controls collapsed and switches applicable options without losing values', async ({
    page,
}) => {
    const dialog = await openVideo(page);
    await expect(dialog.getByLabel('Show controls')).toBeHidden();
    await dialog.locator('summary').click();
    await dialog.getByLabel('Muted', { exact: true }).check();
    await dialog.getByLabel('Subtitle URL (WebVTT)').fill('/demo-video.vtt');
    await dialog
        .getByLabel('Video URL', { exact: true })
        .fill('https://youtu.be/abcdefghijk');
    await expect(dialog.locator('details')).toBeHidden();
    await dialog
        .getByLabel('Video URL', { exact: true })
        .fill('/demo-video.webm');
    await expect(dialog.getByLabel('Muted', { exact: true })).toBeChecked();
    await expect(dialog.getByLabel('Subtitle URL (WebVTT)')).toHaveValue(
        '/demo-video.vtt',
    );
    await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
    expect(await content(page)).toContain('muted');
    expect(await content(page)).toContain('/demo-video.vtt');
});

test('whole article preview exposes keyboard-operable recovery after a player request fails', async ({
    page,
    context,
}) => {
    let requests = 0;
    await context.route('https://www.youtube-nocookie.com/**', (route) => {
        ++requests;
        return requests === 1
            ? route.abort()
            : route.fulfill({
                  contentType: 'text/html',
                  body: '<button>Play video</button>',
              });
    });
    await setContent(
        page,
        '<iframe width="560" height="315" src="https://www.youtube.com/embed/abcdefghijk"></iframe>',
    );
    const pending = context.waitForEvent('page');
    await page.locator('[data-toolbar-item="popupPreview"]').click();
    const popup = await pending;
    const box = popup.locator('[data-preview-player]');
    await expect(box.getByRole('status')).toContainText(/reload|load/i);
    await expect(
        box.getByRole('link', { name: 'Watch on YouTube' }),
    ).toHaveAttribute('href', 'https://www.youtube.com/watch?v=abcdefghijk');
    const first = await box.locator('iframe').elementHandle();
    const retry = box.getByRole('button', { name: 'Reload video' });
    await retry.focus();
    await popup.keyboard.press('Enter');
    await expect(
        box
            .locator('iframe')
            .contentFrame()
            .getByRole('button', { name: 'Play video' }),
    ).toBeVisible();
    expect(await first!.evaluate((node) => node.isConnected)).toBe(false);
    expect(requests).toBe(2);
    await popup.close();
});
