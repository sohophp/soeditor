# Performance budgets

SoEditor 0.9 uses generous regression budgets, not cross-device performance
promises. The gate runs on every release candidate and fails on a large
regression while leaving room for shared CI hosts.

Run the deterministic Node integration measurements with:

```bash
pnpm test:performance
```

The Phase 33 reference run on Node 22.14 measured:

| Scenario           |                            Fixture | Reference |   Budget |
| ------------------ | ---------------------------------: | --------: | -------: |
| annotation mapping |            500 threads × 50 passes |  78.32 ms | 4,000 ms |
| canonical input    | 5,000 paragraphs × 20 replacements |   1.34 ms | 4,000 ms |
| projection updates |       3 adapters × 200 transitions |   7.62 ms | 4,000 ms |
| bounded recovery   |            10 complete recreations |   6.20 ms | 4,000 ms |
| startup/teardown   |                 100 Core instances |   2.54 ms | 4,000 ms |
| table operations   |           100 edits over 400 cells |  48.64 ms | 4,000 ms |

Chromium separately projects 1,000 real Visual paragraphs, applies a real
`beforeinput`, renders a 400-cell table, and repeats 20 Editor/Visual/UI
lifecycles. The per-operation guards are 4 seconds for large projection and
table insertion, 1 second for input, and 6 seconds for the repeated lifecycle.
The complete browser gate currently contains 122 scenarios.

Release bundle guards remain enforced by `pnpm test:release`: 1.35 MB raw and
430 kB gzip for the full direct-browser global, 10 kB CSS, 2 kB for the ESM
facade, and 1.04 MB for the largest Playground chunk. Narrow consumers have
independent 75 kB/100 kB tree-shaking guards.

These measurements do not claim constant-time editing, low-end-device targets,
memory bounds, or production latency. Applications should profile their actual
document shapes, plugins, framework render path, network, and storage adapters.
