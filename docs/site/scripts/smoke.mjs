import process from 'node:process';
const origin = process.argv[2] ?? 'http://127.0.0.1:4175';
for (const [path, status, text] of [
    ['/zh-CN/', 200, 'SoEditor'],
    ['/en/', 200, 'SoEditor'],
    ['/zh-CN/guide/source', 200, 'Source'],
    ['/en/examples/basic', 200, 'SoEditor'],
    ['/demos/basic.html', 200, 'SoEditor'],
    ['/favicon.svg', 200, '<svg'],
    ['/not-a-document-9831', 404, '404'],
    ['/deployment.json', 200, '"editorVersion"'],
]) {
    const response = await fetch(new URL(path, origin), {
        signal: AbortSignal.timeout(15000),
    });
    if (response.status !== status || !(await response.text()).includes(text))
        throw new Error(`Smoke failed: ${path} ${response.status}`);
}
const redirect = await fetch(new URL('/', origin), {
    redirect: 'manual',
    signal: AbortSignal.timeout(15000),
});
if (
    redirect.status !== 302 ||
    !redirect.headers.get('location')?.endsWith('/zh-CN/')
)
    throw new Error('Root redirect failed');

const homeResponse = await fetch(new URL('/en/', origin), {
    signal: AbortSignal.timeout(15000),
});
if (
    !homeResponse.headers.get('cache-control')?.includes('must-revalidate') ||
    !homeResponse.headers.get('cache-control')?.includes('no-transform')
)
    throw new Error('HTML cache policy missing');
const home = await homeResponse.text();
const manifest = await fetch(new URL('/deployment.json', origin)).then(
    (response) => response.json(),
);
if (!['1.2.1', '1.3.0', '1.4.0'].includes(manifest.editorVersion))
    throw new Error('Unsupported documentation artifact version');
if (['1.3.0', '1.4.0'].includes(manifest.editorVersion)) {
    for (const topic of ['react', 'vue', 'video']) {
        for (const path of [
            `/en/examples/${topic}`,
            `/zh-CN/guide/${topic}`,
            `/demos/${topic}.html`,
        ]) {
            const response = await fetch(new URL(path, origin), {
                signal: AbortSignal.timeout(15000),
            });
            if (
                response.status !== 200 ||
                !(await response.text()).includes('SoEditor')
            )
                throw new Error(`Released example missing: ${path}`);
        }
    }
    const companion = await fetch(new URL('/zh-CN/guide/sofinder', origin), {
        signal: AbortSignal.timeout(15000),
    });
    const html = await companion.text();
    if (
        companion.status !== 200 ||
        !html.includes('https://sofinder.sohophp.app/') ||
        !html.includes('最佳搭档')
    )
        throw new Error('SoFinder companion documentation missing');
}

if (
    manifest.preview &&
    (!homeResponse.headers.get('x-robots-tag')?.includes('noindex') ||
        !/<meta\s+name="robots"\s+content="noindex, nofollow"\s*\/?>/.test(
            home,
        ))
)
    throw new Error('Preview headers missing');
const sitemap = await fetch(new URL('/sitemap.xml', origin), {
    signal: AbortSignal.timeout(15000),
});
if (sitemap.status !== (manifest.preview ? 404 : 200))
    throw new Error('Sitemap environment mismatch');
const demoResponse = await fetch(new URL('/demos/basic', origin), {
    signal: AbortSignal.timeout(15000),
});
const demo = await demoResponse.text();
const assets = [
    ...(home + demo).matchAll(
        /(?:src|href)="(\/(?:demos\/)?assets\/[^"?#]+\.(?:js|css))"/g,
    ),
].map((match) => match[1]);
if (!assets.length) throw new Error('Missing home assets');
for (const asset of new Set(assets)) {
    const response = await fetch(new URL(asset, origin), {
        signal: AbortSignal.timeout(15000),
    });
    if (
        !response.ok ||
        !response.headers.get('cache-control')?.includes('max-age=31536000') ||
        response.headers.get('cache-control')?.includes('max-age=0')
    )
        throw new Error(`Asset delivery/cache failed: ${asset}`);
}
const iframe = await fetch(new URL('/demos/basic', origin), {
    signal: AbortSignal.timeout(15000),
});
if (!iframe.headers.get('x-robots-tag')?.includes('noindex'))
    throw new Error('Demo indexing protection missing');

process.stdout.write(`Smoke checks passed: ${origin}\n`);
