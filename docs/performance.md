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

The same command runs with explicit GC enabled. After warm-up it creates and
destroys 2,000 additional Core editors, forces collection, and permits at most
16 MiB retained heap growth. The Phase 35 reference run retained 0.22 MiB. This
is a regression signal, not a proof of leak freedom or an application memory
budget.

Chromium separately projects 1,000 real Visual paragraphs, applies a real
`beforeinput`, renders a 400-cell table, and repeats 20 Editor/Visual/UI
lifecycles. The per-operation guards are 4 seconds for large projection and
table insertion, 1 second for input, and 6 seconds for the repeated lifecycle.
The complete Chromium browser gate currently contains 199 scenarios, plus six
desktop/mobile Chromium CMS qualification project runs.

Release bundle guards remain enforced by `pnpm test:release`: 2.25 MB raw and
665 kB gzip for the full direct-browser global, 31 kB CSS, 2 kB for the ESM
facade, and 1.08 MB for the largest Playground chunk. Phase 39 measured
1.355 MB / 432.45 kB after adding controlled multi-block formatting, nested
lists, and semantic-style policy; the ESM facade remained 1.39 kB and narrow
consumers remained about 32 kB. Narrow consumers retain independent 75 kB/100
kB tree-shaking guards. Phase 40 measured 1.364 MB / 435.75 kB after adding
the external paste classifier and deterministic CMS cleaner, so only the
full-global gzip guard moved from 435 kB to 438 kB; the other guards remain
unchanged.
Phase 41 measured 1.377 MB / 439.50 kB after adding upload task ownership and
complete structured-image properties. The full-global guards therefore move
to 1.39 MB/442 kB; CSS, ESM facade, Playground, and narrow-consumer guards are
unchanged.
Phase 42 measured 1.390 MB / 442.74 kB after adding complete link policy,
provider selection, and bounded CMS content objects. The full-global guards
therefore move to 1.40 MB/445 kB; every other release and tree-shaking guard is
unchanged.
Phase 43 measured 1.403 MB / 446.13 kB after adding table properties,
accessible column resizing, matrix-paste policy, and complete list boundary
behavior. The full-global guards therefore move to 1.42 MB/450 kB; CSS, ESM,
Playground, performance, and narrow-consumer guards remain unchanged.
Phase 44 currently measures 1.412 MB / 448.59 kB with 11.14 kB standalone CSS
after adding responsive keyboard toolbar behavior, contextual commands,
classic status projections, manual resizing, and maximize restoration. The
guards therefore move to 1.425 MB/452 kB and 12 kB CSS; ESM, Playground,
performance, and narrow-consumer guards remain unchanged.
Phase 45 currently measures 1.423 MB / 452.51 kB after adding isolated English,
Simplified Chinese, Traditional Chinese, custom RTL resources, embedded
accessibility help, and composition-session history boundaries. The
full-global guard therefore moves to 1.45 MB/460 kB; the CSS guard remains 12
kB and the other guards remain unchanged.
Phase 46 currently measures 1.429 MB / 454.24 kB after adding the optional save
workflow, localized command-backed save UI, revision/conflict state, and
coordinated leave protection. It remains within the existing 1.45 MB/460 kB
and 12 kB CSS guards.
Phase 47 currently measures 1.432 MB / 454.94 kB with 11.64 kB CSS after
qualifying CMS SDK exports, focused plugin templates/checks, and instance-scoped
theme/icon resources. The completed CMS showcase adds scoped production-table
controls, focus/selection states, and resize styling. It currently measures
1.432 MB / 455.02 kB with 14.12 kB CSS, so the CSS guard moves to 15 kB while
the JavaScript, ESM, Playground, performance, and narrow-consumer guards remain
unchanged. The release audit also requires the table-widget selector, tying the
additional budget to the shipped feature.

The current CMS editing pass measures 1.447 MB / 458.79 kB with 17.21 kB CSS
after adding contextual table tools, full-height CodeMirror, isolated preview,
two/three-pane workspaces, and the asset-manager dialog.
The CSS guard moves to 18 kB; JavaScript, ESM, Playground, performance, and
narrow-consumer guards remain unchanged.

The separated WYSIWYG projection, four-pane workspace, content-style presets,
rich table cells, video/email tools, and preview-client controls currently
measure 1.462 MB / 462.85 kB with 19.37 kB standalone CSS. The guards move to
1.50 MB/475 kB and 22 kB CSS. The ESM facade, Playground, performance, and
narrow-consumer guards remain unchanged.

The independent native-DOM WYSIWYG engine, native range preservation, direct
semantic table/aside/image rendering, and image property workflow currently
measure 1.517 MB / 479.00 kB with 23.06 kB standalone CSS. After reviewing that
feature-owned increase, the guards move to 1.54 MB/490 kB and 25 kB CSS. The
ESM facade, Playground, performance, and narrow-consumer guards remain
unchanged.

Canonical Unicode statistics, explicit editing-view arrangements, and
command-backed text color, background color, and font size currently measure
1.529 MB / 482.45 kB with 23.99 kB standalone
CSS. They remain inside the reviewed 1.54 MB / 490 kB / 25 kB guards, so this
pass does not expand a release budget.

The completed CMS/WYSIWYG feature set and isolated native-browser authoring
surface currently measure 2.214 MB / 649.71 kB with 29.11 kB standalone CSS.
After reviewing that feature-owned increase, the full-global guards move to
2.25 MB / 665 kB and the CSS guard moves to 31 kB. The minimal preset's narrow
Vite consumer now measures
82.78 kB because `UiPlugin` owns the expanded command-backed authoring controls;
its guard moves from 75 kB to 85 kB. The lazily loaded Preview/CodeMirror
Playground chunk now measures 1.062 MB and its reviewed guard moves from 1.04
MB to 1.08 MB. The ESM facade, performance, and other narrow-consumer guards
remain unchanged.

These measurements do not claim constant-time editing, low-end-device targets,
memory bounds, or production latency. Applications should profile their actual
document shapes, plugins, framework render path, network, and storage adapters.
