import assert from 'node:assert/strict';

// Default video adds synchronous inert-card support; see ADR 0081.
// First-use caps are distinct from installed recovery storage and total usage.
export const cmsLoadingBudgets = Object.freeze({
    globalRaw: 500000,
    globalGzip: 150000,
    standaloneCssRaw: 27000,
    optionalInitialRaw: 525000,
    optionalInitialGzip: 157000,
    sourceIncrementRaw: 600000,
    sourceIncrementGzip: 210000,
    formatterIncrementRaw: 650000,
    formatterIncrementGzip: 160000,
    recoveryRaw: 800000,
    recoveryGzip: 260000,
    // Local production consumer, including the first-use fetch and activation.
    sourceLatency: Object.freeze({
        10240: { first: 1000, again: 300 },
        102400: { first: 2000, again: 1000 },
        512000: { first: 5000, again: 3000 },
    }),
});

export function verifyCmsLoading({ artifacts, assets, chunks, runs }) {
    const limits = cmsLoadingBudgets;
    const within = (label, value, limit) =>
        assert.ok(value <= limit, `${label}: ${value} exceeds ${limit} bytes.`);
    const global = artifacts.find((item) =>
        item.path.endsWith('soeditor.global.js'),
    );
    const css = artifacts.find((item) => item.path.endsWith('soeditor.css'));
    assert.ok(global && css);
    within('CMS global raw', global.raw, limits.globalRaw);
    within('CMS global gzip', global.gzip, limits.globalGzip);
    within('CMS CSS raw', css.raw, limits.standaloneCssRaw);
    const requestedChunks = (requests) =>
        chunks.filter((chunk) => requests.includes(`/${chunk.file}`));
    const sum = (items, field) =>
        items.reduce((total, item) => total + item[field], 0);
    const checkRequests = (label, requests, raw, gzip) => {
        const selected = requestedChunks(requests);
        assert.ok(selected.length > 0, `${label} must request a JS chunk.`);
        within(`${label} raw`, sum(selected, 'raw'), raw);
        within(`${label} gzip`, sum(selected, 'gzip'), gzip);
        return selected;
    };
    const forbidden =
        /packages\/(?:markdown|comments|revisions|dev-tools|workspace|preview)\/|(?:^|\/)prettier(?:\/|@)|packages\/html-tools\/|packages\/source\/dist\/index\.js|@codemirror\//u;
    for (const run of runs) {
        const initial = checkRequests(
            'Optional CMS initial',
            run.initialRequests,
            limits.optionalInitialRaw,
            limits.optionalInitialGzip,
        );
        for (const chunk of initial) {
            assert.ok(
                !chunk.modules.some(
                    (id) =>
                        forbidden.test(id) &&
                        // This explicit leaf contains only the typed service token.
                        !/packages\/preview\/dist\/media\.js$/u.test(id),
                ),
                `Initial graph contains optional runtime: ${chunk.file}`,
            );
        }
        assert.ok(
            !run.initialRequests.some((url) =>
                /runtime-|soeditor-retry=/u.test(url),
            ),
            'Recovery assets must not be fetched during startup.',
        );
        if (run.source) {
            const latency = limits.sourceLatency[run.size];
            assert.ok(
                latency,
                `Missing Source latency budget for ${run.size}.`,
            );
            assert.ok(
                run.sourceFirst.milliseconds <= latency.first,
                `First Source at ${run.size}: ${run.sourceFirst.milliseconds}ms exceeds ${latency.first}ms.`,
            );
            assert.ok(
                run.sourceAgain <= latency.again,
                `Repeated Source at ${run.size}: ${run.sourceAgain}ms exceeds ${latency.again}ms.`,
            );
            const source = checkRequests(
                'First Source',
                run.sourceFirst.requests,
                limits.sourceIncrementRaw,
                limits.sourceIncrementGzip,
            );
            assert.ok(
                !source.some((chunk) =>
                    chunk.modules.some((id) =>
                        /packages\/(?:html-tools|dev-tools|preview)\/|(?:^|\/)prettier(?:\/|@)/u.test(
                            id,
                        ),
                    ),
                ),
                'Opening Source must not request formatting or developer/preview modules.',
            );
            checkRequests(
                'First formatting',
                run.formatting.requests,
                limits.formatterIncrementRaw,
                limits.formatterIncrementGzip,
            );
        }
    }
    const recovery = assets.filter((asset) =>
        /(?:^|\/)runtime(?:-|\.)[^/]*\.js$|(?:^|\/)runtime\.js$/u.test(
            asset.file,
        ),
    );
    assert.equal(
        recovery.length,
        1,
        'Exactly one independent recovery asset is required.',
    );
    within('Recovery asset raw', recovery[0].raw, limits.recoveryRaw);
    within('Recovery asset gzip', recovery[0].gzip, limits.recoveryGzip);
    return { passed: true, limits };
}
